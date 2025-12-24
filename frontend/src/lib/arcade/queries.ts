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
 */
export const REGISTER_PLAYER = `
  mutation RegisterPlayer($username: String!) {
    registerPlayer(username: $username)
  }
`;

/**
 * Submit a game score
 * The Operation enum in the contract: SubmitScore { game_type, score, bonus_data }
 */
export const SUBMIT_SCORE = `
  mutation SubmitScore($gameType: GameType!, $score: Int!, $bonusData: Int) {
    submitScore(gameType: $gameType, score: $score, bonusData: $bonusData)
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
