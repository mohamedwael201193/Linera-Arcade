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
