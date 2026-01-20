// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use std::sync::Arc;

use arcade_hub::{
    ArcadeEvent, ArcadeHubAbi, ArcadeStats, CryptoAsset, CryptoRound, GameHighScoreEntry,
    GamePlayedEvent, GameScore, GameType, LeaderboardEntry, MultiplayerGameRoom, MultiplayerGameType,
    MultiplayerGameStatus, Operation, Player, Prediction, PredictionStatus, WorldEvent,
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
    runtime: Arc<ServiceRuntime<Self>>,
}

linera_sdk::service!(ArcadeHubService);

impl WithServiceAbi for ArcadeHubService {
    type Abi = ArcadeHubAbi;
}

impl Service for ArcadeHubService {
    type Parameters = ();

    async fn new(runtime: ServiceRuntime<Self>) -> Self {
        ArcadeHubService {
            runtime: Arc::new(runtime),
        }
    }

    async fn handle_query(&self, request: Self::Query) -> Self::QueryResponse {
        // Load fresh state for each query to ensure we see latest updates
        let state = ArcadeHubState::load(self.runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        
        let schema = Schema::build(
            QueryRoot {
                state: Arc::new(state),
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
            total_predictions: *self.state.total_predictions.get(),
            total_coins_wagered: *self.state.total_coins_wagered.get(),
        }
    }

    // ========================================================================
    // NORMALIZED XP QUERIES (for display - raw XP / normalization_factor)
    // ========================================================================

    /// Get the current normalization factor.
    /// Displayed XP = raw XP / normalization_factor
    async fn normalization_factor(&self) -> i32 {
        let factor = *self.state.normalization_factor.get();
        if factor == 0 { 1 } else { factor as i32 }
    }

    /// Get leaderboard with NORMALIZED XP values for display.
    /// This divides raw XP by the normalization factor (default: 10).
    async fn normalized_leaderboard(&self, limit: Option<i32>) -> Vec<LeaderboardEntry> {
        let limit = limit.unwrap_or(100) as usize;
        let factor = *self.state.normalization_factor.get();
        let factor = if factor == 0 { 1 } else { factor };
        
        let mut entries = Vec::new();

        self.state
            .leaderboard
            .for_each_index_value(|_, entry| {
                let mut e = entry.into_owned();
                // Normalize XP for display
                e.total_xp = e.total_xp / factor;
                // Recalculate level from normalized XP
                e.level = arcade_hub::calculate_level(e.total_xp);
                entries.push(e);
                Ok(())
            })
            .await
            .ok();

        // Sort by normalized XP descending
        entries.sort_by(|a, b| b.total_xp.cmp(&a.total_xp));

        // Assign ranks
        for (i, entry) in entries.iter_mut().enumerate() {
            entry.rank = (i + 1) as u32;
        }

        entries.truncate(limit);
        entries
    }

    /// Get a player with NORMALIZED XP values for display.
    async fn normalized_player(&self, wallet: String) -> Option<Player> {
        let owner = parse_account_owner(&wallet)?;
        let factor = *self.state.normalization_factor.get();
        let factor = if factor == 0 { 1 } else { factor };
        
        let mut player = self.state.players.get(&owner).await.ok().flatten()?;
        // Normalize XP for display
        player.total_xp = player.total_xp / factor;
        player.level = arcade_hub::calculate_level(player.total_xp);
        Some(player)
    }

    // ========================================================================
    // EVENT QUERIES (for polling-based real-time updates)
    // ========================================================================

    /// Get recent events from the event log.
    /// Frontend polls this at 500-1000ms intervals for real-time updates.
    async fn recent_events(&self, limit: Option<i32>) -> Vec<ArcadeEvent> {
        let limit = limit.unwrap_or(50) as usize;
        let count = self.state.event_log.count();
        
        let start = if count > limit { count - limit } else { 0 };
        let mut events = Vec::new();
        
        for i in start..count {
            if let Ok(Some(event)) = self.state.event_log.get(i).await {
                events.push(event);
            }
        }
        
        // Return in reverse chronological order
        events.reverse();
        events
    }

    /// Get recent game played events with detailed data.
    /// Used for activity feed polling.
    async fn recent_game_events(&self, limit: Option<i32>) -> Vec<GamePlayedEvent> {
        let limit = limit.unwrap_or(50) as usize;
        let count = self.state.recent_games.count();
        
        let start = if count > limit { count - limit } else { 0 };
        let mut events = Vec::new();
        
        for i in start..count {
            if let Ok(Some(event)) = self.state.recent_games.get(i).await {
                events.push(event);
            }
        }
        
        // Return in reverse chronological order
        events.reverse();
        events
    }

    /// Get the total count of events (for pagination).
    async fn event_count(&self) -> i32 {
        self.state.event_log.count() as i32
    }

    // ========================================================================
    // CRYPTO PREDICTION QUERIES
    // ========================================================================

    /// Get all crypto prediction rounds.
    async fn crypto_rounds(&self, status: Option<PredictionStatus>) -> Vec<CryptoRound> {
        let mut rounds = Vec::new();

        self.state
            .crypto_rounds
            .for_each_index_value(|_, round| {
                let round_owned = round.into_owned();
                if status.is_none() || status == Some(round_owned.status) {
                    rounds.push(round_owned);
                }
                Ok(())
            })
            .await
            .ok();

        // Sort by start time descending (most recent first)
        rounds.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        rounds
    }

    /// Get active crypto rounds (currently accepting bets).
    async fn active_crypto_rounds(&self) -> Vec<CryptoRound> {
        let mut rounds = Vec::new();

        self.state
            .crypto_rounds
            .for_each_index_value(|_, round| {
                let round_owned = round.into_owned();
                if round_owned.status == PredictionStatus::Active {
                    rounds.push(round_owned);
                }
                Ok(())
            })
            .await
            .ok();

        rounds.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        rounds
    }

    /// Get a specific crypto round by ID.
    async fn crypto_round(&self, round_id: i32) -> Option<CryptoRound> {
        self.state
            .crypto_rounds
            .get(&(round_id as u64))
            .await
            .ok()
            .flatten()
    }

    /// Get crypto rounds by asset type.
    async fn crypto_rounds_by_asset(&self, asset: CryptoAsset) -> Vec<CryptoRound> {
        let mut rounds = Vec::new();

        self.state
            .crypto_rounds
            .for_each_index_value(|_, round| {
                let round_owned = round.into_owned();
                if round_owned.asset == asset {
                    rounds.push(round_owned);
                }
                Ok(())
            })
            .await
            .ok();

        rounds.sort_by(|a, b| b.start_time.cmp(&a.start_time));
        rounds
    }

    // ========================================================================
    // WORLD EVENT PREDICTION QUERIES
    // ========================================================================

    /// Get all world events.
    async fn world_events(&self, status: Option<PredictionStatus>) -> Vec<WorldEvent> {
        let mut events = Vec::new();

        self.state
            .world_events
            .for_each_index_value(|_, event| {
                let event_owned = event.into_owned();
                if status.is_none() || status == Some(event_owned.status) {
                    events.push(event_owned);
                }
                Ok(())
            })
            .await
            .ok();

        // Sort by end time ascending (soonest first)
        events.sort_by(|a, b| a.end_time.cmp(&b.end_time));
        events
    }

    /// Get active world events (currently accepting bets).
    async fn active_world_events(&self) -> Vec<WorldEvent> {
        let mut events = Vec::new();

        self.state
            .world_events
            .for_each_index_value(|_, event| {
                let event_owned = event.into_owned();
                if event_owned.status == PredictionStatus::Active {
                    events.push(event_owned);
                }
                Ok(())
            })
            .await
            .ok();

        events.sort_by(|a, b| a.end_time.cmp(&b.end_time));
        events
    }

    /// Get a specific world event by ID.
    async fn world_event(&self, event_id: i32) -> Option<WorldEvent> {
        self.state
            .world_events
            .get(&(event_id as u64))
            .await
            .ok()
            .flatten()
    }

    /// Get world events by category.
    async fn world_events_by_category(&self, category: String) -> Vec<WorldEvent> {
        let mut events = Vec::new();

        self.state
            .world_events
            .for_each_index_value(|_, event| {
                let event_owned = event.into_owned();
                if event_owned.category == category {
                    events.push(event_owned);
                }
                Ok(())
            })
            .await
            .ok();

        events.sort_by(|a, b| a.end_time.cmp(&b.end_time));
        events
    }

    // ========================================================================
    // USER PREDICTION QUERIES
    // ========================================================================

    /// Get all predictions for a user.
    async fn user_predictions(&self, wallet: String) -> Vec<Prediction> {
        let owner = match parse_account_owner(&wallet) {
            Some(o) => o,
            None => return Vec::new(),
        };

        let mut predictions = Vec::new();

        self.state
            .predictions
            .for_each_index_value(|_, pred| {
                let pred_owned = pred.into_owned();
                if pred_owned.user == owner {
                    predictions.push(pred_owned);
                }
                Ok(())
            })
            .await
            .ok();

        // Sort by created_at descending
        predictions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
        predictions
    }

    /// Get a specific prediction by ID.
    async fn prediction(&self, prediction_id: i32) -> Option<Prediction> {
        self.state
            .predictions
            .get(&(prediction_id as u64))
            .await
            .ok()
            .flatten()
    }

    /// Get predictions for a specific crypto round.
    async fn predictions_for_round(&self, round_id: i32) -> Vec<Prediction> {
        let mut predictions = Vec::new();

        self.state
            .predictions
            .for_each_index_value(|_, pred| {
                let pred_owned = pred.into_owned();
                if pred_owned.prediction_type == arcade_hub::PredictionType::Crypto 
                    && pred_owned.reference_id == round_id as u64 {
                    predictions.push(pred_owned);
                }
                Ok(())
            })
            .await
            .ok();

        predictions
    }

    /// Get predictions for a specific world event.
    async fn predictions_for_event(&self, event_id: i32) -> Vec<Prediction> {
        let mut predictions = Vec::new();

        self.state
            .predictions
            .for_each_index_value(|_, pred| {
                let pred_owned = pred.into_owned();
                if pred_owned.prediction_type == arcade_hub::PredictionType::Event
                    && pred_owned.reference_id == event_id as u64 {
                    predictions.push(pred_owned);
                }
                Ok(())
            })
            .await
            .ok();

        predictions
    }

    /// Get player's coin balance.
    async fn coin_balance(&self, wallet: String) -> Option<i32> {
        let owner = parse_account_owner(&wallet)?;
        let player = self.state.players.get(&owner).await.ok().flatten()?;
        Some(player.coins as i32)
    }

    // ========================================================================
    // MULTIPLAYER GAME QUERIES (CROSS-CHAIN PATTERN)
    // Each player queries their OWN chain's multiplayer_room state.
    // Room is created on HOST's chain, synced via cross-chain messages.
    // ========================================================================

    /// Get the current multiplayer room state on THIS chain.
    /// - Host calls this on their chain to see room they created.
    /// - Joiner calls this on their chain to see synced room state.
    async fn room(&self) -> Option<MultiplayerGameRoom> {
        self.state.multiplayer_room.get().clone()
    }

    /// Alias for room() - get the multiplayer room on this chain.
    async fn multiplayer_room(&self) -> Option<MultiplayerGameRoom> {
        self.state.multiplayer_room.get().clone()
    }

    /// Get the multiplayer game status for this chain's room.
    async fn multiplayer_game_status(&self) -> Option<MultiplayerGameStatus> {
        self.state.multiplayer_room.get().as_ref().map(|r| r.status)
    }

    /// Check if it's the specified player's turn.
    async fn is_my_turn(&self, wallet: String) -> bool {
        let owner = match parse_account_owner(&wallet) {
            Some(o) => o,
            None => return false,
        };

        match self.state.multiplayer_room.get().as_ref() {
            Some(room) => {
                if room.status != MultiplayerGameStatus::InProgress {
                    return false;
                }
                match room.current_turn {
                    arcade_hub::MultiplayerPlayer::One => room.players[0] == owner,
                    arcade_hub::MultiplayerPlayer::Two => room.players[1] == owner,
                }
            }
            None => false,
        }
    }

    /// Get the host chain ID of the current room (if any).
    async fn host_chain_id(&self) -> Option<String> {
        self.state.multiplayer_room.get().as_ref().map(|r| r.host_chain_id.clone())
    }

    /// Check if this chain's room is waiting for a player.
    async fn room_waiting_for_player(&self) -> bool {
        match self.state.multiplayer_room.get().as_ref() {
            Some(room) => room.status == MultiplayerGameStatus::WaitingForPlayer,
            None => false,
        }
    }

    /// Get the move history for the current game.
    async fn move_history(&self) -> Vec<arcade_hub::MoveData> {
        Vec::new()
    }

    /// Get the Tic Tac Toe board state from this chain's room.
    async fn tic_tac_toe_board(&self) -> Option<Vec<i32>> {
        let room = self.state.multiplayer_room.get().as_ref()?.clone();
        
        if room.game_type != MultiplayerGameType::TicTacToe {
            return None;
        }
        let board = room.tic_tac_toe_board.as_ref()?;
        Some(board.cells.iter().map(|c| match &c.player {
            None => 0,
            Some(arcade_hub::MultiplayerPlayer::One) => 1,
            Some(arcade_hub::MultiplayerPlayer::Two) => 2,
        }).collect())
    }

    /// Get the Connect Four board state from this chain's room.
    async fn connect_four_board(&self) -> Option<Vec<i32>> {
        let room = self.state.multiplayer_room.get().as_ref()?.clone();
        
        if room.game_type != MultiplayerGameType::ConnectFour {
            return None;
        }
        let board = room.connect_four_board.as_ref()?;
        Some(board.cells.iter().map(|c| match &c.player {
            None => 0,
            Some(arcade_hub::MultiplayerPlayer::One) => 1,
            Some(arcade_hub::MultiplayerPlayer::Two) => 2,
        }).collect())
    }

    /// Get the Quick Math game state.
    async fn quick_math_state(&self) -> Option<arcade_hub::QuickMathState> {
        let room = self.state.multiplayer_room.get().as_ref()?;
        if room.game_type != MultiplayerGameType::QuickMath {
            return None;
        }
        room.quick_math_state.clone()
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
