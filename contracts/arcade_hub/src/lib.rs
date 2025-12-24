// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! ABI and shared types for the Arcade Hub application.

use async_graphql::{InputObject, Request, Response, SimpleObject};
use linera_sdk::{
    graphql::GraphQLMutationRoot,
    linera_base_types::{AccountOwner, ChainId, ContractAbi, ServiceAbi},
};
use serde::{Deserialize, Serialize};

/// The ABI for the Arcade Hub application.
pub struct ArcadeHubAbi;

impl ContractAbi for ArcadeHubAbi {
    type Operation = Operation;
    type Response = ArcadeResponse;
}

impl ServiceAbi for ArcadeHubAbi {
    type Query = Request;
    type QueryResponse = Response;
}

/// Unique identifier for game types.
pub type GameId = u16;

/// The supported game types in the arcade.
#[derive(
    Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum,
)]
pub enum GameType {
    SpeedClicker,
    MemoryMatrix,
    ReactionStrike,
    MathBlitz,
    SnakeSprint,
}

impl GameType {
    /// Calculate XP earned based on game type, score, and optional bonus data.
    pub fn calculate_xp(&self, score: u64, bonus_data: Option<u64>) -> u64 {
        match self {
            GameType::SpeedClicker => {
                // score = number of clicks in 10s
                score.saturating_mul(10)
            }
            GameType::MemoryMatrix => {
                // score = levelReached, bonus_data = perfectRounds
                let level = score;
                let perfect_rounds = bonus_data.unwrap_or(0);
                level
                    .saturating_mul(100)
                    .saturating_add(perfect_rounds.saturating_mul(50))
            }
            GameType::ReactionStrike => {
                // score = avgReactionMs, bonus_data = targetsHit
                let avg_ms = score as i64;
                let targets_hit = bonus_data.unwrap_or(0);
                let base = 1000_i64.saturating_sub(avg_ms).max(0);
                (base as u64).saturating_mul(targets_hit)
            }
            GameType::MathBlitz => {
                // score = correctAnswers, bonus_data = maxStreak
                let correct = score;
                let streak = bonus_data.unwrap_or(0);
                correct
                    .saturating_mul(25)
                    .saturating_add(streak.saturating_mul(10))
            }
            GameType::SnakeSprint => {
                // score = snakeLength, bonus_data = applesEaten
                let length = score;
                let apples = bonus_data.unwrap_or(0);
                length
                    .saturating_mul(15)
                    .saturating_add(apples.saturating_mul(5))
            }
        }
    }

    /// Get the game ID for this game type.
    pub fn id(&self) -> GameId {
        match self {
            GameType::SpeedClicker => 1,
            GameType::MemoryMatrix => 2,
            GameType::ReactionStrike => 3,
            GameType::MathBlitz => 4,
            GameType::SnakeSprint => 5,
        }
    }

    /// Get the display name for this game type.
    pub fn name(&self) -> &'static str {
        match self {
            GameType::SpeedClicker => "Speed Clicker",
            GameType::MemoryMatrix => "Memory Matrix",
            GameType::ReactionStrike => "Reaction Strike",
            GameType::MathBlitz => "Math Blitz",
            GameType::SnakeSprint => "Snake Sprint",
        }
    }
}

/// Calculate level from total XP.
pub fn calculate_level(total_xp: u64) -> u32 {
    // Level formula: level = sqrt(xp / 100) + 1
    // Each level requires progressively more XP
    ((total_xp as f64 / 100.0).sqrt() as u32).saturating_add(1)
}

/// A registered player in the arcade.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PlayerInput")]
pub struct Player {
    pub owner: AccountOwner,
    pub username: String,
    pub total_xp: u64,
    pub level: u32,
    pub games_played: u64,
    pub registered_at: u64,
}

impl Player {
    /// Create a new player with default values.
    pub fn new(owner: AccountOwner, username: String, timestamp: u64) -> Self {
        Self {
            owner,
            username,
            total_xp: 0,
            level: 1,
            games_played: 0,
            registered_at: timestamp,
        }
    }

    /// Add XP to the player and update level.
    pub fn add_xp(&mut self, xp: u64) {
        self.total_xp = self.total_xp.saturating_add(xp);
        self.level = calculate_level(self.total_xp);
    }

    /// Increment games played counter.
    pub fn increment_games(&mut self) {
        self.games_played = self.games_played.saturating_add(1);
    }
}

/// A leaderboard entry for global rankings.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "LeaderboardEntryInput")]
pub struct LeaderboardEntry {
    pub wallet_address: AccountOwner,
    pub username: String,
    pub total_xp: u64,
    pub level: u32,
    pub rank: u32,
}

impl LeaderboardEntry {
    /// Create a new leaderboard entry from a player.
    pub fn from_player(player: &Player, rank: u32) -> Self {
        Self {
            wallet_address: player.owner.clone(),
            username: player.username.clone(),
            total_xp: player.total_xp,
            level: player.level,
            rank,
        }
    }
}

/// A recorded game score.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "GameScoreInput")]
pub struct GameScore {
    pub id: u64,
    pub game_type: GameType,
    pub player: AccountOwner,
    pub score: u64,
    pub xp_earned: u64,
    pub bonus_data: Option<u64>,
    pub timestamp: u64,
}

/// A high score entry for a specific game.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject)]
pub struct GameHighScoreEntry {
    pub player: AccountOwner,
    pub username: String,
    pub score: u64,
    pub xp_earned: u64,
    pub timestamp: u64,
}

/// Arcade statistics.
#[derive(Clone, Debug, Default, Serialize, Deserialize, SimpleObject)]
pub struct ArcadeStats {
    pub total_players: u64,
    pub total_games_played: u64,
    pub total_xp_earned: u64,
}

/// Operations that can be executed on the arcade hub.
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    /// Register a new player with a username.
    RegisterPlayer { username: String },
    /// Submit a game score.
    SubmitScore {
        game_type: GameType,
        score: u64,
        bonus_data: Option<u64>,
    },
    /// Update a player's username.
    UpdateUsername { new_username: String },
}

/// Response from contract operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArcadeResponse {
    /// Player was registered successfully.
    PlayerRegistered,
    /// Score was submitted successfully with XP earned.
    ScoreSubmitted { xp_earned: u64 },
    /// Username was updated successfully.
    UsernameUpdated,
    /// Operation failed with an error.
    Error(String),
}

/// Messages sent between chains for hub aggregation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    /// Sync a player's data to the hub.
    SyncPlayer(Player),
    /// Sync a game score to the hub.
    SyncScore(GameScore),
    /// Sync an XP update to the hub.
    SyncXpUpdate {
        wallet_address: AccountOwner,
        total_xp: u64,
        level: u32,
        games_played: u64,
    },
}

/// Instantiation argument for the arcade hub application.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantiationArgument {
    /// The chain ID of the hub chain that aggregates all data.
    pub hub_chain_id: ChainId,
}

/// Errors that can occur in the arcade hub.
#[derive(Debug, Clone, thiserror::Error)]
pub enum ArcadeError {
    #[error("Player is already registered")]
    PlayerAlreadyRegistered,
    #[error("Player is not registered")]
    PlayerNotRegistered,
    #[error("Username must be between 3 and 20 characters")]
    InvalidUsernameLength,
    #[error("Username contains invalid characters")]
    InvalidUsernameCharacters,
    #[error("Operation requires authentication")]
    NotAuthenticated,
    #[error("Internal error: {0}")]
    Internal(String),
}

impl ArcadeError {
    /// Convert to an ArcadeResponse::Error.
    pub fn into_response(self) -> ArcadeResponse {
        ArcadeResponse::Error(self.to_string())
    }
}

/// Validate a username.
pub fn validate_username(username: &str) -> Result<(), ArcadeError> {
    let len = username.len();
    if len < 3 || len > 20 {
        return Err(ArcadeError::InvalidUsernameLength);
    }
    if !username
        .chars()
        .all(|c| c.is_alphanumeric() || c == '_' || c == '-')
    {
        return Err(ArcadeError::InvalidUsernameCharacters);
    }
    Ok(())
}
