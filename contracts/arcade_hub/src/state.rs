// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! State management for the Arcade Hub application.

use arcade_hub::{GameScore, LeaderboardEntry, Player};
use linera_sdk::{
    linera_base_types::{AccountOwner, ChainId},
    views::{linera_views, MapView, RegisterView, RootView, ViewStorageContext},
};

/// The application state stored on each chain.
#[derive(RootView)]
#[view(context = ViewStorageContext)]
pub struct ArcadeHubState {
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
}
