// Frontend game types (SCREAMING_SNAKE_CASE - matches async_graphql default)
export type GameType = 
  | 'SPEED_CLICKER'
  | 'MEMORY_MATRIX'
  | 'REACTION_STRIKE'
  | 'MATH_BLITZ'
  | 'SNAKE_SPRINT';

// Contract game types (same as frontend - SCREAMING_SNAKE_CASE in async-graphql)
export type ContractGameType = GameType;

// Map frontend GameType to contract GameType (identity since they're the same)
export const GAME_TYPE_TO_CONTRACT: Record<GameType, ContractGameType> = {
  SPEED_CLICKER: 'SPEED_CLICKER',
  MEMORY_MATRIX: 'MEMORY_MATRIX',
  REACTION_STRIKE: 'REACTION_STRIKE',
  MATH_BLITZ: 'MATH_BLITZ',
  SNAKE_SPRINT: 'SNAKE_SPRINT',
};

// Map contract GameType to frontend GameType (identity since they're the same)
export const CONTRACT_TO_GAME_TYPE: Record<ContractGameType, GameType> = {
  SPEED_CLICKER: 'SPEED_CLICKER',
  MEMORY_MATRIX: 'MEMORY_MATRIX',
  REACTION_STRIKE: 'REACTION_STRIKE',
  MATH_BLITZ: 'MATH_BLITZ',
  SNAKE_SPRINT: 'SNAKE_SPRINT',
};

// Player data
export interface Player {
  owner: string;
  username: string;
  totalXp: number;
  level: number;
  gamesPlayed: number;
  registeredAt: number;
}

// Leaderboard entry
export interface LeaderboardEntry {
  walletAddress: string;
  username: string;
  totalXp: number;
  level: number;
  rank: number;
}

// Game score
export interface GameScore {
  id: string;
  gameType: GameType;
  player: string;
  score: number;
  xpEarned: number;
  bonusData?: number;
  timestamp: number;
}

// Arcade statistics
export interface ArcadeStats {
  totalPlayers: number;
  totalGamesPlayed: number;
  totalXpEarned: number;
}

// Game configuration for UI
export interface GameConfig {
  id: GameType;
  name: string;
  description: string;
  color: string;
  icon: string;
  instructions: string[];
  xpFormula: string;
}

// Game result from playing
export interface GameResult {
  score: number;
  bonusData?: number;
  timeElapsed: number;
}

// All game configurations
export const GAME_CONFIGS: Record<GameType, GameConfig> = {
  SPEED_CLICKER: {
    id: 'SPEED_CLICKER',
    name: 'Speed Clicker',
    description: 'Click as fast as you can in 10 seconds!',
    color: '#ff00ff',
    icon: 'MousePointerClick',
    instructions: [
      'Click the button as many times as possible',
      'You have 10 seconds',
      'Each click counts towards your score',
    ],
    xpFormula: 'XP = clicks × 10',
  },
  MEMORY_MATRIX: {
    id: 'MEMORY_MATRIX',
    name: 'Memory Matrix',
    description: 'Memorize and repeat the pattern sequence.',
    color: '#00ffff',
    icon: 'Grid3X3',
    instructions: [
      'Watch the pattern carefully',
      'Repeat the pattern by clicking tiles',
      'Patterns get longer each level',
    ],
    xpFormula: 'XP = level × 100 + perfect_rounds × 50',
  },
  REACTION_STRIKE: {
    id: 'REACTION_STRIKE',
    name: 'Reaction Strike',
    description: 'Test your reflexes by hitting targets quickly.',
    color: '#00ff00',
    icon: 'Zap',
    instructions: [
      'Click targets as soon as they appear',
      'Faster reactions = better score',
      'Miss too many and the game ends',
    ],
    xpFormula: 'XP = (1000 - avg_ms) × targets_hit',
  },
  MATH_BLITZ: {
    id: 'MATH_BLITZ',
    name: 'Math Blitz',
    description: 'Solve math problems as fast as you can!',
    color: '#ffff00',
    icon: 'Calculator',
    instructions: [
      'Solve arithmetic problems quickly',
      'Build up combos for bonus points',
      '60 seconds on the clock',
    ],
    xpFormula: 'XP = correct × 25 + max_streak × 10',
  },
  SNAKE_SPRINT: {
    id: 'SNAKE_SPRINT',
    name: 'Snake Sprint',
    description: 'Classic snake game with a neon twist.',
    color: '#ff8800',
    icon: 'Gamepad2',
    instructions: [
      'Use arrow keys or WASD to move',
      'Eat apples to grow longer',
      "Don't hit the walls or yourself",
    ],
    xpFormula: 'XP = length × 15 + apples × 5',
  },
};

// Helper to get game config by ID
export function getGameConfig(gameType: GameType): GameConfig {
  return GAME_CONFIGS[gameType];
}

// Helper to calculate XP (client-side estimate)
export function estimateXp(gameType: GameType, score: number, bonusData?: number): number {
  switch (gameType) {
    case 'SPEED_CLICKER':
      return score * 10;
    case 'MEMORY_MATRIX':
      return score * 100 + (bonusData || 0) * 50;
    case 'REACTION_STRIKE':
      return Math.max(0, 1000 - score) * (bonusData || 0);
    case 'MATH_BLITZ':
      return score * 25 + (bonusData || 0) * 10;
    case 'SNAKE_SPRINT':
      return score * 15 + (bonusData || 0) * 5;
    default:
      return 0;
  }
}

// Calculate level from XP
export function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

// Calculate XP needed for next level
export function xpForLevel(level: number): number {
  return Math.pow(level, 2) * 100;
}

// Calculate progress to next level (0-100)
export function levelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp);
  const currentLevelXp = xpForLevel(currentLevel - 1);
  const nextLevelXp = xpForLevel(currentLevel);
  const progress = ((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100;
  return Math.min(100, Math.max(0, progress));
}
