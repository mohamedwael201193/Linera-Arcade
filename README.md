# 🎮 Linera Arcade Hub

<div align="center">

![Linera Arcade Hub](https://img.shields.io/badge/Linera-Arcade%20Hub-6366f1?style=for-the-badge&logo=gamepad&logoColor=white)
![Blockchain](https://img.shields.io/badge/Blockchain-Linera-00d4aa?style=for-the-badge)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)
![Rust](https://img.shields.io/badge/Rust-Smart%20Contracts-f74c00?style=for-the-badge&logo=rust&logoColor=white)

**🚀 A decentralized gaming platform built on Linera blockchain with 5 arcade mini-games, real-time XP tracking, and a global leaderboard system.**

[🎯 Live Demo](https://linera-arcade.vercel.app) • [📖 Documentation](#-documentation) • [🚀 Deploy](#-deployment)

</div>

---

## ✨ Features

### 🎯 Mini-Games
| Game | Description | XP Reward |
|------|-------------|-----------|
| ⚡ **Speed Clicker** | Test your clicking speed | 10-25 XP |
| 🧠 **Memory Matrix** | Pattern memorization challenge | 15-35 XP |
| 🎯 **Reaction Strike** | Lightning-fast reflexes test | 10-30 XP |
| ➕ **Math Blitz** | Quick arithmetic puzzles | 15-35 XP |
| 🐍 **Snake Sprint** | Classic snake reimagined | 10-40 XP |

### 🏆 Global Leaderboard
- Real-time player rankings across all users
- Per-game high score tracking
- Total XP aggregation system
- Sync existing blockchain users to leaderboard

### 🔗 Blockchain Integration
- **Linera Protocol**: Fast, scalable microchain architecture
- **Rust Smart Contracts**: Secure on-chain game logic
- **Dynamic.xyz**: Seamless wallet authentication
- **Hybrid Architecture**: Blockchain writes + Backend reads for optimal UX

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Vercel)                        │
│  React + TypeScript + Vite + TailwindCSS + Dynamic.xyz Wallet   │
└───────────────────────────┬─────────────────────────────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│   WRITES       │ │    READS       │ │    AUTH        │
│ Linera Chain   │ │ Backend API    │ │  Dynamic.xyz   │
│ (Authenticity) │ │ (Aggregation)  │ │   (Wallets)    │
└────────────────┘ └───────┬────────┘ └────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                                   ▼
┌────────────────────────┐     ┌────────────────────────┐
│   BACKEND (Render)     │     │   DATABASE (Render)    │
│   Express.js + Node    │────▶│   PostgreSQL           │
│   REST API Indexer     │     │   Persistent Storage   │
└────────────────────────┘     └────────────────────────┘
```

### Data Flow
1. **User Authentication**: Dynamic.xyz wallet connection
2. **Game Play**: Local game execution with score calculation
3. **Score Recording**: Blockchain write (Linera) + Backend sync
4. **Leaderboard**: Backend API aggregates global rankings

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- (Optional) PostgreSQL for production
- (Optional) Rust 1.86+ for contract development

### 1. Clone Repository
```bash
git clone https://github.com/mohamedwael201193/Linera-Arcade.git
cd Linera-Arcade
```

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)
npm run dev
```

### 3. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your settings (see Environment Variables section)
npm run dev
```

### 4. Open Application
- **Frontend**: http://localhost:5173 or http://localhost:3006
- **Backend API**: http://localhost:3001
- **API Health**: http://localhost:3001/api/health

---

## 📦 Project Structure

```
Linera-Arcade/
├── 📁 frontend/                # React frontend application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── games/         # Game components (5 games)
│   │   │   ├── layout/        # Header, Footer, Layout
│   │   │   └── ui/            # Buttons, Cards, etc.
│   │   ├── pages/             # Route pages
│   │   │   ├── HomePage.tsx
│   │   │   ├── GamesPage.tsx
│   │   │   ├── LeaderboardPage.tsx
│   │   │   └── ProfilePage.tsx
│   │   ├── hooks/             # Custom React hooks
│   │   │   ├── useArcade.ts   # Main game state hook
│   │   │   └── useLeaderboard.ts
│   │   ├── lib/               # API clients & utilities
│   │   │   ├── api/           # Backend REST API client
│   │   │   └── arcade/        # Blockchain API client
│   │   └── stores/            # Zustand state management
│   ├── vercel.json            # Vercel deployment config
│   └── package.json
│
├── 📁 backend/                 # Node.js backend indexer service
│   ├── src/
│   │   ├── routes/            # API route handlers (api.ts)
│   │   ├── repositories/      # Data access layer
│   │   │   ├── players.ts     # Player CRUD operations
│   │   │   └── scores.ts      # Score CRUD operations
│   │   ├── db/                # Database setup
│   │   │   ├── postgres.ts    # PostgreSQL client
│   │   │   └── memory.ts      # In-memory fallback
│   │   └── index.ts           # Express server entry
│   ├── render.yaml            # Render deployment config
│   └── package.json
│
├── 📁 contracts/               # Linera smart contracts (Rust)
│   └── arcade_hub/
│       ├── src/
│       │   ├── lib.rs         # Main contract logic
│       │   ├── state.rs       # Contract state definitions
│       │   └── service.rs     # GraphQL service
│       └── Cargo.toml
│
└── 📁 scripts/                 # Deployment & utility scripts
```

---

## 🌐 API Reference

### Base URL
- **Development**: `http://localhost:3001`
- **Production**: `https://your-backend.onrender.com`

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/leaderboard` | Get global rankings |
| `GET` | `/api/players/:address` | Get player by wallet |
| `POST` | `/api/players` | Register new player |
| `POST` | `/api/scores` | Submit game score |
| `POST` | `/api/sync` | Sync blockchain user |
| `GET` | `/api/stats` | Platform statistics |
| `GET` | `/api/scores/highscores/:game` | Game high scores |

### Example Requests

```bash
# Get leaderboard
curl http://localhost:3001/api/leaderboard

# Register player
curl -X POST http://localhost:3001/api/players \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"walletAddress":"0x...","username":"player1"}'

# Submit score
curl -X POST http://localhost:3001/api/scores \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"walletAddress":"0x...","gameType":"SPEED_CLICKER","score":150,"xpEarned":15}'
```

### Response Format

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

---

## 🔧 Environment Variables

### Frontend (.env)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `VITE_DYNAMIC_ENVIRONMENT_ID` | Dynamic.xyz environment ID | `abc123...` | ✅ Yes |
| `VITE_LINERA_FAUCET_URL` | Linera testnet faucet | `https://faucet.testnet-conway.linera.net` | ✅ Yes |
| `VITE_BACKEND_URL` | Backend API URL | `https://your-app.onrender.com` | ✅ Yes |
| `VITE_API_KEY` | API key for write operations | `your-secret-key` | ✅ Yes |
| `VITE_APPLICATION_ID` | Linera application ID | (optional) | ❌ No |
| `VITE_HUB_CHAIN_ID` | Hub chain ID | (optional) | ❌ No |

### Backend (.env)

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` | ✅ Yes |
| `PORT` | Server port | `3001` | ❌ No |
| `NODE_ENV` | Environment mode | `production` | ✅ Yes |
| `CORS_ORIGINS` | Allowed frontend URLs | `https://your-app.vercel.app` | ✅ Yes |
| `API_SECRET_KEY` | Secret for API authentication | `random-secure-string` | ✅ Yes |

---

## 🚀 Deployment

### 📌 Step 1: Deploy Backend to Render

1. **Create Account**: Go to [render.com](https://render.com) and sign up

2. **Create PostgreSQL Database**:
   - Dashboard → New → PostgreSQL
   - Name: `linera-arcade-db`
   - Region: Oregon (or closest)
   - Plan: Free
   - Click **Create Database**
   - Copy the **Internal Database URL**

3. **Create Web Service**:
   - Dashboard → New → Web Service
   - Connect your GitHub repository
   - **Settings**:
     - Name: `linera-arcade-backend`
     - Region: Same as database
     - Branch: `main`
     - Root Directory: `backend`
     - Runtime: Node
     - Build Command: `npm install && npm run build`
     - Start Command: `npm start`
     - Plan: Free

4. **Set Environment Variables**:
   ```
   DATABASE_URL = <paste-internal-database-url>
   NODE_ENV = production
   CORS_ORIGINS = https://your-app.vercel.app
   API_SECRET_KEY = <generate-a-secure-random-string>
   PORT = 3001
   ```

5. **Deploy** → Copy your backend URL (e.g., `https://linera-arcade-backend.onrender.com`)

---

### 📌 Step 2: Deploy Frontend to Vercel

1. **Create Account**: Go to [vercel.com](https://vercel.com) and sign up

2. **Import Project**:
   - Dashboard → Add New → Project
   - Import your GitHub repository
   - **Configure**:
     - Framework Preset: Vite
     - Root Directory: `frontend`
     - Build Command: `npm run build`
     - Output Directory: `dist`

3. **Set Environment Variables**:
   ```
   VITE_DYNAMIC_ENVIRONMENT_ID = <from-dynamic.xyz-dashboard>
   VITE_LINERA_FAUCET_URL = https://faucet.testnet-conway.linera.net
   VITE_BACKEND_URL = https://linera-arcade-backend.onrender.com
   VITE_API_KEY = <same-as-API_SECRET_KEY-from-backend>
   ```

4. **Deploy** → Your app is live! 🎉

---

### 📌 Step 3: Update CORS (Important!)

After deploying frontend, go back to Render and update:
```
CORS_ORIGINS = https://your-actual-vercel-url.vercel.app
```

---

## 📊 Database Setup

### Auto-Setup (Recommended)
The backend automatically creates tables on first run. No manual setup needed!

### Manual Setup (Optional)
```sql
-- Connect to your PostgreSQL database
psql $DATABASE_URL

-- Create tables
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(66) UNIQUE NOT NULL,
  username VARCHAR(50) NOT NULL,
  total_xp INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scores (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  game_type VARCHAR(50) NOT NULL,
  score INTEGER NOT NULL,
  xp_earned INTEGER NOT NULL,
  played_at TIMESTAMP DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_players_wallet ON players(wallet_address);
CREATE INDEX IF NOT EXISTS idx_players_xp ON players(total_xp DESC);
CREATE INDEX IF NOT EXISTS idx_scores_player ON scores(player_id);
CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game_type);
```

---

## 🎮 Smart Contracts

### Building Contracts
```bash
# Install Rust and Linera tools
rustup target add wasm32-unknown-unknown
cargo install linera-service

# Build contracts
cd contracts/arcade_hub
cargo build --release --target wasm32-unknown-unknown
```

### Contract Operations
```rust
// Register player
Operation::CreatePlayer { username: "player1".to_string() }

// Record score
Operation::RecordScore { 
    game: GameType::SpeedClicker, 
    score: 150 
}
```

### GraphQL Queries
```graphql
query GetPlayer {
  player {
    username
    totalXp
    gamesPlayed
    highScores {
      game
      score
    }
  }
}
```

---

## 🛠️ Development

### Running Locally
```bash
# Terminal 1 - Backend (with hot reload)
cd backend && npm run dev

# Terminal 2 - Frontend (with hot reload)  
cd frontend && npm run dev
```

### Building for Production
```bash
# Backend
cd backend && npm run build

# Frontend
cd frontend && npm run build
```

### Testing API
```bash
# Health check
curl http://localhost:3001/api/health

# Get leaderboard
curl http://localhost:3001/api/leaderboard

# Get stats
curl http://localhost:3001/api/stats
```

---

## 🔍 Troubleshooting

### Common Issues

**Backend not connecting to database:**
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Ensure database is running and accessible

**CORS errors:**
- Add your frontend URL to `CORS_ORIGINS`
- Format: `https://your-app.vercel.app` (no trailing slash)

**API key errors:**
- Ensure `VITE_API_KEY` matches `API_SECRET_KEY`
- Check that API key is included in request headers

**Leaderboard not showing:**
- Verify backend is running and accessible
- Check browser console for errors
- Ensure players have synced to backend

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Acknowledgments

- [Linera Protocol](https://linera.dev) - Blockchain infrastructure
- [Dynamic.xyz](https://dynamic.xyz) - Wallet authentication
- [Render](https://render.com) - Backend hosting
- [Vercel](https://vercel.com) - Frontend hosting

---

<div align="center">

**Built with ❤️ for the Linera Ecosystem**

⭐ Star this repo if you found it helpful!

</div>
