/**
 * API Routes for Linera Arcade Backend
 * Uses in-memory database for development, PostgreSQL for production
 * Extended with Prediction Markets API
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { memoryDb } from '../db/memory.js';
import { binanceService } from '../services/binance.js';

const router = Router();

// =============================================================================
// VALIDATION SCHEMAS
// =============================================================================

const RegisterPlayerSchema = z.object({
  wallet_address: z.string().min(10).max(66),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_-]+$/),
  chain_id: z.string().optional()
});

const SubmitScoreSchema = z.object({
  wallet_address: z.string().min(10).max(66),
  game_type: z.enum(['SPEED_CLICKER', 'MEMORY_MATRIX', 'REACTION_STRIKE', 'MATH_BLITZ', 'SNAKE_SPRINT', 'AIM_TRAINER', 'COLOR_RUSH', 'TYPING_BLITZ']),
  score: z.number().int().min(0),
  xp_earned: z.number().int().min(0),
  bonus_data: z.number().int().optional(),
  chain_id: z.string().optional()
});

// Prediction schemas
const CreateCryptoRoundSchema = z.object({
  asset: z.enum(['BTC', 'ETH']),
  start_price: z.number().int().min(0),
  duration_secs: z.number().int().min(60).max(3600).default(300),
});

const PlaceCryptoPredictionSchema = z.object({
  wallet_address: z.string().min(10).max(66),
  round_id: z.number().int().min(0),
  direction: z.enum(['UP', 'DOWN']),
  amount: z.number().int().min(10).max(10000),
});

const ResolveCryptoRoundSchema = z.object({
  end_price: z.number().int().min(0),
});

const CreateWorldEventSchema = z.object({
  title: z.string().min(10).max(200),
  description: z.string().min(10).max(1000),
  category: z.string().min(2).max(50),
  end_time: z.string().transform(str => new Date(str)),
});

const PlaceEventPredictionSchema = z.object({
  wallet_address: z.string().min(10).max(66),
  event_id: z.number().int().min(0),
  outcome: z.string().min(1).max(200),
  amount: z.number().int().min(10).max(10000),
});

const ResolveWorldEventSchema = z.object({
  outcome: z.boolean(),
});

// =============================================================================
// MIDDLEWARE
// =============================================================================

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.API_SECRET_KEY;
  
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  if (!expectedKey || apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

// =============================================================================
// HEALTH CHECK
// =============================================================================

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), mode: 'memory' });
});

// =============================================================================
// PLAYER ENDPOINTS
// =============================================================================

router.get('/players', async (_req, res) => {
  try {
    const allPlayers = await memoryDb.getAllPlayers();
    res.json({ players: allPlayers });
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({ error: 'Failed to get players' });
  }
});

router.get('/players/:wallet', async (req, res) => {
  try {
    const player = await memoryDb.getPlayerByWallet(req.params.wallet);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }
    // Transform to camelCase for frontend
    res.json({ 
      player: {
        walletAddress: player.wallet_address,
        username: player.username,
        totalXp: Number(player.total_xp),
        level: player.level,
        gamesPlayed: player.games_played,
        coins: player.coins,
        predictionsMade: player.predictions_made,
        predictionsWon: player.predictions_won,
        rank: 0
      }
    });
  } catch (error) {
    console.error('Error getting player:', error);
    res.status(500).json({ error: 'Failed to get player' });
  }
});

router.post('/players', requireApiKey, async (req, res) => {
  try {
    const input = RegisterPlayerSchema.parse(req.body);
    const player = await memoryDb.createPlayer(input);
    res.status(201).json({ player });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating player:', error);
    res.status(500).json({ error: 'Failed to create player' });
  }
});

// =============================================================================
// LEADERBOARD ENDPOINTS
// =============================================================================

router.get('/leaderboard', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const leaderboard = await memoryDb.getLeaderboard(limit);
    
    const entries = leaderboard.map(p => ({
      walletAddress: p.wallet_address,
      username: p.username,
      totalXp: Number(p.total_xp),
      level: p.level,
      rank: Number(p.rank)
    }));
    
    res.json({ leaderboard: entries });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

router.get('/leaderboard/rank/:wallet', async (req, res) => {
  try {
    const rank = await memoryDb.getPlayerRank(req.params.wallet);
    res.json({ rank });
  } catch (error) {
    console.error('Error getting rank:', error);
    res.status(500).json({ error: 'Failed to get rank' });
  }
});

// =============================================================================
// SCORE ENDPOINTS
// =============================================================================

router.post('/scores', requireApiKey, async (req, res) => {
  try {
    const input = SubmitScoreSchema.parse(req.body);
    
    const score = await memoryDb.createScore({
      player_wallet: input.wallet_address,
      game_type: input.game_type,
      score: input.score,
      xp_earned: input.xp_earned,
      bonus_data: input.bonus_data,
      chain_id: input.chain_id,
    });
    await memoryDb.updatePlayerXP(input.wallet_address, input.xp_earned);
    
    // Log the game activity
    const player = await memoryDb.getPlayerByWallet(input.wallet_address);
    if (player) {
      await memoryDb.logActivity(
        input.wallet_address,
        player.username,
        'GAME_COMPLETED',
        {
          game_type: input.game_type,
          score: input.score,
          xp_earned: input.xp_earned,
        }
      );
    }
    
    res.status(201).json({ score });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error submitting score:', error);
    res.status(500).json({ error: 'Failed to submit score' });
  }
});

router.get('/scores/recent', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const recentScores = await memoryDb.getRecentScores(limit);
    
    const transformed = recentScores.map(s => ({
      id: s.id,
      gameType: s.game_type,
      player: s.player_wallet,
      playerName: s.username,
      score: Number(s.score),
      xpEarned: Number(s.xp_earned),
      bonusData: s.bonus_data ? Number(s.bonus_data) : null,
      timestamp: new Date(s.submitted_at).getTime() * 1000
    }));
    
    res.json({ scores: transformed });
  } catch (error) {
    console.error('Error getting recent scores:', error);
    res.status(500).json({ error: 'Failed to get recent scores' });
  }
});

router.get('/scores/game/:gameType', async (req, res) => {
  try {
    const gameType = req.params.gameType;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const gameScores = await memoryDb.getGameScores(gameType, limit);
    
    const transformed = gameScores.map(s => ({
      id: s.id,
      gameType: s.game_type,
      player: s.player_wallet,
      playerName: s.username,
      score: Number(s.score),
      xpEarned: Number(s.xp_earned),
      bonusData: s.bonus_data ? Number(s.bonus_data) : null,
      timestamp: new Date(s.submitted_at).getTime() * 1000
    }));
    
    res.json({ scores: transformed });
  } catch (error) {
    console.error('Error getting game scores:', error);
    res.status(500).json({ error: 'Failed to get game scores' });
  }
});

router.get('/scores/highscores/:gameType', async (req, res) => {
  try {
    const gameType = req.params.gameType;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);
    const highScores = await memoryDb.getGameHighScores(gameType, limit);
    
    const transformed = highScores.map(s => ({
      player: s.player_wallet,
      playerName: s.username,
      score: Number(s.score),
      xpEarned: Number(s.xp_earned),
      rank: s.rank,
      timestamp: new Date(s.submitted_at).getTime() * 1000
    }));
    
    res.json({ highScores: transformed });
  } catch (error) {
    console.error('Error getting high scores:', error);
    res.status(500).json({ error: 'Failed to get high scores' });
  }
});

// =============================================================================
// STATS ENDPOINT
// =============================================================================

router.get('/stats', async (_req, res) => {
  try {
    const stats = await memoryDb.getGlobalStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// =============================================================================
// ACTIVITY FEED ENDPOINTS
// =============================================================================

// Helper to transform activity log to frontend format
function transformActivity(activity: any) {
  // Map backend action to frontend activityType
  const actionToType: Record<string, string> = {
    'PREDICTION_PLACED': 'PREDICTION',
    'PREDICTION_WON': 'WIN',
    'PREDICTION_LOST': 'PREDICTION',
    'GAME_COMPLETED': 'GAME',
    'DAILY_BONUS': 'CLAIM_BONUS',
    'REGISTERED': 'GAME',
  };
  
  // Generate description from details
  let description = '';
  let coinsChange = 0;
  
  if (activity.action === 'PREDICTION_PLACED') {
    description = `Placed ${activity.details.amount} coins on ${activity.details.direction || activity.details.prediction} for ${activity.details.asset || activity.details.eventTitle || 'prediction'}`;
    coinsChange = -activity.details.amount;
  } else if (activity.action === 'PREDICTION_WON') {
    description = `Won prediction on ${activity.details.asset || activity.details.eventTitle}! ${activity.details.direction || activity.details.prediction} was correct`;
    coinsChange = activity.details.payout || 0;
  } else if (activity.action === 'PREDICTION_LOST') {
    description = `Lost prediction on ${activity.details.asset || activity.details.eventTitle}. ${activity.details.direction || activity.details.prediction} was wrong`;
    coinsChange = 0;
  } else if (activity.action === 'GAME_COMPLETED') {
    const gameTypeName = activity.details.game_type?.replace(/_/g, ' ') || activity.details.gameType?.replace(/_/g, ' ') || 'game';
    description = `Played ${gameTypeName} and scored ${activity.details.score || 0} (+${activity.details.xp_earned || activity.details.xpEarned || 0} XP)`;
    coinsChange = 0; // Games give XP, not coins
  } else if (activity.action === 'DAILY_BONUS') {
    description = 'Claimed daily bonus!';
    coinsChange = activity.details.coins || 100;
  } else if (activity.action === 'REGISTERED') {
    description = 'Joined Linera Arcade!';
    coinsChange = activity.details.welcomeBonus || 100;
  }
  
  return {
    id: activity.id,
    walletAddress: activity.wallet_address,
    username: activity.username,
    activityType: actionToType[activity.action] || 'GAME',
    description,
    coinsChange,
    referenceId: activity.details.roundId || activity.details.eventId || null,
    createdAt: activity.created_at.toISOString(),
  };
}

// Primary route (frontend uses this)
router.get('/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rawActivities = await memoryDb.getActivityFeed(limit);
    const activities = rawActivities.map(transformActivity);
    res.json({ activities });
  } catch (error) {
    console.error('Error getting activity feed:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

// Alias for backward compatibility
router.get('/activity/feed', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rawActivities = await memoryDb.getActivityFeed(limit);
    const activities = rawActivities.map(transformActivity);
    res.json({ activities });
  } catch (error) {
    console.error('Error getting activity feed:', error);
    res.status(500).json({ error: 'Failed to get activity feed' });
  }
});

router.get('/activity/user/:wallet', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rawActivities = await memoryDb.getUserActivity(req.params.wallet, limit);
    const activities = rawActivities.map(transformActivity);
    res.json({ activities });
  } catch (error) {
    console.error('Error getting user activity:', error);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

// =============================================================================
// CRYPTO PREDICTION ENDPOINTS
// =============================================================================

// Create crypto round (admin)
router.post('/predictions/crypto/rounds', requireApiKey, async (req, res) => {
  try {
    const input = CreateCryptoRoundSchema.parse(req.body);
    const round = await memoryDb.createCryptoRound(input);
    res.status(201).json({ round });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating crypto round:', error);
    res.status(500).json({ error: 'Failed to create crypto round' });
  }
});

// Get all crypto rounds
router.get('/predictions/crypto/rounds', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const status = req.query.status as string;
    
    let rawRounds;
    if (status === 'active') {
      rawRounds = await memoryDb.getActiveCryptoRounds();
    } else {
      rawRounds = await memoryDb.getAllCryptoRounds(limit);
    }
    
    // Transform to frontend format with proper end_time and result fields
    const rounds = rawRounds.map(r => ({
      id: r.id,
      asset: r.asset,
      start_price: r.start_price,
      end_price: r.end_price,
      start_time: r.start_time.toISOString(),
      end_time: new Date(r.start_time.getTime() + r.duration_secs * 1000).toISOString(),
      status: r.status,
      result: r.winning_direction, // 'UP' | 'DOWN' | null
      total_up: r.total_up,
      total_down: r.total_down,
      created_at: r.created_at.toISOString(),
    }));
    
    res.json({ rounds });
  } catch (error) {
    console.error('Error getting crypto rounds:', error);
    res.status(500).json({ error: 'Failed to get crypto rounds' });
  }
});

// Get specific crypto round
router.get('/predictions/crypto/rounds/:id', async (req, res) => {
  try {
    const round = await memoryDb.getCryptoRound(parseInt(req.params.id));
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    res.json({ round });
  } catch (error) {
    console.error('Error getting crypto round:', error);
    res.status(500).json({ error: 'Failed to get crypto round' });
  }
});

// Place crypto prediction
router.post('/predictions/crypto/place', requireApiKey, async (req, res) => {
  try {
    const input = PlaceCryptoPredictionSchema.parse(req.body);
    const rawPrediction = await memoryDb.placeCryptoPrediction(input);
    
    if (!rawPrediction) {
      return res.status(400).json({ error: 'Failed to place prediction. Check balance and round status.' });
    }
    
    // Transform to frontend format
    const prediction = {
      id: rawPrediction.id,
      wallet_address: rawPrediction.wallet_address,
      prediction_type: 'CRYPTO',
      reference_id: rawPrediction.reference_id,
      direction_or_outcome: rawPrediction.direction_or_outcome === 1 ? 'UP' : 'DOWN',
      coins_staked: rawPrediction.amount,
      coins_won: null,
      status: rawPrediction.status,
      created_at: rawPrediction.created_at.toISOString(),
    };
    
    res.status(201).json({ prediction });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error placing crypto prediction:', error);
    res.status(500).json({ error: 'Failed to place prediction' });
  }
});

// Resolve crypto round (admin)
router.post('/predictions/crypto/rounds/:id/resolve', requireApiKey, async (req, res) => {
  try {
    const input = ResolveCryptoRoundSchema.parse(req.body);
    const round = await memoryDb.resolveCryptoRound(parseInt(req.params.id), input.end_price);
    
    if (!round) {
      return res.status(400).json({ error: 'Failed to resolve round. Round may not exist or already resolved.' });
    }
    
    res.json({ round });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error resolving crypto round:', error);
    res.status(500).json({ error: 'Failed to resolve round' });
  }
});

// Get predictions for round
router.get('/predictions/crypto/rounds/:id/predictions', async (req, res) => {
  try {
    const predictions = await memoryDb.getPredictionsForRound(parseInt(req.params.id));
    res.json({ predictions });
  } catch (error) {
    console.error('Error getting round predictions:', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// =============================================================================
// WORLD EVENT PREDICTION ENDPOINTS
// =============================================================================

// Create world event (admin)
router.post('/predictions/events', requireApiKey, async (req, res) => {
  try {
    const input = CreateWorldEventSchema.parse(req.body);
    const event = await memoryDb.createWorldEvent(input);
    res.status(201).json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error creating world event:', error);
    res.status(500).json({ error: 'Failed to create world event' });
  }
});

// Get all world events
router.get('/predictions/events', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const status = req.query.status as string;
    const category = req.query.category as string;
    
    let events;
    if (status === 'active') {
      events = await memoryDb.getActiveWorldEvents();
    } else if (category) {
      events = await memoryDb.getWorldEventsByCategory(category);
    } else {
      events = await memoryDb.getAllWorldEvents(limit);
    }
    
    res.json({ events });
  } catch (error) {
    console.error('Error getting world events:', error);
    res.status(500).json({ error: 'Failed to get world events' });
  }
});

// Get specific world event
router.get('/predictions/events/:id', async (req, res) => {
  try {
    const event = await memoryDb.getWorldEvent(parseInt(req.params.id));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event });
  } catch (error) {
    console.error('Error getting world event:', error);
    res.status(500).json({ error: 'Failed to get world event' });
  }
});

// Place event prediction
router.post('/predictions/events/place', requireApiKey, async (req, res) => {
  try {
    const input = PlaceEventPredictionSchema.parse(req.body);
    // Transform outcome string to prediction boolean (YES/true, NO/false)
    const predictionBool = input.outcome.toUpperCase() === 'YES' || input.outcome === '1' || input.outcome.toLowerCase() === 'true';
    const prediction = await memoryDb.placeEventPrediction({
      wallet_address: input.wallet_address,
      event_id: input.event_id,
      prediction: predictionBool,
      amount: input.amount,
    });
    
    if (!prediction) {
      return res.status(400).json({ error: 'Failed to place prediction. Check balance and event status.' });
    }
    
    // Transform to frontend format
    const response = {
      id: prediction.id,
      wallet_address: prediction.wallet_address,
      prediction_type: 'WORLD_EVENT',
      reference_id: prediction.reference_id,
      direction_or_outcome: prediction.direction_or_outcome === 1 ? 'YES' : 'NO',
      coins_staked: prediction.amount,
      coins_won: null,
      status: prediction.status,
      created_at: prediction.created_at.toISOString(),
    };
    
    res.status(201).json({ prediction: response });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error placing event prediction:', error);
    res.status(500).json({ error: 'Failed to place prediction' });
  }
});

// Resolve world event (admin)
router.post('/predictions/events/:id/resolve', requireApiKey, async (req, res) => {
  try {
    const input = ResolveWorldEventSchema.parse(req.body);
    const event = await memoryDb.resolveWorldEvent(parseInt(req.params.id), input.outcome);
    
    if (!event) {
      return res.status(400).json({ error: 'Failed to resolve event. Event may not exist or already resolved.' });
    }
    
    res.json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    console.error('Error resolving world event:', error);
    res.status(500).json({ error: 'Failed to resolve event' });
  }
});

// Get predictions for event
router.get('/predictions/events/:id/predictions', async (req, res) => {
  try {
    const predictions = await memoryDb.getPredictionsForEvent(parseInt(req.params.id));
    res.json({ predictions });
  } catch (error) {
    console.error('Error getting event predictions:', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// =============================================================================
// USER PREDICTION ENDPOINTS
// =============================================================================

// Get user's predictions
router.get('/predictions/user/:wallet', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const rawPredictions = await memoryDb.getUserPredictions(req.params.wallet, limit);
    
    // Transform to frontend format
    const predictions = rawPredictions.map(p => ({
      id: p.id,
      wallet_address: p.wallet_address,
      prediction_type: p.prediction_type === 'CRYPTO' ? 'CRYPTO' : 'WORLD_EVENT',
      reference_id: p.reference_id,
      direction_or_outcome: p.prediction_type === 'CRYPTO' 
        ? (p.direction_or_outcome === 1 ? 'UP' : 'DOWN')
        : (p.direction_or_outcome === 1 ? 'YES' : 'NO'),
      coins_staked: p.amount,
      coins_won: p.status === 'WON' ? p.payout : (p.status === 'LOST' ? 0 : null),
      status: p.status,
      created_at: p.created_at.toISOString(),
    }));
    
    res.json({ predictions });
  } catch (error) {
    console.error('Error getting user predictions:', error);
    res.status(500).json({ error: 'Failed to get predictions' });
  }
});

// =============================================================================
// COIN / TOKEN ENDPOINTS
// =============================================================================

// Get user's coin balance (returns null if player not registered)
router.get('/coins/balance/:wallet', async (req, res) => {
  try {
    // Check if player exists first - don't auto-create
    const player = await memoryDb.getPlayerByWallet(req.params.wallet);
    
    if (!player) {
      // Player not registered - return null balance to indicate registration needed
      return res.json({ 
        balance: {
          walletAddress: req.params.wallet.toLowerCase(),
          balance: null,
          lastDailyClaim: null,
          canClaimDaily: false,
          isRegistered: false,
        }
      });
    }
    
    const balance = player.coins || 0;
    const canClaimDaily = !player.last_daily_claim || 
      (new Date().getTime() - new Date(player.last_daily_claim).getTime()) / (1000 * 60 * 60) >= 24;
    
    res.json({ 
      balance: {
        walletAddress: req.params.wallet.toLowerCase(),
        balance: balance,
        lastDailyClaim: player.last_daily_claim?.toISOString() || null,
        canClaimDaily,
        isRegistered: true,
      }
    });
  } catch (error) {
    console.error('Error getting coin balance:', error);
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

// Claim daily bonus (requires registered player)
router.post('/coins/daily-bonus', requireApiKey, async (req, res) => {
  try {
    const { wallet_address } = req.body;
    if (!wallet_address) {
      return res.status(400).json({ error: 'wallet_address is required' });
    }
    
    // Check if player exists - do NOT auto-create
    const existingPlayer = await memoryDb.getPlayerByWallet(wallet_address);
    if (!existingPlayer) {
      return res.status(404).json({ error: 'Player not registered. Please register first.' });
    }
    
    const result = await memoryDb.claimDailyBonus(wallet_address);
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({ success: true, coins: result.coins });
  } catch (error) {
    console.error('Error claiming daily bonus:', error);
    res.status(500).json({ error: 'Failed to claim daily bonus' });
  }
});

// =============================================================================
// PRICE FEED ENDPOINTS (BINANCE)
// =============================================================================

// Fallback prices if Binance API fails
const FALLBACK_PRICES = {
  btc: { symbol: 'BTC', price: 9500000, timestamp: new Date() }, // $95,000
  eth: { symbol: 'ETH', price: 330000, timestamp: new Date() },   // $3,300
};

// Get current crypto prices
router.get('/prices', async (_req, res) => {
  try {
    let prices;
    try {
      prices = await binanceService.getAllPrices();
    } catch (binanceError) {
      console.warn('Binance API failed, using fallback prices:', binanceError);
      prices = FALLBACK_PRICES;
    }
    
    res.json({ 
      prices: {
        btc: {
          symbol: 'BTC',
          priceUsd: prices.btc.price / 100, // Convert cents to dollars
          priceCents: prices.btc.price,
          formatted: binanceService.formatPrice(prices.btc.price),
          timestamp: prices.btc.timestamp,
        },
        eth: {
          symbol: 'ETH',
          priceUsd: prices.eth.price / 100,
          priceCents: prices.eth.price,
          formatted: binanceService.formatPrice(prices.eth.price),
          timestamp: prices.eth.timestamp,
        },
      }
    });
  } catch (error) {
    console.error('Error getting prices:', error);
    // Return fallback prices instead of error
    res.json({ 
      prices: {
        btc: {
          symbol: 'BTC',
          priceUsd: 95000,
          priceCents: 9500000,
          formatted: '$95,000.00',
          timestamp: new Date(),
        },
        eth: {
          symbol: 'ETH',
          priceUsd: 3300,
          priceCents: 330000,
          formatted: '$3,300.00',
          timestamp: new Date(),
        },
      }
    });
  }
});

// Get BTC price
router.get('/prices/btc', async (_req, res) => {
  try {
    let price;
    try {
      price = await binanceService.getBTCPrice();
    } catch {
      price = FALLBACK_PRICES.btc;
    }
    res.json({ 
      price: {
        symbol: 'BTC',
        priceUsd: price.price / 100,
        priceCents: price.price,
        formatted: binanceService.formatPrice(price.price),
        timestamp: price.timestamp,
      }
    });
  } catch (error) {
    console.error('Error getting BTC price:', error);
    res.json({ 
      price: {
        symbol: 'BTC',
        priceUsd: 95000,
        priceCents: 9500000,
        formatted: '$95,000.00',
        timestamp: new Date(),
      }
    });
  }
});

// Get ETH price
router.get('/prices/eth', async (_req, res) => {
  try {
    let price;
    try {
      price = await binanceService.getETHPrice();
    } catch {
      price = FALLBACK_PRICES.eth;
    }
    res.json({ 
      price: {
        symbol: 'ETH',
        priceUsd: price.price / 100,
        priceCents: price.price,
        formatted: binanceService.formatPrice(price.price),
        timestamp: price.timestamp,
      }
    });
  } catch (error) {
    console.error('Error getting ETH price:', error);
    res.json({ 
      price: {
        symbol: 'ETH',
        priceUsd: 3300,
        priceCents: 330000,
        formatted: '$3,300.00',
        timestamp: new Date(),
      }
    });
  }
});

// Auto-create a new crypto round with current price
router.post('/predictions/crypto/rounds/auto', requireApiKey, async (req, res) => {
  try {
    const { asset, duration_secs } = req.body;
    
    if (!asset || !['BTC', 'ETH'].includes(asset)) {
      return res.status(400).json({ error: 'asset must be BTC or ETH' });
    }
    
    const duration = duration_secs || 300; // Default 5 minutes
    
    // Get current price from Binance (with fallback)
    let priceData;
    try {
      priceData = await binanceService.getPrice(asset);
    } catch {
      priceData = asset === 'BTC' ? FALLBACK_PRICES.btc : FALLBACK_PRICES.eth;
    }
    
    // Create round with price
    const round = await memoryDb.createCryptoRound({
      asset,
      start_price: priceData.price,
      duration_secs: duration,
    });
    
    res.status(201).json({ 
      round,
      startPrice: {
        cents: priceData.price,
        formatted: binanceService.formatPrice(priceData.price),
      }
    });
  } catch (error) {
    console.error('Error creating auto crypto round:', error);
    res.status(500).json({ error: 'Failed to create crypto round' });
  }
});

// Auto-resolve a crypto round with current price
router.post('/predictions/crypto/rounds/:id/auto-resolve', requireApiKey, async (req, res) => {
  try {
    const roundId = parseInt(req.params.id);
    const round = await memoryDb.getCryptoRound(roundId);
    
    if (!round) {
      return res.status(404).json({ error: 'Round not found' });
    }
    
    if (round.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Round is not active' });
    }
    
    // Get current price from Binance (with fallback)
    let priceData;
    try {
      priceData = await binanceService.getPrice(round.asset);
    } catch {
      // Use a slightly different fallback price to simulate market movement
      const fallback = round.asset === 'BTC' ? FALLBACK_PRICES.btc : FALLBACK_PRICES.eth;
      const variance = Math.random() * 0.01 - 0.005; // -0.5% to +0.5%
      priceData = { ...fallback, price: Math.round(fallback.price * (1 + variance)) };
    }
    
    // Resolve with real price
    const resolvedRound = await memoryDb.resolveCryptoRound(roundId, priceData.price);
    
    res.json({ 
      round: resolvedRound,
      endPrice: {
        cents: priceData.price,
        formatted: binanceService.formatPrice(priceData.price),
      },
      priceChange: {
        cents: priceData.price - round.start_price,
        percentage: ((priceData.price - round.start_price) / round.start_price * 100).toFixed(4),
      }
    });
  } catch (error) {
    console.error('Error auto-resolving crypto round:', error);
    res.status(500).json({ error: 'Failed to resolve crypto round' });
  }
});

export default router;
