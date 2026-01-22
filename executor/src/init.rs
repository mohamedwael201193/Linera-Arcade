//! Initialization module - Sets up Linera ClientContext and ChainClient
//!
//! This module handles the initialization of the Linera client following
//! the patterns from linera-client and linera-faucet.
//!
//! ## Key Components
//!
//! 1. **Storage**: RocksDB or ServiceStorage backend
//! 2. **Wallet**: Loaded from file (JSON format)
//! 3. **Signer**: InMemorySigner with the private key
//! 4. **ClientContext**: The main client context
//! 5. **ChainClient**: For executing operations on a specific chain
//!
//! ## Setup Requirements
//!
//! Before running the executor, ensure:
//!
//! 1. Wallet is initialized with a chain that has signing authority:
//!    ```bash
//!    export LINERA_WALLET="$HOME/.linera/wallet.json"
//!    export LINERA_KEYSTORE="$HOME/.linera/keystore.json"
//!    export LINERA_STORAGE="rocksdb:$HOME/.linera/client.db"
//!    linera wallet init --faucet https://faucet.testnet-conway.linera.net
//!    linera wallet request-chain --faucet https://faucet.testnet-conway.linera.net
//!    ```
//!
//! 2. The wallet must have authority to sign operations on the hub chain

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use anyhow::{Context, Result};
use linera_base::{
    crypto::InMemorySigner,
    identifiers::ChainId,
};
use linera_client::{
    client_context::ClientContext,
    client_options::Options,
    config::GenesisConfig,
};
use linera_core::client::{ChainClient, Client};
use linera_rpc::node_provider::{NodeOptions, NodeProvider};
use linera_storage::Storage;

use crate::config::ExecutorConfig;

/// Default block cache size
const BLOCK_CACHE_SIZE: usize = 5000;
/// Default execution state cache size
const EXECUTION_STATE_CACHE_SIZE: usize = 10000;

/// Environment type alias for our client
pub type ExecutorEnvironment<S> = linera_core::environment::Impl<S, NodeProvider, InMemorySigner, WalletState>;

/// Wallet state type - Using Memory wallet but populated from file
pub type WalletState = linera_core::wallet::Memory;

/// Wallet file structure (matches the Linera CLI wallet.json format)
#[derive(serde::Deserialize)]
struct WalletFile {
    chains: std::collections::HashMap<String, WalletChainInfo>,
    default: Option<String>,
    genesis_config: serde_json::Value, // We already fetch this from faucet
}

#[derive(serde::Deserialize)]
struct WalletChainInfo {
    owner: Option<String>,
    block_hash: Option<String>,
    next_block_height: u64,
    timestamp: u64,
    pending_proposal: Option<serde_json::Value>,
    epoch: Option<String>,
}

/// Load wallet from file and populate a Memory wallet
pub fn load_wallet_from_file(path: &std::path::Path) -> Result<WalletState> {
    use linera_base::data_types::{BlockHeight, Timestamp};
    use linera_base::identifiers::AccountOwner;
    use linera_core::wallet::Chain;
    
    let contents = std::fs::read_to_string(path)
        .context("Failed to read wallet file")?;
    let wallet_file: WalletFile = serde_json::from_str(&contents)
        .context("Failed to parse wallet file")?;
    
    let wallet = WalletState::default();
    
    for (chain_id_str, chain_info) in wallet_file.chains {
        let chain_id: ChainId = chain_id_str.parse()
            .context(format!("Invalid chain ID: {}", chain_id_str))?;
        
        let owner = if let Some(owner_str) = &chain_info.owner {
            Some(owner_str.parse::<AccountOwner>()
                .context(format!("Invalid owner: {}", owner_str))?)
        } else {
            None
        };
        
        let block_hash = if let Some(hash_str) = &chain_info.block_hash {
            Some(hash_str.parse()
                .context(format!("Invalid block hash: {}", hash_str))?)
        } else {
            None
        };
        
        let epoch = if let Some(epoch_str) = &chain_info.epoch {
            Some(epoch_str.parse()
                .context(format!("Invalid epoch: {}", epoch_str))?)
        } else {
            None
        };
        
        let chain = Chain {
            owner,
            block_hash,
            next_block_height: BlockHeight(chain_info.next_block_height),
            timestamp: Timestamp::from(chain_info.timestamp),
            pending_proposal: None, // We don't need pending proposals for the executor
            epoch,
        };
        
        wallet.insert(chain_id, chain);
    }
    
    tracing::info!("✅ Wallet loaded with {} chains", wallet.chain_ids().len());
    
    Ok(wallet)
}

/// Initialize the Linera client and return a ChainClient for the hub chain
///
/// This follows the patterns from:
/// - linera-service/tests/wallet.rs (test client context creation)
/// - linera-client/src/client_context.rs (ClientContext::new)
/// - linera-faucet/server/src/lib.rs (FaucetService initialization)
pub async fn create_chain_client<S>(
    config: &ExecutorConfig,
    storage: S,
    wallet: WalletState,
    signer: InMemorySigner,
    genesis_config: GenesisConfig,
) -> Result<ChainClient<ExecutorEnvironment<S>>>
where
    S: Storage + Clone + Send + Sync + 'static,
{
    tracing::info!("🔧 Initializing Linera client...");

    // Parse the hub chain ID
    let hub_chain_id: ChainId = config.hub_chain_id.parse()
        .context("Invalid hub chain ID")?;

    // Verify that the wallet has the hub chain
    let chain_ids = wallet.chain_ids();
    if !chain_ids.contains(&hub_chain_id) {
        anyhow::bail!(
            "Wallet does not contain hub chain {}. Available chains: {:?}",
            hub_chain_id,
            chain_ids
        );
    }

    // Create node options for RPC communication
    let node_options = NodeOptions {
        send_timeout: Duration::from_secs(30),
        recv_timeout: Duration::from_secs(30),
        retry_delay: Duration::from_millis(1000),
        max_retries: 10,
    };

    // Create the node provider for validator communication
    let node_provider = NodeProvider::new(node_options);

    // Get tracked chains from wallet
    let tracked_chains: Vec<ChainId> = wallet.chain_ids();

    // Create the environment
    let environment = linera_core::environment::Impl {
        storage: storage.clone(),
        network: node_provider,
        signer,
        wallet: wallet.clone(),
    };

    // Create the core client (using 0.15.8 API - 9 arguments)
    // ChainClientOptions doesn't have Default, so we construct it manually
    use linera_core::client::{BlanketMessagePolicy, MessagePolicy};
    use linera_core::node::CrossChainMessageDelivery;
    
    let chain_client_options = linera_core::client::ChainClientOptions {
        max_pending_message_bundles: 10,
        message_policy: MessagePolicy::new(
            BlanketMessagePolicy::Accept,
            None, // restrict_chain_ids_to
            None, // reject_message_bundles_without_application_ids
            None, // reject_message_bundles_with_other_application_ids
        ),
        cross_chain_message_delivery: CrossChainMessageDelivery::NonBlocking,
        quorum_grace_period: 0.2,
        blob_download_timeout: Duration::from_secs(30),
        certificate_batch_download_timeout: Duration::from_secs(30),
        certificate_download_batch_size: 500,
        sender_certificate_download_batch_size: 20_000,
        max_joined_tasks: 100,
    };
    
    let client = Arc::new(Client::new(
        environment,
        genesis_config.admin_id(),
        false, // long_lived_services
        tracked_chains,
        format!("Arcade Executor for {:.8}", hub_chain_id),
        Duration::from_secs(30),  // chain_worker_ttl
        Duration::from_secs(1),   // sender_chain_worker_ttl
        chain_client_options,
        linera_core::client::requests_scheduler::RequestsSchedulerConfig::default(),
    ));

    // Get the chain info from the wallet
    let chain = wallet.get(hub_chain_id).unwrap_or_default();
    
    tracing::info!("📋 Chain info: owner={:?}, block_hash={:?}, height={}",
        chain.owner, chain.block_hash, chain.next_block_height);

    // Create the chain client for the hub chain (0.15.8 API - 6 arguments)
    let chain_client = client.create_chain_client(
        hub_chain_id,
        chain.block_hash,
        chain.next_block_height,
        chain.pending_proposal,
        chain.owner,
        None, // timing_sender
    );

    tracing::info!("✅ Chain client created for hub chain");

    // Synchronize with validators to get latest state
    tracing::info!("📡 Synchronizing with validators...");
    chain_client.synchronize_from_validators().await
        .context("Failed to synchronize with validators")?;

    tracing::info!("✅ Linera client initialized and synchronized");

    Ok(chain_client)
}

/// Load the genesis configuration from the faucet
pub async fn fetch_genesis_config(faucet_url: &str) -> Result<GenesisConfig> {
    tracing::info!("📡 Fetching genesis config from faucet: {}", faucet_url);
    
    // Use the linera-faucet-client pattern
    let client = reqwest::Client::new();
    
    // GraphQL query to get genesis config
    let query = r#"{"query": "query { genesisConfig }"}"#;
    
    let response = client
        .post(faucet_url)
        .header("Content-Type", "application/json")
        .body(query)
        .send()
        .await
        .context("Failed to connect to faucet")?;

    if !response.status().is_success() {
        anyhow::bail!("Faucet returned status {}", response.status());
    }

    #[derive(serde::Deserialize)]
    struct GraphQLResponse {
        data: GenesisConfigData,
    }
    
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct GenesisConfigData {
        genesis_config: GenesisConfig,
    }

    let response: GraphQLResponse = response.json().await
        .context("Failed to parse genesis config response")?;

    tracing::info!("✅ Genesis config loaded (admin chain: {})", response.data.genesis_config.admin_id());
    
    Ok(response.data.genesis_config)
}

/// Load the signer from the keystore file
pub fn load_signer(keystore_path: &Path) -> Result<InMemorySigner> {
    tracing::info!("🔑 Loading signer from {:?}", keystore_path);
    
    let keystore_data = std::fs::read_to_string(keystore_path)
        .context("Failed to read keystore file")?;
    
    let signer: InMemorySigner = serde_json::from_str(&keystore_data)
        .context("Failed to parse keystore JSON")?;
    
    tracing::info!("✅ Signer loaded");
    
    Ok(signer)
}

/// Get the default wallet path
pub fn get_wallet_path() -> Result<PathBuf> {
    // Check environment variable
    if let Ok(path) = std::env::var("LINERA_WALLET") {
        let path = PathBuf::from(path);
        if path.exists() {
            return Ok(path);
        }
    }
    
    // Default to ~/.config/linera/wallet.json (standard Linera v0.15 location)
    let config_dir = dirs::config_dir()
        .context("Could not determine config directory")?;
    let default_path = config_dir.join("linera").join("wallet.json");
    
    if default_path.exists() {
        return Ok(default_path);
    }
    
    // Fallback to ~/.linera/wallet.json (older location)
    let home = dirs::home_dir()
        .context("Could not determine home directory")?;
    let legacy_path = home.join(".linera").join("wallet.json");
    
    if legacy_path.exists() {
        return Ok(legacy_path);
    }
    
    anyhow::bail!(
        "Could not find wallet file. Tried:\n  - $LINERA_WALLET\n  - {}\n  - {}",
        default_path.display(),
        legacy_path.display()
    );
}

/// Get the default keystore path
pub fn get_keystore_path() -> Result<PathBuf> {
    // Check environment variable
    if let Ok(path) = std::env::var("LINERA_KEYSTORE") {
        return Ok(PathBuf::from(path));
    }
    
    // Default to ~/.config/linera/keystore.json (standard Linera location)
    let config_dir = dirs::config_dir()
        .context("Could not determine config directory")?;
    Ok(config_dir.join("linera").join("keystore.json"))
}

/// Get the storage configuration
pub fn get_storage_config() -> Result<String> {
    // Check environment variable
    if let Ok(storage) = std::env::var("LINERA_STORAGE") {
        return Ok(storage);
    }
    
    // Default to rocksdb in ~/.linera
    let home = dirs::home_dir()
        .context("Could not determine home directory")?;
    let db_path = home.join(".linera").join("client.db");
    Ok(format!("rocksdb:{}", db_path.display()))
}
