/**
 * Database migrations for Linera Arcade Backend
 * 
 * Run with: npm run db:migrate
 */

import { pool, query } from './index.js';

const migrations = [
  {
    name: '001_create_players',
    sql: `
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(66) UNIQUE NOT NULL,
        username VARCHAR(50) NOT NULL,
        total_xp BIGINT DEFAULT 0,
        level INTEGER DEFAULT 1,
        games_played BIGINT DEFAULT 0,
        chain_id VARCHAR(66),
        registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_players_xp ON players(total_xp DESC);
      CREATE INDEX IF NOT EXISTS idx_players_level ON players(level DESC);
    `
  },
  {
    name: '002_create_scores',
    sql: `
      CREATE TABLE IF NOT EXISTS scores (
        id SERIAL PRIMARY KEY,
        player_wallet VARCHAR(66) NOT NULL REFERENCES players(wallet_address) ON DELETE CASCADE,
        game_type VARCHAR(50) NOT NULL,
        score BIGINT NOT NULL,
        xp_earned BIGINT NOT NULL,
        bonus_data BIGINT,
        chain_id VARCHAR(66),
        submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_wallet);
      CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_type);
      CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC);
      CREATE INDEX IF NOT EXISTS idx_scores_submitted ON scores(submitted_at DESC);
    `
  },
  {
    name: '003_create_migrations_table',
    sql: `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `
  },
  {
    name: '004_create_stats',
    sql: `
      CREATE TABLE IF NOT EXISTS stats (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value BIGINT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      INSERT INTO stats (key, value) VALUES ('total_players', 0) ON CONFLICT (key) DO NOTHING;
      INSERT INTO stats (key, value) VALUES ('total_games_played', 0) ON CONFLICT (key) DO NOTHING;
      INSERT INTO stats (key, value) VALUES ('total_xp_earned', 0) ON CONFLICT (key) DO NOTHING;
    `
  }
];

async function runMigrations() {
  console.log('🚀 Running database migrations...');
  
  try {
    // First ensure migrations table exists
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
    // Get already executed migrations
    const result = await query<{ name: string }>('SELECT name FROM migrations');
    const executedMigrations = new Set(result.rows.map(r => r.name));
    
    // Run pending migrations
    for (const migration of migrations) {
      if (executedMigrations.has(migration.name)) {
        console.log(`⏭️  Skipping ${migration.name} (already executed)`);
        continue;
      }
      
      console.log(`📝 Running ${migration.name}...`);
      await query(migration.sql);
      await query('INSERT INTO migrations (name) VALUES ($1)', [migration.name]);
      console.log(`✅ ${migration.name} completed`);
    }
    
    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
runMigrations();
