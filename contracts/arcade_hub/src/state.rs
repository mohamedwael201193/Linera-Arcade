// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! State management for the Arcade Hub application.
//! Extended with Token Economy, Prediction Markets, Event-Sourced Model, and On-Chain Multiplayer.

use arcade_hub::{ArcadeEvent, CryptoRound, GamePlayedEvent, GameScore, LeaderboardEntry, MultiplayerGameRoom, Player, Prediction, WorldEvent};
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

    // ========== XP NORMALIZATION ==========
    /// Normalization factor for XP display (raw_xp / factor = displayed_xp).
    /// Default: 10 (to fix the 100k XP issue without data migration).
    /// Can be adjusted later (20, 50, etc.) without resetting leaderboards.
    pub normalization_factor: RegisterView<u64>,

    // ========== EVENT-SOURCED MODEL ==========
    /// Event log for activity feed and cross-chain syncing.
    /// Events are append-only and power real-time updates via polling.
    pub event_log: LogView<ArcadeEvent>,
    /// Counter for generating unique event IDs.
    pub arcade_event_counter: RegisterView<u64>,
    /// Recent game played events for activity feed (more detailed).
    pub recent_games: LogView<GamePlayedEvent>,

    // ========== ON-CHAIN MULTIPLAYER STATE (HUB-BASED) ==========
    /// Active multiplayer game rooms stored on HUB chain (keyed by room ID).
    /// This replaces the child-chain approach for cross-browser compatibility.
    pub active_rooms: MapView<u64, MultiplayerGameRoom>,
    /// Counter for generating unique room IDs.
    pub room_counter: RegisterView<u64>,
    /// Maps player wallet to list of room IDs they're in.
    pub player_room_ids: MapView<AccountOwner, Vec<u64>>,
    /// Total multiplayer games played.
    pub total_multiplayer_games: RegisterView<u64>,
    
    // ========== LEGACY (kept for compatibility) ==========
    /// Current multiplayer game room state (deprecated - use active_rooms).
    pub multiplayer_room: RegisterView<Option<MultiplayerGameRoom>>,
    /// Active multiplayer rooms by owner (deprecated - use player_room_ids).
    pub player_rooms: MapView<AccountOwner, Vec<ChainId>>,
}