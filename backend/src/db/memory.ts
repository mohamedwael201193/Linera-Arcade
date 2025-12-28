/**
 * In-Memory Database for Development
 * 
 * Simple in-memory storage when PostgreSQL is not available.
 * Data is lost on restart but works for testing.
 * Extended with Prediction Markets support.
 */

export interface Player {
  id: number;
  wallet_address: string;
  username: string;
  total_xp: number;
  level: number;
  games_played: number;
  coins: number;
  predictions_made: number;
  predictions_won: number;
  last_daily_claim: Date | null;
  chain_id: string | null;
  registered_at: Date;
  updated_at: Date;
}

export interface Score {
  id: number;
  player_wallet: string;
  game_type: string;
  score: number;
  xp_earned: number;
  bonus_data: number | null;
  chain_id: string | null;
  submitted_at: Date;
}

// ============================================================================
// PREDICTION MARKET TYPES
// ============================================================================

export type CryptoAsset = 'BTC' | 'ETH';
export type PredictionDirection = 'UP' | 'DOWN';
export type PredictionStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
export type RoundStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

export interface CryptoRound {
  id: number;
  asset: CryptoAsset;
  start_price: number; // Price in cents
  end_price: number | null;
  start_time: Date;
  duration_secs: number;
  status: RoundStatus;
  total_up: number;
  total_down: number;
  winning_direction: PredictionDirection | null;
  created_at: Date;
}

export interface WorldEvent {
  id: number;
  title: string;
  description: string;
  category: string;
  end_time: Date;
  status: RoundStatus;
  outcome: boolean | null;
  total_yes: number;
  total_no: number;
  created_at: Date;
}

export interface Prediction {
  id: number;
  wallet_address: string;
  prediction_type: 'CRYPTO' | 'EVENT';
  reference_id: number; // round_id or event_id
  direction_or_outcome: number; // 0=DOWN/NO, 1=UP/YES
  amount: number;
  odds_at_bet: number; // Basis points (19000 = 1.9x)
  status: PredictionStatus;
  payout: number;
  created_at: Date;
}

export interface ActivityLog {
  id: number;
  wallet_address: string;
  username: string;
  action: 'GAME_COMPLETED' | 'PREDICTION_PLACED' | 'PREDICTION_WON' | 'PREDICTION_LOST' | 'DAILY_BONUS' | 'REGISTERED';
  details: Record<string, any>;
  created_at: Date;
}

// In-memory storage
const players: Map<string, Player> = new Map();
const scores: Score[] = [];
const cryptoRounds: Map<number, CryptoRound> = new Map();
const worldEvents: Map<number, WorldEvent> = new Map();
const predictions: Prediction[] = [];
const activityLogs: ActivityLog[] = [];

let nextPlayerId = 1;
let nextScoreId = 1;
let nextRoundId = 1;
let nextEventId = 1;
let nextPredictionId = 1;
let nextActivityId = 1;

// Stats
const stats = {
  total_players: 0,
  total_games_played: 0,
  total_xp_earned: 0,
  total_predictions: 0,
  total_coins_wagered: 0,
};

/**
 * In-memory database implementation
 */
export const memoryDb = {
  // Player operations
  async createPlayer(input: { wallet_address: string; username: string; chain_id?: string }): Promise<Player> {
    const wallet = input.wallet_address.toLowerCase();
    
    // Check if exists
    const existing = players.get(wallet);
    if (existing) {
      existing.username = input.username;
      existing.updated_at = new Date();
      return existing;
    }
    
    const player: Player = {
      id: nextPlayerId++,
      wallet_address: wallet,
      username: input.username,
      total_xp: 0,
      level: 1,
      games_played: 0,
      coins: 100, // Starting bonus
      predictions_made: 0,
      predictions_won: 0,
      last_daily_claim: null,
      chain_id: input.chain_id || null,
      registered_at: new Date(),
      updated_at: new Date(),
    };
    
    players.set(wallet, player);
    stats.total_players++;
    
    // Log activity
    await this.logActivity(wallet, player.username, 'REGISTERED', {});
    
    return player;
  },

  async getPlayerByWallet(wallet: string): Promise<Player | null> {
    return players.get(wallet.toLowerCase()) || null;
  },

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(players.values()).sort((a, b) => b.total_xp - a.total_xp);
  },

  async updatePlayerXP(wallet: string, xpEarned: number): Promise<Player | null> {
    const player = players.get(wallet.toLowerCase());
    if (!player) return null;
    
    player.total_xp += xpEarned;
    player.games_played++;
    player.level = Math.floor(Math.sqrt(player.total_xp / 100)) + 1;
    player.updated_at = new Date();
    
    return player;
  },

  async getLeaderboard(limit: number = 100): Promise<(Player & { rank: number })[]> {
    const sorted = Array.from(players.values())
      .sort((a, b) => b.total_xp - a.total_xp)
      .slice(0, limit);
    
    return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
  },

  async getPlayerRank(wallet: string): Promise<number | null> {
    const sorted = Array.from(players.values())
      .sort((a, b) => b.total_xp - a.total_xp);
    
    const index = sorted.findIndex(p => p.wallet_address === wallet.toLowerCase());
    return index >= 0 ? index + 1 : null;
  },

  // Score operations
  async createScore(input: {
    player_wallet: string;
    game_type: string;
    score: number;
    xp_earned: number;
    bonus_data?: number;
    chain_id?: string;
  }): Promise<Score> {
    const score: Score = {
      id: nextScoreId++,
      player_wallet: input.player_wallet.toLowerCase(),
      game_type: input.game_type,
      score: input.score,
      xp_earned: input.xp_earned,
      bonus_data: input.bonus_data || null,
      chain_id: input.chain_id || null,
      submitted_at: new Date(),
    };
    
    scores.push(score);
    stats.total_games_played++;
    stats.total_xp_earned += input.xp_earned;
    
    return score;
  },

  async getRecentScores(limit: number = 50): Promise<(Score & { username: string })[]> {
    return scores
      .slice(-limit)
      .reverse()
      .map(s => ({
        ...s,
        username: players.get(s.player_wallet)?.username || 'Unknown',
      }));
  },

  async getGameScores(gameType: string, limit: number = 50): Promise<(Score & { username: string })[]> {
    return scores
      .filter(s => s.game_type === gameType)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({
        ...s,
        username: players.get(s.player_wallet)?.username || 'Unknown',
      }));
  },

  async getGameHighScores(gameType: string, limit: number = 10): Promise<{
    player_wallet: string;
    username: string;
    score: number;
    xp_earned: number;
    rank: number;
    submitted_at: Date;
  }[]> {
    // Get best score per player
    const bestScores = new Map<string, Score>();
    
    for (const score of scores) {
      if (score.game_type !== gameType) continue;
      
      const existing = bestScores.get(score.player_wallet);
      if (!existing || score.score > existing.score) {
        bestScores.set(score.player_wallet, score);
      }
    }
    
    return Array.from(bestScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, i) => ({
        player_wallet: s.player_wallet,
        username: players.get(s.player_wallet)?.username || 'Unknown',
        score: s.score,
        xp_earned: s.xp_earned,
        rank: i + 1,
        submitted_at: s.submitted_at,
      }));
  },

  async getGlobalStats(): Promise<{
    totalPlayers: number;
    totalGamesPlayed: number;
    totalXpEarned: number;
    totalPredictions: number;
    totalCoinsWagered: number;
    topXp: number;
    highestLevel: number;
  }> {
    const allPlayers = Array.from(players.values());
    const topPlayer = allPlayers.sort((a, b) => b.total_xp - a.total_xp)[0];
    
    return {
      totalPlayers: players.size,
      totalGamesPlayed: stats.total_games_played,
      totalXpEarned: stats.total_xp_earned,
      totalPredictions: stats.total_predictions,
      totalCoinsWagered: stats.total_coins_wagered,
      topXp: topPlayer?.total_xp || 0,
      highestLevel: topPlayer?.level || 1,
    };
  },

  // ============================================================================
  // ACTIVITY LOG OPERATIONS
  // ============================================================================

  async logActivity(wallet: string, username: string, action: ActivityLog['action'], details: Record<string, any>): Promise<void> {
    activityLogs.push({
      id: nextActivityId++,
      wallet_address: wallet.toLowerCase(),
      username,
      action,
      details,
      created_at: new Date(),
    });
    
    // Keep only last 1000 activities
    if (activityLogs.length > 1000) {
      activityLogs.shift();
    }
  },

  async getActivityFeed(limit: number = 50): Promise<ActivityLog[]> {
    return activityLogs.slice(-limit).reverse();
  },

  async getUserActivity(wallet: string, limit: number = 50): Promise<ActivityLog[]> {
    const walletLower = wallet.toLowerCase();
    return activityLogs
      .filter(a => a.wallet_address === walletLower)
      .slice(-limit)
      .reverse();
  },

  // ============================================================================
  // CRYPTO ROUND OPERATIONS
  // ============================================================================

  async createCryptoRound(input: {
    asset: CryptoAsset;
    start_price: number;
    duration_secs: number;
  }): Promise<CryptoRound> {
    const round: CryptoRound = {
      id: nextRoundId++,
      asset: input.asset,
      start_price: input.start_price,
      end_price: null,
      start_time: new Date(),
      duration_secs: input.duration_secs,
      status: 'ACTIVE',
      total_up: 0,
      total_down: 0,
      winning_direction: null,
      created_at: new Date(),
    };
    
    cryptoRounds.set(round.id, round);
    return round;
  },

  async getCryptoRound(id: number): Promise<CryptoRound | null> {
    return cryptoRounds.get(id) || null;
  },

  async getActiveCryptoRounds(): Promise<CryptoRound[]> {
    return Array.from(cryptoRounds.values())
      .filter(r => r.status === 'ACTIVE')
      .sort((a, b) => b.start_time.getTime() - a.start_time.getTime());
  },

  async getAllCryptoRounds(limit: number = 50): Promise<CryptoRound[]> {
    return Array.from(cryptoRounds.values())
      .sort((a, b) => b.start_time.getTime() - a.start_time.getTime())
      .slice(0, limit);
  },

  async resolveCryptoRound(id: number, end_price: number): Promise<CryptoRound | null> {
    const round = cryptoRounds.get(id);
    if (!round || round.status !== 'ACTIVE') return null;
    
    round.end_price = end_price;
    round.status = 'RESOLVED';
    round.winning_direction = end_price > round.start_price ? 'UP' : 'DOWN';
    
    // Process winning predictions
    const roundPredictions = predictions.filter(
      p => p.prediction_type === 'CRYPTO' && p.reference_id === id
    );
    
    console.log(`📊 Processing ${roundPredictions.length} predictions for round ${id} (result: ${round.winning_direction})`);
    
    for (const pred of roundPredictions) {
      const userDirection: PredictionDirection = pred.direction_or_outcome === 1 ? 'UP' : 'DOWN';
      const won = userDirection === round.winning_direction;
      
      console.log(`   → Prediction ${pred.id}: user bet ${userDirection}, result ${round.winning_direction}, ${won ? 'WON' : 'LOST'}`);
      
      pred.status = won ? 'WON' : 'LOST';
      if (won) {
        pred.payout = Math.floor((pred.amount * pred.odds_at_bet) / 10000);
        const player = players.get(pred.wallet_address);
        if (player) {
          player.coins += pred.payout;
          player.predictions_won++;
          console.log(`   💰 Awarded ${pred.payout} coins to ${player.username}`);
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_WON', {
            type: 'CRYPTO',
            asset: round.asset,
            direction: userDirection,
            amount: pred.amount,
            payout: pred.payout,
          });
        }
      } else {
        pred.payout = 0;
        const player = players.get(pred.wallet_address);
        if (player) {
          console.log(`   ❌ ${player.username} lost ${pred.amount} coins`);
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_LOST', {
            type: 'CRYPTO',
            asset: round.asset,
            direction: userDirection,
            amount: pred.amount,
          });
        }
      }
    }
    
    return round;
  },

  // ============================================================================
  // WORLD EVENT OPERATIONS
  // ============================================================================

  async createWorldEvent(input: {
    title: string;
    description: string;
    category: string;
    end_time: Date;
  }): Promise<WorldEvent> {
    const event: WorldEvent = {
      id: nextEventId++,
      title: input.title,
      description: input.description,
      category: input.category,
      end_time: input.end_time,
      status: 'ACTIVE',
      outcome: null,
      total_yes: 0,
      total_no: 0,
      created_at: new Date(),
    };
    
    worldEvents.set(event.id, event);
    return event;
  },

  async getWorldEvent(id: number): Promise<WorldEvent | null> {
    return worldEvents.get(id) || null;
  },

  async getActiveWorldEvents(): Promise<WorldEvent[]> {
    return Array.from(worldEvents.values())
      .filter(e => e.status === 'ACTIVE')
      .sort((a, b) => a.end_time.getTime() - b.end_time.getTime());
  },

  async getAllWorldEvents(limit: number = 50): Promise<WorldEvent[]> {
    return Array.from(worldEvents.values())
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  },

  async getWorldEventsByCategory(category: string): Promise<WorldEvent[]> {
    return Array.from(worldEvents.values())
      .filter(e => e.category === category)
      .sort((a, b) => a.end_time.getTime() - b.end_time.getTime());
  },

  async resolveWorldEvent(id: number, outcome: boolean): Promise<WorldEvent | null> {
    const event = worldEvents.get(id);
    if (!event || event.status !== 'ACTIVE') return null;
    
    event.outcome = outcome;
    event.status = 'RESOLVED';
    
    // Process winning predictions
    const eventPredictions = predictions.filter(
      p => p.prediction_type === 'EVENT' && p.reference_id === id
    );
    
    for (const pred of eventPredictions) {
      const userPrediction = pred.direction_or_outcome === 1;
      const won = userPrediction === outcome;
      
      pred.status = won ? 'WON' : 'LOST';
      if (won) {
        pred.payout = Math.floor((pred.amount * pred.odds_at_bet) / 10000);
        const player = players.get(pred.wallet_address);
        if (player) {
          player.coins += pred.payout;
          player.predictions_won++;
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_WON', {
            type: 'EVENT',
            eventTitle: event.title,
            prediction: userPrediction ? 'YES' : 'NO',
            amount: pred.amount,
            payout: pred.payout,
          });
        }
      } else {
        const player = players.get(pred.wallet_address);
        if (player) {
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_LOST', {
            type: 'EVENT',
            eventTitle: event.title,
            prediction: userPrediction ? 'YES' : 'NO',
            amount: pred.amount,
          });
        }
      }
    }
    
    return event;
  },

  // ============================================================================
  // PREDICTION OPERATIONS
  // ============================================================================

  async placeCryptoPrediction(input: {
    wallet_address: string;
    round_id: number;
    direction: PredictionDirection;
    amount: number;
  }): Promise<Prediction | null> {
    const wallet = input.wallet_address.toLowerCase();
    const player = players.get(wallet);
    if (!player) return null;
    
    const round = cryptoRounds.get(input.round_id);
    if (!round || round.status !== 'ACTIVE') return null;
    
    // Check balance
    if (player.coins < input.amount) return null;
    
    // Calculate odds before updating pool
    const total = round.total_up + round.total_down;
    let odds = 19000; // Default 1.9x
    if (total > 0) {
      const poolForDirection = input.direction === 'UP' ? round.total_up : round.total_down;
      if (poolForDirection > 0) {
        const payoutPool = total * 9500 / 10000;
        odds = Math.floor((payoutPool * 10000) / poolForDirection);
      } else {
        odds = 50000; // 5x max
      }
    }
    
    // Deduct coins
    player.coins -= input.amount;
    player.predictions_made++;
    
    // Update round totals
    if (input.direction === 'UP') {
      round.total_up += input.amount;
    } else {
      round.total_down += input.amount;
    }
    
    const prediction: Prediction = {
      id: nextPredictionId++,
      wallet_address: wallet,
      prediction_type: 'CRYPTO',
      reference_id: input.round_id,
      direction_or_outcome: input.direction === 'UP' ? 1 : 0,
      amount: input.amount,
      odds_at_bet: odds,
      status: 'PENDING',
      payout: 0,
      created_at: new Date(),
    };
    
    predictions.push(prediction);
    stats.total_predictions++;
    stats.total_coins_wagered += input.amount;
    
    // Log activity
    await this.logActivity(wallet, player.username, 'PREDICTION_PLACED', {
      type: 'CRYPTO',
      asset: round.asset,
      direction: input.direction,
      amount: input.amount,
      odds: odds / 10000,
    });
    
    return prediction;
  },

  async placeEventPrediction(input: {
    wallet_address: string;
    event_id: number;
    prediction: boolean;
    amount: number;
  }): Promise<Prediction | null> {
    const wallet = input.wallet_address.toLowerCase();
    const player = players.get(wallet);
    if (!player) return null;
    
    const event = worldEvents.get(input.event_id);
    if (!event || event.status !== 'ACTIVE') return null;
    
    // Check balance
    if (player.coins < input.amount) return null;
    
    // Calculate odds
    const total = event.total_yes + event.total_no;
    let odds = 19000;
    if (total > 0) {
      const poolForPrediction = input.prediction ? event.total_yes : event.total_no;
      if (poolForPrediction > 0) {
        const payoutPool = total * 9500 / 10000;
        odds = Math.floor((payoutPool * 10000) / poolForPrediction);
      } else {
        odds = 50000;
      }
    }
    
    // Deduct coins
    player.coins -= input.amount;
    player.predictions_made++;
    
    // Update event totals
    if (input.prediction) {
      event.total_yes += input.amount;
    } else {
      event.total_no += input.amount;
    }
    
    const pred: Prediction = {
      id: nextPredictionId++,
      wallet_address: wallet,
      prediction_type: 'EVENT',
      reference_id: input.event_id,
      direction_or_outcome: input.prediction ? 1 : 0,
      amount: input.amount,
      odds_at_bet: odds,
      status: 'PENDING',
      payout: 0,
      created_at: new Date(),
    };
    
    predictions.push(pred);
    stats.total_predictions++;
    stats.total_coins_wagered += input.amount;
    
    // Log activity
    await this.logActivity(wallet, player.username, 'PREDICTION_PLACED', {
      type: 'EVENT',
      eventTitle: event.title,
      prediction: input.prediction ? 'YES' : 'NO',
      amount: input.amount,
      odds: odds / 10000,
    });
    
    return pred;
  },

  async getUserPredictions(wallet: string, limit: number = 50): Promise<Prediction[]> {
    const walletLower = wallet.toLowerCase();
    return predictions
      .filter(p => p.wallet_address === walletLower)
      .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
      .slice(0, limit);
  },

  async getPredictionsForRound(round_id: number): Promise<Prediction[]> {
    return predictions.filter(
      p => p.prediction_type === 'CRYPTO' && p.reference_id === round_id
    );
  },

  async getPredictionsForEvent(event_id: number): Promise<Prediction[]> {
    return predictions.filter(
      p => p.prediction_type === 'EVENT' && p.reference_id === event_id
    );
  },

  // ============================================================================
  // COIN OPERATIONS
  // ============================================================================

  async claimDailyBonus(wallet: string): Promise<{ success: boolean; coins?: number; error?: string }> {
    const player = players.get(wallet.toLowerCase());
    if (!player) return { success: false, error: 'Player not found' };
    
    const now = new Date();
    const lastClaim = player.last_daily_claim;
    
    // Check if 24 hours have passed
    if (lastClaim) {
      const hoursSinceClaim = (now.getTime() - lastClaim.getTime()) / (1000 * 60 * 60);
      if (hoursSinceClaim < 24) {
        return { success: false, error: 'Daily bonus already claimed' };
      }
    }
    
    player.coins += 100;
    player.last_daily_claim = now;
    
    await this.logActivity(wallet.toLowerCase(), player.username, 'DAILY_BONUS', { coins: 100 });
    
    return { success: true, coins: 100 };
  },

  async getCoinBalance(wallet: string): Promise<number | null> {
    const player = players.get(wallet.toLowerCase());
    return player?.coins ?? null;
  },

  // Initialize prediction rounds (no mock data)
  async seed() {
    // Skip mock player data - only real users who register will appear
    
    // Create crypto rounds with real prices from Binance
    try {
      const binanceService = await import('../services/binance.js').then(m => m.binanceService);
      const btcPrice = await binanceService.getBTCPrice();
      const ethPrice = await binanceService.getETHPrice();
      await this.createCryptoRound({ asset: 'BTC', start_price: btcPrice.price, duration_secs: 300 });
      await this.createCryptoRound({ asset: 'ETH', start_price: ethPrice.price, duration_secs: 300 });
      console.log(`✅ Created prediction rounds with real Binance prices: BTC=$${btcPrice.price/100}, ETH=$${ethPrice.price/100}`);
    } catch (err) {
      console.error('⚠️ Failed to fetch Binance prices, creating rounds with current market estimate:', err);
      // Use reasonable fallback prices
      await this.createCryptoRound({ asset: 'BTC', start_price: 9500000, duration_secs: 300 });
      await this.createCryptoRound({ asset: 'ETH', start_price: 350000, duration_secs: 300 });
    }
    
    console.log('✅ Backend initialized - Ready for real users!');
  }
};
