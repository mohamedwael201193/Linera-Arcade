/**
 * Linera Arcade Backend - Main Entry Point
 * 
 * Express server that provides REST API for the global leaderboard.
 * Uses PostgreSQL for production, falls back to in-memory for development.
 * 
 * NOTE: Multiplayer is now fully on-chain via Linera microchains.
 * Socket.IO has been removed - multiplayer state is queried via GraphQL.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import apiRoutes from './routes/api.js';
import { memoryDb } from './db/memory.js';
import { postgresDb } from './db/postgres.js';
import { binanceService } from './services/binance.js';
import { startChainIndexer, getIndexerStatus } from './services/chainIndexer.js';
// NOTE: On-chain resolution is handled by the separate Rust executor
// See: /home/devmo/linera/executor/ for the Linera blockchain integration

// Load environment variables
dotenv.config();

// Use PostgreSQL if DATABASE_URL is set, otherwise use memory
const usePostgres = !!process.env.DATABASE_URL;
export const db = usePostgres ? postgresDb : memoryDb;

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3001', 10);

// =============================================================================
// MIDDLEWARE
// =============================================================================

// Parse JSON bodies
app.use(express.json());

// CORS configuration
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map(o => o.trim()) || [
  'http://localhost:3005',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is allowed
    if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
      return callback(null, true);
    }
    
    // In production, be more strict
    if (process.env.NODE_ENV === 'production') {
      return callback(new Error('Not allowed by CORS'), false);
    }
    
    // In development, allow all
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key']
}));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// =============================================================================
// ROUTES
// =============================================================================

// API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'Linera Arcade Backend',
    version: '1.0.0',
    description: 'Global leaderboard indexer for Linera Arcade Hub',
    endpoints: {
      health: '/api/health',
      players: '/api/players',
      leaderboard: '/api/leaderboard',
      scores: '/api/scores/recent',
      stats: '/api/stats'
    }
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// =============================================================================
// START SERVER
// =============================================================================

// Start server and seed test data
httpServer.listen(PORT, async () => {
  // Run migrations if using PostgreSQL
  if (usePostgres) {
    try {
      console.log('🔄 Running database migrations...');
      const { pool, query } = await import('./db/index.js');
      
      // Run migrations inline (simplified)
      const migrations = [
        `CREATE TABLE IF NOT EXISTS players (
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
        )`,
        `CREATE TABLE IF NOT EXISTS scores (
          id SERIAL PRIMARY KEY,
          player_wallet VARCHAR(66) NOT NULL,
          game_type VARCHAR(50) NOT NULL,
          score BIGINT NOT NULL,
          xp_earned BIGINT NOT NULL,
          bonus_data BIGINT,
          chain_id VARCHAR(66),
          submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS crypto_rounds (
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
        )`,
        `CREATE TABLE IF NOT EXISTS predictions (
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
        )`,
        `CREATE TABLE IF NOT EXISTS activity_logs (
          id SERIAL PRIMARY KEY,
          wallet_address VARCHAR(66) NOT NULL,
          username VARCHAR(50),
          action VARCHAR(50) NOT NULL,
          details JSONB DEFAULT '{}',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )`,
        `CREATE TABLE IF NOT EXISTS world_events (
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
        )`,
        // Migration 009: Add onchain_round_id for executor synchronization
        `ALTER TABLE crypto_rounds ADD COLUMN IF NOT EXISTS onchain_round_id INTEGER`,
        `CREATE INDEX IF NOT EXISTS idx_crypto_rounds_onchain ON crypto_rounds(onchain_round_id)`,
        // Migration 010: Set onchain_round_id = id for existing rounds (executor sync fix)
        `UPDATE crypto_rounds SET onchain_round_id = id WHERE onchain_round_id IS NULL`,
      ];
      
      for (const sql of migrations) {
        await query(sql);
      }
      console.log('✅ Database migrations completed');
    } catch (err) {
      console.error('❌ Migration error:', err);
    }
  }
  
  // Seed test data
  await db.seed();
  
  // =============================================================================
  // ROUND ROTATION BACKGROUND TASK
  // =============================================================================
  // Creates new rounds when old ones expire (resolution is handled by Rust executor)
  // This ensures there are always active rounds for users to bet on
  
  setInterval(async () => {
    try {
      // First, cancel any expired rounds that have no on-chain link (no bets placed)
      // These rounds can't be resolved by the executor because they don't exist on-chain
      const cancelled = await db.cancelUnlinkedExpiredRounds();
      if (cancelled > 0) {
        console.log(`🚫 Cancelled ${cancelled} unlinked expired round(s)`);
      }
      
      const activeRounds = await db.getActiveCryptoRounds();
      const hasActiveBTC = activeRounds.some((r: any) => r.asset === 'BTC');
      const hasActiveETH = activeRounds.some((r: any) => r.asset === 'ETH');
      
      // Create new rounds if needed
      if (!hasActiveBTC || !hasActiveETH) {
        const { binanceService } = await import('./services/binance.js');
        
        if (!hasActiveBTC) {
          try {
            const btcPrice = await binanceService.getBTCPrice();
            const price = btcPrice.price > 0 ? btcPrice.price : 9500000;
            if (price > 0) {
              const round = await db.createCryptoRound({ asset: 'BTC', start_price: price, duration_secs: 300 });
              console.log(`🔄 Created new BTC round ${round.id} at $${price/100}`);
            } else {
              console.error('⚠️ Skipping BTC round creation - invalid price');
            }
          } catch (err) {
            console.error('⚠️ Failed to create BTC round:', err);
          }
        }
        
        if (!hasActiveETH) {
          try {
            const ethPrice = await binanceService.getETHPrice();
            const price = ethPrice.price > 0 ? ethPrice.price : 350000;
            if (price > 0) {
              const round = await db.createCryptoRound({ asset: 'ETH', start_price: price, duration_secs: 300 });
              console.log(`🔄 Created new ETH round ${round.id} at $${price/100}`);
            } else {
              console.error('⚠️ Skipping ETH round creation - invalid price');
            }
          } catch (err) {
            console.error('⚠️ Failed to create ETH round:', err);
          }
        }
      }
    } catch (err) {
      console.error('Error in round rotation:', err);
    }
  }, 10000); // Check every 10 seconds
  
  console.log('ℹ️ Round rotation ENABLED - creates new rounds when old ones expire');
  console.log('ℹ️ Resolution is handled by Rust executor on-chain');
  
  // =============================================================================
  // START CHAIN INDEXER SERVICE
  // =============================================================================
  // The Chain Indexer MIRRORS on-chain state to the backend DB
  // It does NOT resolve rounds - only syncs chain → DB
  // Resolution is handled by the Rust executor on-chain
  
  startChainIndexer();
  
  /*
  // Check every 10 seconds for expired rounds and resolve them
  // 
  // ARCHITECTURE: Backend is the ORACLE
  // 1. Backend detects expired round
  // 2. Backend fetches real price from Coinbase
  // 3. Backend resolves in DB (for indexing)
  // 4. Backend calls ON-CHAIN resolution (for payouts)
  // 5. Smart contract determines winners and credits coins
  //
  // This ensures rounds resolve even if NO USER visits the website!
  
  // Fallback prices if Binance API fails
  const FALLBACK_PRICES = {
    BTC: 9500000,  // $95,000
    ETH: 330000,   // $3,300
  };
  
  setInterval(async () => {
    try {
      // Get expired rounds that need resolution (not the active ones)
      const expiredRounds = await db.getExpiredUnresolvedRounds();
      
      for (const round of expiredRounds) {
        console.log(`⏰ Auto-resolving expired round ${round.id} (${round.asset})...`);
        try {
          let endPrice: number;
          try {
            const priceData = await binanceService.getPrice(round.asset as 'BTC' | 'ETH');
            endPrice = priceData.price;
          } catch {
            // Use fallback with slight variance to simulate market movement
            const fallback = FALLBACK_PRICES[round.asset as 'BTC' | 'ETH'];
            const variance = Math.random() * 0.01 - 0.005; // -0.5% to +0.5%
            endPrice = Math.round(fallback * (1 + variance));
            console.warn(`⚠️ Using fallback price for ${round.asset}: $${endPrice/100}`);
          }
          
          // STEP 1: Resolve in database (for backend indexing)
          const resolved = await db.resolveCryptoRound(round.id, endPrice);
          if (resolved) {
            console.log(`✅ DB Round ${round.id} resolved: ${round.asset} ${resolved.winning_direction} (${round.start_price/100} → ${endPrice/100})`);
            
            // NOTE: On-chain resolution (STEP 2) is handled by the Rust executor
            // The Rust executor:
            // 1. Monitors for expired rounds
            // 2. Uses linera-client to call ResolveCryptoRound
            // 3. Smart contract computes winners and pays coins
            // See: /home/devmo/linera/executor/
            
            // Create a new round for the same asset
            let newStartPrice: number;
            try {
              const priceData = await binanceService.getPrice(round.asset as 'BTC' | 'ETH');
              newStartPrice = priceData.price;
            } catch {
              newStartPrice = endPrice; // Use last end price
            }
            
            const newRound = await db.createCryptoRound({
              asset: round.asset as 'BTC' | 'ETH',
              start_price: newStartPrice,
              duration_secs: 300, // 5 minutes
            });
            console.log(`🆕 Created new round ${newRound.id} for ${newRound.asset} at $${newStartPrice/100}`);
          }
        } catch (priceErr) {
          console.error(`Failed to resolve round ${round.id}:`, priceErr);
        }
      }
    } catch (err) {
      console.error('Error in auto-resolution task:', err);
    }
  }, 10000); // Check every 10 seconds
  */  // END OF DISABLED AUTO-RESOLUTION BLOCK
  
  const dbMode = usePostgres ? 'PostgreSQL (production)' : 'In-Memory (development)';
  
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎮 LINERA ARCADE BACKEND                                    ║
║                                                               ║
║   Server running on http://localhost:${PORT}                    ║
║   Database: ${dbMode.padEnd(35)}║
║                                                               ║
║   Endpoints:                                                  ║
║   • GET  /api/health          - Health check                  ║
║   • GET  /api/leaderboard     - Global leaderboard            ║
║   • GET  /api/players         - All players                   ║
║   • POST /api/players         - Register player               ║
║   • POST /api/scores          - Submit score                  ║
║   • GET  /api/stats           - Global stats                  ║
║   • GET  /api/prices          - Live BTC/ETH prices           ║
║   • GET  /api/predictions/*   - Prediction markets            ║
║   • GET  /api/activity        - Activity feed                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
