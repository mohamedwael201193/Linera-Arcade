/**
 * PostgreSQL Database Implementation
 * 
 * Production-ready database layer using PostgreSQL.
 * Implements the same interface as memory.ts for seamless switching.
 */

import { query } from './index.js';

// ============================================================================
// TYPE DEFINITIONS (same as memory.ts)
// ============================================================================

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

export type CryptoAsset = 'BTC' | 'ETH';
export type PredictionDirection = 'UP' | 'DOWN';
export type PredictionStatus = 'PENDING' | 'WON' | 'LOST' | 'CANCELLED';
export type RoundStatus = 'ACTIVE' | 'RESOLVED' | 'CANCELLED';

export interface CryptoRound {
  id: number;
  asset: CryptoAsset;
  start_price: number;
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
  reference_id: number;
  direction_or_outcome: number;
  amount: number;
  odds_at_bet: number;
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

// ============================================================================
// POSTGRESQL DATABASE IMPLEMENTATION
// ============================================================================

export const postgresDb = {
  // ============================================================================
  // PLAYER OPERATIONS
  // ============================================================================

  async createPlayer(input: { wallet_address: string; username: string; chain_id?: string }): Promise<Player> {
    const wallet = input.wallet_address.toLowerCase();
    
    // Upsert player
    const result = await query<Player>(
      `INSERT INTO players (wallet_address, username, chain_id, coins)
       VALUES ($1, $2, $3, 100)
       ON CONFLICT (wallet_address) DO UPDATE SET
         username = EXCLUDED.username,
         updated_at = NOW()
       RETURNING *`,
      [wallet, input.username, input.chain_id || null]
    );
    
    const player = result.rows[0];
    
    // Log activity for new players
    const isNew = player.registered_at.getTime() === player.updated_at.getTime();
    if (isNew) {
      await this.logActivity(wallet, player.username, 'REGISTERED', { welcomeBonus: 100 });
    }
    
    return player;
  },

  async getPlayerByWallet(wallet: string): Promise<Player | null> {
    const result = await query<Player>(
      'SELECT * FROM players WHERE wallet_address = $1',
      [wallet.toLowerCase()]
    );
    return result.rows[0] || null;
  },

  async getAllPlayers(): Promise<Player[]> {
    const result = await query<Player>(
      'SELECT * FROM players ORDER BY total_xp DESC'
    );
    return result.rows;
  },

  async updatePlayerXP(wallet: string, xpEarned: number): Promise<Player | null> {
    const result = await query<Player>(
      `UPDATE players SET
         total_xp = total_xp + $2,
         games_played = games_played + 1,
         level = GREATEST(1, FLOOR(SQRT((total_xp + $2) / 100.0)) + 1),
         updated_at = NOW()
       WHERE wallet_address = $1
       RETURNING *`,
      [wallet.toLowerCase(), xpEarned]
    );
    return result.rows[0] || null;
  },

  async getLeaderboard(limit: number = 100): Promise<(Player & { rank: number })[]> {
    const result = await query<Player & { rank: number }>(
      `SELECT *, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
       FROM players
       ORDER BY total_xp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getPlayerRank(wallet: string): Promise<number | null> {
    const result = await query<{ rank: number }>(
      `SELECT rank FROM (
         SELECT wallet_address, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
         FROM players
       ) ranked WHERE wallet_address = $1`,
      [wallet.toLowerCase()]
    );
    return result.rows[0]?.rank || null;
  },

  // ============================================================================
  // SCORE OPERATIONS
  // ============================================================================

  async createScore(input: {
    player_wallet: string;
    game_type: string;
    score: number;
    xp_earned: number;
    bonus_data?: number;
    chain_id?: string;
  }): Promise<Score> {
    const result = await query<Score>(
      `INSERT INTO scores (player_wallet, game_type, score, xp_earned, bonus_data, chain_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.player_wallet.toLowerCase(),
        input.game_type,
        input.score,
        input.xp_earned,
        input.bonus_data || null,
        input.chain_id || null
      ]
    );
    return result.rows[0];
  },

  async getRecentScores(limit: number = 50): Promise<(Score & { username: string })[]> {
    const result = await query<Score & { username: string }>(
      `SELECT s.*, p.username
       FROM scores s
       JOIN players p ON s.player_wallet = p.wallet_address
       ORDER BY s.submitted_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async getGameScores(gameType: string, limit: number = 50): Promise<(Score & { username: string })[]> {
    const result = await query<Score & { username: string }>(
      `SELECT s.*, p.username
       FROM scores s
       JOIN players p ON s.player_wallet = p.wallet_address
       WHERE s.game_type = $1
       ORDER BY s.score DESC
       LIMIT $2`,
      [gameType, limit]
    );
    return result.rows;
  },

  async getGameHighScores(gameType: string, limit: number = 10): Promise<{
    player_wallet: string;
    username: string;
    score: number;
    xp_earned: number;
    rank: number;
    submitted_at: Date;
  }[]> {
    const result = await query<any>(
      `SELECT DISTINCT ON (s.player_wallet)
         s.player_wallet,
         p.username,
         s.score,
         s.xp_earned,
         s.submitted_at
       FROM scores s
       JOIN players p ON s.player_wallet = p.wallet_address
       WHERE s.game_type = $1
       ORDER BY s.player_wallet, s.score DESC`,
      [gameType]
    );
    
    // Sort and add ranks
    const sorted = result.rows.sort((a: any, b: any) => b.score - a.score).slice(0, limit);
    return sorted.map((row: any, index: number) => ({ ...row, rank: index + 1 }));
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
    const playersResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM players');
    const scoresResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM scores');
    const xpResult = await query<{ sum: string }>('SELECT COALESCE(SUM(total_xp), 0) as sum FROM players');
    const topPlayerResult = await query<Player>('SELECT * FROM players ORDER BY total_xp DESC LIMIT 1');
    const predictionsResult = await query<{ count: string }>('SELECT COUNT(*) as count FROM predictions');
    const coinsResult = await query<{ sum: string }>('SELECT COALESCE(SUM(amount), 0) as sum FROM predictions');
    
    const topPlayer = topPlayerResult.rows[0];
    
    return {
      totalPlayers: parseInt(playersResult.rows[0].count),
      totalGamesPlayed: parseInt(scoresResult.rows[0].count),
      totalXpEarned: parseInt(xpResult.rows[0].sum),
      totalPredictions: parseInt(predictionsResult.rows[0].count),
      totalCoinsWagered: parseInt(coinsResult.rows[0].sum),
      topXp: topPlayer?.total_xp || 0,
      highestLevel: topPlayer?.level || 1,
    };
  },

  // ============================================================================
  // ACTIVITY LOG OPERATIONS
  // ============================================================================

  async logActivity(wallet: string, username: string, action: ActivityLog['action'], details: Record<string, any>): Promise<void> {
    await query(
      `INSERT INTO activity_logs (wallet_address, username, action, details)
       VALUES ($1, $2, $3, $4)`,
      [wallet.toLowerCase(), username, action, JSON.stringify(details)]
    );
  },

  async getActivityFeed(limit: number = 50): Promise<ActivityLog[]> {
    const result = await query<ActivityLog>(
      `SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
    }));
  },

  async getUserActivity(wallet: string, limit: number = 50): Promise<ActivityLog[]> {
    const result = await query<ActivityLog>(
      `SELECT * FROM activity_logs WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT $2`,
      [wallet.toLowerCase(), limit]
    );
    return result.rows.map(row => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details
    }));
  },

  // ============================================================================
  // CRYPTO ROUND OPERATIONS
  // ============================================================================

  async createCryptoRound(input: {
    asset: CryptoAsset;
    start_price: number;
    duration_secs: number;
  }): Promise<CryptoRound> {
    const result = await query<CryptoRound>(
      `INSERT INTO crypto_rounds (asset, start_price, duration_secs)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.asset, input.start_price, input.duration_secs]
    );
    return result.rows[0];
  },

  async getCryptoRound(id: number): Promise<CryptoRound | null> {
    const result = await query<CryptoRound>(
      'SELECT * FROM crypto_rounds WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async getActiveCryptoRounds(): Promise<CryptoRound[]> {
    // Only return rounds that are ACTIVE and not yet expired
    const result = await query<CryptoRound>(
      `SELECT * FROM crypto_rounds 
       WHERE status = 'ACTIVE' 
       AND (start_time + (duration_secs * interval '1 second')) > NOW()
       ORDER BY start_time DESC`
    );
    return result.rows;
  },

  async getExpiredUnresolvedRounds(): Promise<CryptoRound[]> {
    // Get rounds that are ACTIVE but have passed their end time
    const result = await query<CryptoRound>(
      `SELECT * FROM crypto_rounds 
       WHERE status = 'ACTIVE' 
       AND (start_time + (duration_secs * interval '1 second')) <= NOW()
       ORDER BY start_time DESC`
    );
    return result.rows;
  },

  async getAllCryptoRounds(limit: number = 50): Promise<CryptoRound[]> {
    const result = await query<CryptoRound>(
      `SELECT * FROM crypto_rounds ORDER BY start_time DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async resolveCryptoRound(id: number, end_price: number): Promise<CryptoRound | null> {
    // Get the round first
    const roundResult = await query<CryptoRound>(
      'SELECT * FROM crypto_rounds WHERE id = $1',
      [id]
    );
    const round = roundResult.rows[0];
    if (!round || round.status !== 'ACTIVE') return null;

    // Determine winning direction
    const winning_direction: PredictionDirection = end_price >= round.start_price ? 'UP' : 'DOWN';

    // Update round
    const result = await query<CryptoRound>(
      `UPDATE crypto_rounds SET
         end_price = $2,
         status = 'RESOLVED',
         winning_direction = $3
       WHERE id = $1
       RETURNING *`,
      [id, end_price, winning_direction]
    );
    const resolvedRound = result.rows[0];

    // Process predictions
    const predictions = await query<Prediction>(
      `SELECT * FROM predictions WHERE reference_id = $1 AND prediction_type = 'CRYPTO' AND status = 'PENDING'`,
      [id]
    );

    for (const pred of predictions.rows) {
      const predDirection = pred.direction_or_outcome === 1 ? 'UP' : 'DOWN';
      const won = predDirection === winning_direction;
      const payout = won ? Math.floor(pred.amount * 1.9) : 0;

      // Update prediction
      await query(
        `UPDATE predictions SET status = $2, payout = $3 WHERE id = $1`,
        [pred.id, won ? 'WON' : 'LOST', payout]
      );

      // Update player coins if won
      if (won) {
        await query(
          `UPDATE players SET coins = coins + $2, predictions_won = predictions_won + 1 WHERE wallet_address = $1`,
          [pred.wallet_address, payout]
        );
      }

      // Get player for activity log
      const player = await this.getPlayerByWallet(pred.wallet_address);
      if (player) {
        if (won) {
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_WON', {
            asset: round.asset,
            direction: predDirection,
            amount: pred.amount,
            payout,
            roundId: id,
          });
        } else {
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_LOST', {
            asset: round.asset,
            direction: predDirection,
            amount: pred.amount,
            roundId: id,
          });
        }
      }
    }

    return resolvedRound;
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
    const result = await query<WorldEvent>(
      `INSERT INTO world_events (title, description, category, end_time)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.title, input.description, input.category, input.end_time]
    );
    return result.rows[0];
  },

  async getWorldEvent(id: number): Promise<WorldEvent | null> {
    const result = await query<WorldEvent>(
      'SELECT * FROM world_events WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async getActiveWorldEvents(): Promise<WorldEvent[]> {
    const result = await query<WorldEvent>(
      `SELECT * FROM world_events WHERE status = 'ACTIVE' ORDER BY end_time ASC`
    );
    return result.rows;
  },

  async getAllWorldEvents(limit: number = 50): Promise<WorldEvent[]> {
    const result = await query<WorldEvent>(
      `SELECT * FROM world_events ORDER BY created_at DESC LIMIT $1`,
      [limit]
    );
    return result.rows;
  },

  async resolveWorldEvent(id: number, outcome: boolean): Promise<WorldEvent | null> {
    // Get the event first
    const eventResult = await query<WorldEvent>(
      'SELECT * FROM world_events WHERE id = $1',
      [id]
    );
    const event = eventResult.rows[0];
    if (!event || event.status !== 'ACTIVE') return null;

    // Update event
    const result = await query<WorldEvent>(
      `UPDATE world_events SET
         outcome = $2,
         status = 'RESOLVED'
       WHERE id = $1
       RETURNING *`,
      [id, outcome]
    );
    const resolvedEvent = result.rows[0];

    // Process predictions
    const predictions = await query<Prediction>(
      `SELECT * FROM predictions WHERE reference_id = $1 AND prediction_type = 'EVENT' AND status = 'PENDING'`,
      [id]
    );

    for (const pred of predictions.rows) {
      const predOutcome = pred.direction_or_outcome === 1;
      const won = predOutcome === outcome;
      const payout = won ? Math.floor(pred.amount * 1.9) : 0;

      // Update prediction
      await query(
        `UPDATE predictions SET status = $2, payout = $3 WHERE id = $1`,
        [pred.id, won ? 'WON' : 'LOST', payout]
      );

      // Update player coins if won
      if (won) {
        await query(
          `UPDATE players SET coins = coins + $2, predictions_won = predictions_won + 1 WHERE wallet_address = $1`,
          [pred.wallet_address, payout]
        );
      }

      // Get player for activity log
      const player = await this.getPlayerByWallet(pred.wallet_address);
      if (player) {
        if (won) {
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_WON', {
            eventTitle: event.title,
            prediction: predOutcome ? 'YES' : 'NO',
            amount: pred.amount,
            payout,
            eventId: id,
          });
        } else {
          await this.logActivity(pred.wallet_address, player.username, 'PREDICTION_LOST', {
            eventTitle: event.title,
            prediction: predOutcome ? 'YES' : 'NO',
            amount: pred.amount,
            eventId: id,
          });
        }
      }
    }

    return resolvedEvent;
  },

  // ============================================================================
  // PREDICTION OPERATIONS
  // ============================================================================

  async placeCryptoPrediction(input: {
    wallet_address: string;
    round_id: number;
    direction: PredictionDirection;
    amount: number;
  }): Promise<Prediction> {
    const wallet = input.wallet_address.toLowerCase();
    const direction_value = input.direction === 'UP' ? 1 : 0;

    // Deduct coins from player
    const playerResult = await query<Player>(
      `UPDATE players SET coins = coins - $2, predictions_made = predictions_made + 1 WHERE wallet_address = $1 AND coins >= $2 RETURNING *`,
      [wallet, input.amount]
    );
    if (playerResult.rows.length === 0) {
      throw new Error('Insufficient coins');
    }
    const player = playerResult.rows[0];

    // Create prediction
    const result = await query<Prediction>(
      `INSERT INTO predictions (wallet_address, prediction_type, reference_id, direction_or_outcome, amount)
       VALUES ($1, 'CRYPTO', $2, $3, $4)
       RETURNING *`,
      [wallet, input.round_id, direction_value, input.amount]
    );
    const prediction = result.rows[0];

    // Update round totals
    if (input.direction === 'UP') {
      await query(`UPDATE crypto_rounds SET total_up = total_up + $2 WHERE id = $1`, [input.round_id, input.amount]);
    } else {
      await query(`UPDATE crypto_rounds SET total_down = total_down + $2 WHERE id = $1`, [input.round_id, input.amount]);
    }

    // Get round for activity log
    const round = await this.getCryptoRound(input.round_id);

    // Log activity
    await this.logActivity(wallet, player.username, 'PREDICTION_PLACED', {
      asset: round?.asset,
      direction: input.direction,
      amount: input.amount,
      roundId: input.round_id,
    });

    return prediction;
  },

  async placeEventPrediction(input: {
    wallet_address: string;
    event_id: number;
    outcome: boolean;
    amount: number;
  }): Promise<Prediction> {
    const wallet = input.wallet_address.toLowerCase();
    const outcome_value = input.outcome ? 1 : 0;

    // Deduct coins from player
    const playerResult = await query<Player>(
      `UPDATE players SET coins = coins - $2, predictions_made = predictions_made + 1 WHERE wallet_address = $1 AND coins >= $2 RETURNING *`,
      [wallet, input.amount]
    );
    if (playerResult.rows.length === 0) {
      throw new Error('Insufficient coins');
    }
    const player = playerResult.rows[0];

    // Create prediction
    const result = await query<Prediction>(
      `INSERT INTO predictions (wallet_address, prediction_type, reference_id, direction_or_outcome, amount)
       VALUES ($1, 'EVENT', $2, $3, $4)
       RETURNING *`,
      [wallet, input.event_id, outcome_value, input.amount]
    );
    const prediction = result.rows[0];

    // Update event totals
    if (input.outcome) {
      await query(`UPDATE world_events SET total_yes = total_yes + $2 WHERE id = $1`, [input.event_id, input.amount]);
    } else {
      await query(`UPDATE world_events SET total_no = total_no + $2 WHERE id = $1`, [input.event_id, input.amount]);
    }

    // Get event for activity log
    const event = await this.getWorldEvent(input.event_id);

    // Log activity
    await this.logActivity(wallet, player.username, 'PREDICTION_PLACED', {
      eventTitle: event?.title,
      prediction: input.outcome ? 'YES' : 'NO',
      amount: input.amount,
      eventId: input.event_id,
    });

    return prediction;
  },

  async getPrediction(id: number): Promise<Prediction | null> {
    const result = await query<Prediction>(
      'SELECT * FROM predictions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  async getUserPredictions(wallet: string): Promise<Prediction[]> {
    const result = await query<Prediction>(
      `SELECT * FROM predictions WHERE wallet_address = $1 ORDER BY created_at DESC`,
      [wallet.toLowerCase()]
    );
    return result.rows;
  },

  async getPredictionsByRound(roundId: number): Promise<Prediction[]> {
    const result = await query<Prediction>(
      `SELECT * FROM predictions WHERE reference_id = $1 AND prediction_type = 'CRYPTO'`,
      [roundId]
    );
    return result.rows;
  },

  // ============================================================================
  // COIN OPERATIONS
  // ============================================================================

  async claimDailyBonus(wallet: string): Promise<{ success: boolean; coins?: number; error?: string }> {
    const player = await this.getPlayerByWallet(wallet);
    if (!player) return { success: false, error: 'Player not found' };

    const now = new Date();
    const lastClaim = player.last_daily_claim;

    // Check if 24 hours have passed
    if (lastClaim) {
      const hoursSinceClaim = (now.getTime() - new Date(lastClaim).getTime()) / (1000 * 60 * 60);
      if (hoursSinceClaim < 24) {
        return { success: false, error: 'Daily bonus already claimed' };
      }
    }

    // Update player
    await query(
      `UPDATE players SET coins = coins + 100, last_daily_claim = NOW() WHERE wallet_address = $1`,
      [wallet.toLowerCase()]
    );

    await this.logActivity(wallet.toLowerCase(), player.username, 'DAILY_BONUS', { coins: 100 });

    return { success: true, coins: 100 };
  },

  async getCoinBalance(wallet: string): Promise<number | null> {
    const player = await this.getPlayerByWallet(wallet);
    return player?.coins ?? null;
  },

  async addCoins(wallet: string, amount: number): Promise<void> {
    await query(
      `UPDATE players SET coins = coins + $2 WHERE wallet_address = $1`,
      [wallet, amount]
    );
  },

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  async seed() {
    // Check if there are any active rounds
    const activeRounds = await this.getActiveCryptoRounds();
    if (activeRounds.length === 0) {
      // Create initial crypto rounds with real prices
      try {
        const binanceService = await import('../services/binance.js').then(m => m.binanceService);
        const btcPrice = await binanceService.getBTCPrice();
        const ethPrice = await binanceService.getETHPrice();
        await this.createCryptoRound({ asset: 'BTC', start_price: btcPrice.price, duration_secs: 300 });
        await this.createCryptoRound({ asset: 'ETH', start_price: ethPrice.price, duration_secs: 300 });
        console.log(`✅ Created prediction rounds with real prices: BTC=$${btcPrice.price/100}, ETH=$${ethPrice.price/100}`);
      } catch (err) {
        console.error('⚠️ Failed to fetch prices, creating rounds with fallback prices:', err);
        await this.createCryptoRound({ asset: 'BTC', start_price: 9500000, duration_secs: 300 });
        await this.createCryptoRound({ asset: 'ETH', start_price: 350000, duration_secs: 300 });
      }
    }
    console.log('✅ PostgreSQL database initialized - Ready for users!');
  },
};

export default postgresDb;
