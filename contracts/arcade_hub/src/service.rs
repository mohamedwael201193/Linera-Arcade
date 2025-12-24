// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use arcade_hub::{
    ArcadeHubAbi, ArcadeStats, GameHighScoreEntry, GameScore, GameType, LeaderboardEntry,
    Operation, Player,
};
use async_graphql::{EmptySubscription, Object, Schema};
use linera_sdk::{
    graphql::GraphQLMutationRoot as _,
    linera_base_types::{AccountOwner, WithServiceAbi},
    views::View,
    Service, ServiceRuntime,
};

use self::state::ArcadeHubState;

/// The Arcade Hub service for GraphQL queries.
#[derive(Clone)]
pub struct ArcadeHubService {
    state: Arc<ArcadeHubState>,
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(ArcadeHubService);

impl WithServiceAbi for ArcadeHubService {
    type Abi = ArcadeHubAbi;
}

impl Service for ArcadeHubService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        let state = ArcadeHubState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ArcadeHubService {
            state: Arc::new(state),
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Self::Query) -> Self::QueryResponse {
        let schema = Schema::build(
            QueryRoot {
                state: self.state.clone(),
            },
            Operation::mutation_root(self.runtime.clone()),
            EmptySubscription,
        )
        .finish();
        schema.execute(request).await
    }
}

/// The root query type for GraphQL.
struct QueryRoot {
    state: Arc<ArcadeHubState>,
}

#[Object]
impl QueryRoot {
    /// Get a player by their wallet address.
    async fn player(&self, wallet: String) -> Option<Player> {
        let owner = parse_account_owner(&wallet)?;
        self.state.players.get(&owner).await.ok().flatten()
    }

    /// Get all registered players.
    async fn all_players(&self) -> Vec<Player> {
        let mut players = Vec::new();
        self.state
            .players
            .for_each_index_value(|_, player| {
                players.push(player.into_owned());
                Ok(())
            })
            .await
            .ok();
        players
    }

    /// Get the leaderboard, sorted by XP (descending).
    async fn leaderboard(&self, limit: Option<i32>) -> Vec<LeaderboardEntry> {
        let limit = limit.unwrap_or(100) as usize;
        let mut entries = Vec::new();

        self.state
            .leaderboard
            .for_each_index_value(|_, entry| {
                entries.push(entry.into_owned());
                Ok(())
            })
            .await
            .ok();

        // Sort by total XP descending
        entries.sort_by(|a, b| b.total_xp.cmp(&a.total_xp));

        // Assign ranks
        for (i, entry) in entries.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }

        entries.truncate(limit);
        entries
    }

    /// Get a player's rank on the leaderboard.
    async fn player_rank(&self, wallet: String) -> Option<i32> {
        let owner = parse_account_owner(&wallet)?;

        let mut entries: Vec<LeaderboardEntry> = Vec::new();
        self.state
            .leaderboard
            .for_each_index_value(|_, entry| {
                entries.push(entry.into_owned());
                Ok(())
            })
            .await
            .ok();

        entries.sort_by(|a, b| b.total_xp.cmp(&a.total_xp));

        entries
            .iter()
            .position(|e| e.wallet_address == owner)
            .map(|pos| (pos + 1) as i32)
    }

    /// Get recent game scores.
    async fn recent_scores(&self, limit: Option<i32>) -> Vec<GameScore> {
        let limit = limit.unwrap_or(50) as usize;
        let mut scores = Vec::new();

        self.state
            .game_scores
            .for_each_index_value(|_, score| {
                scores.push(score.into_owned());
                Ok(())
            })
            .await
            .ok();

        // Sort by timestamp descending (most recent first)
        scores.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        scores.truncate(limit);
        scores
    }

    /// Get scores for a specific game type.
    async fn game_scores(&self, game_type: GameType, limit: Option<i32>) -> Vec<GameScore> {
        let limit = limit.unwrap_or(50) as usize;
        let mut scores = Vec::new();

        self.state
            .game_scores
            .for_each_index_value(|_, score| {
                if score.game_type == game_type {
                    scores.push(score.into_owned());
                }
                Ok(())
            })
            .await
            .ok();

        // Sort by score descending
        scores.sort_by(|a, b| b.score.cmp(&a.score));
        scores.truncate(limit);
        scores
    }

    /// Get high scores for a specific game type (best per player).
    async fn game_high_scores(
        &self,
        game_type: GameType,
        limit: Option<i32>,
    ) -> Vec<GameHighScoreEntry> {
        let limit = limit.unwrap_or(50) as usize;
        let mut player_best: std::collections::HashMap<AccountOwner, GameScore> =
            std::collections::HashMap::new();

        self.state
            .game_scores
            .for_each_index_value(|_, score| {
                if score.game_type == game_type {
                    let score_owned = score.into_owned();
                    let entry = player_best.entry(score_owned.player.clone()).or_insert(score_owned.clone());
                    if score_owned.score > entry.score {
                        *entry = score_owned;
                    }
                }
                Ok(())
            })
            .await
            .ok();

        let mut high_scores: Vec<GameHighScoreEntry> = Vec::new();

        for (player_owner, score) in player_best {
            // Get username from players
            let username = self
                .state
                .players
                .get(&player_owner)
                .await
                .ok()
                .flatten()
                .map(|p| p.username)
                .unwrap_or_else(|| "Unknown".to_string());

            high_scores.push(GameHighScoreEntry {
                player: score.player,
                username,
                score: score.score,
                xp_earned: score.xp_earned,
                timestamp: score.timestamp,
            });
        }

        // Sort by score descending
        high_scores.sort_by(|a, b| b.score.cmp(&a.score));
        high_scores.truncate(limit);
        high_scores
    }

    /// Get arcade statistics.
    async fn stats(&self) -> ArcadeStats {
        let mut total_players = 0u64;

        self.state
            .players
            .for_each_index(|_| {
                total_players += 1;
                Ok(())
            })
            .await
            .ok();

        ArcadeStats {
            total_players,
            total_games_played: *self.state.total_games_played.get(),
            total_xp_earned: *self.state.total_xp_earned.get(),
        }
    }
}

/// Parse a wallet address string to AccountOwner.
fn parse_account_owner(wallet: &str) -> Option<AccountOwner> {
    // Try to parse as User:0x... format or just raw address
    let clean = wallet.trim().trim_start_matches("User:");
    
    // Try parsing as hex address (with or without 0x prefix)
    let hex_str = clean.trim_start_matches("0x");
    
    if hex_str.len() == 40 {
        // 20-byte ETH address (Address20)
        let mut bytes = [0u8; 20];
        if hex::decode_to_slice(hex_str, &mut bytes).is_ok() {
            return Some(AccountOwner::Address20(bytes));
        }
    }
    
    // Try parsing as raw JSON
    serde_json::from_str(wallet).ok()
}
