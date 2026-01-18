// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! State management for the Arcade Hub application.
//! Extended with Token Economy, Prediction Markets, and Event-Sourced Model.

use arcade_hub::{ArcadeEvent, CryptoRound, GamePlayedEvent, GameScore, LeaderboardEntry, Player, Prediction, WorldEvent};
use linera_sdk::{
    linera_base_types::{AccountOwner, ChainId},
    views::{linera_views, LogView, MapView, RegisterView, RootView, ViewStorageContext},
};

/// The application state stored on each chain.
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ArcadeHubState {
    // ========== EXISTING STATE (DO NOT MODIFY) ==========
    /// The chain ID of the hub chain (for routing messages).
    pub hub_chain_id: RegisterView<Option<ChainId>>,
    /// All registered players on this chain (keyed by wallet address).
    pub players: MapView<AccountOwner, Player>,
    /// Leaderboard entries (keyed by wallet address).
    pub leaderboard: MapView<AccountOwner, LeaderboardEntry>,
    /// All game scores (keyed by score ID).
    pub game_scores: MapView<u64, GameScore>,
    /// Counter for generating unique score IDs.
    pub score_counter: RegisterView<u64>,
    /// Total number of games played.
    pub total_games_played: RegisterView<u64>,
    /// Total XP earned across all players.
    pub total_xp_earned: RegisterView<u64>,

    // ========== PREDICTION MARKET STATE ==========
    /// Active and historical crypto prediction rounds (keyed by round ID).
    pub crypto_rounds: MapView<u64, CryptoRound>,
    /// Counter for generating unique round IDs.
    pub round_counter: RegisterView<u64>,
    /// World events for prediction (keyed by event ID).
    pub world_events: MapView<u64, WorldEvent>,
    /// Counter for generating unique event IDs.
    pub event_counter: RegisterView<u64>,
    /// All user predictions (keyed by prediction ID).
    pub predictions: MapView<u64, Prediction>,
    /// Counter for generating unique prediction IDs.
    pub prediction_counter: RegisterView<u64>,
    /// Total coins wagered across all predictions.
    pub total_coins_wagered: RegisterView<u64>,
    /// Total predictions made.
    pub total_predictions: RegisterView<u64>,

    // ========== XP NORMALIZATION (NEW) ==========
    /// Normalization factor for XP display (raw_xp / factor = displayed_xp).
    /// Default: 10 (to fix the 100k XP issue without data migration).
    /// Can be adjusted later (20, 50, etc.) without resetting leaderboards.
    pub normalization_factor: RegisterView<u64>,

    // ========== EVENT-SOURCED MODEL (NEW) ==========
    /// Event log for activity feed and cross-chain syncing.
    /// Events are append-only and power real-time updates via polling.
    pub event_log: LogView<ArcadeEvent>,
    /// Counter for generating unique event IDs.
    pub arcade_event_counter: RegisterView<u64>,
    /// Recent game played events for activity feed (more detailed).
    pub recent_games: LogView<GamePlayedEvent>,
}
