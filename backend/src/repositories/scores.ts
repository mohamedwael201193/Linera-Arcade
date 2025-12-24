/**
 * Scores repository - database operations for game scores
 */

import { query } from '../db/index.js';

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

export interface CreateScoreInput {
  player_wallet: string;
  game_type: string;
  score: number;
  xp_earned: number;
  bonus_data?: number;
  chain_id?: string;
}

export interface GameHighScore {
  player_wallet: string;
  username: string;
  score: number;
  xp_earned: number;
  rank: number;
  submitted_at: Date;
}

/**
 * Create a new score entry
 */
export async function createScore(input: CreateScoreInput): Promise<Score> {
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
  
  // Update stats
  await query(
    `UPDATE stats SET value = value + 1, updated_at = NOW() WHERE key = 'total_games_played'`
  );
  await query(
    `UPDATE stats SET value = value + $1, updated_at = NOW() WHERE key = 'total_xp_earned'`,
    [input.xp_earned]
  );
  
  return result.rows[0];
}

/**
 * Get recent scores across all games
 */
export async function getRecentScores(limit: number = 50): Promise<(Score & { username: string })[]> {
  const result = await query<Score & { username: string }>(
    `SELECT s.*, p.username
     FROM scores s
     JOIN players p ON s.player_wallet = p.wallet_address
     ORDER BY s.submitted_at DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get scores for a specific game type
 */
export async function getGameScores(gameType: string, limit: number = 50): Promise<(Score & { username: string })[]> {
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
}

/**
 * Get high scores for a specific game type (best score per player)
 */
export async function getGameHighScores(gameType: string, limit: number = 10): Promise<GameHighScore[]> {
  const result = await query<GameHighScore>(
    `SELECT DISTINCT ON (s.player_wallet)
       s.player_wallet,
       p.username,
       s.score,
       s.xp_earned,
       s.submitted_at,
       ROW_NUMBER() OVER (ORDER BY s.score DESC) as rank
     FROM scores s
     JOIN players p ON s.player_wallet = p.wallet_address
     WHERE s.game_type = $1
     ORDER BY s.player_wallet, s.score DESC`,
    [gameType]
  );
  
  // Re-rank after distinct
  const ranked = result.rows
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((row, index) => ({ ...row, rank: index + 1 }));
  
  return ranked;
}

/**
 * Get player's scores for a specific game
 */
export async function getPlayerGameScores(wallet: string, gameType: string): Promise<Score[]> {
  const result = await query<Score>(
    `SELECT * FROM scores
     WHERE player_wallet = $1 AND game_type = $2
     ORDER BY score DESC`,
    [wallet.toLowerCase(), gameType]
  );
  return result.rows;
}

/**
 * Get global stats
 */
export async function getGlobalStats(): Promise<{
  totalPlayers: number;
  totalGamesPlayed: number;
  totalXpEarned: number;
  topXp: number;
  highestLevel: number;
}> {
  const statsResult = await query<{ key: string; value: string }>(
    'SELECT key, value FROM stats'
  );
  const stats = Object.fromEntries(statsResult.rows.map(r => [r.key, parseInt(r.value, 10)]));
  
  const topResult = await query<{ total_xp: string; level: number }>(
    'SELECT total_xp, level FROM players ORDER BY total_xp DESC LIMIT 1'
  );
  
  return {
    totalPlayers: stats['total_players'] || 0,
    totalGamesPlayed: stats['total_games_played'] || 0,
    totalXpEarned: stats['total_xp_earned'] || 0,
    topXp: topResult.rows[0] ? parseInt(topResult.rows[0].total_xp, 10) : 0,
    highestLevel: topResult.rows[0]?.level || 1
  };
}
