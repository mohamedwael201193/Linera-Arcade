/**
 * Backend API Client
 * 
 * Communicates with the Linera Arcade backend service
 * for global leaderboard data aggregation.
 */

// Backend URL from environment
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
const API_KEY = import.meta.env.VITE_API_KEY || '';

/**
 * Make a GET request to the backend
 */
async function get<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${BACKEND_URL}/api${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

/**
 * Make a POST request to the backend
 */
async function post<T>(endpoint: string, data: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (API_KEY) {
    headers['X-Api-Key'] = API_KEY;
  }
  
  const response = await fetch(`${BACKEND_URL}/api${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface BackendPlayer {
  walletAddress: string;
  username: string;
  totalXp: number;
  level: number;
  rank?: number;
}

export interface BackendLeaderboardEntry {
  walletAddress: string;
  username: string;
  totalXp: number;
  level: number;
  rank: number;
}

export interface BackendScore {
  id: number;
  gameType: string;
  player: string;
  playerName: string;
  score: number;
  xpEarned: number;
  bonusData: number | null;
  timestamp: number;
}

export interface BackendHighScore {
  player: string;
  playerName: string;
  score: number;
  xpEarned: number;
  rank: number;
  timestamp: number;
}

export interface BackendStats {
  totalPlayers: number;
  totalGamesPlayed: number;
  totalXpEarned: number;
  topXp: number;
  highestLevel: number;
}

// =============================================================================
// API METHODS
// =============================================================================

/**
 * Backend API client
 */
export const backendApi = {
  /**
   * Health check
   */
  async health(): Promise<{ status: string }> {
    return get('/health');
  },

  /**
   * Get global leaderboard
   */
  async getLeaderboard(limit: number = 100): Promise<BackendLeaderboardEntry[]> {
    const result = await get<{ leaderboard: BackendLeaderboardEntry[] }>(
      `/leaderboard?limit=${limit}`
    );
    return result.leaderboard;
  },

  /**
   * Get player rank
   */
  async getPlayerRank(wallet: string): Promise<number | null> {
    const result = await get<{ rank: number | null }>(
      `/leaderboard/rank/${wallet.toLowerCase()}`
    );
    return result.rank;
  },

  /**
   * Get all players
   */
  async getAllPlayers(): Promise<BackendPlayer[]> {
    const result = await get<{ players: BackendPlayer[] }>('/players');
    return result.players;
  },

  /**
   * Get player by wallet
   */
  async getPlayer(wallet: string): Promise<BackendPlayer | null> {
    try {
      const result = await get<{ player: BackendPlayer }>(
        `/players/${wallet.toLowerCase()}`
      );
      return result.player;
    } catch {
      return null;
    }
  },

  /**
   * Register a new player (sync with backend)
   */
  async registerPlayer(wallet: string, username: string, chainId?: string): Promise<void> {
    await post('/players', {
      wallet_address: wallet.toLowerCase(),
      username,
      chain_id: chainId,
    });
  },

  /**
   * Submit a score (sync with backend)
   */
  async submitScore(
    wallet: string,
    gameType: string,
    score: number,
    xpEarned: number,
    bonusData?: number,
    chainId?: string
  ): Promise<void> {
    await post('/scores', {
      wallet_address: wallet.toLowerCase(),
      game_type: gameType,
      score,
      xp_earned: xpEarned,
      bonus_data: bonusData,
      chain_id: chainId,
    });
  },

  /**
   * Get recent scores
   */
  async getRecentScores(limit: number = 50): Promise<BackendScore[]> {
    const result = await get<{ scores: BackendScore[] }>(
      `/scores/recent?limit=${limit}`
    );
    return result.scores;
  },

  /**
   * Get scores for a specific game
   */
  async getGameScores(gameType: string, limit: number = 50): Promise<BackendScore[]> {
    const result = await get<{ scores: BackendScore[] }>(
      `/scores/game/${gameType}?limit=${limit}`
    );
    return result.scores;
  },

  /**
   * Get high scores for a specific game
   */
  async getGameHighScores(gameType: string, limit: number = 10): Promise<BackendHighScore[]> {
    const result = await get<{ highScores: BackendHighScore[] }>(
      `/scores/highscores/${gameType}?limit=${limit}`
    );
    return result.highScores;
  },

  /**
   * Get global stats
   */
  async getStats(): Promise<BackendStats> {
    const result = await get<{ stats: BackendStats }>('/stats');
    return result.stats;
  },
};

export default backendApi;
