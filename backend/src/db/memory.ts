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
  onchain_round_id: number | null; // The blockchain round ID (source of truth for executor)
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
  action: 'GAME_COMPLETED' | 'PREDICTION_PLACED' | 'PREDICTION_WON' | 'PREDICTION_LOST' | 'DAILY_BONUS' | 'REGISTERED' | 'TOURNAMENT_COMPLETED' | 'MULTIPLAYER_WIN' | 'MULTIPLAYER_LOSS';
  details: Record<string, any>;
  created_at: Date;
}

// =============================================================================
// TOURNAMENT LEADERBOARD TYPES
// =============================================================================

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
  submitted_at: Date;
}

// =============================================================================
// FILE PERSISTENCE
// =============================================================================

import * as fs from 'fs';
import * as path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'arcade-data.json');

interface PersistedData {
  players: [string, Player][];
  scores: Score[];
  cryptoRounds: [number, CryptoRound][];
  worldEvents: [number, WorldEvent][];
  predictions: Prediction[];
  activityLogs: ActivityLog[];
  tournamentLeaderboard: TournamentLeaderboardEntry[];
  nextIds: {
    playerId: number;
    scoreId: number;
    roundId: number;
    eventId: number;
    predictionId: number;
    activityId: number;
    tournamentEntryId: number;
  };
  stats: typeof stats;
}

function ensureDataDir() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function saveData() {
  try {
    ensureDataDir();
    const data: PersistedData = {
      players: Array.from(players.entries()),
      scores: scores,
      cryptoRounds: Array.from(cryptoRounds.entries()),
      worldEvents: Array.from(worldEvents.entries()),
      predictions: predictions,
      activityLogs: activityLogs,
      tournamentLeaderboard: tournamentLeaderboard,
      nextIds: {
        playerId: nextPlayerId,
        scoreId: nextScoreId,
        roundId: nextRoundId,
        eventId: nextEventId,
        predictionId: nextPredictionId,
        activityId: nextActivityId,
        tournamentEntryId: nextTournamentEntryId,
      },
      stats: stats,
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log(`💾 Data saved (${players.size} players, ${activityLogs.length} activities)`);
  } catch (error) {
    console.error('❌ Failed to save data:', error);
  }
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      console.log('📭 No saved data found, starting fresh');
      return;
    }
    
    const rawData = fs.readFileSync(DATA_FILE, 'utf-8');
    const data: PersistedData = JSON.parse(rawData);
    
    // Restore players
    players.clear();
    for (const [key, player] of data.players) {
      // Convert date strings back to Date objects
      player.registered_at = new Date(player.registered_at);
      player.updated_at = new Date(player.updated_at);
      if (player.last_daily_claim) {
        player.last_daily_claim = new Date(player.last_daily_claim);
      }
      players.set(key, player);
    }
    
    // Restore scores
    scores.length = 0;
    for (const score of data.scores) {
      score.submitted_at = new Date(score.submitted_at);
      scores.push(score);
    }
    
    // Restore crypto rounds
    cryptoRounds.clear();
    for (const [key, round] of data.cryptoRounds) {
      round.start_time = new Date(round.start_time);
      round.created_at = new Date(round.created_at);
      // Ensure onchain_round_id exists (migration for old data)
      if (round.onchain_round_id === undefined) {
        round.onchain_round_id = null;
      }
      cryptoRounds.set(key, round);
    }
    
    // Restore world events
    worldEvents.clear();
    for (const [key, event] of data.worldEvents) {
      event.end_time = new Date(event.end_time);
      event.created_at = new Date(event.created_at);
      worldEvents.set(key, event);
    }
    
    // Restore predictions
    predictions.length = 0;
    for (const pred of data.predictions) {
      pred.created_at = new Date(pred.created_at);
      predictions.push(pred);
    }
    
    // Restore activity logs
    activityLogs.length = 0;
    for (const activity of data.activityLogs) {
      activity.created_at = new Date(activity.created_at);
      activityLogs.push(activity);
    }
    
    // Restore tournament leaderboard
    tournamentLeaderboard.length = 0;
    if (data.tournamentLeaderboard) {
      for (const entry of data.tournamentLeaderboard) {
        entry.submitted_at = new Date(entry.submitted_at);
        tournamentLeaderboard.push(entry);
      }
    }
    
    // Restore IDs
    nextPlayerId = data.nextIds.playerId;
    nextScoreId = data.nextIds.scoreId;
    nextRoundId = data.nextIds.roundId;
    nextEventId = data.nextIds.eventId;
    nextPredictionId = data.nextIds.predictionId;
    nextActivityId = data.nextIds.activityId;
    nextTournamentEntryId = data.nextIds.tournamentEntryId || 1;
    
    // Restore stats
    Object.assign(stats, data.stats);
    
    console.log(`✅ Data loaded: ${players.size} players, ${scores.length} scores, ${activityLogs.length} activities`);
    
    // Cleanup stale ACTIVE rounds that have expired
    const now = Date.now();
    let staleCount = 0;
    for (const [id, round] of cryptoRounds.entries()) {
      if (round.status === 'ACTIVE') {
        const endTime = round.start_time.getTime() + (round.duration_secs * 1000);
        if (now >= endTime) {
          // Mark as RESOLVED with the start price (no change = draw)
          round.status = 'RESOLVED';
          round.end_price = round.start_price;
          round.winning_direction = null; // No winner for stale rounds
          staleCount++;
        }
      }
    }
    if (staleCount > 0) {
      console.log(`🧹 Cleaned up ${staleCount} stale ACTIVE rounds`);
    }
  } catch (error) {
    console.error('❌ Failed to load data:', error);
  }
}

// =============================================================================
// IN-MEMORY STORAGE
// =============================================================================

// In-memory storage
const players: Map<string, Player> = new Map();
const scores: Score[] = [];
const cryptoRounds: Map<number, CryptoRound> = new Map();
const worldEvents: Map<number, WorldEvent> = new Map();
const predictions: Prediction[] = [];
const activityLogs: ActivityLog[] = [];
const tournamentLeaderboard: TournamentLeaderboardEntry[] = [];

let nextPlayerId = 1;
let nextScoreId = 1;
let nextRoundId = 1;
let nextEventId = 1;
let nextPredictionId = 1;
let nextActivityId = 1;
let nextTournamentEntryId = 1;

// Stats
const stats = {
  total_players: 0,
  total_games_played: 0,
  total_xp_earned: 0,
  total_predictions: 0,
  total_coins_wagered: 0,
};

// Load data on startup (AFTER variable declarations)
loadData();

// Auto-save every 30 seconds
setInterval(() => {
  saveData();
}, 30000);

// Save on process exit
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down, saving data...');
  saveData();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down, saving data...');
  saveData();
  process.exit(0);
});

/**
 * In-memory database implementation with file persistence
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
    
    // Save data to disk
    saveData();
    
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
    
    // Save after XP update
    saveData();
    
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
    
    // Save after score submission
    saveData();
    
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
    
    // Save after activity log
    saveData();
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
    onchain_round_id?: number; // Optional: blockchain round ID (source of truth)
  }): Promise<CryptoRound> {
    // Check if there's already an active round for this asset
    const existingActive = Array.from(cryptoRounds.values())
      .find(r => r.asset === input.asset && r.status === 'ACTIVE');
    
    if (existingActive) {
      console.log(`⚠️ Active round for ${input.asset} already exists (ID: ${existingActive.id}), skipping creation`);
      return existingActive;
    }
    
    const roundId = nextRoundId++;
    const round: CryptoRound = {
      id: roundId,
      onchain_round_id: input.onchain_round_id ?? roundId, // Default to DB ID for executor sync
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
    console.log(`🆕 Created crypto round: DB ID=${round.id}, onchain_id=${round.onchain_round_id}, asset=${round.asset}`);
    
    // Cleanup old resolved rounds to prevent memory bloat (keep max 50)
    const allRounds = Array.from(cryptoRounds.values())
      .sort((a, b) => b.start_time.getTime() - a.start_time.getTime());
    if (allRounds.length > 50) {
      const toDelete = allRounds.slice(50);
      for (const r of toDelete) {
        cryptoRounds.delete(r.id);
      }
      console.log(`🧹 Cleaned up ${toDelete.length} old rounds`);
    }
    
    saveData();
    return round;
  },

  async getCryptoRound(id: number): Promise<CryptoRound | null> {
    return cryptoRounds.get(id) || null;
  },

  async getActiveCryptoRounds(): Promise<CryptoRound[]> {
    const now = new Date();
    return Array.from(cryptoRounds.values())
      .filter(r => {
        if (r.status !== 'ACTIVE') return false;
        // Also filter out expired rounds that haven't been resolved yet
        const endTime = new Date(r.start_time.getTime() + r.duration_secs * 1000);
        return now <= endTime;
      })
      .sort((a, b) => b.start_time.getTime() - a.start_time.getTime())
      .slice(0, 2); // Maximum 2 active rounds (1 BTC, 1 ETH)
  },

  // Get rounds that have ACTIVE status but are expired (need auto-resolution)
  // IMPORTANT: Only returns rounds that have an onchain_round_id set!
  async getExpiredUnresolvedRounds(): Promise<CryptoRound[]> {
    const now = new Date();
    return Array.from(cryptoRounds.values())
      .filter(r => {
        if (r.status !== 'ACTIVE') return false;
        if (r.onchain_round_id === null) return false; // Must have on-chain ID
        const endTime = new Date(r.start_time.getTime() + r.duration_secs * 1000);
        return now > endTime; // Expired but still ACTIVE status
      });
  },

  // Get rounds that are pending (executor needs to resolve them on-chain)
  // Returns rounds with onchain_round_id that are ACTIVE and expired
  async getPendingRoundsForExecutor(): Promise<Array<{
    onchain_round_id: number;
    asset: CryptoAsset;
    start_price: number;
    start_time: Date;
    duration_secs: number;
  }>> {
    const now = new Date();
    return Array.from(cryptoRounds.values())
      .filter(r => {
        if (r.status !== 'ACTIVE') return false;
        if (r.onchain_round_id === null) return false; // Must have on-chain ID
        const endTime = new Date(r.start_time.getTime() + r.duration_secs * 1000);
        return now > endTime; // Expired but still ACTIVE
      })
      .map(r => ({
        onchain_round_id: r.onchain_round_id!,
        asset: r.asset,
        start_price: r.start_price,
        start_time: r.start_time,
        duration_secs: r.duration_secs,
      }));
  },

  // Update a round's onchain_round_id after blockchain creation
  async setOnchainRoundId(dbId: number, onchainId: number): Promise<boolean> {
    const round = cryptoRounds.get(dbId);
    if (!round) return false;
    round.onchain_round_id = onchainId;
    saveData();
    console.log(`🔗 Linked DB round ${dbId} to on-chain round ${onchainId}`);
    return true;
  },

  // Cancel expired rounds that were never linked to on-chain (no bets placed)
  // These rounds can't be resolved because they don't exist on-chain
  async cancelUnlinkedExpiredRounds(): Promise<number> {
    const now = new Date();
    let cancelled = 0;
    
    for (const round of cryptoRounds.values()) {
      if (round.status !== 'ACTIVE') continue;
      if (round.onchain_round_id !== null) continue; // Has on-chain link, skip
      
      const endTime = new Date(round.start_time.getTime() + round.duration_secs * 1000);
      if (now > endTime) {
        // Expired and no on-chain link - cancel it
        round.status = 'CANCELLED';
        round.end_price = round.start_price; // No change
        console.log(`🚫 Cancelled unlinked expired round ${round.id} (${round.asset}) - no bets placed`);
        cancelled++;
      }
    }
    
    if (cancelled > 0) {
      saveData();
    }
    return cancelled;
  },

  // Find round by onchain_round_id (for executor notifications)
  async getCryptoRoundByOnchainId(onchainId: number): Promise<CryptoRound | null> {
    return Array.from(cryptoRounds.values()).find(r => r.onchain_round_id === onchainId) || null;
  },

  // Resolve a round by its onchain_round_id (used by executor)
  async resolveCryptoRoundByOnchainId(onchainId: number, end_price: number): Promise<CryptoRound | null> {
    const round = Array.from(cryptoRounds.values()).find(r => r.onchain_round_id === onchainId);
    if (!round || round.status !== 'ACTIVE') return null;
    
    round.end_price = end_price;
    round.status = 'RESOLVED';
    round.winning_direction = end_price > round.start_price ? 'UP' : 'DOWN';
    
    console.log(`✅ Resolved round: onchain_id=${onchainId}, DB_id=${round.id}, result=${round.winning_direction}`);
    
    // Process winning predictions (by DB round ID since predictions reference DB ID)
    const roundPredictions = predictions.filter(
      p => p.prediction_type === 'CRYPTO' && p.reference_id === round.id
    );
    
    console.log(`📊 Processing ${roundPredictions.length} predictions for round ${round.id}`);
    
    for (const pred of roundPredictions) {
      const userDirection: PredictionDirection = pred.direction_or_outcome === 1 ? 'UP' : 'DOWN';
      const won = userDirection === round.winning_direction;
      
      pred.status = won ? 'WON' : 'LOST';
      if (won) {
        pred.payout = Math.floor((pred.amount * pred.odds_at_bet) / 10000);
        const player = players.get(pred.wallet_address);
        if (player) {
          player.coins += pred.payout;
          player.predictions_won++;
          console.log(`   💰 ${player.username} WON ${pred.payout} coins`);
        }
      } else {
        pred.payout = 0;
        const player = players.get(pred.wallet_address);
        if (player) {
          console.log(`   ❌ ${player.username} lost ${pred.amount} coins`);
        }
      }
    }
    
    saveData();
    return round;
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
    outcome: boolean;  // Changed from 'prediction' to match postgres.ts
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
      const poolForPrediction = input.outcome ? event.total_yes : event.total_no;
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
    
    // Update event totals - use input.outcome (true = YES, false = NO)
    if (input.outcome) {
      event.total_yes += input.amount;
    } else {
      event.total_no += input.amount;
    }
    
    const pred: Prediction = {
      id: nextPredictionId++,
      wallet_address: wallet,
      prediction_type: 'EVENT',
      reference_id: input.event_id,
      direction_or_outcome: input.outcome ? 1 : 0,
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
      prediction: input.outcome ? 'YES' : 'NO',
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
    
    // Save after bonus claim
    saveData();
    
    return { success: true, coins: 100 };
  },

  async getCoinBalance(wallet: string): Promise<number | null> {
    const player = players.get(wallet.toLowerCase());
    return player?.coins ?? null;
  },

  async addCoins(wallet: string, amount: number): Promise<number | null> {
    const player = players.get(wallet.toLowerCase());
    if (!player) return null;
    
    player.coins += amount;
    saveData();
    
    return player.coins;
  },

  // Initialize prediction rounds (only if needed)
  async seed() {
    // Skip mock player data - only real users who register will appear
    
    // First, clean up any stale ACTIVE rounds (rounds that have expired but weren't resolved)
    const now = new Date();
    let staleCount = 0;
    for (const round of cryptoRounds.values()) {
      if (round.status === 'ACTIVE') {
        const endTime = new Date(round.start_time.getTime() + round.duration_secs * 1000);
        if (now > endTime) {
          // Mark as resolved with unknown direction (will be cleaned up)
          round.status = 'RESOLVED';
          round.end_price = round.start_price;
          round.winning_direction = 'UP'; // Default
          staleCount++;
        }
      }
    }
    if (staleCount > 0) {
      console.log(`🧹 Cleaned up ${staleCount} stale rounds from previous session`);
      saveData();
    }
    
    // Check if we already have active rounds for each asset
    const activeRounds = await this.getActiveCryptoRounds();
    const hasActiveBTC = activeRounds.some(r => r.asset === 'BTC');
    const hasActiveETH = activeRounds.some(r => r.asset === 'ETH');
    
    if (hasActiveBTC && hasActiveETH) {
      console.log('✅ Active rounds already exist for BTC and ETH, skipping seed');
    } else {
      // Create crypto rounds with real prices from Binance (only for missing assets)
      try {
        const binanceModule = await import('../services/binance.js');
        const binanceService = binanceModule.binanceService;
        
        // Wait for prices to be available (up to 5 seconds)
        console.log('⏳ Waiting for price data...');
        const hasPrices = await binanceService.waitForPrices(5000);
        
        if (!hasPrices) {
          console.warn('⚠️ Prices not available after 5s, using fallback prices');
        }
        
        if (!hasActiveBTC) {
          const btcPrice = await binanceService.getBTCPrice();
          const price = btcPrice.price > 0 ? btcPrice.price : 9500000;
          await this.createCryptoRound({ asset: 'BTC', start_price: price, duration_secs: 300 });
          console.log(`✅ Created BTC round at $${price/100}`);
        }
        
        if (!hasActiveETH) {
          const ethPrice = await binanceService.getETHPrice();
          const price = ethPrice.price > 0 ? ethPrice.price : 350000;
          await this.createCryptoRound({ asset: 'ETH', start_price: price, duration_secs: 300 });
          console.log(`✅ Created ETH round at $${price/100}`);
        }
      } catch (err) {
        console.error('⚠️ Failed to fetch Binance prices, creating rounds with fallback:', err);
        if (!hasActiveBTC) {
          await this.createCryptoRound({ asset: 'BTC', start_price: 9500000, duration_secs: 300 });
        }
        if (!hasActiveETH) {
          await this.createCryptoRound({ asset: 'ETH', start_price: 350000, duration_secs: 300 });
        }
      }
    }
    
    // Seed Polymarket-style world events (only if none exist)
    const activeEvents = await this.getActiveWorldEvents();
    if (activeEvents.length === 0) {
      console.log('📰 Seeding Polymarket-style trending events...');
      
      // Trending events like Polymarket - long term predictions (14 days to 1 month)
      const trendingEvents = [
        // Politics
        {
          title: "Will Bitcoin hit $100,000 by end of January 2026?",
          description: "Resolves YES if Bitcoin price reaches $100,000 USD on any major exchange (Binance, Coinbase) before January 31, 2026 11:59 PM UTC.",
          category: "Crypto",
          days: 27, // ~1 month
          image: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
          yesOdds: 35, // 35% chance
        },
        {
          title: "Will Ethereum reach $5,000 by end of February 2026?",
          description: "Resolves YES if Ethereum price reaches $5,000 USD on any major exchange before February 28, 2026 11:59 PM UTC.",
          category: "Crypto",
          days: 55,
          image: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
          yesOdds: 25,
        },
        {
          title: "Will SpaceX Starship complete orbital flight by March 2026?",
          description: "Resolves YES if SpaceX successfully completes a full orbital flight with Starship (launch, orbit, and controlled landing/splashdown) by March 31, 2026.",
          category: "Tech",
          days: 85,
          image: "🚀",
          yesOdds: 65,
        },
        {
          title: "Will Apple announce AR Glasses in 2026?",
          description: "Resolves YES if Apple officially announces a standalone AR glasses product (not Vision Pro) during any 2026 event or press release.",
          category: "Tech",
          days: 180,
          image: "🍎",
          yesOdds: 40,
        },
        {
          title: "Will there be a Russia-Ukraine ceasefire by June 2026?",
          description: "Resolves YES if both Russia and Ukraine officially agree to a ceasefire (temporary or permanent) by June 30, 2026.",
          category: "Geopolitics",
          days: 175,
          image: "🕊️",
          yesOdds: 30,
        },
        {
          title: "Will the Fed cut interest rates in January 2026?",
          description: "Resolves YES if the Federal Reserve announces an interest rate cut at the January 2026 FOMC meeting.",
          category: "Finance",
          days: 27,
          image: "🏦",
          yesOdds: 45,
        },
        {
          title: "Will Solana reach $500 by end of Q1 2026?",
          description: "Resolves YES if Solana (SOL) price reaches $500 USD on any major exchange before March 31, 2026.",
          category: "Crypto",
          days: 85,
          image: "https://cryptologos.cc/logos/solana-sol-logo.png",
          yesOdds: 20,
        },
        {
          title: "Will AI generate a Billboard Hot 100 song by 2026?",
          description: "Resolves YES if a song with AI-generated vocals or composition reaches the Billboard Hot 100 chart in 2026.",
          category: "Culture",
          days: 180,
          image: "🎵",
          yesOdds: 55,
        },
        {
          title: "Will Tesla release a sub-$30,000 car in 2026?",
          description: "Resolves YES if Tesla officially releases (available for customer delivery) a new vehicle model priced under $30,000 USD in 2026.",
          category: "Tech",
          days: 180,
          image: "🚗",
          yesOdds: 35,
        },
        {
          title: "Will XRP win the SEC lawsuit appeal by mid-2026?",
          description: "Resolves YES if Ripple (XRP) wins or settles favorably in any SEC appeal proceedings by June 30, 2026.",
          category: "Crypto",
          days: 175,
          image: "⚖️",
          yesOdds: 60,
        },
        {
          title: "Will Manchester City win the Premier League 2025-26?",
          description: "Resolves YES if Manchester City wins the English Premier League for the 2025-26 season.",
          category: "Sports",
          days: 150,
          image: "⚽",
          yesOdds: 55,
        },
        {
          title: "Will a new COVID variant cause global restrictions in 2026?",
          description: "Resolves YES if any country in the G20 reinstates significant COVID-19 restrictions (lockdowns, mask mandates, or travel bans) in 2026.",
          category: "World",
          days: 180,
          image: "🦠",
          yesOdds: 15,
        },
      ];
      
      for (const event of trendingEvents) {
        const endTime = new Date(Date.now() + event.days * 24 * 60 * 60 * 1000);
        
        // Create the event with ZERO initial pools - real data only!
        await this.createWorldEvent({
          title: event.title,
          description: event.description,
          category: event.category,
          end_time: endTime,
        });
        // No fake pools - total_yes and total_no start at 0
        
        console.log(`  ✅ Created event: "${event.title.substring(0, 50)}..."`);
      }
      
      console.log(`✅ Seeded ${trendingEvents.length} trending world events`);
      saveData();
    }
    
    console.log('✅ Backend initialized - Ready for real users!');
  },

  // Admin function to reset all world events (delete corrupted data and re-seed)
  async resetWorldEvents() {
    console.log('🔄 Resetting world events...');
    
    // Delete all predictions for world events
    const eventPreds = predictions.filter(p => p.prediction_type === 'EVENT');
    for (const pred of eventPreds) {
      const idx = predictions.indexOf(pred);
      if (idx !== -1) predictions.splice(idx, 1);
    }
    console.log('  ✅ Deleted all event predictions');
    
    // Delete all world events
    worldEvents.clear();
    console.log('  ✅ Deleted all world events');
    
    // Re-seed events
    const trendingEvents = [
      {
        title: "Will Bitcoin hit $100,000 by end of January 2026?",
        description: "Resolves YES if Bitcoin price reaches $100,000 USD on any major exchange (Binance, Coinbase) before January 31, 2026 11:59 PM UTC.",
        category: "Crypto",
        days: 27,
      },
      {
        title: "Will Ethereum reach $5,000 by end of February 2026?",
        description: "Resolves YES if Ethereum price reaches $5,000 USD on any major exchange before February 28, 2026 11:59 PM UTC.",
        category: "Crypto",
        days: 55,
      },
      {
        title: "Will SpaceX Starship complete orbital flight by March 2026?",
        description: "Resolves YES if SpaceX successfully completes a full orbital flight with Starship (launch, orbit, and controlled landing/splashdown) by March 31, 2026.",
        category: "Tech",
        days: 85,
      },
      {
        title: "Will Apple announce AR Glasses in 2026?",
        description: "Resolves YES if Apple officially announces a standalone AR glasses product (not Vision Pro) during any 2026 event or press release.",
        category: "Tech",
        days: 180,
      },
      {
        title: "Will there be a Russia-Ukraine ceasefire by June 2026?",
        description: "Resolves YES if both Russia and Ukraine officially agree to a ceasefire (temporary or permanent) by June 30, 2026.",
        category: "Geopolitics",
        days: 175,
      },
      {
        title: "Will the Fed cut interest rates in January 2026?",
        description: "Resolves YES if the Federal Reserve announces an interest rate cut at the January 2026 FOMC meeting.",
        category: "Finance",
        days: 27,
      },
      {
        title: "Will Solana reach $500 by end of Q1 2026?",
        description: "Resolves YES if Solana (SOL) price reaches $500 USD on any major exchange before March 31, 2026.",
        category: "Crypto",
        days: 85,
      },
      {
        title: "Will AI generate a Billboard Hot 100 song by 2026?",
        description: "Resolves YES if a song with AI-generated vocals or composition reaches the Billboard Hot 100 chart in 2026.",
        category: "Culture",
        days: 180,
      },
      {
        title: "Will Tesla release a sub-$30,000 car in 2026?",
        description: "Resolves YES if Tesla officially releases (available for customer delivery) a new vehicle model priced under $30,000 USD in 2026.",
        category: "Tech",
        days: 180,
      },
      {
        title: "Will XRP win the SEC lawsuit appeal by mid-2026?",
        description: "Resolves YES if Ripple (XRP) wins or settles favorably in any SEC appeal proceedings by June 30, 2026.",
        category: "Crypto",
        days: 175,
      },
      {
        title: "Will Manchester City win the Premier League 2025-26?",
        description: "Resolves YES if Manchester City wins the English Premier League for the 2025-26 season.",
        category: "Sports",
        days: 150,
      },
      {
        title: "Will a new COVID variant cause global restrictions in 2026?",
        description: "Resolves YES if any country in the G20 reinstates significant COVID-19 restrictions (lockdowns, mask mandates, or travel bans) in 2026.",
        category: "World",
        days: 180,
      },
    ];
    
    for (const event of trendingEvents) {
      const endTime = new Date(Date.now() + event.days * 24 * 60 * 60 * 1000);
      await this.createWorldEvent({
        title: event.title,
        description: event.description,
        category: event.category,
        end_time: endTime,
      });
    }
    
    saveData();
    console.log(`✅ Re-seeded ${trendingEvents.length} fresh world events`);
    return { success: true, eventsCount: trendingEvents.length };
  },

  // =============================================================================
  // TOURNAMENT LEADERBOARD OPERATIONS
  // =============================================================================

  /**
   * Submit or update a tournament leaderboard entry.
   * Only updates if the new score is higher than the existing score.
   */
  async submitTournamentEntry(input: {
    tournament_id: number;
    tournament_name: string;
    player_address: string;
    username: string;
    chain_id: string;
    score: number;
    seed: number;
    moves: number[];
    moves_used: number;
  }): Promise<TournamentLeaderboardEntry> {
    const playerKey = `${input.tournament_id}-${input.player_address.toLowerCase()}`;
    
    // Find existing entry for this player in this tournament
    const existingIndex = tournamentLeaderboard.findIndex(
      e => e.tournament_id === input.tournament_id && 
           e.player_address.toLowerCase() === input.player_address.toLowerCase()
    );
    
    if (existingIndex !== -1) {
      const existing = tournamentLeaderboard[existingIndex];
      // Only update if new score is higher
      if (input.score > existing.score) {
        existing.score = input.score;
        existing.seed = input.seed;
        existing.moves = input.moves;
        existing.moves_used = input.moves_used;
        existing.submitted_at = new Date();
        existing.chain_id = input.chain_id;
        existing.username = input.username;
        saveData();
        console.log(`🏆 Updated tournament entry for ${input.player_address}: ${existing.score} -> ${input.score}`);
        return existing;
      } else {
        console.log(`🏆 Kept existing higher score for ${input.player_address}: ${existing.score} >= ${input.score}`);
        return existing;
      }
    }
    
    // Create new entry
    const entry: TournamentLeaderboardEntry = {
      id: nextTournamentEntryId++,
      tournament_id: input.tournament_id,
      tournament_name: input.tournament_name,
      player_address: input.player_address.toLowerCase(),
      username: input.username,
      chain_id: input.chain_id,
      score: input.score,
      seed: input.seed,
      moves: input.moves,
      moves_used: input.moves_used,
      submitted_at: new Date(),
    };
    
    tournamentLeaderboard.push(entry);
    saveData();
    console.log(`🏆 New tournament entry for ${input.player_address}: ${input.score}`);
    return entry;
  },

  /**
   * Get tournament leaderboard sorted by:
   * 1. Higher score first
   * 2. Fewer moves wins tie
   * 3. Earlier submission wins tie
   * Returns entries with calculated ranks.
   */
  async getTournamentLeaderboard(tournamentId: number, limit: number = 100): Promise<(TournamentLeaderboardEntry & { rank: number })[]> {
    const entries = tournamentLeaderboard
      .filter(e => e.tournament_id === tournamentId)
      .sort((a, b) => {
        // 1. Sort by score DESC (higher score first)
        if (b.score !== a.score) return b.score - a.score;
        // 2. Sort by moves_used ASC (fewer moves wins tie)
        if (a.moves_used !== b.moves_used) return a.moves_used - b.moves_used;
        // 3. Sort by submitted_at ASC (earlier submission wins tie)
        return a.submitted_at.getTime() - b.submitted_at.getTime();
      })
      .slice(0, limit);
    
    // Add ranks
    return entries.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
  },

  /**
   * Get a player's entry for a specific tournament
   */
  async getPlayerTournamentEntry(
    tournamentId: number,
    playerAddress: string
  ): Promise<(TournamentLeaderboardEntry & { rank: number }) | null> {
    const allEntries = await this.getTournamentLeaderboard(tournamentId, 10000);
    return allEntries.find(e => e.player_address.toLowerCase() === playerAddress.toLowerCase()) || null;
  }
};
