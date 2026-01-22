//! Minimal types for the Crypto Round Resolution Executor
//!
//! DESIGN PRINCIPLE: This executor is DECOUPLED from the main contract.
//! It only knows about crypto round resolution - no games, users, multiplayer, or events.
//!
//! The types here are the MINIMUM needed to:
//! 1. Query active crypto rounds
//! 2. Determine which rounds need resolution
//! 3. Fetch prices for BTC/ETH
//!
//! This executor will NOT break if games are added/removed from the contract.

use serde::{Deserialize, Serialize};

// =============================================================================
// CRYPTO ROUND TYPES (ONLY WHAT THE EXECUTOR NEEDS)
// =============================================================================

/// Crypto assets supported for prediction
/// Used only to determine which price to fetch (BTC or ETH)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum CryptoAsset {
    Btc,
    Eth,
}

/// Status of a crypto round (for filtering which rounds need resolution)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RoundStatus {
    Active,
    Resolved,
}

/// Crypto round data received from GraphQL query
/// This is a READ-ONLY struct for determining which rounds to resolve
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoRound {
    pub id: u64,
    pub asset: CryptoAsset,
    pub start_price: u64,
    pub end_price: Option<u64>,
    pub start_time: u64,
    pub end_time: u64,
    pub status: RoundStatus,
    // Note: We don't need total_up/total_down - the contract handles payouts
}
