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
        // Return blockchain data directly - sync happens on register/score submit
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
}

// Export singleton instance
export const arcadeApi = new ArcadeApiClass();

// Also export the class for testing
export { ArcadeApiClass };
