// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use arcade_hub::{
    validate_username, ArcadeError, ArcadeEvent, ArcadeEventType, ArcadeHubAbi, ArcadeResponse,
    CryptoRound, GamePlayedEvent, GameScore, GameType, InstantiationArgument, LeaderboardEntry,
    Message, Operation, Player, Prediction, PredictionDirection, PredictionStatus, WorldEvent,
    // Multiplayer types
    MultiplayerGameType, MultiplayerGameRoom, MultiplayerGameStatus, MultiplayerPlayer, MoveData,
    // Response types
    PlayerRegisteredResponse, ScoreSubmittedResponse, UsernameUpdatedResponse,
    DailyBonusResponse, CryptoRoundCreatedResponse, CryptoPredictionResponse,
    CryptoRoundResolvedResponse, WorldEventCreatedResponse, EventPredictionResponse,
    WorldEventResolvedResponse, MultiplayerRoomCreatedResponse, MultiplayerRoomJoinedResponse,
    MoveMadeResponse, GameEndedResponse,
};
use linera_sdk::{
    linera_base_types::{AccountOwner, ChainId, WithContractAbi},
    views::{RootView, View},
    Contract, ContractRuntime,
};

use self::state::ArcadeHubState;

/// The Arcade Hub contract.
pub struct ArcadeHubContract {
    state: ArcadeHubState,
    runtime: ContractRuntime<Self>,
}

linera_sdk::contract!(ArcadeHubContract);

impl WithContractAbi for ArcadeHubContract {
    type Abi = ArcadeHubAbi;
}

impl Contract for ArcadeHubContract {
    type Message = Message;
    type InstantiationArgument = InstantiationArgument;
    type Parameters = ();
    type EventValue = ();

    async fn load(runtime: ContractRuntime<Self>) -> Self {
        let state = ArcadeHubState::load(runtime.root_view_storage_context())
            .await
            .expect("Failed to load state");
        ArcadeHubContract { state, runtime }
    }

    async fn instantiate(&mut self, argument: Self::InstantiationArgument) {
        // Store the hub chain ID for message routing
        self.state
            .hub_chain_id
            .set(Some(argument.hub_chain_id));
        self.state.score_counter.set(0);
        self.state.total_games_played.set(0);
        self.state.total_xp_earned.set(0);
        // Initialize prediction counters
        self.state.round_counter.set(0);
        self.state.event_counter.set(0);
        self.state.prediction_counter.set(0);
        self.state.total_coins_wagered.set(0);
        self.state.total_predictions.set(0);
        // Initialize XP normalization factor (10 = divide raw XP by 10 for display)
        // This fixes the 100k XP issue without data migration
        self.state.normalization_factor.set(10);
        // Initialize event counter
        self.state.arcade_event_counter.set(0);
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        // Get authenticated signer
        let owner = match self.runtime.authenticated_signer() {
            Some(signer) => AccountOwner::from(signer),
            None => return ArcadeError::NotAuthenticated.into_response(),
        };

        match operation {
            // ========== EXISTING OPERATIONS ==========
            Operation::RegisterPlayer { username } => {
                self.handle_register_player(owner, username).await
            }
            Operation::SubmitScore {
                game_type,
                score,
                bonus_data,
            } => {
                self.handle_submit_score(owner, game_type, score, bonus_data)
                    .await
            }
            Operation::UpdateUsername { new_username } => {
                self.handle_update_username(owner, new_username).await
            }

            // ========== TOKEN ECONOMY OPERATIONS ==========
            Operation::ClaimDailyBonus => {
                self.handle_claim_daily_bonus(owner).await
            }

            // ========== CRYPTO PREDICTION OPERATIONS ==========
            Operation::CreateCryptoRound {
                asset,
                start_price,
                duration_secs,
            } => {
                self.handle_create_crypto_round(asset, start_price, duration_secs)
                    .await
            }
            Operation::PlaceCryptoPrediction {
                round_id,
                direction,
                amount,
            } => {
                self.handle_place_crypto_prediction(owner, round_id, direction, amount)
                    .await
            }
            Operation::ResolveCryptoRound { round_id, end_price } => {
                self.handle_resolve_crypto_round(round_id, end_price).await
            }

            // ========== WORLD EVENT OPERATIONS ==========
            Operation::CreateWorldEvent {
                title,
                description,
                category,
                end_time,
            } => {
                self.handle_create_world_event(title, description, category, end_time)
                    .await
            }
            Operation::PlaceEventPrediction {
                event_id,
                prediction,
                amount,
            } => {
                self.handle_place_event_prediction(owner, event_id, prediction, amount)
                    .await
            }
            Operation::ResolveWorldEvent { event_id, outcome } => {
                self.handle_resolve_world_event(event_id, outcome).await
            }

            // ========== ON-CHAIN MULTIPLAYER OPERATIONS (Cross-Chain Pattern) ==========
            Operation::CreateMultiplayerRoom { game_type } => {
                self.handle_create_multiplayer_room(owner, game_type).await
            }
            Operation::JoinMultiplayerRoom { host_chain_id } => {
                self.handle_join_multiplayer_room(owner, host_chain_id).await
            }
            Operation::MakeMove { move_data } => {
                self.handle_make_move(owner, move_data).await
            }
            Operation::ForfeitGame => {
                self.handle_forfeit_game(owner).await
            }
            Operation::ClaimVictoryTimeout => {
                self.handle_claim_victory_timeout(owner).await
            }
            Operation::LeaveRoom => {
                self.handle_leave_room(owner).await
            }
            Operation::ClearRoom => {
                self.handle_clear_room(owner).await
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        match message {
            // ========== HUB CHAIN MESSAGES (aggregation) ==========
            Message::SyncPlayer(player) => {
                self.handle_sync_player(player).await;
            }
            Message::SyncScore(score) => {
                self.handle_sync_score(score).await;
            }
            Message::SyncXpUpdate {
                wallet_address,
                total_xp,
                level,
                games_played,
                coins,
            } => {
                self.handle_sync_xp_update(wallet_address, total_xp, level, games_played, coins)
                    .await;
            }
            Message::SyncCryptoRound(round) => {
                self.handle_sync_crypto_round(round).await;
            }
            Message::SyncWorldEvent(event) => {
                self.handle_sync_world_event(event).await;
            }
            Message::SyncPrediction(prediction) => {
                self.handle_sync_prediction(prediction).await;
            }
            Message::SyncPredictionResult {
                prediction_id,
                won,
                payout,
            } => {
                self.handle_sync_prediction_result(prediction_id, won, payout)
                    .await;
            }

            // ========== MULTIPLAYER CROSS-CHAIN MESSAGES ==========
            Message::JoinRequest { player_chain_id, player_wallet, player_name } => {
                self.handle_join_request(player_chain_id, player_wallet, player_name).await;
            }
            Message::GameStateSync { room } => {
                self.handle_game_state_sync(room).await;
            }
            Message::PlayerLeft { player_chain_id, player_wallet } => {
                self.handle_player_left(player_chain_id, player_wallet).await;
            }
            Message::GameMoveSync { room } => {
                self.handle_game_move_sync(room).await;
            }
            Message::GameEndedSync { host_chain_id, game_type, winner, loser, winner_username, loser_username, is_draw } => {
                self.handle_game_ended_sync(host_chain_id, game_type, winner, loser, winner_username, loser_username, is_draw).await;
            }
            Message::RewardSync { player_wallet, xp_earned, coins_earned, is_winner: _, game_type: _ } => {
                // Apply rewards to local player data
                self.apply_rewards_to_player(&player_wallet, xp_earned, coins_earned).await;
            }
        }
    }

    async fn store(mut self) {
        self.state.save().await.expect("Failed to save state");
    }
}

impl ArcadeHubContract {
    /// Handle player registration.
    async fn handle_register_player(
        &mut self,
        owner: AccountOwner,
        username: String,
    ) -> ArcadeResponse {
        // Validate username
        if let Err(e) = validate_username(&username) {
            return e.into_response();
        }

        // Check if already registered
        if self.state.players.contains_key(&owner).await.unwrap_or(false) {
            return ArcadeError::PlayerAlreadyRegistered.into_response();
        }

        // Get current timestamp
        let timestamp = self.runtime.system_time().micros();

        // Create new player
        let player = Player::new(owner.clone(), username.clone(), timestamp);

        // Insert into local state
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to insert player");

        // Create leaderboard entry
        let entry = LeaderboardEntry::from_player(&player, 0);
        self.state
            .leaderboard
            .insert(&owner, entry)
            .expect("Failed to insert leaderboard entry");

        // Send sync message to hub if not on hub chain
        self.send_to_hub_if_needed(Message::SyncPlayer(player));

        ArcadeResponse::PlayerRegistered(PlayerRegisteredResponse {
            success: true,
            message: "Player registered successfully".to_string(),
        })
    }

    /// Handle score submission.
    async fn handle_submit_score(
        &mut self,
        owner: AccountOwner,
        game_type: arcade_hub::GameType,
        score: u64,
        bonus_data: Option<u64>,
    ) -> ArcadeResponse {
        // Check if player is registered
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            _ => return ArcadeError::PlayerNotRegistered.into_response(),
        };

        // Calculate XP earned (CAPPED: 30-75 XP per game)
        // XP is calculated ONCE here - frontend NEVER calculates XP
        let xp_earned = game_type.calculate_xp(score, bonus_data);
        
        // Calculate coins earned (1 coin per 10 XP)
        let coins_earned = xp_earned / 10;

        // Update player stats
        player.add_xp(xp_earned);
        player.increment_games(xp_earned);

        // Save updated player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Update leaderboard entry
        let entry = LeaderboardEntry::from_player(&player, 0);
        self.state
            .leaderboard
            .insert(&owner, entry)
            .expect("Failed to update leaderboard");

        // Generate score ID and create score record
        let score_id = {
            let current = *self.state.score_counter.get();
            self.state.score_counter.set(current + 1);
            current
        };

        let timestamp = self.runtime.system_time().micros();
        let game_score = GameScore {
            id: score_id,
            game_type,
            player: owner.clone(),
            score,
            xp_earned,
            bonus_data,
            timestamp,
        };

        // Insert score
        self.state
            .game_scores
            .insert(&score_id, game_score.clone())
            .expect("Failed to insert score");

        // Update totals
        let total_games = *self.state.total_games_played.get();
        self.state.total_games_played.set(total_games + 1);

        let total_xp = *self.state.total_xp_earned.get();
        self.state.total_xp_earned.set(total_xp + xp_earned);

        // Emit GamePlayed event for activity feed
        self.emit_game_played_event(
            owner.clone(),
            player.username.clone(),
            game_type,
            score,
            xp_earned,
            timestamp,
        ).await;

        // Send sync messages to hub if not on hub chain
        self.send_to_hub_if_needed(Message::SyncScore(game_score));
        self.send_to_hub_if_needed(Message::SyncXpUpdate {
            wallet_address: owner,
            total_xp: player.total_xp,
            level: player.level,
            games_played: player.games_played,
            coins: player.coins,
        });

        // CRITICAL: Return the XP earned so frontend can display it
        // Frontend MUST use this value, NEVER calculate XP locally
        ArcadeResponse::ScoreSubmitted(ScoreSubmittedResponse {
            success: true,
            xp_earned,
            coins_earned,
            total_xp: player.total_xp,
            level: player.level,
        })
    }

    /// Handle username update.
    async fn handle_update_username(
        &mut self,
        owner: AccountOwner,
        new_username: String,
    ) -> ArcadeResponse {
        // Validate username
        if let Err(e) = validate_username(&new_username) {
            return e.into_response();
        }

        // Check if player exists
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            _ => return ArcadeError::PlayerNotRegistered.into_response(),
        };

        // Update username
        player.username = new_username;

        // Save updated player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Update leaderboard entry
        let entry = LeaderboardEntry::from_player(&player, 0);
        self.state
            .leaderboard
            .insert(&owner, entry)
            .expect("Failed to update leaderboard");

        // Send sync message to hub
        self.send_to_hub_if_needed(Message::SyncPlayer(player));

        ArcadeResponse::UsernameUpdated(UsernameUpdatedResponse {
            success: true,
        })
    }

    /// Handle syncing a player from another chain (hub only).
    async fn handle_sync_player(&mut self, player: Player) {
        let owner = player.owner.clone();

        // Upsert player - preserve XP if exists
        if let Ok(Some(existing)) = self.state.players.get(&owner).await {
            // Keep the higher XP value
            let mut updated = player.clone();
            if existing.total_xp > updated.total_xp {
                updated.total_xp = existing.total_xp;
                updated.level = existing.level;
                updated.games_played = existing.games_played;
            }
            self.state
                .players
                .insert(&owner, updated.clone())
                .expect("Failed to update player");

            let entry = LeaderboardEntry::from_player(&updated, 0);
            self.state
                .leaderboard
                .insert(&owner, entry)
                .expect("Failed to update leaderboard");
        } else {
            self.state
                .players
                .insert(&owner, player.clone())
                .expect("Failed to insert player");

            let entry = LeaderboardEntry::from_player(&player, 0);
            self.state
                .leaderboard
                .insert(&owner, entry)
                .expect("Failed to insert leaderboard");
        }
    }

    /// Handle syncing a score from another chain (hub only).
    async fn handle_sync_score(&mut self, score: GameScore) {
        // Insert score with its original ID
        self.state
            .game_scores
            .insert(&score.id, score.clone())
            .expect("Failed to insert score");

        // Update totals
        let total_games = *self.state.total_games_played.get();
        self.state.total_games_played.set(total_games + 1);

        let total_xp = *self.state.total_xp_earned.get();
        self.state.total_xp_earned.set(total_xp + score.xp_earned);
    }

    /// Handle XP update sync from another chain (hub only).
    async fn handle_sync_xp_update(
        &mut self,
        wallet_address: AccountOwner,
        total_xp: u64,
        level: u32,
        games_played: u64,
        coins: u64,
    ) {
        // Update leaderboard entry if exists
        if let Ok(Some(mut entry)) = self.state.leaderboard.get(&wallet_address).await {
            // Only update if the new values are higher
            if total_xp >= entry.total_xp {
                entry.total_xp = total_xp;
                entry.level = level;
                self.state
                    .leaderboard
                    .insert(&wallet_address, entry)
                    .expect("Failed to update leaderboard");
            }
        }

        // Update player if exists
        if let Ok(Some(mut player)) = self.state.players.get(&wallet_address).await {
            if total_xp >= player.total_xp {
                player.total_xp = total_xp;
                player.level = level;
                player.games_played = games_played;
                player.coins = coins;
                self.state
                    .players
                    .insert(&wallet_address, player)
                    .expect("Failed to update player");
            }
        }
    }

    // ========================================================================
    // TOKEN ECONOMY HANDLERS
    // ========================================================================

    /// Handle daily bonus claim.
    async fn handle_claim_daily_bonus(&mut self, owner: AccountOwner) -> ArcadeResponse {
        // Check if player is registered
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            _ => return ArcadeError::PlayerNotRegistered.into_response(),
        };

        let current_time = self.runtime.system_time().micros();

        if !player.claim_daily_bonus(current_time) {
            return ArcadeError::DailyBonusAlreadyClaimed.into_response();
        }

        // Save updated player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncPlayer(player));

        ArcadeResponse::DailyBonusClaimed(DailyBonusResponse {
            success: true,
            coins: 100,
        })
    }

    // ========================================================================
    // CRYPTO PREDICTION HANDLERS
    // ========================================================================

    /// Handle creating a new crypto prediction round.
    async fn handle_create_crypto_round(
        &mut self,
        asset: arcade_hub::CryptoAsset,
        start_price: u64,
        duration_secs: u64,
    ) -> ArcadeResponse {
        let round_id = {
            let current = *self.state.round_counter.get();
            self.state.round_counter.set(current + 1);
            current
        };

        let start_time = self.runtime.system_time().micros();
        let round = CryptoRound::new(round_id, asset, start_price, start_time, duration_secs);

        self.state
            .crypto_rounds
            .insert(&round_id, round.clone())
            .expect("Failed to insert crypto round");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncCryptoRound(round));

        ArcadeResponse::CryptoRoundCreated(CryptoRoundCreatedResponse {
            success: true,
            round_id,
        })
    }

    /// Handle placing a crypto price prediction.
    async fn handle_place_crypto_prediction(
        &mut self,
        owner: AccountOwner,
        round_id: u64,
        direction: PredictionDirection,
        amount: u64,
    ) -> ArcadeResponse {
        // Validate bet amount
        if amount < 10 {
            return ArcadeError::BetTooSmall.into_response();
        }
        if amount > 10000 {
            return ArcadeError::BetTooLarge.into_response();
        }

        // Check if player is registered
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            _ => return ArcadeError::PlayerNotRegistered.into_response(),
        };

        // Check sufficient balance
        if !player.spend_coins(amount) {
            return ArcadeError::InsufficientCoins.into_response();
        }

        // Check if round exists and is accepting bets
        let mut round = match self.state.crypto_rounds.get(&round_id).await {
            Ok(Some(r)) => r,
            _ => return ArcadeError::CryptoRoundNotFound.into_response(),
        };

        let current_time = self.runtime.system_time().micros();
        if !round.is_accepting_bets(current_time) {
            // Refund coins
            player.award_coins(amount);
            self.state.players.insert(&owner, player).expect("Failed to refund");
            return ArcadeError::RoundNotAcceptingBets.into_response();
        }

        // Calculate odds before updating pool
        let odds = round.calculate_odds(direction);

        // Update round totals
        match direction {
            PredictionDirection::Up => round.total_up = round.total_up.saturating_add(amount),
            PredictionDirection::Down => round.total_down = round.total_down.saturating_add(amount),
        }

        // Save updated round
        self.state
            .crypto_rounds
            .insert(&round_id, round.clone())
            .expect("Failed to update round");

        // Create prediction record
        let prediction_id = {
            let current = *self.state.prediction_counter.get();
            self.state.prediction_counter.set(current + 1);
            current
        };

        let prediction = Prediction::new_crypto(
            prediction_id,
            owner.clone(),
            round_id,
            direction,
            amount,
            odds,
            current_time,
        );

        self.state
            .predictions
            .insert(&prediction_id, prediction.clone())
            .expect("Failed to insert prediction");

        // Update totals
        let total_wagered = *self.state.total_coins_wagered.get();
        self.state.total_coins_wagered.set(total_wagered + amount);

        let total_preds = *self.state.total_predictions.get();
        self.state.total_predictions.set(total_preds + 1);

        // Save updated player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncPrediction(prediction));
        self.send_to_hub_if_needed(Message::SyncCryptoRound(round));

        ArcadeResponse::CryptoPredictionPlaced(CryptoPredictionResponse {
            success: true,
            prediction_id,
            odds,
        })
    }

    /// Handle resolving a crypto round.
    async fn handle_resolve_crypto_round(
        &mut self,
        round_id: u64,
        end_price: u64,
    ) -> ArcadeResponse {
        // Get round
        let mut round = match self.state.crypto_rounds.get(&round_id).await {
            Ok(Some(r)) => r,
            _ => return ArcadeError::CryptoRoundNotFound.into_response(),
        };

        if round.status == PredictionStatus::Resolved {
            return ArcadeError::RoundAlreadyResolved.into_response();
        }

        // Determine winning direction
        let winning_direction = if end_price > round.start_price {
            PredictionDirection::Up
        } else {
            PredictionDirection::Down
        };

        // Update round
        round.end_price = Some(end_price);
        round.status = PredictionStatus::Resolved;
        round.winning_direction = Some(winning_direction);

        self.state
            .crypto_rounds
            .insert(&round_id, round.clone())
            .expect("Failed to update round");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncCryptoRound(round));

        ArcadeResponse::CryptoRoundResolved(CryptoRoundResolvedResponse {
            success: true,
            winning_direction,
        })
    }

    // ========================================================================
    // WORLD EVENT PREDICTION HANDLERS
    // ========================================================================

    /// Handle creating a new world event.
    async fn handle_create_world_event(
        &mut self,
        title: String,
        description: String,
        category: String,
        end_time: u64,
    ) -> ArcadeResponse {
        let event_id = {
            let current = *self.state.event_counter.get();
            self.state.event_counter.set(current + 1);
            current
        };

        let created_at = self.runtime.system_time().micros();
        let event = WorldEvent::new(event_id, title, description, category, end_time, created_at);

        self.state
            .world_events
            .insert(&event_id, event.clone())
            .expect("Failed to insert world event");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncWorldEvent(event));

        ArcadeResponse::WorldEventCreated(WorldEventCreatedResponse {
            success: true,
            event_id,
        })
    }

    /// Handle placing a world event prediction.
    async fn handle_place_event_prediction(
        &mut self,
        owner: AccountOwner,
        event_id: u64,
        prediction: bool,
        amount: u64,
    ) -> ArcadeResponse {
        // Validate bet amount
        if amount < 10 {
            return ArcadeError::BetTooSmall.into_response();
        }
        if amount > 10000 {
            return ArcadeError::BetTooLarge.into_response();
        }

        // Check if player is registered
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            _ => return ArcadeError::PlayerNotRegistered.into_response(),
        };

        // Check sufficient balance
        if !player.spend_coins(amount) {
            return ArcadeError::InsufficientCoins.into_response();
        }

        // Check if event exists and is accepting bets
        let mut event = match self.state.world_events.get(&event_id).await {
            Ok(Some(e)) => e,
            _ => return ArcadeError::WorldEventNotFound.into_response(),
        };

        let current_time = self.runtime.system_time().micros();
        if !event.is_accepting_bets(current_time) {
            // Refund coins
            player.award_coins(amount);
            self.state.players.insert(&owner, player).expect("Failed to refund");
            return ArcadeError::EventNotAcceptingBets.into_response();
        }

        // Calculate odds before updating pool
        let odds = if prediction {
            event.calculate_yes_odds()
        } else {
            event.calculate_no_odds()
        };

        // Update event totals
        if prediction {
            event.total_yes = event.total_yes.saturating_add(amount);
        } else {
            event.total_no = event.total_no.saturating_add(amount);
        }

        // Save updated event
        self.state
            .world_events
            .insert(&event_id, event.clone())
            .expect("Failed to update event");

        // Create prediction record
        let prediction_id = {
            let current = *self.state.prediction_counter.get();
            self.state.prediction_counter.set(current + 1);
            current
        };

        let pred = Prediction::new_event(
            prediction_id,
            owner.clone(),
            event_id,
            prediction,
            amount,
            odds,
            current_time,
        );

        self.state
            .predictions
            .insert(&prediction_id, pred.clone())
            .expect("Failed to insert prediction");

        // Update totals
        let total_wagered = *self.state.total_coins_wagered.get();
        self.state.total_coins_wagered.set(total_wagered + amount);

        let total_preds = *self.state.total_predictions.get();
        self.state.total_predictions.set(total_preds + 1);

        // Save updated player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncPrediction(pred));
        self.send_to_hub_if_needed(Message::SyncWorldEvent(event));

        ArcadeResponse::EventPredictionPlaced(EventPredictionResponse {
            success: true,
            prediction_id,
            odds,
        })
    }

    /// Handle resolving a world event.
    async fn handle_resolve_world_event(
        &mut self,
        event_id: u64,
        outcome: bool,
    ) -> ArcadeResponse {
        // Get event
        let mut event = match self.state.world_events.get(&event_id).await {
            Ok(Some(e)) => e,
            _ => return ArcadeError::WorldEventNotFound.into_response(),
        };

        if event.status == PredictionStatus::Resolved {
            return ArcadeError::EventAlreadyResolved.into_response();
        }

        // Update event
        event.outcome = Some(outcome);
        event.status = PredictionStatus::Resolved;

        self.state
            .world_events
            .insert(&event_id, event.clone())
            .expect("Failed to update event");

        // Sync to hub
        self.send_to_hub_if_needed(Message::SyncWorldEvent(event));

        ArcadeResponse::WorldEventResolved(WorldEventResolvedResponse {
            success: true,
            outcome,
        })
    }

    // ========================================================================
    // SYNC MESSAGE HANDLERS (Hub Chain Only)
    // ========================================================================

    /// Handle syncing a crypto round from another chain.
    async fn handle_sync_crypto_round(&mut self, round: CryptoRound) {
        let round_id = round.id;
        self.state
            .crypto_rounds
            .insert(&round_id, round)
            .expect("Failed to sync crypto round");
    }

    /// Handle syncing a world event from another chain.
    async fn handle_sync_world_event(&mut self, event: WorldEvent) {
        let event_id = event.id;
        self.state
            .world_events
            .insert(&event_id, event)
            .expect("Failed to sync world event");
    }

    /// Handle syncing a prediction from another chain.
    async fn handle_sync_prediction(&mut self, prediction: Prediction) {
        let prediction_id = prediction.id;
        self.state
            .predictions
            .insert(&prediction_id, prediction)
            .expect("Failed to sync prediction");

        // Update totals
        let total_preds = *self.state.total_predictions.get();
        self.state.total_predictions.set(total_preds + 1);
    }

    /// Handle syncing prediction result from another chain.
    async fn handle_sync_prediction_result(&mut self, prediction_id: u64, won: bool, payout: u64) {
        if let Ok(Some(mut prediction)) = self.state.predictions.get(&prediction_id).await {
            prediction.status = PredictionStatus::Resolved;
            if won {
                prediction.payout = payout;
            }
            self.state
                .predictions
                .insert(&prediction_id, prediction)
                .expect("Failed to update prediction");
        }
    }

    /// Send a message to the hub chain if we're not already on it.
    fn send_to_hub_if_needed(&mut self, message: Message) {
        let hub_chain_id = match self.state.hub_chain_id.get() {
            Some(id) => *id,
            None => return,
        };

        // Only send if not on hub chain
        if self.runtime.chain_id() != hub_chain_id {
            self.runtime
                .prepare_message(message)
                .with_authentication()
                .send_to(hub_chain_id);
        }
    }


    // ========================================================================
    // ON-CHAIN MULTIPLAYER HANDLERS (Cross-Chain Pattern)
    // Room stored on HOST's chain, joiner sends cross-chain message to join.
    // ========================================================================

    /// Create a new multiplayer game room on YOUR chain.
    async fn handle_create_multiplayer_room(
        &mut self,
        owner: AccountOwner,
        game_type: MultiplayerGameType,
    ) -> ArcadeResponse {
        let player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            Ok(None) => return ArcadeError::PlayerNotRegistered.into_response(),
            Err(_) => return ArcadeError::Internal("Failed to get player".to_string()).into_response(),
        };

        // Check if there's an existing room
        if let Some(existing_room) = self.state.multiplayer_room.get().clone() {
            // Only block if game is actively in progress
            // Allow overwriting finished, abandoned, waiting, or old rooms
            let can_overwrite = match existing_room.status {
                MultiplayerGameStatus::InProgress => false,
                MultiplayerGameStatus::Finished 
                | MultiplayerGameStatus::Draw 
                | MultiplayerGameStatus::Forfeited 
                | MultiplayerGameStatus::Abandoned => true,
                MultiplayerGameStatus::WaitingForPlayer => {
                    // Allow overwriting if waiting for more than 10 minutes (600 seconds)
                    let now = self.runtime.system_time().micros();
                    let age_secs = (now.saturating_sub(existing_room.created_at)) / 1_000_000;
                    age_secs > 600
                }
            };
            
            if !can_overwrite {
                return ArcadeError::GameAlreadyStarted.into_response();
            }
            // Clear the old room before creating new one
            self.state.multiplayer_room.set(None);
        }

        let host_chain_id = self.runtime.chain_id().to_string();
        let timestamp = self.runtime.system_time().micros();
        let room = MultiplayerGameRoom::new_waiting(
            host_chain_id.clone(),
            game_type,
            owner.clone(),
            player.username.clone(),
            timestamp,
        );

        self.state.multiplayer_room.set(Some(room));

        ArcadeResponse::MultiplayerRoomCreated(MultiplayerRoomCreatedResponse {
            success: true,
            host_chain_id,
            game_type,
        })
    }

    /// Join an existing multiplayer room by HOST CHAIN ID (passed as String).
    async fn handle_join_multiplayer_room(
        &mut self,
        owner: AccountOwner,
        host_chain_id_str: String,
    ) -> ArcadeResponse {
        // Parse the string to ChainId
        let host_chain_id: ChainId = match host_chain_id_str.parse() {
            Ok(id) => id,
            Err(_) => return ArcadeError::Internal(format!("Invalid host chain ID: {}", host_chain_id_str)).into_response(),
        };

        let player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            Ok(None) => return ArcadeError::PlayerNotRegistered.into_response(),
            Err(_) => return ArcadeError::Internal("Failed to get player".to_string()).into_response(),
        };

        if self.runtime.chain_id() == host_chain_id {
            return ArcadeError::CannotJoinOwnRoom.into_response();
        }

        let join_request = Message::JoinRequest {
            player_chain_id: self.runtime.chain_id(),
            player_wallet: owner.clone(),
            player_name: player.username.clone(),
        };

        self.runtime
            .prepare_message(join_request)
            .with_authentication()
            .send_to(host_chain_id);

        ArcadeResponse::MultiplayerRoomJoined(MultiplayerRoomJoinedResponse {
            success: true,
            host_chain_id: host_chain_id.to_string(),
            game_type: MultiplayerGameType::TicTacToe,
            opponent_username: String::new(),
        })
    }

    /// Handle incoming JoinRequest from another chain.
    async fn handle_join_request(
        &mut self,
        player_chain_id: ChainId,
        player_wallet: AccountOwner,
        player_name: String,
    ) {
        let room = match self.state.multiplayer_room.get().clone() {
            Some(r) => r,
            None => return,
        };

        if room.status != MultiplayerGameStatus::WaitingForPlayer {
            return;
        }

        let mut updated_room = room.clone();
        updated_room.player_chain_ids[1] = player_chain_id.to_string();
        updated_room.players[1] = player_wallet.clone();
        updated_room.usernames[1] = player_name.clone();

        let timestamp = self.runtime.system_time().micros();
        updated_room.initialize_game(timestamp);

        self.state.multiplayer_room.set(Some(updated_room.clone()));

        let sync_message = Message::GameStateSync {
            room: updated_room.clone(),
        };

        self.runtime
            .prepare_message(sync_message)
            .with_authentication()
            .send_to(player_chain_id);
    }

    async fn handle_game_state_sync(&mut self, room: MultiplayerGameRoom) {
        self.state.multiplayer_room.set(Some(room));
    }

    async fn handle_player_left(&mut self, _player_chain_id: ChainId, _player_wallet: AccountOwner) {
        if let Some(room) = self.state.multiplayer_room.get() {
            if room.status == MultiplayerGameStatus::WaitingForPlayer {
                self.state.multiplayer_room.set(None);
            }
        }
    }

    async fn handle_game_move_sync(&mut self, room: MultiplayerGameRoom) {
        self.state.multiplayer_room.set(Some(room));
    }

    async fn handle_game_ended_sync(
        &mut self,
        _host_chain_id: ChainId,
        game_type: MultiplayerGameType,
        winner: Option<AccountOwner>,
        loser: Option<AccountOwner>,
        _winner_username: String,
        _loser_username: String,
        is_draw: bool,
    ) {
        let timestamp = self.runtime.system_time().micros();

        if is_draw {
            let xp = game_type.draw_xp();
            let coins = xp / 5;
            if let Some(w) = &winner {
                self.award_multiplayer_rewards(w, xp, coins).await;
            }
            if let Some(l) = &loser {
                self.award_multiplayer_rewards(l, xp, coins).await;
            }
        } else {
            if let Some(w) = &winner {
                self.award_multiplayer_rewards(w, game_type.winner_xp(), game_type.winner_coins()).await;
            }
            if let Some(l) = &loser {
                self.award_multiplayer_rewards(l, game_type.loser_xp(), game_type.loser_coins()).await;
            }
        }

        let total = *self.state.total_multiplayer_games.get();
        self.state.total_multiplayer_games.set(total + 1);
        self.emit_event(ArcadeEventType::MultiplayerResult, timestamp).await;
        self.state.multiplayer_room.set(None);
    }

    async fn handle_leave_room(&mut self, owner: AccountOwner) -> ArcadeResponse {
        let room = match self.state.multiplayer_room.get().clone() {
            Some(r) => r,
            None => return ArcadeError::RoomNotFound.into_response(),
        };

        if room.players[0] != owner && room.players[1] != owner {
            return ArcadeError::NotAuthenticated.into_response();
        }

        if room.status == MultiplayerGameStatus::InProgress {
            return self.handle_forfeit_game(owner).await;
        }

        self.state.multiplayer_room.set(None);

        ArcadeResponse::GameEnded(GameEndedResponse {
            success: true,
            winner: None,
            xp_earned: 0,
            coins_earned: 0,
        })
    }

    /// Force clear room state - allows resetting stuck/abandoned rooms
    async fn handle_clear_room(&mut self, _owner: AccountOwner) -> ArcadeResponse {
        // Simply clear the room - anyone on this chain can reset it
        // This is needed when rooms get stuck in bad states
        self.state.multiplayer_room.set(None);
        
        ArcadeResponse::GameEnded(GameEndedResponse {
            success: true,
            winner: None,
            xp_earned: 0,
            coins_earned: 0,
        })
    }

    async fn handle_make_move(
        &mut self,
        owner: AccountOwner,
        move_data: MoveData,
    ) -> ArcadeResponse {
        let mut room = match self.state.multiplayer_room.get().clone() {
            Some(r) => r,
            None => return ArcadeError::RoomNotFound.into_response(),
        };

        if room.status != MultiplayerGameStatus::InProgress {
            return ArcadeError::GameNotInProgress.into_response();
        }

        let player_index = if room.players[0] == owner {
            MultiplayerPlayer::One
        } else if room.players[1] == owner {
            MultiplayerPlayer::Two
        } else {
            return ArcadeError::NotAuthenticated.into_response();
        };

        // QuickMath is a race - no turn enforcement
        // Other games require turn-based play
        if room.game_type != MultiplayerGameType::QuickMath && room.current_turn != player_index {
            return ArcadeError::NotYourTurn.into_response();
        }

        let timestamp = self.runtime.system_time().micros();
        room.last_move_at = timestamp;

        let mut game_ended = false;
        let mut winner: Option<MultiplayerPlayer> = None;

        match room.game_type {
            MultiplayerGameType::TicTacToe => {
                if let Some(ref mut board) = room.tic_tac_toe_board {
                    let pos = move_data.primary as u8;
                    if !board.make_move(pos, player_index) {
                        return ArcadeError::InvalidMove.into_response();
                    }
                    if let Some(w) = board.check_winner() {
                        game_ended = true;
                        winner = Some(w);
                        room.status = MultiplayerGameStatus::Finished;
                        room.winner = Some(w);
                    } else if board.is_full() {
                        game_ended = true;
                        room.status = MultiplayerGameStatus::Draw;
                    }
                }
            }
            MultiplayerGameType::ConnectFour => {
                if let Some(ref mut board) = room.connect_four_board {
                    let col = move_data.primary as u8;
                    if board.drop_piece(col, player_index).is_none() {
                        return ArcadeError::InvalidMove.into_response();
                    }
                    if let Some(w) = board.check_winner() {
                        game_ended = true;
                        winner = Some(w);
                        room.status = MultiplayerGameStatus::Finished;
                        room.winner = Some(w);
                    } else if board.is_full() {
                        game_ended = true;
                        room.status = MultiplayerGameStatus::Draw;
                    }
                }
            }
            MultiplayerGameType::QuickMath => {
                if let Some(ref mut state) = room.quick_math_state {
                    let answer = move_data.primary;
                    let (is_correct, _round_complete, finished) = state.submit_answer(player_index, answer);
                    
                    if !is_correct {
                        return ArcadeError::InvalidMove.into_response();
                    }
                    
                    if finished {
                        game_ended = true;
                        winner = state.get_winner();
                        room.status = if winner.is_some() {
                            MultiplayerGameStatus::Finished
                        } else {
                            MultiplayerGameStatus::Draw
                        };
                        room.winner = winner;
                    }
                    // Note: If round_complete but not finished, next problem is already generated
                    // Turn does NOT switch for QuickMath - it's a race
                }
            }
            MultiplayerGameType::Chess => {
                let move_str = match &move_data.secondary {
                    Some(s) => s.clone(),
                    None => return ArcadeError::InvalidMove.into_response(),
                };
                
                if let Some(ref mut board) = room.chess_board {
                    let is_white = player_index == MultiplayerPlayer::One;
                    if !board.make_move(&move_str, is_white) {
                        return ArcadeError::InvalidMove.into_response();
                    }
                    // Board state and FEN are now updated on-chain
                }
            }
            MultiplayerGameType::Checkers => {
                let move_str = match &move_data.secondary {
                    Some(s) => s.clone(),
                    None => return ArcadeError::InvalidMove.into_response(),
                };
                
                if let Some(ref mut board) = room.checkers_board {
                    let is_player_one = player_index == MultiplayerPlayer::One;
                    if !board.make_move(&move_str, is_player_one) {
                        return ArcadeError::InvalidMove.into_response();
                    }
                    
                    // Check for winner (opponent has no pieces)
                    if let Some(w) = board.check_winner() {
                        game_ended = true;
                        winner = Some(w);
                        room.status = MultiplayerGameStatus::Finished;
                        room.winner = Some(w);
                    }
                }
            }
        }

        // QuickMath doesn't switch turns (both players can answer anytime)
        // Other games do switch turns
        if !game_ended && room.game_type != MultiplayerGameType::QuickMath {
            room.current_turn = room.current_turn.other();
        }

        self.state.multiplayer_room.set(Some(room.clone()));

        let opponent_chain_str = if room.players[0] == owner {
            &room.player_chain_ids[1]
        } else {
            &room.player_chain_ids[0]
        };

        if !opponent_chain_str.is_empty() {
            if let Ok(opponent_chain) = opponent_chain_str.parse::<ChainId>() {
                let sync_message = Message::GameMoveSync { room: room.clone() };
                self.runtime
                    .prepare_message(sync_message)
                    .with_authentication()
                    .send_to(opponent_chain);
            }
        }

        let (xp_earned, coins_earned) = if game_ended {
            self.finalize_multiplayer_game(&room).await
        } else {
            (None, None)
        };

        ArcadeResponse::MoveMade(MoveMadeResponse {
            success: true,
            game_ended,
            winner,
            xp_earned,
            coins_earned,
        })
    }

    async fn handle_forfeit_game(&mut self, owner: AccountOwner) -> ArcadeResponse {
        let mut room = match self.state.multiplayer_room.get().clone() {
            Some(r) => r,
            None => return ArcadeError::RoomNotFound.into_response(),
        };

        if room.status != MultiplayerGameStatus::InProgress {
            return ArcadeError::GameNotInProgress.into_response();
        }

        let forfeit_player = if room.players[0] == owner {
            MultiplayerPlayer::One
        } else if room.players[1] == owner {
            MultiplayerPlayer::Two
        } else {
            return ArcadeError::NotAuthenticated.into_response();
        };

        room.winner = Some(forfeit_player.other());
        room.status = MultiplayerGameStatus::Forfeited;

        self.state.multiplayer_room.set(Some(room.clone()));

        let opponent_chain_str = if room.players[0] == owner {
            &room.player_chain_ids[1]
        } else {
            &room.player_chain_ids[0]
        };

        if !opponent_chain_str.is_empty() {
            if let Ok(opponent_chain) = opponent_chain_str.parse::<ChainId>() {
                let sync_message = Message::GameMoveSync { room: room.clone() };
                self.runtime
                    .prepare_message(sync_message)
                    .with_authentication()
                    .send_to(opponent_chain);
            }
        }

        let (xp, coins) = self.finalize_multiplayer_game(&room).await;

        ArcadeResponse::GameEnded(GameEndedResponse {
            success: true,
            winner: room.winner,
            xp_earned: xp.unwrap_or(0),
            coins_earned: coins.unwrap_or(0),
        })
    }

    async fn handle_claim_victory_timeout(&mut self, owner: AccountOwner) -> ArcadeResponse {
        let mut room = match self.state.multiplayer_room.get().clone() {
            Some(r) => r,
            None => return ArcadeError::RoomNotFound.into_response(),
        };

        if room.status != MultiplayerGameStatus::InProgress {
            return ArcadeError::GameNotInProgress.into_response();
        }

        let current_time = self.runtime.system_time().micros();
        if !room.is_timed_out(current_time) {
            return ArcadeError::OpponentNotTimedOut.into_response();
        }

        let winner = room.current_turn.other();

        if room.players[winner.index()] != owner {
            return ArcadeError::NotAuthenticated.into_response();
        }

        room.winner = Some(winner);
        room.status = MultiplayerGameStatus::Abandoned;

        self.state.multiplayer_room.set(Some(room.clone()));

        let opponent_chain_str = if room.players[0] == owner {
            &room.player_chain_ids[1]
        } else {
            &room.player_chain_ids[0]
        };

        if !opponent_chain_str.is_empty() {
            if let Ok(opponent_chain) = opponent_chain_str.parse::<ChainId>() {
                let sync_message = Message::GameMoveSync { room: room.clone() };
                self.runtime
                    .prepare_message(sync_message)
                    .with_authentication()
                    .send_to(opponent_chain);
            }
        }

        let (xp, coins) = self.finalize_multiplayer_game(&room).await;

        ArcadeResponse::GameEnded(GameEndedResponse {
            success: true,
            winner: room.winner,
            xp_earned: xp.unwrap_or(0),
            coins_earned: coins.unwrap_or(0),
        })
    }

    async fn finalize_multiplayer_game(&mut self, room: &MultiplayerGameRoom) -> (Option<u64>, Option<u64>) {
        let timestamp = self.runtime.system_time().micros();
        let is_draw = room.status == MultiplayerGameStatus::Draw;
        let my_chain = self.runtime.chain_id();

        // Calculate rewards based on game outcome
        let (winner_xp, winner_coins) = if is_draw {
            (room.game_type.draw_xp(), room.game_type.draw_xp() / 5)
        } else {
            (room.game_type.winner_xp(), room.game_type.winner_coins())
        };
        let (loser_xp, loser_coins) = (room.game_type.loser_xp(), room.game_type.loser_coins());

        // Send reward messages to BOTH players' chains
        for (i, player_chain_str) in room.player_chain_ids.iter().enumerate() {
            if player_chain_str.is_empty() {
                continue;
            }
            
            let (xp, coins, is_winner) = if is_draw {
                (winner_xp, winner_coins, false) // Both get draw rewards
            } else if let Some(winner_player) = room.winner {
                if i == winner_player.index() {
                    (winner_xp, winner_coins, true)
                } else {
                    (loser_xp, loser_coins, false)
                }
            } else {
                continue;
            };
            
            // Send reward to this player's chain
            if let Ok(player_chain) = player_chain_str.parse::<ChainId>() {
                // If this is the current chain, apply locally
                if player_chain == my_chain {
                    self.apply_rewards_to_player(&room.players[i], xp, coins).await;
                } else {
                    // Send cross-chain reward message
                    let reward_msg = Message::RewardSync {
                        player_wallet: room.players[i].clone(),
                        xp_earned: xp,
                        coins_earned: coins,
                        is_winner,
                        game_type: room.game_type,
                    };
                    self.runtime
                        .prepare_message(reward_msg)
                        .with_authentication()
                        .send_to(player_chain);
                }
            }
        }

        let total = *self.state.total_multiplayer_games.get();
        self.state.total_multiplayer_games.set(total + 1);
        self.emit_event(ArcadeEventType::MultiplayerResult, timestamp).await;

        if let Some(hub_chain_id) = self.state.hub_chain_id.get() {
            let hub = *hub_chain_id;
            if my_chain != hub {
                let host_chain = if let Ok(id) = room.host_chain_id.parse::<ChainId>() {
                    id
                } else {
                    my_chain
                };
                
                let msg = Message::GameEndedSync {
                    host_chain_id: host_chain,
                    game_type: room.game_type,
                    winner: room.winner.map(|w| room.players[w.index()].clone()),
                    loser: room.winner.map(|w| room.players[w.other().index()].clone()),
                    winner_username: room.winner.map(|w| room.usernames[w.index()].clone()).unwrap_or_default(),
                    loser_username: room.winner.map(|w| room.usernames[w.other().index()].clone()).unwrap_or_default(),
                    is_draw,
                };
                self.runtime.prepare_message(msg).with_authentication().send_to(hub);
            }
        }

        // Return XP/coins for the player who made the winning move (for response)
        let xp = if is_draw {
            Some(winner_xp)
        } else if room.winner.is_some() {
            Some(winner_xp)
        } else {
            None
        };

        let coins = xp.map(|_| winner_coins);
        (xp, coins)
    }

    async fn award_multiplayer_rewards(&mut self, owner: &AccountOwner, xp: u64, coins: u64) {
        // This is called on the HOST's chain, but we need to reward both players
        // The host player's data is on this chain, but the joiner's data is on their chain
        // So this only updates local chain state
        self.apply_rewards_to_player(owner, xp, coins).await;
    }
    
    /// Apply rewards to a player on THIS chain (local state only).
    async fn apply_rewards_to_player(&mut self, owner: &AccountOwner, xp: u64, coins: u64) {
        if let Ok(Some(mut player)) = self.state.players.get(owner).await {
            player.add_xp(xp);
            player.coins = player.coins.saturating_add(coins);
            player.games_played = player.games_played.saturating_add(1);

            let _ = self.state.players.insert(owner, player.clone());

            let entry = LeaderboardEntry::from_player(&player, 0);
            let _ = self.state.leaderboard.insert(owner, entry);
        }
    }

    // ========================================================================
    // EVENT EMISSION HELPERS
    // ========================================================================

    async fn emit_event(&mut self, event_type: ArcadeEventType, timestamp: u64) {
        let event_id = {
            let current = *self.state.arcade_event_counter.get();
            self.state.arcade_event_counter.set(current + 1);
            current
        };

        let event = ArcadeEvent {
            id: event_id,
            timestamp,
            event_type,
        };

        self.state.event_log.push(event);
    }

    async fn emit_game_played_event(
        &mut self,
        player: AccountOwner,
        username: String,
        game_type: GameType,
        score: u64,
        xp_earned: u64,
        timestamp: u64,
    ) {
        self.emit_event(ArcadeEventType::GamePlayed, timestamp).await;

        let detailed_event = GamePlayedEvent {
            player,
            username,
            game_type,
            score,
            xp_earned,
            timestamp,
        };
        self.state.recent_games.push(detailed_event);
    }
}
