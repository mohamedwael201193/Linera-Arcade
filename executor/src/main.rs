//! Linera Arcade Hub - On-Chain Resolution Executor
//!
//! This is a backend service that resolves crypto prediction rounds on-chain.
//! It uses the linera-client library directly (same pattern as the Linera Faucet).
//!
//! ## Architecture
//!
//! ```text
//! [Executor Timer Loop]
//!   └─ Detects expired round (queries on-chain state)
//!   └─ Fetches BTC/ETH price (Coinbase API)
//!   └─ Signs & executes ResolveCryptoRound operation via ChainClient
//!          ↓
//! [Linera Blockchain]
//!   └─ Contract handles ResolveCryptoRound
//!   └─ Computes winners
//!   └─ Pays coins to winners
//!   └─ Updates state
//!          ↓
//! [Frontend (Vercel)]
//!   └─ Reads state only (no mutations for resolution)
//! ```
//!
//! ## Key Design Decisions
//!
//! 1. **No HTTP service**: This executor does NOT expose any ports
//! 2. **Direct Linera client**: Uses `ChainClient::execute_operation` like the Faucet
//! 3. **Self-contained**: Runs independently of the Node.js backend
//! 4. **Production-safe**: Same pattern used by official Linera services
//!
//! ## Prerequisites
//!
//! Before running, ensure you have:
//! 1. Wallet initialized: `linera wallet init --faucet <URL>`
//! 2. A chain with signing authority: `linera wallet request-chain --faucet <URL>`
//!
//! ## Environment Variables
//!
//! ```bash
//! export HUB_CHAIN_ID="925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44"
//! export APPLICATION_ID="6c827a8df45212cdc97eaca2d286f4608511e632396dd6fea7783ef83d573782"
//! export LINERA_WALLET="$HOME/.linera/wallet.json"
//! export LINERA_KEYSTORE="$HOME/.linera/keystore.json"
//! export FAUCET_URL="https://faucet.testnet-conway.linera.net"
//! ```

mod config;
mod executor;
mod init;
mod price_oracle;
mod types;
mod wallet_loader;

use anyhow::{Context, Result};
use linera_storage::DbStorage;
use linera_views::memory::{MemoryDatabase, MemoryStoreConfig};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

/// Type alias for in-memory storage
pub type MemoryStorage = DbStorage<MemoryDatabase, linera_storage::WallClock>;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize TLS crypto provider first (required before any network calls)
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    // Initialize logging
    tracing_subscriber::registry()
        .with(EnvFilter::try_from_default_env().unwrap_or_else(|_| {
            EnvFilter::new("arcade_executor=info,linera_client=warn,linera_core=warn")
        }))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("🎮 Linera Arcade Executor starting...");
    tracing::info!("   Version: {}", env!("CARGO_PKG_VERSION"));

    // Load configuration
    dotenv::dotenv().ok();
    let config = config::ExecutorConfig::from_env()?;
    
    tracing::info!("📋 Configuration loaded:");
    tracing::info!("   Hub Chain ID: {}...", &config.hub_chain_id[..16.min(config.hub_chain_id.len())]);
    tracing::info!("   Application ID: {}...", &config.application_id[..16.min(config.application_id.len())]);
    tracing::info!("   Faucet URL: {}", config.faucet_url);
    tracing::info!("   Resolution interval: {}s", config.resolution_interval_secs);

    // === WALLET LOADING (PRODUCTION-SAFE) ===
    // This handles both:
    // - Production (Render): Load wallet from LINERA_WALLET_JSON / LINERA_KEYSTORE_JSON env vars
    // - Development (Local): Use existing wallet files on disk
    tracing::info!("🔐 Loading wallet credentials...");
    let wallet_result = wallet_loader::load_wallet()
        .context("Failed to load wallet credentials")?;
    tracing::info!("   ✅ Wallet loaded from {}", wallet_result.source);

    // Load the signer from keystore (now using wallet_result paths)
    tracing::info!("🔑 Loading signer from {:?}", wallet_result.keystore_path);
    let signer = init::load_signer(&wallet_result.keystore_path)?;

    // Fetch genesis config from faucet
    tracing::info!("📡 Fetching genesis config from faucet...");
    let genesis_config = init::fetch_genesis_config(&config.faucet_url).await?;

    // Load wallet from file (contains chain ownership info)
    tracing::info!("📂 Loading wallet from {:?}", wallet_result.wallet_path);
    let wallet = init::load_wallet_from_file(&wallet_result.wallet_path)?;

    // Create in-memory storage (same pattern as web/@linera/client)
    tracing::info!("📦 Creating in-memory storage backend...");
    let storage_config = MemoryStoreConfig {
        max_stream_queries: 10,
        kill_on_drop: false,
    };
    
    let mut storage: MemoryStorage = DbStorage::maybe_create_and_connect(
        &storage_config,
        "arcade_executor",
        Some(linera_execution::WasmRuntime::Wasmer), // Required for application interaction
    ).await?;

    // Initialize storage with genesis config
    tracing::info!("🔧 Initializing storage with genesis config...");
    genesis_config.initialize_storage(&mut storage).await?;
    
    tracing::info!("✅ Storage initialized");

    // Create the chain client
    tracing::info!("🔗 Creating chain client for hub chain...");
    let chain_client = init::create_chain_client(
        &config,
        storage,
        wallet,
        signer,
        genesis_config,
    ).await?;

    // Create and run the executor
    tracing::info!("🚀 Starting crypto round executor...");
    let executor = executor::CryptoRoundExecutor::new(config, chain_client)?;
    
    // Run the executor loop (this blocks)
    executor.run().await
}
