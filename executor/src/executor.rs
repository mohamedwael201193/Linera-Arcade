//! Crypto Round Resolution Executor
//!
//! ARCHITECTURE: Backend-driven resolution
//!
//! This executor:
//! - Fetches PENDING rounds from backend API (rounds that need resolution)
//! - Uses ChainClient to submit ResolveCryptoRound operations
//! - Notifies backend after successful on-chain resolution
//!
//! SINGLE SOURCE OF TRUTH:
//! - Backend database stores rounds with onchain_round_id
//! - Executor only resolves rounds the backend tells it to
//! - No guessing, no blind iteration
//!
//! Flow:
//! 1. Periodic timer fires
//! 2. Fetch pending rounds from GET /api/internal/pending-rounds
//! 3. For each pending round:
//!    - Fetch current price from Binance
//!    - Submit ResolveCryptoRound(onchain_round_id, end_price)
//! 4. On success, POST to /api/internal/resolve-round
//! 5. Backend updates DB

use std::time::Duration;

use anyhow::{Context, Result};
use linera_base::identifiers::ApplicationId;
use linera_core::{
    client::ChainClient,
    data_types::ClientOutcome,
    Environment,
};
use linera_execution::Operation;
use serde::Deserialize;
use tokio::time::interval;
use tokio_util::sync::CancellationToken;

use crate::config::ExecutorConfig;
use crate::price_oracle::PriceOracle;

/// Pending round from backend API
#[derive(Debug, Deserialize)]
struct PendingRound {
    onchain_round_id: u64,
    asset: String,
    start_price: u64,
    #[allow(dead_code)]
    start_time: String,
    #[allow(dead_code)]
    duration_secs: u64,
}

/// Backend API response for pending rounds
#[derive(Debug, Deserialize)]
struct PendingRoundsResponse {
    rounds: Vec<PendingRound>,
}

/// The crypto round resolution executor
///
/// Uses the Linera client library directly to execute operations on-chain.
/// Fetches pending rounds from backend rather than guessing IDs.
pub struct CryptoRoundExecutor<Env: Environment> {
    /// Configuration
    config: ExecutorConfig,
    
    /// The chain client for the hub chain
    chain_client: ChainClient<Env>,
    
    /// Application ID for the arcade hub
    application_id: ApplicationId,
    
    /// Price oracle for fetching BTC/ETH prices
    price_oracle: PriceOracle,
    
    /// Cancellation token for graceful shutdown
    cancellation_token: CancellationToken,
    
    /// Track which on-chain round IDs we've successfully resolved
    resolved_rounds: std::collections::HashSet<u64>,
    
    /// HTTP client for backend API
    http_client: reqwest::Client,
}

impl<Env: Environment + 'static> CryptoRoundExecutor<Env> {
    /// Create a new executor with a chain client
    pub fn new(
        config: ExecutorConfig,
        chain_client: ChainClient<Env>,
    ) -> Result<Self> {
        let application_id: ApplicationId = config.application_id.parse()
            .context("Invalid application ID")?;

        tracing::info!("✅ Executor initialized (backend-driven mode)");
        tracing::info!("   Hub chain: {}...", &config.hub_chain_id[..16]);
        tracing::info!("   Application: {}...", &config.application_id[..16]);
        if let Some(ref url) = config.backend_url {
            tracing::info!("   Backend URL: {}", url);
        } else {
            tracing::warn!("   ⚠️ No BACKEND_URL set - executor will not fetch pending rounds!");
        }

        Ok(Self {
            config,
            chain_client,
            application_id,
            price_oracle: PriceOracle::new(),
            cancellation_token: CancellationToken::new(),
            resolved_rounds: std::collections::HashSet::new(),
            http_client: reqwest::Client::new(),
        })
    }

    /// Run the resolution loop
    pub async fn run(mut self) -> Result<()> {
        let mut interval = interval(Duration::from_secs(self.config.resolution_interval_secs));
        
        tracing::info!(
            "🔁 Starting resolution loop (interval: {}s)",
            self.config.resolution_interval_secs
        );

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    if let Err(e) = self.try_resolve_pending_rounds().await {
                        tracing::error!("Resolution cycle failed: {}", e);
                    }
                }
                _ = self.cancellation_token.cancelled() => {
                    tracing::info!("Shutdown signal received, stopping executor...");
                    break;
                }
                _ = tokio::signal::ctrl_c() => {
                    tracing::info!("Ctrl+C received, shutting down...");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Fetch pending rounds from backend and try to resolve them
    async fn try_resolve_pending_rounds(&mut self) -> Result<()> {
        let Some(backend_url) = &self.config.backend_url else {
            tracing::debug!("BACKEND_URL not set, skipping resolution cycle");
            return Ok(());
        };

        // Fetch pending rounds from backend
        let pending_rounds = match self.fetch_pending_rounds(backend_url).await {
            Ok(rounds) => rounds,
            Err(e) => {
                tracing::warn!("⚠️ Failed to fetch pending rounds: {}", e);
                return Ok(()); // Don't fail the cycle
            }
        };
        
        if pending_rounds.is_empty() {
            tracing::debug!("📭 No pending rounds to resolve");
            return Ok(());
        }

        tracing::info!("🔄 Found {} pending round(s) to resolve", pending_rounds.len());

        // Fetch current prices once per cycle
        let btc_price = self.price_oracle.get_btc_price().await.unwrap_or(9500000);
        let eth_price = self.price_oracle.get_eth_price().await.unwrap_or(330000);
        
        tracing::info!(
            "📈 Current prices: BTC=${:.2}, ETH=${:.2}",
            btc_price as f64 / 100.0,
            eth_price as f64 / 100.0
        );

        let mut resolved_count = 0;

        for round in pending_rounds {
            let onchain_id = round.onchain_round_id;
            
            // Skip if already resolved this session
            if self.resolved_rounds.contains(&onchain_id) {
                tracing::debug!("⏭️ Round {} already resolved this session", onchain_id);
                continue;
            }

            // Select price based on asset
            let end_price = match round.asset.to_uppercase().as_str() {
                "BTC" => btc_price,
                "ETH" => eth_price,
                _ => {
                    tracing::warn!("Unknown asset: {}", round.asset);
                    continue;
                }
            };

            tracing::info!(
                "🎯 Resolving on-chain round {} ({}) at price {} cents",
                onchain_id,
                round.asset,
                end_price
            );

            match self.try_resolve_round(onchain_id, end_price).await {
                Ok(true) => {
                    tracing::info!(
                        "✅ Round {} RESOLVED on-chain (price: {} cents)",
                        onchain_id,
                        end_price
                    );
                    self.resolved_rounds.insert(onchain_id);
                    resolved_count += 1;
                    
                    // Notify backend
                    self.notify_backend(onchain_id, &round.asset, end_price, round.start_price).await;
                }
                Ok(false) => {
                    tracing::debug!("⏳ Round {} not ready (contract rejected)", onchain_id);
                }
                Err(e) => {
                    tracing::warn!("⚠️ Error resolving round {}: {}", onchain_id, e);
                }
            }
        }

        if resolved_count > 0 {
            tracing::info!("📊 Resolved {} round(s) this cycle", resolved_count);
        }

        Ok(())
    }

    /// Fetch pending rounds from backend API
    async fn fetch_pending_rounds(&self, backend_url: &str) -> Result<Vec<PendingRound>> {
        let url = format!("{}/api/internal/pending-rounds", backend_url.trim_end_matches('/'));
        
        let response = self.http_client
            .get(&url)
            .timeout(Duration::from_secs(10))
            .send()
            .await
            .context("Failed to fetch pending rounds")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Backend returned {}: {}", status, body);
        }

        let data: PendingRoundsResponse = response.json().await
            .context("Failed to parse pending rounds response")?;

        Ok(data.rounds)
    }

    /// Try to resolve a single round on-chain
    /// 
    /// Returns:
    /// - Ok(true) if operation committed (round was resolved)
    /// - Ok(false) if operation was rejected by contract
    /// - Err if network/serialization error
    async fn try_resolve_round(&self, round_id: u64, end_price: u64) -> Result<bool> {
        let operation = self.create_resolve_operation(round_id, end_price)?;

        let result = self.chain_client
            .execute_operation(operation)
            .await;

        match result {
            Ok(ClientOutcome::Committed(certificate)) => {
                tracing::info!(
                    "🔗 Operation committed in block: {}",
                    certificate.hash()
                );
                Ok(true)
            }
            Ok(ClientOutcome::WaitForTimeout(timeout)) => {
                tracing::debug!(
                    "⏳ Operation pending until: {:?}",
                    timeout.timestamp
                );
                Ok(false)
            }
            Err(e) => {
                let err_str = e.to_string();
                // Expected rejections from contract
                if err_str.contains("Round not expired")
                    || err_str.contains("Round not found")
                    || err_str.contains("Round already resolved")
                    || err_str.contains("application execution")
                    || err_str.contains("ExecutionError")
                {
                    tracing::debug!("Contract rejected round {}: {}", round_id, err_str);
                    Ok(false)
                } else {
                    Err(e.into())
                }
            }
        }
    }

    /// Create a ResolveCryptoRound operation
    fn create_resolve_operation(&self, round_id: u64, end_price: u64) -> Result<Operation> {
        #[derive(serde::Serialize)]
        #[allow(dead_code)]
        enum CryptoResolutionOp {
            _Reserved0,  // Index 0: RegisterPlayer
            _Reserved1,  // Index 1: SubmitScore
            _Reserved2,  // Index 2: UpdateUsername
            _Reserved3,  // Index 3: ClaimDailyBonus
            _Reserved4,  // Index 4: CreateCryptoRound
            _Reserved5,  // Index 5: PlaceCryptoPrediction
            ResolveCryptoRound { round_id: u64, end_price: u64 }, // Index 6
        }

        let op = CryptoResolutionOp::ResolveCryptoRound {
            round_id,
            end_price,
        };

        let bytes = bcs::to_bytes(&op)
            .context("Failed to serialize operation")?;

        Ok(Operation::User {
            application_id: self.application_id,
            bytes,
        })
    }

    /// Notify the backend about a resolved round
    async fn notify_backend(&self, round_id: u64, asset: &str, end_price: u64, start_price: u64) {
        let Some(backend_url) = &self.config.backend_url else {
            return;
        };

        let url = format!("{}/api/internal/resolve-round", backend_url.trim_end_matches('/'));
        
        // Determine winning direction based on price comparison
        let winning_direction = if end_price > start_price { "UP" } else { "DOWN" };
        
        let payload = serde_json::json!({
            "round_id": round_id,
            "asset": asset,
            "end_price": end_price,
            "winning_direction": winning_direction,
            "resolved_at": chrono::Utc::now().to_rfc3339(),
        });

        tracing::info!("📤 Notifying backend: {} round {} resolved ({})", asset, round_id, winning_direction);
        
        match self.http_client
            .post(&url)
            .json(&payload)
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    tracing::info!("✅ Backend notified successfully for round {}", round_id);
                } else {
                    let status = response.status();
                    let body = response.text().await.unwrap_or_default();
                    tracing::warn!(
                        "⚠️ Backend returned {} for round {}: {}",
                        status,
                        round_id,
                        body
                    );
                }
            }
            Err(e) => {
                tracing::warn!("⚠️ Failed to notify backend for round {}: {}", round_id, e);
            }
        }
    }
}
