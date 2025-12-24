/**
 * useLeaderboard Hook
 * 
 * Manages leaderboard data with automatic polling refresh.
 * Fetches from backend API (no blockchain connection required for reads).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { backendApi } from '../lib/api/backendApi';
import { 
  type LeaderboardEntry, 
  type GameHighScoreEntry,
  type GameType,
  GameType as GameTypeEnum,
} from '../lib/arcade';

// Refresh interval (30 seconds)
const REFRESH_INTERVAL = 30 * 1000;

/**
 * Leaderboard state returned by the hook
 */
export interface LeaderboardState {
  // Data
  leaderboard: LeaderboardEntry[];
  gameHighScores: Record<GameType, GameHighScoreEntry[]>;
  stats: {
    totalPlayers: number;
    topXp: number;
    highestLevel: number;
  };
  
  // Loading/error states
  isLoading: boolean;
  error: string | null;
  
  // Metadata
  lastUpdated: Date | null;
  
  // Actions
  refresh: () => Promise<void>;
  getGameHighScores: (gameType: GameType) => GameHighScoreEntry[];
}

/**
 * Hook for leaderboard data with auto-refresh
 * Fetches directly from backend API - no blockchain connection needed
 */
export function useLeaderboard(): LeaderboardState {
  // State
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [gameHighScores, setGameHighScores] = useState<Record<GameType, GameHighScoreEntry[]>>({
    [GameTypeEnum.SPEED_CLICKER]: [],
    [GameTypeEnum.MEMORY_MATRIX]: [],
    [GameTypeEnum.REACTION_STRIKE]: [],
    [GameTypeEnum.MATH_BLITZ]: [],
    [GameTypeEnum.SNAKE_SPRINT]: [],
  });
  const [stats, setStats] = useState({
    totalPlayers: 0,
    topXp: 0,
    highestLevel: 1,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Track if initial load has happened
  const initialLoadDone = useRef(false);
  const isRefreshing = useRef(false);
  
  /**
   * Fetch all leaderboard data from backend
   */
  const refresh = useCallback(async () => {
    // Prevent concurrent refreshes
    if (isRefreshing.current) {
      console.log('⏭️ Refresh already in progress, skipping...');
      return;
    }
    
    isRefreshing.current = true;
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🔄 Refreshing leaderboard data from backend...');
      
      // Fetch global leaderboard from backend
      const entries = await backendApi.getLeaderboard(100);
      
      // Transform to match frontend types
      const leaderboardData: LeaderboardEntry[] = entries.map(e => ({
        walletAddress: e.walletAddress,
        username: e.username,
        totalXp: e.totalXp,
        level: e.level,
        rank: e.rank,
      }));
      
      setLeaderboard(leaderboardData);
      
      // Fetch stats
      const statsData = await backendApi.getStats();
      setStats({
        totalPlayers: statsData.totalPlayers,
        topXp: statsData.topXp,
        highestLevel: statsData.highestLevel,
      });
      
      // Fetch high scores for each game type in parallel
      const gameTypes = Object.values(GameTypeEnum);
      const highScorePromises = gameTypes.map(async (gameType) => {
        try {
          const scores = await backendApi.getGameHighScores(gameType, 10);
          return { gameType, scores };
        } catch {
          return { gameType, scores: [] };
        }
      });
      
      const highScoreResults = await Promise.all(highScorePromises);
      
      // Build high scores record
      const newHighScores: Record<GameType, GameHighScoreEntry[]> = {
        [GameTypeEnum.SPEED_CLICKER]: [],
        [GameTypeEnum.MEMORY_MATRIX]: [],
        [GameTypeEnum.REACTION_STRIKE]: [],
        [GameTypeEnum.MATH_BLITZ]: [],
        [GameTypeEnum.SNAKE_SPRINT]: [],
      };
      
      for (const { gameType, scores } of highScoreResults) {
        newHighScores[gameType] = scores.map(s => ({
          player: s.player,
          username: s.playerName, // Map playerName to username
          score: s.score,
          xpEarned: s.xpEarned,
          timestamp: s.timestamp,
        }));
      }
      
      setGameHighScores(newHighScores);
      setLastUpdated(new Date());
      
      console.log(`✅ Leaderboard refreshed: ${leaderboardData.length} players`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load leaderboard';
      console.error('Leaderboard refresh failed:', message);
      setError(message);
      // Don't clear data on error - keep stale data
    } finally {
      setIsLoading(false);
      isRefreshing.current = false;
    }
  }, []);
  
  /**
   * Get high scores for a specific game
   */
  const getGameHighScores = useCallback((gameType: GameType): GameHighScoreEntry[] => {
    return gameHighScores[gameType] || [];
  }, [gameHighScores]);
  
  // Initial load on mount
  useEffect(() => {
    if (!initialLoadDone.current) {
      initialLoadDone.current = true;
      refresh();
    }
  }, [refresh]);
  
  // Auto-refresh interval
  useEffect(() => {
    const intervalId = setInterval(() => {
      refresh();
    }, REFRESH_INTERVAL);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [refresh]);
  
  return {
    leaderboard,
    gameHighScores,
    stats,
    isLoading,
    error,
    lastUpdated,
    refresh,
    getGameHighScores,
  };
}
