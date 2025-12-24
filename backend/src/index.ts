/**
 * Linera Arcade Backend - Main Entry Point
 * 
 * Express server that provides REST API for the global leaderboard.
 * Uses in-memory database for development, PostgreSQL for production.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRoutes from './routes/api.js';

// Load environment variables
dotenv.config();

const app = express();
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

// Start server (no mock data - only real registrations)
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎮 LINERA ARCADE BACKEND                                    ║
║                                                               ║
║   Server running on http://localhost:${PORT}                    ║
║   Mode: In-Memory (development)                               ║
║                                                               ║
║   ⚠️  Data resets on server restart                           ║
║   Deploy to Render with PostgreSQL for persistence            ║
║                                                               ║
║   Endpoints:                                                  ║
║   • GET  /api/health          - Health check                  ║
║   • GET  /api/leaderboard     - Global leaderboard            ║
║   • GET  /api/players         - All players                   ║
║   • POST /api/players         - Register player               ║
║   • POST /api/scores          - Submit score                  ║
║   • GET  /api/stats           - Global stats                  ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

export default app;
