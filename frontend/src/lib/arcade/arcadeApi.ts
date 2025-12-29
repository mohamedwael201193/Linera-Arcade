/**
 * Arcade API - High-level interface for Arcade Hub operations
 * 
 * HYBRID ARCHITECTURE:
 * - READS (leaderboard, stats, etc.) → Backend API (for global aggregation)
 * - WRITES (register, submit score) → Linera blockchain (for authenticity)
 * 
 * After each blockchain write, we also sync to the backend for global visibility.
 */

import { lineraAdapter } from '../linera';
import { backendApi } from '../api/backendApi';
import {
  GET_PLAYER,
  REGISTER_PLAYER,
  SUBMIT_SCORE,
  GET_COIN_BALANCE,
  CLAIM_DAILY_BONUS,
  PLACE_CRYPTO_PREDICTION,
  PLACE_EVENT_PREDICTION,
} from './queries';
import type {
  Player,
  LeaderboardEntry,
  GameScore,
  GameHighScoreEntry,
} from './types';
import { GameType } from './types';

// =============================================================================
// RESPONSE TYPES (for blockchain queries)
// =============================================================================

interface PlayerResponse {
  player: Player | null;
}

interface RegisterPlayerResponse {
  registerPlayer: string | null;
}

interface SubmitScoreResponse {
  submitScore: string | null;
}

// =============================================================================
// XP CALCULATION (must match contract)
// =============================================================================

function calculateXP(gameType: GameType, score: number, bonusData?: number): number {
  switch (gameType) {
    case GameType.SPEED_CLICKER:
      return score * 10;
    case GameType.MEMORY_MATRIX:
      return score * 100 + (bonusData || 0) * 50;
    case GameType.REACTION_STRIKE:
      const base = Math.max(0, 1000 - score);
      return base * (bonusData || 0);
    case GameType.MATH_BLITZ:
      return score * 25 + (bonusData || 0) * 10;
    case GameType.SNAKE_SPRINT:
      return score * 15 + (bonusData || 0) * 5;
    case GameType.AIM_TRAINER:
      return score * 20 + Math.floor((bonusData || 0) / 10) * 5;
    case GameType.COLOR_RUSH:
      return score * 30 + (bonusData || 0) * 10;
    case GameType.TYPING_BLITZ:
      return score * 25 + Math.floor((bonusData || 0) / 10) * 5;
    default:
      return score;
  }
}

// =============================================================================
// ARCADE API CLASS
// =============================================================================

/**
 * ArcadeApi provides typed access to all Arcade Hub operations
 * Uses backend API for reads and blockchain for writes
 */
class ArcadeApiClass {
  /**
   * Normalize wallet address to lowercase
   */
  private normalizeWallet(wallet: string): string {
    return wallet.toLowerCase();
  }

  // ===========================================================================
  // PLAYER OPERATIONS
  // ===========================================================================

  /**
   * Get a player by wallet address
   * First tries backend, falls back to blockchain for own chain data.
   * Auto-syncs to backend if player exists on blockchain but not on backend.
   * 
   * @param wallet - Wallet address (0x...)
   * @returns Player or null if not registered
   */
  async getPlayer(wallet: string): Promise<Player | null> {
    const normalizedWallet = this.normalizeWallet(wallet);
    
    // Try backend first (has global data)
    try {
      const backendPlayer = await backendApi.getPlayer(wallet);
      if (backendPlayer) {
        return {
          owner: backendPlayer.walletAddress,
          username: backendPlayer.username,
          totalXp: backendPlayer.totalXp,
          level: backendPlayer.level,
          gamesPlayed: 0,
          registeredAt: 0,
        };
      }
    } catch {
      // Backend player not found, try blockchain
    }
    
    // Fall back to blockchain query (own chain)
    try {
      const result = await lineraAdapter.query<PlayerResponse>(
        GET_PLAYER,
        { wallet: normalizedWallet }
      );
      
      if (result.player) {
        // Auto-sync to backend if player exists on blockchain but not on backend
        console.log('📡 Player found on blockchain but not backend, auto-syncing...');
        try {
          const chainId = lineraAdapter.getChainId();
          await backendApi.registerPlayer(wallet, result.player.username, chainId || undefined);
          console.log('✅ Player auto-synced to backend!');
        } catch (syncErr) {
          console.warn('⚠️ Failed to auto-sync player to backend:', syncErr);
        }
        
        return result.player;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get player from blockchain:', error);
      return null;
    }
  }

  /**
   * Get all registered players from backend
   * 
   * @returns Array of all players
   */
  async getAllPlayers(): Promise<Player[]> {
    try {
      const players = await backendApi.getAllPlayers();
      return players.map(p => ({
        owner: p.walletAddress,
        username: p.username,
        totalXp: p.totalXp,
        level: p.level,
        gamesPlayed: 0,
        registeredAt: 0,
      }));
    } catch (error) {
      console.error('Failed to get all players:', error);
      return [];
    }
  }

  /**
   * Register a new player
   * 1. Submits to blockchain (for authenticity)
   * 2. Syncs to backend (for global visibility)
   * 
   * @param username - Display username (3-20 chars, alphanumeric + underscore/hyphen)
   * @returns true if registration was initiated
   */
  async registerPlayer(username: string): Promise<boolean> {
    console.log(`📝 Registering player: ${username}`);
    
    // Step 1: Submit to blockchain
    await lineraAdapter.mutate<RegisterPlayerResponse>(
      REGISTER_PLAYER,
      { username }
    );
    
    console.log('✅ Player registered on blockchain');
    
    // Step 2: Sync to backend (async, don't wait)
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (wallet) {
      backendApi.registerPlayer(wallet, username, chainId || undefined)
        .then(() => console.log('✅ Player synced to backend'))
        .catch(err => console.warn('⚠️ Failed to sync to backend:', err));
    }
    
    return true;
  }

  /**
   * Sync existing blockchain player to backend leaderboard
   * Call this manually if player exists on blockchain but not on backend
   * 
   * @returns true if sync was successful
   */
  async syncToLeaderboard(): Promise<boolean> {
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    console.log('📡 Syncing player to global leaderboard...');
    
    // Get player from blockchain
    const result = await lineraAdapter.query<PlayerResponse>(
      GET_PLAYER,
      { wallet: wallet.toLowerCase() }
    );
    
    if (!result.player) {
      throw new Error('Player not found on blockchain. Please register first.');
    }
    
    // Sync to backend
    await backendApi.registerPlayer(wallet, result.player.username, chainId || undefined);
    
    // Also sync XP if they have any
    if (result.player.totalXp > 0) {
      await backendApi.submitScore(
        wallet,
        GameType.SNAKE_SPRINT, // Use proper enum value (SCREAMING_SNAKE_CASE)
        0,
        result.player.totalXp,
        undefined,
        chainId || undefined
      );
    }
    
    console.log('✅ Player synced to global leaderboard!');
    return true;
  }

  // ===========================================================================
  // LEADERBOARD OPERATIONS (from backend)
  // ===========================================================================

  /**
   * Get global leaderboard ranked by XP
   * Fetches from backend which aggregates all players
   * 
   * @param limit - Maximum number of entries (default 100)
   * @returns Array of LeaderboardEntry
   */
  async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    try {
      const entries = await backendApi.getLeaderboard(limit);
      return entries.map(e => ({
        walletAddress: e.walletAddress,
        username: e.username,
        totalXp: e.totalXp,
        level: e.level,
        rank: e.rank,
      }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Get a player's rank on the global leaderboard
   * 
   * @param wallet - Wallet address
   * @returns Rank (1-indexed) or null if not on leaderboard
   */
  async getPlayerRank(wallet: string): Promise<number | null> {
    try {
      return await backendApi.getPlayerRank(wallet);
    } catch (error) {
      console.error('Failed to get player rank:', error);
      return null;
    }
  }

  // ===========================================================================
  // SCORE OPERATIONS
  // ===========================================================================

  /**
   * Submit a game score
   * 1. Submits to blockchain (for authenticity and XP calculation)
   * 2. Syncs to backend (for global leaderboard)
   * 
   * @param gameType - Type of game played
   * @param score - Raw score achieved
   * @param bonusData - Optional bonus data (varies by game)
   * @returns true if score submission was initiated
   */
  async submitScore(
    gameType: GameType,
    score: number,
    bonusData?: number
  ): Promise<boolean> {
    console.log(`🎮 Submitting score: ${score} for ${gameType}`);
    
    // Step 1: Submit to blockchain
    await lineraAdapter.mutate<SubmitScoreResponse>(
      SUBMIT_SCORE,
      {
        gameType,
        score,
        bonusData: bonusData ?? null,
      }
    );
    
    console.log('✅ Score submitted to blockchain');
    
    // Step 2: Calculate XP (same formula as contract)
    const xpEarned = calculateXP(gameType, score, bonusData);
    
    // Step 3: Sync to backend (async, don't wait)
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (wallet) {
      backendApi.submitScore(wallet, gameType, score, xpEarned, bonusData, chainId || undefined)
        .then(() => console.log('✅ Score synced to backend'))
        .catch(err => console.warn('⚠️ Failed to sync score to backend:', err));
    }
    
    return true;
  }

  /**
   * Get recent scores across all games (from backend)
   * 
   * @param limit - Maximum number of scores (default 50)
   * @returns Array of recent GameScore
   */
  async getRecentScores(limit: number = 50): Promise<GameScore[]> {
    try {
      const scores = await backendApi.getRecentScores(limit);
      return scores.map(s => ({
        id: s.id,
        gameType: s.gameType as unknown as GameType,
        player: s.player,
        score: s.score,
        xpEarned: s.xpEarned,
        bonusData: s.bonusData ?? null,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get recent scores:', error);
      return [];
    }
  }

  /**
   * Get scores for a specific game type (from backend)
   * 
   * @param gameType - Type of game
   * @param limit - Maximum number of scores (default 50)
   * @returns Array of GameScore
   */
  async getGameScores(gameType: GameType, limit: number = 50): Promise<GameScore[]> {
    try {
      const scores = await backendApi.getGameScores(gameType, limit);
      return scores.map(s => ({
        id: s.id,
        gameType: s.gameType as unknown as GameType,
        player: s.player,
        score: s.score,
        xpEarned: s.xpEarned,
        bonusData: s.bonusData ?? null,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get game scores:', error);
      return [];
    }
  }

  /**
   * Get high scores for a specific game type (from backend)
   * 
   * @param gameType - Type of game
   * @param limit - Maximum number of entries (default 10)
   * @returns Array of GameHighScoreEntry
   */
  async getGameHighScores(
    gameType: GameType,
    limit: number = 10
  ): Promise<GameHighScoreEntry[]> {
    try {
      const scores = await backendApi.getGameHighScores(gameType, limit);
      return scores.map(s => ({
        player: s.player,
        username: s.playerName,
        score: s.score,
        xpEarned: s.xpEarned,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get game high scores:', error);
      return [];
    }
  }

  /**
   * Get global stats from backend
   */
  async getStats(): Promise<{
    totalPlayers: number;
    totalGamesPlayed: number;
    totalXpEarned: number;
    topXp: number;
    highestLevel: number;
  }> {
    try {
      return await backendApi.getStats();
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPlayers: 0,
        totalGamesPlayed: 0,
        totalXpEarned: 0,
        topXp: 0,
        highestLevel: 1,
      };
    }
  }

  // ===========================================================================
  // COIN & PREDICTION OPERATIONS (NEW)
  // ===========================================================================

  /**
   * Get user's coin balance from blockchain
   * 
   * @param wallet - Wallet address
   * @returns Coin balance or 0 if not found
   */
  async getCoinBalance(wallet: string): Promise<number> {
    try {
      const result = await lineraAdapter.query<{ coinBalance: number }>(
        GET_COIN_BALANCE,
        { wallet: wallet.toLowerCase() }
      );
      return result.coinBalance || 0;
    } catch (error) {
      console.error('Failed to get coin balance:', error);
      // Fall back to backend
      try {
        const balance = await backendApi.getCoinBalance(wallet);
        return balance.balance || 0;
      } catch {
        return 0;
      }
    }
  }

  /**
   * Claim daily bonus (100 coins)
   * 1. Submits to blockchain
   * 2. Syncs to backend
   * 
   * @returns true if bonus was claimed
   */
  async claimDailyBonus(): Promise<boolean> {
    console.log('🎁 Claiming daily bonus...');
    
    try {
      // Step 1: Submit to blockchain
      await lineraAdapter.mutate<{ claimDailyBonus: boolean }>(
        CLAIM_DAILY_BONUS,
        {}
      );
      
      console.log('✅ Daily bonus claimed on blockchain');
      
      // Step 2: Sync to backend
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        backendApi.claimDailyBonus(wallet)
          .then(() => console.log('✅ Daily bonus synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync bonus to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to claim daily bonus:', error);
      
      // Try backend-only claim if blockchain fails
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        try {
          const result = await backendApi.claimDailyBonus(wallet);
          return result.success;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  /**
   * Place a crypto prediction (UP/DOWN)
   * 1. Submits to blockchain
   * 2. Syncs to backend
   * 
   * @param roundId - Crypto round ID
   * @param direction - 'UP' or 'DOWN'
   * @param coinsStaked - Amount of coins to stake
   * @returns true if prediction was placed
   */
  async placeCryptoPrediction(
    roundId: number,
    direction: 'UP' | 'DOWN',
    coinsStaked: number
  ): Promise<boolean> {
    console.log(`📊 Placing crypto prediction: ${direction} with ${coinsStaked} coins`);
    
    try {
      // Step 1: Submit to blockchain
      // Variable names must match the GraphQL mutation: round_id, direction, amount
      await lineraAdapter.mutate<{ placeCryptoPrediction: boolean }>(
        PLACE_CRYPTO_PREDICTION,
        { round_id: roundId, direction, amount: coinsStaked }
      );
      
      console.log('✅ Crypto prediction placed on blockchain');
      
      // Step 2: Sync to backend
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        backendApi.placeCryptoPrediction(wallet, roundId, direction, coinsStaked)
          .then(() => console.log('✅ Prediction synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync prediction to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to place crypto prediction:', error);
      return false;
    }
  }

  /**
   * Place a world event prediction
   * 1. Submits to blockchain
   * 2. Syncs to backend
   * 
   * @param eventId - World event ID
   * @param outcome - Predicted outcome
   * @param coinsStaked - Amount of coins to stake
   * @returns true if prediction was placed
   */
  async placeEventPrediction(
    eventId: number,
    outcome: string,
    coinsStaked: number
  ): Promise<boolean> {
    console.log(`🌍 Placing event prediction: ${outcome} with ${coinsStaked} coins`);
    
    try {
      // Step 1: Submit to blockchain
      // Variable names must match the GraphQL mutation: event_id, outcome, amount
      await lineraAdapter.mutate<{ placeEventPrediction: boolean }>(
        PLACE_EVENT_PREDICTION,
        { event_id: eventId, outcome, amount: coinsStaked }
      );
      
      console.log('✅ Event prediction placed on blockchain');
      
      // Step 2: Sync to backend
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        backendApi.placeEventPrediction(wallet, eventId, outcome, coinsStaked)
          .then(() => console.log('✅ Prediction synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync prediction to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to place event prediction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const arcadeApi = new ArcadeApiClass();

// Also export the class for testing
export { ArcadeApiClass };
