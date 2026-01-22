//! Configuration for the executor

use anyhow::{anyhow, Result};
use std::env;
use std::path::PathBuf;

/// Executor configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct ExecutorConfig {
    /// Path to Linera wallet file
    pub wallet_path: PathBuf,
    
    /// Hub chain ID where the application is deployed
    pub hub_chain_id: String,
    
    /// Application ID of the Arcade Hub contract
    pub application_id: String,
    
    /// Faucet URL for network genesis config
    pub faucet_url: String,
    
    /// Resolution check interval in seconds
    pub resolution_interval_secs: u64,
    
    /// Database URL for querying expired rounds (optional)
    /// If not set, queries on-chain state directly
    pub database_url: Option<String>,
    
    /// Backend URL for notifying resolved rounds
    /// Executor POSTs to {backend_url}/api/internal/resolve-round
    pub backend_url: Option<String>,
}

impl ExecutorConfig {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        // Required variables
        let wallet_path = env::var("LINERA_WALLET_PATH")
            .map(PathBuf::from)
            .unwrap_or_else(|_| {
                // Default to ~/.config/linera/wallet.json (standard Linera location)
                dirs::config_dir()
                    .map(|h| h.join("linera").join("wallet.json"))
                    .unwrap_or_else(|| PathBuf::from("wallet.json"))
            });

        let hub_chain_id = env::var("HUB_CHAIN_ID")
            .or_else(|_| env::var("VITE_HUB_CHAIN_ID"))
            .map_err(|_| anyhow!("HUB_CHAIN_ID environment variable is required"))?;

        let application_id = env::var("APPLICATION_ID")
            .or_else(|_| env::var("VITE_APPLICATION_ID"))
            .map_err(|_| anyhow!("APPLICATION_ID environment variable is required"))?;

        let faucet_url = env::var("LINERA_FAUCET_URL")
            .or_else(|_| env::var("VITE_LINERA_FAUCET_URL"))
            .unwrap_or_else(|_| "https://faucet.testnet-conway.linera.net".to_string());

        let resolution_interval_secs = env::var("RESOLUTION_INTERVAL_SECS")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(10); // Default: check every 10 seconds

        let database_url = env::var("DATABASE_URL").ok();
        
        let backend_url = env::var("BACKEND_URL").ok();

        Ok(Self {
            wallet_path,
            hub_chain_id,
            application_id,
            faucet_url,
            resolution_interval_secs,
            database_url,
            backend_url,
        })
    }
}
