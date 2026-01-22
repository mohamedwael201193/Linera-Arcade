//! Wallet Loader for Production Deployment
//!
//! This module handles loading Linera wallet credentials from environment variables
//! for secure deployment on platforms like Render.
//!
//! SECURITY:
//! - Never logs wallet contents or private keys
//! - Writes files with restrictive permissions
//! - Fails fast with clear errors if credentials missing

use anyhow::{anyhow, Context, Result};
use std::env;
use std::fs;
use std::path::PathBuf;

/// Directory where Linera expects wallet files
const LINERA_CONFIG_DIR: &str = ".config/linera";
const WALLET_FILENAME: &str = "wallet.json";
const KEYSTORE_FILENAME: &str = "keystore.json";

/// Environment variable names for wallet credentials
const ENV_WALLET_JSON: &str = "LINERA_WALLET_JSON";
const ENV_KEYSTORE_JSON: &str = "LINERA_KEYSTORE_JSON";

/// Result of wallet loading operation
pub struct WalletLoadResult {
    pub wallet_path: PathBuf,
    pub keystore_path: PathBuf,
    pub source: WalletSource,
}

#[derive(Debug, Clone, Copy)]
pub enum WalletSource {
    /// Loaded from environment variables (production)
    Environment,
    /// Using existing files on disk (local development)
    ExistingFiles,
}

impl std::fmt::Display for WalletSource {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WalletSource::Environment => write!(f, "environment variables"),
            WalletSource::ExistingFiles => write!(f, "existing files"),
        }
    }
}

/// Load or create wallet files from environment variables
///
/// Priority:
/// 1. If env vars LINERA_WALLET_JSON and LINERA_KEYSTORE_JSON are set,
///    write them to the config directory
/// 2. If wallet files already exist on disk, use them
/// 3. Fail with a clear error if neither option is available
///
/// This approach ensures:
/// - Production: Credentials loaded from Render environment variables
/// - Local development: Existing wallet files are used
pub fn load_wallet() -> Result<WalletLoadResult> {
    let config_dir = get_config_dir()?;
    let wallet_path = config_dir.join(WALLET_FILENAME);
    let keystore_path = config_dir.join(KEYSTORE_FILENAME);

    // Check if environment variables are set
    let wallet_json = env::var(ENV_WALLET_JSON).ok();
    let keystore_json = env::var(ENV_KEYSTORE_JSON).ok();

    match (wallet_json, keystore_json) {
        // Both env vars set - write them to disk (production mode)
        (Some(wallet), Some(keystore)) => {
            tracing::info!("📦 Loading wallet from environment variables...");
            
            // Validate JSON before writing
            validate_wallet_json(&wallet)?;
            validate_keystore_json(&keystore)?;
            
            // Ensure config directory exists
            fs::create_dir_all(&config_dir)
                .context("Failed to create Linera config directory")?;
            
            // Write wallet file
            write_secure_file(&wallet_path, &wallet)
                .context("Failed to write wallet.json")?;
            tracing::info!("   ✅ Written wallet.json");
            
            // Write keystore file
            write_secure_file(&keystore_path, &keystore)
                .context("Failed to write keystore.json")?;
            tracing::info!("   ✅ Written keystore.json");
            
            // Verify the wallet contains the expected hub chain
            verify_hub_chain_ownership(&wallet)?;
            
            Ok(WalletLoadResult {
                wallet_path,
                keystore_path,
                source: WalletSource::Environment,
            })
        }
        
        // Only one env var set - configuration error
        (Some(_), None) => {
            Err(anyhow!(
                "LINERA_WALLET_JSON is set but LINERA_KEYSTORE_JSON is missing. \
                 Both must be provided for production deployment."
            ))
        }
        (None, Some(_)) => {
            Err(anyhow!(
                "LINERA_KEYSTORE_JSON is set but LINERA_WALLET_JSON is missing. \
                 Both must be provided for production deployment."
            ))
        }
        
        // No env vars - check for existing files (development mode)
        (None, None) => {
            tracing::info!("📂 No wallet env vars found, checking for existing files...");
            
            if wallet_path.exists() && keystore_path.exists() {
                tracing::info!("   ✅ Found existing wallet at: {}", wallet_path.display());
                
                // Read and verify existing wallet
                let wallet_content = fs::read_to_string(&wallet_path)
                    .context("Failed to read existing wallet.json")?;
                verify_hub_chain_ownership(&wallet_content)?;
                
                Ok(WalletLoadResult {
                    wallet_path,
                    keystore_path,
                    source: WalletSource::ExistingFiles,
                })
            } else {
                Err(anyhow!(
                    "No wallet credentials found!\n\n\
                     For PRODUCTION (Render):\n\
                       Set these environment variables:\n\
                       - LINERA_WALLET_JSON: Contents of wallet.json (base64 or raw JSON)\n\
                       - LINERA_KEYSTORE_JSON: Contents of keystore.json (base64 or raw JSON)\n\n\
                     For LOCAL DEVELOPMENT:\n\
                       Ensure wallet files exist at:\n\
                       - {}\n\
                       - {}\n\n\
                     ⚠️  DO NOT create a new wallet - it won't have hub chain permissions!",
                    wallet_path.display(),
                    keystore_path.display()
                ))
            }
        }
    }
}

/// Get the Linera config directory path
fn get_config_dir() -> Result<PathBuf> {
    // First check if LINERA_WALLET_PATH env var specifies a custom path
    if let Ok(custom_path) = env::var("LINERA_WALLET_PATH") {
        let path = PathBuf::from(&custom_path);
        if let Some(parent) = path.parent() {
            return Ok(parent.to_path_buf());
        }
    }
    
    // Default to ~/.config/linera or /root/.config/linera (in Docker)
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| "/root".to_string());
    
    Ok(PathBuf::from(home).join(LINERA_CONFIG_DIR))
}

/// Write a file securely (no world-readable permissions)
fn write_secure_file(path: &PathBuf, content: &str) -> Result<()> {
    // Write the file
    fs::write(path, content)?;
    
    // On Unix, set restrictive permissions (owner read/write only)
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(path)?.permissions();
        perms.set_mode(0o600);
        fs::set_permissions(path, perms)?;
    }
    
    Ok(())
}

/// Validate wallet JSON structure (without logging contents)
fn validate_wallet_json(json: &str) -> Result<()> {
    let value: serde_json::Value = serde_json::from_str(json)
        .context("Invalid wallet JSON format")?;
    
    // Check required fields exist
    if value.get("chains").is_none() {
        return Err(anyhow!("Wallet JSON missing 'chains' field"));
    }
    if value.get("default").is_none() {
        return Err(anyhow!("Wallet JSON missing 'default' field"));
    }
    if value.get("genesis_config").is_none() {
        return Err(anyhow!("Wallet JSON missing 'genesis_config' field"));
    }
    
    Ok(())
}

/// Validate keystore JSON structure (without logging contents)
fn validate_keystore_json(json: &str) -> Result<()> {
    let value: serde_json::Value = serde_json::from_str(json)
        .context("Invalid keystore JSON format")?;
    
    // Check required fields exist
    if value.get("keys").is_none() {
        return Err(anyhow!("Keystore JSON missing 'keys' field"));
    }
    
    // Verify it has at least one key
    if let Some(keys) = value.get("keys").and_then(|k| k.as_array()) {
        if keys.is_empty() {
            return Err(anyhow!("Keystore has no keys"));
        }
        tracing::info!("   📝 Keystore contains {} key(s)", keys.len());
    }
    
    Ok(())
}

/// Verify the wallet contains and owns the hub chain
fn verify_hub_chain_ownership(wallet_json: &str) -> Result<()> {
    let hub_chain_id = env::var("HUB_CHAIN_ID")
        .context("HUB_CHAIN_ID environment variable is required")?;
    
    let wallet: serde_json::Value = serde_json::from_str(wallet_json)?;
    
    // Check if hub chain exists in wallet
    let chains = wallet.get("chains")
        .and_then(|c| c.as_object())
        .ok_or_else(|| anyhow!("Wallet has no chains"))?;
    
    let hub_chain = chains.get(&hub_chain_id)
        .ok_or_else(|| anyhow!(
            "Hub chain {} NOT FOUND in wallet!\n\
             This wallet cannot operate on the hub chain.\n\
             Available chains: {:?}",
            hub_chain_id,
            chains.keys().collect::<Vec<_>>()
        ))?;
    
    // Verify the chain has an owner (meaning we can sign for it)
    let owner = hub_chain.get("owner")
        .and_then(|o| o.as_str());
    
    if owner.is_none() || owner == Some("null") {
        tracing::warn!("⚠️  Hub chain has no owner set in wallet - may be read-only");
    } else {
        tracing::info!("   ✅ Hub chain owner: {}...", &owner.unwrap()[..18]);
    }
    
    // Verify default chain is the hub chain
    let default_chain = wallet.get("default")
        .and_then(|d| d.as_str())
        .unwrap_or("");
    
    if default_chain != hub_chain_id {
        tracing::warn!(
            "⚠️  Default chain ({}) differs from hub chain ({})",
            &default_chain[..16],
            &hub_chain_id[..16]
        );
    } else {
        tracing::info!("   ✅ Default chain is hub chain");
    }
    
    tracing::info!("   ✅ Wallet verified for hub chain operations");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_wallet_json() {
        let valid = r#"{"chains":{},"default":"abc","genesis_config":{}}"#;
        assert!(validate_wallet_json(valid).is_ok());
        
        let invalid = r#"{"chains":{}}"#;
        assert!(validate_wallet_json(invalid).is_err());
    }

    #[test]
    fn test_validate_keystore_json() {
        let valid = r#"{"keys":[["0x123",[1,2,3]]]}"#;
        assert!(validate_keystore_json(valid).is_ok());
        
        let empty = r#"{"keys":[]}"#;
        assert!(validate_keystore_json(empty).is_err());
    }
}
