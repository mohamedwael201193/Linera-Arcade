// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use arcade_hub::{
    validate_username, ArcadeError, ArcadeEvent, ArcadeEventType, ArcadeHubAbi, ArcadeResponse,
    CryptoRound, GamePlayedEvent, GameScore, GameType, InstantiationArgument, LeaderboardEntry,
    Message, Operation, Player, Prediction, PredictionDirection, PredictionStatus, WorldEvent,
    // Response types
    PlayerRegisteredResponse, ScoreSubmittedResponse, UsernameUpdatedResponse,
    DailyBonusResponse, CryptoRoundCreatedResponse, CryptoPredictionResponse,
    CryptoRoundResolvedResponse, WorldEventCreatedResponse, EventPredictionResponse,
    WorldEventResolvedResponse, MultiplayerResultResponse,
};
use linera_sdk::{
    linera_base_types::{AccountOwner, WithContractAbi},
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

            // ========== MULTIPLAYER RESULT (HYBRID SYSTEM) ==========
            Operation::SubmitMultiplayerResult {
                game_type,
                room_code,
                is_winner,
                opponent_username,
            } => {
                self.handle_submit_multiplayer_result(
                    owner,
                    game_type,
                    room_code,
                    is_winner,
                    opponent_username,
                )
                .await
            }
        }
    }

    async fn execute_message(&mut self, message: Self::Message) {
        // Get the hub chain ID
        let hub_chain_id = match self.state.hub_chain_id.get() {
            Some(id) => *id,
            None => return, // Not initialized yet
        };

        // Only process messages on the hub chain
        if self.runtime.chain_id() != hub_chain_id {
            return;
        }

        match message {
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
    // MULTIPLAYER RESULT HANDLER (HYBRID SYSTEM)
    // ========================================================================

    /// Handle submitting a multiplayer game result.
    /// Games play via WebSocket (fast, no signatures during play),
    /// then final result is submitted on-chain for XP/coins (1 signature).
    async fn handle_submit_multiplayer_result(
        &mut self,
        owner: AccountOwner,
        game_type: String,
        _room_code: String,
        is_winner: bool,
        _opponent_username: String,
    ) -> ArcadeResponse {
        // Get player
        let mut player = match self.state.players.get(&owner).await {
            Ok(Some(p)) => p,
            Ok(None) => return ArcadeError::PlayerNotRegistered.into_response(),
            Err(_) => return ArcadeError::Internal("Failed to get player".to_string()).into_response(),
        };

        // Calculate XP based on game type (CAPPED REWARDS!)
        // Multiplayer XP is also capped to prevent inflation
        // Winner: 50-75 XP, Loser: 15-25 XP (participation)
        let winner_xp: u64 = match game_type.as_str() {
            "chess" => 75,           // Most complex
            "checkers" => 65,        // Strategic
            "connect-four" => 55,    // Moderate complexity
            "tic-tac-toe" => 50,     // Simple
            "rock-paper-scissors" => 50,
            "word-duel" => 60,       // Language skill
            "reaction-duel" => 55,   // Reflexes
            "quick-math" => 65,      // Math skill
            "emoji-race" => 55,      // Speed game
            _ => 50,                 // Default for unknown games
        };

        // Winner gets full XP, loser gets ~30% participation XP
        let xp_earned = if is_winner {
            winner_xp
        } else {
            (winner_xp * 30) / 100  // 30% for participation (15-23 XP)
        };

        // Coins: Winner gets 10, loser gets 3 (scaled down with XP)
        let coins_earned = if is_winner {
            10
        } else {
            3
        };

        // Update player stats
        player.add_xp(xp_earned);
        player.games_played = player.games_played.saturating_add(1);
        player.coins = player.coins.saturating_add(coins_earned);

        // Save player
        self.state
            .players
            .insert(&owner, player.clone())
            .expect("Failed to update player");

        // Update leaderboard
        let leaderboard_entry = LeaderboardEntry::from_player(&player, 0);
        self.state
            .leaderboard
            .insert(&owner, leaderboard_entry.clone())
            .expect("Failed to update leaderboard");

        // Create a game score record for activity feed
        let score_id = *self.state.score_counter.get();
        self.state.score_counter.set(score_id + 1);

        let timestamp = self.runtime.system_time().micros();

        // Use GameType::SpeedClicker as placeholder for multiplayer games
        // The game_type string is stored in bonus_data context
        let game_score = GameScore {
            id: score_id,
            game_type: GameType::SpeedClicker, // Placeholder - real game type in context
            player: owner.clone(),
            score: if is_winner { 1 } else { 0 }, // 1 = win, 0 = loss
            xp_earned,
            bonus_data: None,
            timestamp,
        };

        self.state
            .game_scores
            .insert(&score_id, game_score.clone())
            .expect("Failed to save score");

        // Update global stats
        let total_games = *self.state.total_games_played.get();
        self.state.total_games_played.set(total_games + 1);

        let total_xp = *self.state.total_xp_earned.get();
        self.state.total_xp_earned.set(total_xp + xp_earned);

        // Emit multiplayer event
        self.emit_event(ArcadeEventType::MultiplayerResult, timestamp).await;

        // Sync to hub chain
        self.send_to_hub_if_needed(Message::SyncScore(game_score));
        self.send_to_hub_if_needed(Message::SyncXpUpdate {
            wallet_address: owner,
            total_xp: player.total_xp,
            level: player.level,
            games_played: player.games_played,
            coins: player.coins,
        });

        ArcadeResponse::MultiplayerResultSubmitted(MultiplayerResultResponse {
            success: true,
            xp_earned,
            coins_earned,
            is_winner,
        })
    }

    // ========================================================================
    // EVENT EMISSION HELPERS
    // ========================================================================

    /// Emit a generic event to the event log.
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

    /// Emit a GamePlayed event with detailed game data.
    async fn emit_game_played_event(
        &mut self,
        player: AccountOwner,
        username: String,
        game_type: GameType,
        score: u64,
        xp_earned: u64,
        timestamp: u64,
    ) {
        // Emit to generic event log
        self.emit_event(ArcadeEventType::GamePlayed, timestamp).await;

        // Also emit detailed event
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
