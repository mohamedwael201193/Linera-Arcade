/**
 * Arcade Hub GraphQL Queries and Mutations
 * 
 * All GraphQL operations for the Arcade Hub contract.
 * These match the schema defined in the Rust service.
 * 
 * Contract Schema Reference:
 * - Player: owner, username, total_xp (totalXp), level, games_played (gamesPlayed), registered_at (registeredAt)
 * - LeaderboardEntry: wallet_address (walletAddress), username, total_xp (totalXp), level, rank
 * - GameScore: id, game_type (gameType), player, score, xp_earned (xpEarned), bonus_data (bonusData), timestamp
 * - GameHighScoreEntry: player, username, score, xp_earned (xpEarned), timestamp
 * - GameType enum: SPEED_CLICKER, MEMORY_MATRIX, REACTION_STRIKE, MATH_BLITZ, SNAKE_SPRINT
 */

// =============================================================================
// QUERIES
// =============================================================================

/**
 * Get a player by wallet address
 */
export const GET_PLAYER = `
  query GetPlayer($wallet: String!) {
    player(wallet: $wallet) {
      owner
      username
      totalXp
      level
      gamesPlayed
      registeredAt
    }
  }
`;

/**
 * Get all registered players
 */
export const GET_ALL_PLAYERS = `
  query GetAllPlayers {
    allPlayers {
      owner
      username
      totalXp
      level
      gamesPlayed
      registeredAt
    }
  }
`;

/**
 * Get global leaderboard ranked by XP
 * Returns LeaderboardEntry objects with rank assigned
 */
export const GET_LEADERBOARD = `
  query GetLeaderboard($limit: Int) {
    leaderboard(limit: $limit) {
      walletAddress
      username
      totalXp
      level
      rank
    }
  }
`;

/**
 * Get a player's rank on the global leaderboard
 */
export const GET_PLAYER_RANK = `
  query GetPlayerRank($wallet: String!) {
    playerRank(wallet: $wallet)
  }
`;

/**
 * Get recent scores across all games
 */
export const GET_RECENT_SCORES = `
  query GetRecentScores($limit: Int) {
    recentScores(limit: $limit) {
      id
      gameType
      player
      score
      xpEarned
      bonusData
      timestamp
    }
  }
`;

/**
 * Get scores for a specific game type
 */
export const GET_GAME_SCORES = `
  query GetGameScores($gameType: GameType!, $limit: Int) {
    gameScores(gameType: $gameType, limit: $limit) {
      id
      gameType
      player
      score
      xpEarned
      bonusData
      timestamp
    }
  }
`;

/**
 * Get high scores for a specific game type (best per player)
 */
export const GET_GAME_HIGH_SCORES = `
  query GetGameHighScores($gameType: GameType!, $limit: Int) {
    gameHighScores(gameType: $gameType, limit: $limit) {
      player
      username
      score
      xpEarned
      timestamp
    }
  }
`;

/**
 * Get arcade statistics
 */
export const GET_STATS = `
  query GetStats {
    stats {
      totalPlayers
      totalGamesPlayed
      totalXpEarned
    }
  }
`;

// =============================================================================
// MUTATIONS
// =============================================================================

/**
 * Register a new player
 * The Operation enum in the contract: RegisterPlayer { username: String }
 * 
 * NOTE: Linera mutations don't return complex types - just execute the mutation
 * then query player state to verify registration.
 */
export const REGISTER_PLAYER = `
  mutation RegisterPlayer($username: String!) {
    registerPlayer(username: $username)
  }
`;

/**
 * Submit a game score
 * The Operation enum in the contract: SubmitScore { game_type, score, bonus_data }
 * 
 * NOTE: Linera mutations don't return complex types directly.
 * After mutation, query player state to get updated XP.
 * XP is calculated by contract (30-75 per game, capped).
 */
export const SUBMIT_SCORE = `
  mutation SubmitScore($gameType: GameType!, $score: Int!, $bonusData: Int) {
    submitScore(gameType: $gameType, score: $score, bonusData: $bonusData)
  }
`;

/**
 * Submit a multiplayer game result
 * The Operation enum in the contract: SubmitMultiplayerResult { game_type, room_code, is_winner, opponent_username }
 * HYBRID SYSTEM: Games play via WebSocket for speed, then final result goes on-chain.
 */
export const SUBMIT_MULTIPLAYER_RESULT = `
  mutation SubmitMultiplayerResult($gameType: String!, $roomCode: String!, $isWinner: Boolean!, $opponentUsername: String!) {
    submitMultiplayerResult(gameType: $gameType, roomCode: $roomCode, isWinner: $isWinner, opponentUsername: $opponentUsername)
  }
`;

/**
 * Update a player's username
 * The Operation enum in the contract: UpdateUsername { new_username: String }
 */
export const UPDATE_USERNAME = `
  mutation UpdateUsername($newUsername: String!) {
    updateUsername(newUsername: $newUsername)
  }
`;

// =============================================================================
// PREDICTION QUERIES (NEW)
// =============================================================================

/**
 * Get user's coin balance
 */
export const GET_COIN_BALANCE = `
  query GetCoinBalance($wallet: String!) {
    coinBalance(wallet: $wallet)
  }
`;

/**
 * Get all crypto rounds
 */
export const GET_CRYPTO_ROUNDS = `
  query GetCryptoRounds {
    cryptoRounds {
      id
      asset
      startPrice
      endPrice
      startTime
      endTime
      status
      result
      totalUp
      totalDown
    }
  }
`;

/**
 * Get active crypto rounds
 */
export const GET_ACTIVE_CRYPTO_ROUNDS = `
  query GetActiveCryptoRounds {
    activeCryptoRounds {
      id
      asset
      startPrice
      endPrice
      startTime
      endTime
      status
      result
      totalUp
      totalDown
    }
  }
`;

/**
 * Get all world events
 */
export const GET_WORLD_EVENTS = `
  query GetWorldEvents {
    worldEvents {
      id
      title
      description
      category
      outcomes
      correctOutcome
      startTime
      endTime
      status
    }
  }
`;

/**
 * Get active world events
 */
export const GET_ACTIVE_WORLD_EVENTS = `
  query GetActiveWorldEvents {
    activeWorldEvents {
      id
      title
      description
      category
      outcomes
      correctOutcome
      startTime
      endTime
      status
    }
  }
`;

/**
 * Get user's predictions
 */
export const GET_USER_PREDICTIONS = `
  query GetUserPredictions($wallet: String!) {
    userPredictions(wallet: $wallet) {
      id
      predictionType
      referenceId
      directionOrOutcome
      coinsStaked
      coinsWon
      status
      createdAt
    }
  }
`;

// =============================================================================
// PREDICTION MUTATIONS (NEW)
// =============================================================================

/**
 * Claim daily bonus (100 coins)
 */
export const CLAIM_DAILY_BONUS = `
  mutation ClaimDailyBonus {
    claimDailyBonus
  }
`;

/**
 * Create a new crypto prediction round ON-CHAIN
 * This creates the round in the blockchain state so predictions can be placed
 * Note: Field names must match the Rust Operation enum: asset, start_price, duration_secs
 */
export const CREATE_CRYPTO_ROUND = `
  mutation CreateCryptoRound($asset: CryptoAsset!, $start_price: Int!, $duration_secs: Int!) {
    createCryptoRound(asset: $asset, startPrice: $start_price, durationSecs: $duration_secs)
  }
`;

/**
 * Place a crypto prediction (UP/DOWN)
 * Note: Field names must match the Rust Operation enum: round_id, direction, amount
 */
export const PLACE_CRYPTO_PREDICTION = `
  mutation PlaceCryptoPrediction($round_id: Int!, $direction: PredictionDirection!, $amount: Int!) {
    placeCryptoPrediction(roundId: $round_id, direction: $direction, amount: $amount)
  }
`;

/**
 * Create a world event ON-CHAIN
 * This creates the event in the blockchain state so predictions can be placed
 * Note: Field names must match the Rust Operation enum: title, description, category, end_time
 */
export const CREATE_WORLD_EVENT = `
  mutation CreateWorldEvent($title: String!, $description: String!, $category: String!, $end_time: Int!) {
    createWorldEvent(title: $title, description: $description, category: $category, endTime: $end_time)
  }
`;

/**
 * Place a world event prediction
 * Note: Field names must match the Rust Operation enum: event_id, prediction (bool), amount
 */
export const PLACE_EVENT_PREDICTION = `
  mutation PlaceEventPrediction($event_id: Int!, $prediction: Boolean!, $amount: Int!) {
    placeEventPrediction(eventId: $event_id, prediction: $prediction, amount: $amount)
  }
`;

// =============================================================================
// NORMALIZED XP QUERIES (NEW - for display, divides by normalization_factor)
// =============================================================================

/**
 * Get the normalization factor (displayed XP = raw XP / factor)
 * Default is 10 to fix the 100k XP inflation issue
 */
export const GET_NORMALIZATION_FACTOR = `
  query GetNormalizationFactor {
    normalizationFactor
  }
`;

/**
 * Get leaderboard with NORMALIZED XP values for display
 * This is the preferred query for UI - shows corrected XP values
 */
export const GET_NORMALIZED_LEADERBOARD = `
  query GetNormalizedLeaderboard($limit: Int) {
    normalizedLeaderboard(limit: $limit) {
      walletAddress
      username
      totalXp
      level
      rank
    }
  }
`;

/**
 * Get a player with NORMALIZED XP values for display
 * Use this for showing player stats in UI
 */
export const GET_NORMALIZED_PLAYER = `
  query GetNormalizedPlayer($wallet: String!) {
    normalizedPlayer(wallet: $wallet) {
      owner
      username
      totalXp
      level
      gamesPlayed
      registeredAt
    }
  }
`;

// =============================================================================
// EVENT QUERIES (NEW - for polling-based real-time updates)
// =============================================================================

/**
 * Get recent events from the event log
 * Frontend polls this at 500-1000ms intervals for real-time updates
 * Linera-native approach: no WebSockets, just deterministic polling
 */
export const GET_RECENT_EVENTS = `
  query GetRecentEvents($limit: Int) {
    recentEvents(limit: $limit) {
      id
      timestamp
      eventType
    }
  }
`;

/**
 * Get recent game played events with detailed data
 * Used for activity feed
 */
export const GET_RECENT_GAME_EVENTS = `
  query GetRecentGameEvents($limit: Int) {
    recentGameEvents(limit: $limit) {
      player
      username
      gameType
      score
      xpEarned
      timestamp
    }
  }
`;

/**
 * Get total event count (for pagination)
 */
export const GET_EVENT_COUNT = `
  query GetEventCount {
    eventCount
  }
`;

// =============================================================================
// QUERY HELPERS
// =============================================================================

/**
 * Build a query string with inline variables (for simpler queries)
 */
export function buildInlineQuery(
  baseQuery: string, 
  variables: Record<string, unknown>
): string {
  let result = baseQuery;
  for (const [key, value] of Object.entries(variables)) {
    const replacement = typeof value === 'string' ? `"${value}"` : String(value);
    result = result.replace(new RegExp(`\\$${key}\\b`, 'g'), replacement);
  }
  return result;
}
