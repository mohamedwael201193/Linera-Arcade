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
        coins BIGINT DEFAULT 100,
        predictions_made BIGINT DEFAULT 0,
        predictions_won BIGINT DEFAULT 0,
        last_daily_claim TIMESTAMP WITH TIME ZONE,
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
      INSERT INTO stats (key, value) VALUES ('total_predictions', 0) ON CONFLICT (key) DO NOTHING;
      INSERT INTO stats (key, value) VALUES ('total_coins_wagered', 0) ON CONFLICT (key) DO NOTHING;
    `
  },
  {
    name: '005_create_crypto_rounds',
    sql: `
      CREATE TABLE IF NOT EXISTS crypto_rounds (
        id SERIAL PRIMARY KEY,
        asset VARCHAR(10) NOT NULL,
        start_price BIGINT NOT NULL,
        end_price BIGINT,
        start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        duration_secs INTEGER DEFAULT 300,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        total_up BIGINT DEFAULT 0,
        total_down BIGINT DEFAULT 0,
        winning_direction VARCHAR(10),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_crypto_rounds_status ON crypto_rounds(status);
      CREATE INDEX IF NOT EXISTS idx_crypto_rounds_asset ON crypto_rounds(asset);
    `
  },
  {
    name: '006_create_predictions',
    sql: `
      CREATE TABLE IF NOT EXISTS predictions (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(66) NOT NULL,
        prediction_type VARCHAR(20) NOT NULL,
        reference_id INTEGER NOT NULL,
        direction_or_outcome INTEGER NOT NULL,
        amount BIGINT NOT NULL,
        odds_at_bet INTEGER DEFAULT 19000,
        status VARCHAR(20) DEFAULT 'PENDING',
        payout BIGINT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_predictions_wallet ON predictions(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_predictions_reference ON predictions(reference_id);
      CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
    `
  },
  {
    name: '007_create_activity_logs',
    sql: `
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        wallet_address VARCHAR(66) NOT NULL,
        username VARCHAR(50),
        action VARCHAR(50) NOT NULL,
        details JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_activity_wallet ON activity_logs(wallet_address);
      CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
    `
  },
  {
    name: '008_create_world_events',
    sql: `
      CREATE TABLE IF NOT EXISTS world_events (
        id SERIAL PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        end_time TIMESTAMP WITH TIME ZONE NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE',
        outcome BOOLEAN,
        total_yes BIGINT DEFAULT 0,
        total_no BIGINT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_events_status ON world_events(status);
      CREATE INDEX IF NOT EXISTS idx_events_category ON world_events(category);
    `
  },
  {
    name: '009_add_onchain_round_id',
    sql: `
      -- Add onchain_round_id column to crypto_rounds table for blockchain synchronization
      ALTER TABLE crypto_rounds 
      ADD COLUMN IF NOT EXISTS onchain_round_id INTEGER;
      
      -- Index for efficient lookups by onchain_round_id
      CREATE INDEX IF NOT EXISTS idx_crypto_rounds_onchain ON crypto_rounds(onchain_round_id);
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
