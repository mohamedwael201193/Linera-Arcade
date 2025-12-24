// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

#![cfg_attr(target_arch = "wasm32", no_main)]

mod state;

use arcade_hub::{
    validate_username, ArcadeError, ArcadeHubAbi, ArcadeResponse, GameScore, InstantiationArgument,
    LeaderboardEntry, Message, Operation, Player,
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
    }

    async fn execute_operation(&mut self, operation: Self::Operation) -> Self::Response {
        // Get authenticated signer
        let owner = match self.runtime.authenticated_signer() {
            Some(signer) => AccountOwner::from(signer),
            None => return ArcadeError::NotAuthenticated.into_response(),
        };

        match operation {
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
            } => {
                self.handle_sync_xp_update(wallet_address, total_xp, level, games_played)
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

        ArcadeResponse::PlayerRegistered
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

        // Calculate XP earned
        let xp_earned = game_type.calculate_xp(score, bonus_data);

        // Update player stats
        player.add_xp(xp_earned);
        player.increment_games();

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

        // Send sync messages to hub if not on hub chain
        self.send_to_hub_if_needed(Message::SyncScore(game_score));
        self.send_to_hub_if_needed(Message::SyncXpUpdate {
            wallet_address: owner,
            total_xp: player.total_xp,
            level: player.level,
            games_played: player.games_played,
        });

        ArcadeResponse::ScoreSubmitted { xp_earned }
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

        ArcadeResponse::UsernameUpdated
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
                self.state
                    .players
                    .insert(&wallet_address, player)
                    .expect("Failed to update player");
            }
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
}
