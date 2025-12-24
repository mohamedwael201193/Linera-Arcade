/**
 * Arcade Module - Re-exports for clean imports
 */

// Types
export {
  GameType,
  GAME_TYPE_NAMES,
  GAME_ID_TO_TYPE,
  type Player,
  type LeaderboardEntry,
  type GameScore,
  type GameHighScoreEntry,
  type ArcadeStats,
  type ScoreSubmission,
} from './types';

// Queries (for debugging/inspection)
export * from './queries';

// API
export { arcadeApi, ArcadeApiClass } from './arcadeApi';
