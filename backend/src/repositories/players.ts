/**
 * Player repository - database operations for players
 */

import { query } from '../db/index.js';

export interface Player {
  id: number;
  wallet_address: string;
  username: string;
  total_xp: number;
  level: number;
  games_played: number;
  chain_id: string | null;
  registered_at: Date;
  updated_at: Date;
}

export interface CreatePlayerInput {
  wallet_address: string;
  username: string;
  chain_id?: string;
}

export interface UpdatePlayerXPInput {
  wallet_address: string;
  xp_earned: number;
}

/**
 * Create a new player
 */
export async function createPlayer(input: CreatePlayerInput): Promise<Player> {
  const result = await query<Player>(
    `INSERT INTO players (wallet_address, username, chain_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (wallet_address) DO UPDATE SET
       username = EXCLUDED.username,
       updated_at = NOW()
     RETURNING *`,
    [input.wallet_address.toLowerCase(), input.username, input.chain_id || null]
  );
  
  // Update stats
  await query(
    `UPDATE stats SET value = value + 1, updated_at = NOW() WHERE key = 'total_players'`
  );
  
  return result.rows[0];
}

/**
 * Get player by wallet address
 */
export async function getPlayerByWallet(wallet: string): Promise<Player | null> {
  const result = await query<Player>(
    'SELECT * FROM players WHERE wallet_address = $1',
    [wallet.toLowerCase()]
  );
  return result.rows[0] || null;
}

/**
 * Get all players
 */
export async function getAllPlayers(): Promise<Player[]> {
  const result = await query<Player>(
    'SELECT * FROM players ORDER BY total_xp DESC'
  );
  return result.rows;
}

/**
 * Update player XP after a game
 */
export async function updatePlayerXP(input: UpdatePlayerXPInput): Promise<Player | null> {
  const wallet = input.wallet_address.toLowerCase();
  
  // Calculate new level based on XP
  const result = await query<Player>(
    `UPDATE players SET
       total_xp = total_xp + $2,
       games_played = games_played + 1,
       level = GREATEST(1, FLOOR(POWER((total_xp + $2) / 100.0, 0.5))::integer + 1),
       updated_at = NOW()
     WHERE wallet_address = $1
     RETURNING *`,
    [wallet, input.xp_earned]
  );
  
  return result.rows[0] || null;
}

/**
 * Get leaderboard (top players by XP)
 */
export async function getLeaderboard(limit: number = 100): Promise<(Player & { rank: number })[]> {
  const result = await query<Player & { rank: number }>(
    `SELECT *, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
     FROM players
     ORDER BY total_xp DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

/**
 * Get player rank
 */
export async function getPlayerRank(wallet: string): Promise<number | null> {
  const result = await query<{ rank: number }>(
    `SELECT rank FROM (
       SELECT wallet_address, ROW_NUMBER() OVER (ORDER BY total_xp DESC) as rank
       FROM players
     ) ranked
     WHERE wallet_address = $1`,
    [wallet.toLowerCase()]
  );
  return result.rows[0]?.rank ?? null;
}

/**
 * Get total player count
 */
export async function getTotalPlayers(): Promise<number> {
  const result = await query<{ count: string }>('SELECT COUNT(*) as count FROM players');
  return parseInt(result.rows[0].count, 10);
}
