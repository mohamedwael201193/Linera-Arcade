/**
 * Database selector - chooses PostgreSQL or in-memory based on environment
 */

import dotenv from 'dotenv';
dotenv.config();

// Use PostgreSQL if DATABASE_URL is set, otherwise use memory
const usePostgres = !!process.env.DATABASE_URL;

// Dynamic import to avoid circular dependencies
let db: any;

export async function getDb() {
  if (db) return db;
  
  if (usePostgres) {
    const { postgresDb } = await import('./postgres.js');
    db = postgresDb;
    console.log('📦 Using PostgreSQL database');
  } else {
    const { memoryDb } = await import('./memory.js');
    db = memoryDb;
    console.log('💾 Using in-memory database');
  }
  
  return db;
}

export function isUsingPostgres() {
  return usePostgres;
}

// =============================================================================
// TOURNAMENT LEADERBOARD INTERFACE
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

/**
 * Unified leaderboard database interface.
 * Works with both memory.ts and postgres.ts.
 */
export const leaderboardDb = {
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
    const database = await getDb();
    return database.submitTournamentEntry(input);
  },

  async getTournamentLeaderboard(tournamentId: number, limit?: number): Promise<(TournamentLeaderboardEntry & { rank: number })[]> {
    const database = await getDb();
    return database.getTournamentLeaderboard(tournamentId, limit);
  },

  async getPlayerTournamentEntry(
    tournamentId: number,
    playerAddress: string
  ): Promise<(TournamentLeaderboardEntry & { rank: number }) | null> {
    const database = await getDb();
    return database.getPlayerTournamentEntry(tournamentId, playerAddress);
  },
};
