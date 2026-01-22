//! Price Oracle - Fetches real-time BTC/ETH prices
//!
//! Uses Coinbase public API (no API key required, works globally)

use anyhow::{anyhow, Result};
use serde::Deserialize;

/// Coinbase spot price response
#[derive(Debug, Deserialize)]
struct CoinbaseResponse {
    data: CoinbaseData,
}

#[derive(Debug, Deserialize)]
struct CoinbaseData {
    amount: String,
}

/// Price oracle for fetching crypto prices
pub struct PriceOracle {
    client: reqwest::Client,
}

impl PriceOracle {
    /// Create a new price oracle
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    /// Get BTC price in cents (e.g., $95,000.00 = 9500000)
    pub async fn get_btc_price(&self) -> Result<u64> {
        self.get_price("BTC").await
    }

    /// Get ETH price in cents (e.g., $3,300.00 = 330000)
    pub async fn get_eth_price(&self) -> Result<u64> {
        self.get_price("ETH").await
    }

    /// Get price for a specific asset
    async fn get_price(&self, asset: &str) -> Result<u64> {
        let url = format!("https://api.coinbase.com/v2/prices/{}-USD/spot", asset);
        
        tracing::debug!("Fetching {} price from Coinbase...", asset);
        
        let response = self.client
            .get(&url)
            .header("Accept", "application/json")
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch {} price: {}", asset, e))?;

        if !response.status().is_success() {
            return Err(anyhow!(
                "Coinbase API returned status {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            ));
        }

        let data: CoinbaseResponse = response.json().await
            .map_err(|e| anyhow!("Failed to parse {} price response: {}", asset, e))?;

        // Parse price string to cents
        let price_str = &data.data.amount;
        let price_float: f64 = price_str.parse()
            .map_err(|e| anyhow!("Invalid price format '{}': {}", price_str, e))?;
        
        // Convert to cents (multiply by 100)
        let price_cents = (price_float * 100.0).round() as u64;
        
        tracing::debug!("{} price: ${:.2} ({} cents)", asset, price_float, price_cents);
        
        Ok(price_cents)
    }
}

impl Default for PriceOracle {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_btc_price() {
        let oracle = PriceOracle::new();
        let price = oracle.get_btc_price().await;
        
        // Should succeed and return a reasonable price
        assert!(price.is_ok());
        let price = price.unwrap();
        
        // BTC should be > $10,000 = 1,000,000 cents
        assert!(price > 1_000_000, "BTC price {} seems too low", price);
    }

    #[tokio::test]
    async fn test_get_eth_price() {
        let oracle = PriceOracle::new();
        let price = oracle.get_eth_price().await;
        
        // Should succeed and return a reasonable price
        assert!(price.is_ok());
        let price = price.unwrap();
        
        // ETH should be > $100 = 10,000 cents
        assert!(price > 10_000, "ETH price {} seems too low", price);
    }
}
