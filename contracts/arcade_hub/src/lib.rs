// Copyright (c) Linera Arcade Hub
// SPDX-License-Identifier: Apache-2.0

//! ABI and shared types for the Arcade Hub application.
//! Extended with Token Economy and Prediction Markets.

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
    /// Arcade coins balance (Token Economy)
    pub coins: u64,
    /// Last daily bonus claim timestamp (microseconds)
    pub last_daily_claim: u64,
    /// Total predictions made
    pub predictions_made: u64,
    /// Predictions won
    pub predictions_won: u64,
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
            coins: 100, // Starting bonus of 100 coins
            last_daily_claim: 0,
            predictions_made: 0,
            predictions_won: 0,
        }
    }

    /// Add XP to the player and update level.
    pub fn add_xp(&mut self, xp: u64) {
        self.total_xp = self.total_xp.saturating_add(xp);
        self.level = calculate_level(self.total_xp);
    }

    /// Increment games played counter and award coins.
    pub fn increment_games(&mut self, xp_earned: u64) {
        self.games_played = self.games_played.saturating_add(1);
        // Award coins: 1 coin per 10 XP earned
        let coins_earned = xp_earned / 10;
        self.coins = self.coins.saturating_add(coins_earned);
    }

    /// Claim daily bonus (100 coins). Returns true if successful.
    pub fn claim_daily_bonus(&mut self, current_time: u64) -> bool {
        // 24 hours in microseconds
        const DAY_MICROS: u64 = 24 * 60 * 60 * 1_000_000;
        
        if current_time >= self.last_daily_claim + DAY_MICROS {
            self.coins = self.coins.saturating_add(100);
            self.last_daily_claim = current_time;
            true
        } else {
            false
        }
    }

    /// Spend coins for prediction. Returns true if sufficient balance.
    pub fn spend_coins(&mut self, amount: u64) -> bool {
        if self.coins >= amount {
            self.coins = self.coins.saturating_sub(amount);
            true
        } else {
            false
        }
    }

    /// Award coins for winning prediction.
    pub fn award_coins(&mut self, amount: u64) {
        self.coins = self.coins.saturating_add(amount);
    }

    /// Record prediction outcome.
    pub fn record_prediction(&mut self, won: bool) {
        self.predictions_made = self.predictions_made.saturating_add(1);
        if won {
            self.predictions_won = self.predictions_won.saturating_add(1);
        }
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
    pub total_predictions: u64,
    pub total_coins_wagered: u64,
}

// ============================================================================
// PREDICTION MARKET TYPES
// ============================================================================

/// Crypto asset types for price predictions.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum CryptoAsset {
    BTC,
    ETH,
}

impl CryptoAsset {
    pub fn name(&self) -> &'static str {
        match self {
            CryptoAsset::BTC => "Bitcoin",
            CryptoAsset::ETH => "Ethereum",
        }
    }

    pub fn symbol(&self) -> &'static str {
        match self {
            CryptoAsset::BTC => "BTC",
            CryptoAsset::ETH => "ETH",
        }
    }
}

/// Direction for crypto price predictions.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionDirection {
    Up,
    Down,
}

/// Status of a prediction round or event.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionStatus {
    /// Round/Event is active and accepting bets
    Active,
    /// Round/Event is locked, waiting for resolution
    Locked,
    /// Round/Event has been resolved
    Resolved,
    /// Round/Event was cancelled (refunds issued)
    Cancelled,
}

/// A crypto price prediction round.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "CryptoRoundInput")]
pub struct CryptoRound {
    pub id: u64,
    pub asset: CryptoAsset,
    /// Start price in cents (e.g., 9500000 = $95,000.00)
    pub start_price: u64,
    /// End price (filled when resolved)
    pub end_price: Option<u64>,
    /// Round start time (microseconds)
    pub start_time: u64,
    /// Duration in seconds (e.g., 300 = 5 minutes)
    pub duration_secs: u64,
    /// Round status
    pub status: PredictionStatus,
    /// Total coins bet on UP
    pub total_up: u64,
    /// Total coins bet on DOWN
    pub total_down: u64,
    /// Winning direction (filled when resolved)
    pub winning_direction: Option<PredictionDirection>,
}

impl CryptoRound {
    pub fn new(id: u64, asset: CryptoAsset, start_price: u64, start_time: u64, duration_secs: u64) -> Self {
        Self {
            id,
            asset,
            start_price,
            end_price: None,
            start_time,
            duration_secs,
            status: PredictionStatus::Active,
            total_up: 0,
            total_down: 0,
            winning_direction: None,
        }
    }

    /// Check if round is still accepting bets (active and not past lock time)
    pub fn is_accepting_bets(&self, current_time: u64) -> bool {
        if self.status != PredictionStatus::Active {
            return false;
        }
        // Lock betting 30 seconds before end
        let lock_time = self.start_time + (self.duration_secs.saturating_sub(30)) * 1_000_000;
        current_time < lock_time
    }

    /// Calculate end time
    pub fn end_time(&self) -> u64 {
        self.start_time + self.duration_secs * 1_000_000
    }

    /// Calculate odds multiplier for a direction (in basis points, 10000 = 1.0x)
    pub fn calculate_odds(&self, direction: PredictionDirection) -> u64 {
        let total = self.total_up + self.total_down;
        if total == 0 {
            return 19000; // 1.9x default odds
        }

        let pool_for_direction = match direction {
            PredictionDirection::Up => self.total_up,
            PredictionDirection::Down => self.total_down,
        };

        if pool_for_direction == 0 {
            return 50000; // 5.0x max odds if nobody bet this direction
        }

        // Odds = (total pool * 0.95) / pool_for_direction (5% house edge)
        // Returns in basis points (multiply by 10000)
        let payout_pool = total * 9500 / 10000; // 95% of total
        (payout_pool * 10000) / pool_for_direction
    }
}

/// A world/crypto news event for prediction.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "WorldEventInput")]
pub struct WorldEvent {
    pub id: u64,
    /// Event title (e.g., "Will BTC reach $100K by Jan 15?")
    pub title: String,
    /// Detailed description
    pub description: String,
    /// Category for organization
    pub category: String,
    /// Event end time (when betting closes, microseconds)
    pub end_time: u64,
    /// When the event was created
    pub created_at: u64,
    /// Event status
    pub status: PredictionStatus,
    /// Outcome: None = pending, true = YES won, false = NO won
    pub outcome: Option<bool>,
    /// Total coins bet on YES
    pub total_yes: u64,
    /// Total coins bet on NO
    pub total_no: u64,
}

impl WorldEvent {
    pub fn new(id: u64, title: String, description: String, category: String, end_time: u64, created_at: u64) -> Self {
        Self {
            id,
            title,
            description,
            category,
            end_time,
            created_at,
            status: PredictionStatus::Active,
            outcome: None,
            total_yes: 0,
            total_no: 0,
        }
    }

    /// Check if event is accepting bets
    pub fn is_accepting_bets(&self, current_time: u64) -> bool {
        self.status == PredictionStatus::Active && current_time < self.end_time
    }

    /// Calculate odds for YES (in basis points)
    pub fn calculate_yes_odds(&self) -> u64 {
        let total = self.total_yes + self.total_no;
        if total == 0 || self.total_yes == 0 {
            return 19000; // 1.9x default
        }
        let payout_pool = total * 9500 / 10000;
        (payout_pool * 10000) / self.total_yes
    }

    /// Calculate odds for NO (in basis points)
    pub fn calculate_no_odds(&self) -> u64 {
        let total = self.total_yes + self.total_no;
        if total == 0 || self.total_no == 0 {
            return 19000;
        }
        let payout_pool = total * 9500 / 10000;
        (payout_pool * 10000) / self.total_no
    }
}

/// Type of prediction bet.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Hash, Serialize, Deserialize, async_graphql::Enum)]
pub enum PredictionType {
    /// Crypto price prediction
    Crypto,
    /// World event prediction
    Event,
}

/// A user's prediction bet.
#[derive(Clone, Debug, Serialize, Deserialize, SimpleObject, InputObject)]
#[graphql(input_name = "PredictionInput")]
pub struct Prediction {
    pub id: u64,
    pub user: AccountOwner,
    /// Type of prediction
    pub prediction_type: PredictionType,
    /// Reference ID (round_id for Crypto, event_id for Event)
    pub reference_id: u64,
    /// Direction for crypto (0=Down, 1=Up) or prediction for event (0=No, 1=Yes)
    pub direction_or_outcome: u64,
    /// Amount of coins wagered
    pub amount: u64,
    /// Odds at time of bet (basis points)
    pub odds_at_bet: u64,
    /// Status of this prediction
    pub status: PredictionStatus,
    /// Payout if won (0 if lost/pending)
    pub payout: u64,
    /// When the bet was placed
    pub created_at: u64,
}

impl Prediction {
    pub fn new_crypto(id: u64, user: AccountOwner, round_id: u64, direction: PredictionDirection, amount: u64, odds: u64, created_at: u64) -> Self {
        Self {
            id,
            user,
            prediction_type: PredictionType::Crypto,
            reference_id: round_id,
            direction_or_outcome: match direction {
                PredictionDirection::Up => 1,
                PredictionDirection::Down => 0,
            },
            amount,
            odds_at_bet: odds,
            status: PredictionStatus::Active,
            payout: 0,
            created_at,
        }
    }

    pub fn new_event(id: u64, user: AccountOwner, event_id: u64, prediction: bool, amount: u64, odds: u64, created_at: u64) -> Self {
        Self {
            id,
            user,
            prediction_type: PredictionType::Event,
            reference_id: event_id,
            direction_or_outcome: if prediction { 1 } else { 0 },
            amount,
            odds_at_bet: odds,
            status: PredictionStatus::Active,
            payout: 0,
            created_at,
        }
    }

    /// Get crypto direction if this is a crypto prediction
    pub fn get_crypto_direction(&self) -> Option<PredictionDirection> {
        if self.prediction_type == PredictionType::Crypto {
            Some(if self.direction_or_outcome == 1 {
                PredictionDirection::Up
            } else {
                PredictionDirection::Down
            })
        } else {
            None
        }
    }

    /// Get event prediction if this is an event prediction
    pub fn get_event_prediction(&self) -> Option<bool> {
        if self.prediction_type == PredictionType::Event {
            Some(self.direction_or_outcome == 1)
        } else {
            None
        }
    }

    /// Calculate potential payout based on odds at bet time
    pub fn calculate_payout(&self) -> u64 {
        (self.amount * self.odds_at_bet) / 10000
    }
}

/// Operations that can be executed on the arcade hub.
#[derive(Debug, Clone, Serialize, Deserialize, GraphQLMutationRoot)]
pub enum Operation {
    // ========== EXISTING OPERATIONS (DO NOT MODIFY) ==========
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

    // ========== TOKEN ECONOMY OPERATIONS ==========
    /// Claim daily bonus (100 coins).
    ClaimDailyBonus,

    // ========== CRYPTO PREDICTION OPERATIONS ==========
    /// Create a new crypto prediction round (admin only via backend).
    CreateCryptoRound {
        asset: CryptoAsset,
        start_price: u64,
        duration_secs: u64,
    },
    /// Place a crypto price prediction.
    PlaceCryptoPrediction {
        round_id: u64,
        direction: PredictionDirection,
        amount: u64,
    },
    /// Resolve a crypto round with end price (admin only via backend).
    ResolveCryptoRound {
        round_id: u64,
        end_price: u64,
    },

    // ========== WORLD EVENT PREDICTION OPERATIONS ==========
    /// Create a new world event market (admin only via backend).
    CreateWorldEvent {
        title: String,
        description: String,
        category: String,
        end_time: u64,
    },
    /// Place a world event prediction.
    PlaceEventPrediction {
        event_id: u64,
        prediction: bool, // true = YES, false = NO
        amount: u64,
    },
    /// Resolve a world event (admin only via backend).
    ResolveWorldEvent {
        event_id: u64,
        outcome: bool, // true = YES won, false = NO won
    },
}

/// Response from contract operations.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ArcadeResponse {
    // ========== EXISTING RESPONSES ==========
    /// Player was registered successfully.
    PlayerRegistered,
    /// Score was submitted successfully with XP earned.
    ScoreSubmitted { xp_earned: u64, coins_earned: u64 },
    /// Username was updated successfully.
    UsernameUpdated,
    /// Operation failed with an error.
    Error(String),

    // ========== TOKEN ECONOMY RESPONSES ==========
    /// Daily bonus claimed successfully.
    DailyBonusClaimed { coins: u64 },

    // ========== PREDICTION RESPONSES ==========
    /// Crypto round created successfully.
    CryptoRoundCreated { round_id: u64 },
    /// Crypto prediction placed successfully.
    CryptoPredictionPlaced { prediction_id: u64, odds: u64 },
    /// Crypto round resolved.
    CryptoRoundResolved { winning_direction: PredictionDirection },
    /// World event created successfully.
    WorldEventCreated { event_id: u64 },
    /// Event prediction placed successfully.
    EventPredictionPlaced { prediction_id: u64, odds: u64 },
    /// World event resolved.
    WorldEventResolved { outcome: bool },
}

/// Messages sent between chains for hub aggregation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Message {
    // ========== EXISTING MESSAGES ==========
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
        coins: u64,
    },

    // ========== PREDICTION MESSAGES ==========
    /// Sync a crypto round to all chains.
    SyncCryptoRound(CryptoRound),
    /// Sync a world event to all chains.
    SyncWorldEvent(WorldEvent),
    /// Sync a prediction placement.
    SyncPrediction(Prediction),
    /// Sync prediction resolution results.
    SyncPredictionResult {
        prediction_id: u64,
        won: bool,
        payout: u64,
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
    // ========== EXISTING ERRORS ==========
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

    // ========== TOKEN ECONOMY ERRORS ==========
    #[error("Daily bonus already claimed today")]
    DailyBonusAlreadyClaimed,
    #[error("Insufficient coins balance")]
    InsufficientCoins,

    // ========== PREDICTION ERRORS ==========
    #[error("Crypto round not found")]
    CryptoRoundNotFound,
    #[error("Round is not accepting bets")]
    RoundNotAcceptingBets,
    #[error("Round is already resolved")]
    RoundAlreadyResolved,
    #[error("World event not found")]
    WorldEventNotFound,
    #[error("Event is not accepting bets")]
    EventNotAcceptingBets,
    #[error("Event is already resolved")]
    EventAlreadyResolved,
    #[error("Minimum bet amount is 10 coins")]
    BetTooSmall,
    #[error("Maximum bet amount is 10000 coins")]
    BetTooLarge,
    #[error("Prediction not found")]
    PredictionNotFound,
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
