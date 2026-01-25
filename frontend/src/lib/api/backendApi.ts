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
  gamesPlayed: number;
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

export interface TournamentLeaderboardEntry {
  id: number;
  tournament_id: number;
  tournament_name: string;
  player_address: string;
  username: string;
  chain_id: string;
  score: number;
  seed: number;
  moves: number[];
  moves_used: number;
  submitted_at: string;
  rank: number;
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
   * Submit a multiplayer game result (sync with backend)
   * This updates the player's XP/coins and logs the activity
   */
  async submitMultiplayerResult(
    wallet: string,
    gameType: string,
    roomCode: string,
    isWinner: boolean,
    opponentUsername: string,
    xpEarned: number,
    coinsEarned: number,
    chainId?: string
  ): Promise<{ success: boolean; new_total_xp: number }> {
    return post('/multiplayer/result', {
      wallet_address: wallet.toLowerCase(),
      game_type: gameType,
      room_code: roomCode,
      is_winner: isWinner,
      opponent_username: opponentUsername,
      xp_earned: xpEarned,
      coins_earned: coinsEarned,
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

  // =============================================================================
  // PRICE FEED METHODS
  // =============================================================================

  /**
   * Get current crypto prices (BTC, ETH)
   */
  async getPrices(): Promise<{ btc: CryptoPrice; eth: CryptoPrice }> {
    const result = await get<{ prices: { btc: CryptoPrice; eth: CryptoPrice } }>('/prices');
    return result.prices;
  },

  /**
   * Get BTC price
   */
  async getBTCPrice(): Promise<CryptoPrice> {
    const result = await get<{ price: CryptoPrice }>('/prices/btc');
    return result.price;
  },

  /**
   * Get ETH price
   */
  async getETHPrice(): Promise<CryptoPrice> {
    const result = await get<{ price: CryptoPrice }>('/prices/eth');
    return result.price;
  },

  // =============================================================================
  // ACTIVITY FEED METHODS
  // =============================================================================

  /**
   * Get recent activity feed
   */
  async getActivityFeed(limit: number = 50): Promise<ActivityLogEntry[]> {
    const result = await get<{ activities: ActivityLogEntry[] }>(
      `/activity?limit=${limit}`
    );
    return result.activities;
  },

  /**
   * Get user's activity
   */
  async getUserActivity(wallet: string, limit: number = 50): Promise<ActivityLogEntry[]> {
    const result = await get<{ activities: ActivityLogEntry[] }>(
      `/activity/user/${wallet.toLowerCase()}?limit=${limit}`
    );
    return result.activities;
  },

  // =============================================================================
  // TOURNAMENT LEADERBOARD METHODS (Backend Indexer)
  // =============================================================================

  /**
   * Submit a tournament entry to the backend indexer.
   * NOTE: The score is NOT calculated by the backend - it is provided by the on-chain contract.
   * The backend only INDEXES the submission for global leaderboard display.
   * Verification is always done on-chain via replay.
   * 
   * This also awards XP and coins to the player and logs the activity.
   */
  async submitTournamentEntry(entry: {
    tournament_id: number;
    tournament_name: string;
    player_address: string;
    username: string;
    chain_id: string;
    score: number;
    seed: number;
    moves: number[];
    moves_used: number;
    xp_earned?: number;
    coins_earned?: number;
  }): Promise<{ 
    success: boolean; 
    entry: TournamentLeaderboardEntry; 
    rank: number;
    message: string;
    rewards_awarded: boolean;
    xp_earned: number;
    coins_earned: number;
    new_total_xp: number;
  }> {
    return post('/tournament/submit', entry);
  },

  /**
   * Get tournament leaderboard from the backend indexer.
   * This is the aggregated global leaderboard across all player chains.
   */
  async getTournamentLeaderboard(
    tournamentId: number,
    limit: number = 100
  ): Promise<TournamentLeaderboardEntry[]> {
    const result = await get<{ 
      tournament_id: number;
      total_entries: number;
      leaderboard: TournamentLeaderboardEntry[];
    }>(`/tournament/${tournamentId}/leaderboard?limit=${limit}`);
    return result.leaderboard;
  },

  /**
   * Get a specific player's tournament entry with their rank.
   */
  async getPlayerTournamentEntry(
    tournamentId: number,
    playerAddress: string
  ): Promise<TournamentLeaderboardEntry | null> {
    try {
      const result = await get<{
        tournament_id: number;
        entry: TournamentLeaderboardEntry;
      }>(`/tournament/${tournamentId}/player/${playerAddress.toLowerCase()}`);
      return result.entry;
    } catch {
      return null;
    }
  },

  // =============================================================================
  // CRYPTO PREDICTION METHODS
  // =============================================================================

  /**
   * Get all crypto rounds
   */
  async getCryptoRounds(): Promise<CryptoRoundEntry[]> {
    const result = await get<{ rounds: CryptoRoundEntry[] }>('/predictions/crypto/rounds');
    return result.rounds;
  },

  /**
   * Get active crypto rounds
   */
  async getActiveCryptoRounds(): Promise<CryptoRoundEntry[]> {
    const result = await get<{ rounds: CryptoRoundEntry[] }>('/predictions/crypto/rounds/active');
    return result.rounds;
  },

  /**
   * Get a specific crypto round
   */
  async getCryptoRound(roundId: number): Promise<CryptoRoundEntry | null> {
    try {
      const result = await get<{ round: CryptoRoundEntry }>(
        `/predictions/crypto/rounds/${roundId}`
      );
      return result.round;
    } catch {
      return null;
    }
  },

  /**
   * Create a new crypto round with current Binance price
   */
  async createCryptoRound(asset: 'BTC' | 'ETH', durationSecs: number = 300): Promise<{ round: CryptoRoundEntry; startPrice: { cents: number; formatted: string } }> {
    return post('/predictions/crypto/rounds/auto', {
      asset,
      duration_secs: durationSecs,
    });
  },

  /**
   * Link a backend round to an on-chain round ID
   * Called after frontend creates a round on-chain
   */
  async linkOnchainRound(dbRoundId: number, onchainRoundId: number): Promise<{ success: boolean }> {
    return post('/predictions/crypto/rounds/link-onchain', {
      db_round_id: dbRoundId,
      onchain_round_id: onchainRoundId,
    });
  },

  /**
   * Place a crypto prediction
   */
  async placeCryptoPrediction(
    wallet: string,
    roundId: number,
    direction: 'UP' | 'DOWN',
    coinsStaked: number
  ): Promise<{ prediction: PredictionEntry }> {
    return post('/predictions/crypto/place', {
      wallet_address: wallet.toLowerCase(),
      round_id: roundId,
      direction,
      amount: coinsStaked,
    });
  },

  /**
   * Auto-resolve a crypto round with current Binance price
   */
  async resolveCryptoRound(roundId: number): Promise<{
    round: CryptoRoundEntry;
    endPrice: { cents: number; formatted: string };
    priceChange: { cents: number; percentage: string };
  }> {
    return post(`/predictions/crypto/rounds/${roundId}/auto-resolve`, {});
  },

  // =============================================================================
  // WORLD EVENT PREDICTION METHODS
  // =============================================================================

  /**
   * Get all world events
   */
  async getWorldEvents(): Promise<WorldEventEntry[]> {
    const result = await get<{ events: WorldEventEntry[] }>('/predictions/events');
    return result.events;
  },

  /**
   * Get active world events
   */
  async getActiveWorldEvents(): Promise<WorldEventEntry[]> {
    const result = await get<{ events: WorldEventEntry[] }>('/predictions/events/active');
    return result.events;
  },

  /**
   * Get a specific world event
   */
  async getWorldEvent(eventId: number): Promise<WorldEventEntry | null> {
    try {
      const result = await get<{ event: WorldEventEntry }>(
        `/predictions/events/${eventId}`
      );
      return result.event;
    } catch {
      return null;
    }
  },

  /**
   * Create a new world event
   */
  async createWorldEvent(
    title: string,
    description: string,
    category: string,
    outcomes: string[],
    durationSecs: number = 86400
  ): Promise<{ event: WorldEventEntry }> {
    return post('/predictions/events', {
      title,
      description,
      category,
      outcomes,
      duration_secs: durationSecs,
    });
  },

  /**
   * Place a world event prediction
   */
  async placeEventPrediction(
    wallet: string,
    eventId: number,
    outcome: string,
    coinsStaked: number
  ): Promise<{ prediction: PredictionEntry }> {
    return post('/predictions/events/place', {
      wallet_address: wallet.toLowerCase(),
      event_id: eventId,
      outcome,
      amount: coinsStaked,
    });
  },

  /**
   * Resolve a world event
   */
  async resolveWorldEvent(eventId: number, correctOutcome: string): Promise<{ event: WorldEventEntry }> {
    return post(`/predictions/events/${eventId}/resolve`, {
      correct_outcome: correctOutcome,
    });
  },

  // =============================================================================
  // USER PREDICTION METHODS
  // =============================================================================

  /**
   * Get user's predictions
   */
  async getUserPredictions(wallet: string): Promise<PredictionEntry[]> {
    const result = await get<{ predictions: PredictionEntry[] }>(
      `/predictions/user/${wallet.toLowerCase()}`
    );
    return result.predictions;
  },

  /**
   * Get user's coin balance
   */
  async getCoinBalance(wallet: string): Promise<CoinBalanceEntry> {
    const result = await get<{ balance: CoinBalanceEntry }>(
      `/coins/balance/${wallet.toLowerCase()}`
    );
    return result.balance;
  },

  /**
   * Claim daily bonus
   */
  async claimDailyBonus(wallet: string): Promise<{ success: boolean; coins: number }> {
    return post('/coins/daily-bonus', {
      wallet_address: wallet.toLowerCase(),
    });
  },
};

// =============================================================================
// ADDITIONAL TYPE DEFINITIONS FOR PREDICTIONS
// =============================================================================

export interface CryptoPrice {
  symbol: 'BTC' | 'ETH';
  priceUsd: number;
  priceCents: number;
  formatted: string;
  timestamp: number;
}

export interface ActivityLogEntry {
  id: number;
  walletAddress: string;
  username: string;
  activityType: 'PREDICTION' | 'GAME' | 'CLAIM_BONUS' | 'WIN';
  description: string;
  coinsChange: number;
  referenceId: number | null;
  createdAt: string;
}

export interface CryptoRoundEntry {
  id: number;
  onchain_round_id?: number | null; // CRITICAL: On-chain round ID for executor resolution
  asset: 'BTC' | 'ETH';
  start_price: number;
  end_price: number | null;
  start_time: string;
  end_time: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  result: 'UP' | 'DOWN' | null;
  total_up: number;
  total_down: number;
  created_at: string;
}

export interface WorldEventEntry {
  id: number;
  title: string;
  description: string;
  category: string;
  outcomes?: string[]; // Legacy - for backward compatibility
  correct_outcome?: string | null;
  end_time: string;
  start_time?: string;
  status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
  outcome?: boolean | null; // YES = true, NO = false
  total_yes: number;
  total_no: number;
  image_url?: string | null;
  source?: string | null;
  created_at: string;
}

export interface PredictionEntry {
  id: number;
  wallet_address: string;
  prediction_type: 'CRYPTO' | 'WORLD_EVENT';
  reference_id: number;
  direction_or_outcome: string;
  coins_staked: number;
  coins_won: number | null;
  status: 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
  created_at: string;
}

export interface CoinBalanceEntry {
  walletAddress: string;
  balance: number | null;
  lastDailyClaim: string | null;
  canClaimDaily: boolean;
  isRegistered: boolean;
}

export default backendApi;
