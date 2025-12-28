// Frontend game types (SCREAMING_SNAKE_CASE - matches async_graphql default)
export type GameType = 
  | 'SPEED_CLICKER'
  | 'MEMORY_MATRIX'
  | 'REACTION_STRIKE'
  | 'MATH_BLITZ'
  | 'SNAKE_SPRINT'
  | 'AIM_TRAINER'
  | 'COLOR_RUSH'
  | 'TYPING_BLITZ';

// Contract game types - only the original 5 that exist on blockchain
export type ContractGameType = 
  | 'SPEED_CLICKER'
  | 'MEMORY_MATRIX'
  | 'REACTION_STRIKE'
  | 'MATH_BLITZ'
  | 'SNAKE_SPRINT';

// Map frontend GameType to contract GameType
// New games map to similar existing games for blockchain submission
export const GAME_TYPE_TO_CONTRACT: Record<GameType, ContractGameType> = {
  SPEED_CLICKER: 'SPEED_CLICKER',
  MEMORY_MATRIX: 'MEMORY_MATRIX',
  REACTION_STRIKE: 'REACTION_STRIKE',
  MATH_BLITZ: 'MATH_BLITZ',
  SNAKE_SPRINT: 'SNAKE_SPRINT',
  // New games map to similar existing games
  AIM_TRAINER: 'REACTION_STRIKE',  // Both are reflex/accuracy games
  COLOR_RUSH: 'MEMORY_MATRIX',      // Both test pattern recognition
  TYPING_BLITZ: 'MATH_BLITZ',       // Both are speed/accuracy challenges
};

// Map contract GameType to frontend GameType
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
  AIM_TRAINER: {
    id: 'AIM_TRAINER',
    name: 'Aim Trainer',
    description: 'Click targets as fast as possible!',
    color: '#ff0055',
    icon: 'Target',
    instructions: [
      'Click on targets before they disappear',
      'Smaller targets are harder but spawn faster',
      'Build combos for accuracy bonus',
    ],
    xpFormula: 'XP = hits × 20 + accuracy_bonus',
  },
  COLOR_RUSH: {
    id: 'COLOR_RUSH',
    name: 'Color Rush',
    description: 'Match the color shown - but watch out for tricks!',
    color: '#bf00ff',
    icon: 'Palette',
    instructions: [
      'Click the COLOR shown, not the word!',
      'The word might trick you - focus on the actual color',
      'Build streaks for bonus points',
    ],
    xpFormula: 'XP = matches × 30 + streak_bonus',
  },
  TYPING_BLITZ: {
    id: 'TYPING_BLITZ',
    name: 'Typing Blitz',
    description: 'Type words as fast as you can!',
    color: '#00ffaa',
    icon: 'Keyboard',
    instructions: [
      'Type the displayed word correctly',
      'Press TAB to skip, ESC to clear',
      'Difficulty increases as you type more',
    ],
    xpFormula: 'XP = words × 25 + WPM_bonus',
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
    case 'AIM_TRAINER':
      return score * 20 + Math.floor((bonusData || 0) / 10) * 5;
    case 'COLOR_RUSH':
      return score * 30 + (bonusData || 0) * 10;
    case 'TYPING_BLITZ':
      return score * 25 + Math.floor((bonusData || 0) / 10) * 5;
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

// =============================================================================
// PREDICTION MARKET TYPES
// =============================================================================

// Crypto asset types for predictions
export type CryptoAsset = 'BTC' | 'ETH';

// Prediction direction for crypto
export type PredictionDirection = 'UP' | 'DOWN';

// Prediction status
export type PredictionStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';

// Round status
export type RoundStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

// Event status
export type EventStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

// Crypto prediction round
export interface CryptoRound {
  id: number;
  asset: CryptoAsset;
  startPrice: number;        // Price in cents
  endPrice: number | null;   // Price in cents when resolved
  startTime: number;         // Unix timestamp
  endTime: number;           // Unix timestamp
  status: RoundStatus;
  result: PredictionDirection | null;  // Actual result when resolved
  totalUp: number;           // Total coins bet on UP
  totalDown: number;         // Total coins bet on DOWN
  createdAt?: string;
}

// World event for predictions
export interface WorldEvent {
  id: number;
  title: string;
  description: string;
  category: string;          // 'crypto_news' | 'tech' | 'finance' | 'sports'
  outcomes: string[];        // Possible outcomes
  correctOutcome: string | null;
  startTime: number;
  endTime: number;
  status: EventStatus;
  imageUrl?: string;
  source?: string;
  createdAt?: string;
}

// User prediction
export interface Prediction {
  id: number;
  walletAddress: string;
  predictionType: 'CRYPTO' | 'WORLD_EVENT';
  referenceId: number;       // Round ID or Event ID
  directionOrOutcome: string; // 'UP'/'DOWN' or event outcome
  coinsStaked: number;
  coinsWon: number | null;
  status: PredictionStatus;
  createdAt: string;
}

// Activity log entry
export interface ActivityLog {
  id: number;
  walletAddress: string;
  username: string;
  activityType: 'PREDICTION' | 'GAME' | 'CLAIM_BONUS' | 'WIN';
  description: string;
  coinsChange: number;
  referenceId: number | null;
  createdAt: string;
}

// Price data from Binance
export interface CryptoPrice {
  symbol: CryptoAsset;
  priceUsd: number;
  priceCents: number;
  formatted: string;
  timestamp: number;
}

// User coin balance
export interface CoinBalance {
  walletAddress: string;
  balance: number;
  lastDailyClaim: string | null;
  canClaimDaily: boolean;
}

// Prediction stats for user
export interface PredictionStats {
  totalPredictions: number;
  wins: number;
  losses: number;
  pending: number;
  totalStaked: number;
  totalWon: number;
  winRate: number;
}

// =============================================================================
// PREDICTION HELPER FUNCTIONS
// =============================================================================

// Format coin amount
export function formatCoins(coins: number | null | undefined): string {
  if (coins === null || coins === undefined) {
    return '0';
  }
  if (coins >= 1000000) {
    return `${(coins / 1000000).toFixed(1)}M`;
  }
  if (coins >= 1000) {
    return `${(coins / 1000).toFixed(1)}K`;
  }
  return coins.toString();
}

// Format price from cents to USD
export function formatPrice(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Calculate time remaining
export function getTimeRemaining(endTime: number): { minutes: number; seconds: number; total: number } {
  const total = Math.max(0, endTime - Date.now());
  return {
    minutes: Math.floor((total / 1000 / 60) % 60),
    seconds: Math.floor((total / 1000) % 60),
    total,
  };
}

// Check if round/event is active
export function isActive(status: RoundStatus | EventStatus): boolean {
  return status === 'ACTIVE';
}

// Calculate potential winnings (simplified 2x payout)
export function calculatePotentialWinnings(stake: number): number {
  return stake * 2;
}

// Get prediction status color
export function getPredictionStatusColor(status: PredictionStatus): string {
  switch (status) {
    case 'WON': return '#00ff00';
    case 'LOST': return '#ff0000';
    case 'PENDING': return '#ffff00';
    case 'CANCELLED': return '#888888';
    default: return '#ffffff';
  }
}

// Get asset color
export function getAssetColor(asset: CryptoAsset): string {
  switch (asset) {
    case 'BTC': return '#f7931a';
    case 'ETH': return '#627eea';
    default: return '#ffffff';
  }
}

// Get direction color
export function getDirectionColor(direction: PredictionDirection): string {
  switch (direction) {
    case 'UP': return '#00ff00';
    case 'DOWN': return '#ff0000';
    default: return '#ffffff';
  }
}
