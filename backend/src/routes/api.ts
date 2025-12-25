/**
 * API Routes for Linera Arcade Backend
 * Uses in-memory database for development, PostgreSQL for production
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { memoryDb } from '../db/memory.js';

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

export default router;
