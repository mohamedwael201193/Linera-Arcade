/**
 * Arcade Hub Types - TypeScript interfaces matching GraphQL schema
 * 
 * These types mirror the on-chain data structures for the Arcade Hub contract.
 * 
 * Contract Schema Reference:
 * - Player: owner, username, total_xp, level, games_played, registered_at
 * - LeaderboardEntry: wallet_address, username, total_xp, level, rank
 * - GameScore: id, game_type, player, score, xp_earned, bonus_data, timestamp
 * - GameHighScoreEntry: player, username, score, xp_earned, timestamp
 */

/**
 * Game types available in the Arcade Hub
 * Must match the contract's GraphQL GameType enum (async_graphql uses SCREAMING_SNAKE_CASE)
 */
export enum GameType {
  SPEED_CLICKER = 'SPEED_CLICKER',
  MEMORY_MATRIX = 'MEMORY_MATRIX',
  REACTION_STRIKE = 'REACTION_STRIKE',
  MATH_BLITZ = 'MATH_BLITZ',
  SNAKE_SPRINT = 'SNAKE_SPRINT',
}

/**
 * Map of game type to display name
 */
export const GAME_TYPE_NAMES: Record<GameType, string> = {
  [GameType.SPEED_CLICKER]: 'Speed Clicker',
  [GameType.MEMORY_MATRIX]: 'Memory Matrix',
  [GameType.REACTION_STRIKE]: 'Reaction Strike',
  [GameType.MATH_BLITZ]: 'Math Blitz',
  [GameType.SNAKE_SPRINT]: 'Snake Sprint',
};

/**
 * Map of game ID (URL slug) to GameType enum
 */
export const GAME_ID_TO_TYPE: Record<string, GameType> = {
  'speed-clicker': GameType.SPEED_CLICKER,
  'memory-matrix': GameType.MEMORY_MATRIX,
  'reaction-strike': GameType.REACTION_STRIKE,
  'math-blitz': GameType.MATH_BLITZ,
  'snake-sprint': GameType.SNAKE_SPRINT,
};

/**
 * Player profile stored on-chain
 * Matches: Player struct in contract lib.rs
 */
export interface Player {
  /** AccountOwner - wallet address */
  owner: string;
  /** Display username */
  username: string;
  /** Total XP earned across all games */
  totalXp: number;
  /** Current level (computed from XP) */
  level: number;
  /** Total number of games played */
  gamesPlayed: number;
  /** Unix timestamp (microseconds) when player registered */
  registeredAt: number;
}

/**
 * Leaderboard entry returned by leaderboard query
 * Matches: LeaderboardEntry struct in contract lib.rs
 */
export interface LeaderboardEntry {
  /** Wallet address (AccountOwner) */
  walletAddress: string;
  /** Display username */
  username: string;
  /** Total XP earned */
  totalXp: number;
  /** Current level */
  level: number;
  /** Position on leaderboard (1-indexed, assigned by query) */
  rank: number;
}

/**
 * Individual game score record
 * Matches: GameScore struct in contract lib.rs
 */
export interface GameScore {
  /** Unique score ID */
  id: number;
  /** Type of game played */
  gameType: GameType;
  /** Player wallet address (AccountOwner) */
  player: string;
  /** Raw score achieved */
  score: number;
  /** XP earned for this score */
  xpEarned: number;
  /** Optional bonus data (varies by game) */
  bonusData: number | null;
  /** Unix timestamp (microseconds) when score was submitted */
  timestamp: number;
}

/**
 * Per-game high score entry
 * Matches: GameHighScoreEntry struct in contract lib.rs
 * Note: Does NOT have rank field - rank is derived from array position
 */
export interface GameHighScoreEntry {
  /** Player wallet address (AccountOwner) */
  player: string;
  /** Player username */
  username: string;
  /** Score achieved */
  score: number;
  /** XP earned */
  xpEarned: number;
  /** Unix timestamp (microseconds) */
  timestamp: number;
}

/**
 * Arcade-wide statistics
 * Matches: ArcadeStats struct in contract lib.rs
 */
export interface ArcadeStats {
  /** Total number of registered players */
  totalPlayers: number;
  /** Total games played across all players */
  totalGamesPlayed: number;
  /** Total XP earned across all players */
  totalXpEarned: number;
}

/**
 * GraphQL response wrapper
 */
export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

/**
 * Bonus data structure for score submissions
 * Different games use bonus_data differently:
 * - SpeedClicker: not used
 * - MemoryMatrix: perfect_rounds
 * - ReactionStrike: targets_hit
 * - MathBlitz: max_streak
 * - SnakeSprint: apples_eaten
 */
export interface ScoreSubmission {
  gameType: GameType;
  score: number;
  bonusData?: number;
}
