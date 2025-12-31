<div align="center">
  <img src="https://img.shields.io/badge/Linera-Arcade%20Hub-orange?style=for-the-badge" alt="Linera Arcade Hub" />
  <img src="https://img.shields.io/badge/Blockchain-Conway%20Testnet-blue?style=for-the-badge" alt="Conway Testnet" />
  <img src="https://img.shields.io/badge/Status-Live-green?style=for-the-badge" alt="Live" />
</div>

<h1 align="center">🎮 Linera Arcade Hub</h1>

<p align="center">
  <strong>A Fully On-Chain Gaming & Prediction Platform on Linera Conway Testnet</strong>
</p>

<p align="center">
  <a href="https://linera-arcadee.vercel.app">🌐 Live Demo</a> •
  <a href="#-features">Features</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-smart-contract">Smart Contract</a>
</p>

---

## 📋 Overview

Linera Arcade Hub is a **fully decentralized gaming platform** built on the Linera blockchain (Conway Testnet). It features:

- **8 Single-Player Mini Games** with on-chain score submission
- **9 Real-Time Multiplayer Games** with hybrid blockchain integration
- **Crypto Price Predictions** (BTC/ETH) with real price feeds
- **Token Economy** with XP, coins, and daily bonuses
- **Global Leaderboard** ranked by XP
- **Activity Feed** showing all platform activity in real-time

### 🔗 Live URLs

| Service | URL |
|---------|-----|
| **Frontend** | [https://linera-arcadee.vercel.app](https://linera-arcadee.vercel.app) |
| **Backend API** | [https://linera-arcade-backend.onrender.com](https://linera-arcade-backend.onrender.com) |
| **Blockchain** | Linera Conway Testnet |

### 📦 On-Chain Deployment

```
Application ID: cfd9451f2324ca63f9a9d2f642030b837eab9147fa7e1deeaa2a51150fc19b06
Hub Chain ID:   925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44
```

---

## ✨ Features

### 🎮 Single-Player Mini Games (8 Games)

Each game submits scores on-chain with XP rewards:

| Game | Description | XP Formula |
|------|-------------|------------|
| **🐍 Snake Sprint** | Classic snake game | `score × 0.5 + 50` |
| **⚡ Reaction Strike** | Test your reflexes | `1000 - reactionTime` |
| **🧠 Memory Matrix** | Pattern memorization | `matches × 10 + level × 25` |
| **🔢 Math Blitz** | Speed math challenges | `correct × 15 + streak × 5` |
| **🖱️ Speed Clicker** | Click as fast as possible | `clicks × 2` |
| **⌨️ Typing Blitz** | Type words quickly | `wpm × 2 + accuracy` |
| **🎯 Aim Trainer** | Precision clicking | `hits × 10 - misses × 5` |
| **🎨 Color Rush** | Color matching game | `correct × 20` |

### 🆚 Multiplayer Games (9 Games)

Real-time multiplayer via WebSocket with on-chain result recording:

| Game | Type | Winner XP | Winner Coins |
|------|------|-----------|--------------|
| **⭕ Tic Tac Toe** | Turn-based | 200 XP | 100 🪙 |
| **🔴 Connect Four** | Turn-based | 250 XP | 100 🪙 |
| **♟️ Chess** | Turn-based | 500 XP | 100 🪙 |
| **🔘 Checkers** | Turn-based | 350 XP | 100 🪙 |
| **✂️ Rock Paper Scissors** | Simultaneous | 150 XP | 100 🪙 |
| **📝 Word Duel** | Racing | 200 XP | 100 🪙 |
| **⚡ Reaction Duel** | Racing | 180 XP | 100 🪙 |
| **🔢 Quick Math** | Racing | 220 XP | 100 🪙 |
| **😀 Emoji Race** | Racing | 180 XP | 100 🪙 |

*Losers receive 25% of winner's XP + 30 coins for participation*

### 📈 Crypto Predictions

Predict BTC/ETH price movement with real price data:

- **Assets**: Bitcoin (BTC/USD), Ethereum (ETH/USD)
- **Directions**: UP ⬆️ or DOWN ⬇️
- **Duration**: 5-minute rounds
- **Stakes**: 10, 25, 50, 100, 250, or custom amount
- **Payout**: 1.9x on correct prediction
- **Price Source**: CryptoCompare API (real-time)

### 💰 Token Economy

| Action | Reward |
|--------|--------|
| **Registration** | 100 welcome coins |
| **Daily Bonus** | +100 coins/day |
| **Win Multiplayer** | 100 coins + full XP |
| **Lose Multiplayer** | 30 coins + 25% XP |
| **Win Prediction** | 1.9x stake back |
| **Submit Score** | XP based on performance |

### 🏆 Global Leaderboard

- Ranked by total XP
- Shows level, games played, total XP
- Highlights current player position
- Updates in real-time

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│                   (React + Vite + TypeScript)                   │
│                     Vercel Deployment                           │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Games   │ │Leaderboard│ │Predictions│ │   Multiplayer   │   │
│  │  Page    │ │   Page   │ │   Page   │ │      Page       │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘   │
│       │            │            │                │              │
│       └────────────┴─────┬──────┴────────────────┘              │
│                          │                                       │
│                    ┌─────▼─────┐                                │
│                    │ ArcadeAPI │ ◄──── Dynamic.xyz Wallet       │
│                    └─────┬─────┘                                │
└──────────────────────────┼──────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐    ┌──────────┐
    │  Linera  │    │  Backend │    │ WebSocket│
    │Blockchain│    │   API    │    │  Server  │
    │(GraphQL) │    │ (REST)   │    │(Socket.IO│
    └────┬─────┘    └────┬─────┘    └────┬─────┘
         │               │               │
         │               ▼               │
         │        ┌──────────┐           │
         │        │PostgreSQL│           │
         │        │ Database │           │
         │        └──────────┘           │
         │                               │
         └───────────────────────────────┘
              Conway Testnet (Linera)
```

### Technology Stack

| Layer | Technology |
|-------|------------|
| **Blockchain** | Linera (Rust/WASM) |
| **Frontend** | React 18 + Vite + TypeScript |
| **Styling** | Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | PostgreSQL (Render) |
| **Real-time** | Socket.IO |
| **Wallet** | Dynamic.xyz |
| **Hosting** | Vercel (Frontend) + Render (Backend) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Rust + Cargo
- Linera CLI
- PostgreSQL (for production)

### Installation

```bash
# Clone the repository
git clone https://github.com/mohamedwael201193/Linera-Arcade.git
cd Linera-Arcade

# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd ../backend && npm install
```

### Environment Setup

**Frontend** (`frontend/.env`):
```env
VITE_DYNAMIC_ENVIRONMENT_ID=your_dynamic_env_id
VITE_APPLICATION_ID=cfd9451f2324ca63f9a9d2f642030b837eab9147fa7e1deeaa2a51150fc19b06
VITE_HUB_CHAIN_ID=925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44
VITE_BACKEND_URL=http://localhost:3001
```

**Backend** (`backend/.env`):
```env
PORT=3001
DATABASE_URL=postgresql://user:password@host:5432/dbname
CORS_ORIGINS=http://localhost:3006
NODE_ENV=development
```

### Running Locally

```bash
# Terminal 1: Start backend
cd backend && npm run dev

# Terminal 2: Start frontend
cd frontend && npm run dev
```

Access at: http://localhost:3006

---

## 📜 Smart Contract

The Arcade Hub smart contract is written in Rust and compiled to WASM for deployment on Linera.

### Contract Operations

```rust
pub enum Operation {
    /// Register a new player with username
    RegisterPlayer { username: String },
    
    /// Submit a game score
    SubmitScore { game_type: String, score: u64 },
    
    /// Place a crypto prediction
    PlaceCryptoPrediction {
        round_id: String,
        direction: PredictionDirection,
        amount: u64,
    },
    
    /// Submit multiplayer game result (hybrid system)
    SubmitMultiplayerResult {
        game_type: String,
        room_code: String,
        is_winner: bool,
        opponent_username: String,
    },
    
    /// Claim daily bonus (100 coins)
    ClaimDailyBonus,
}
```

### Building & Deploying Contract

```bash
# Build the contract
cargo build --release --target wasm32-unknown-unknown -p arcade-hub

# Deploy to Linera
linera publish-and-create \
  target/wasm32-unknown-unknown/release/arcade_hub_contract.wasm \
  target/wasm32-unknown-unknown/release/arcade_hub_service.wasm \
  --json-argument '{"hub_chain_id": "925415e59d6e1d8ebb3ab2f5791ac170a21e79653f1606332ac4a62429dfca44"}'
```

### GraphQL Mutations

```graphql
# Register Player
mutation Register($username: String!) {
  register(username: $username)
}

# Submit Score
mutation SubmitScore($gameType: String!, $score: Int!) {
  submitScore(gameType: $gameType, score: $score)
}

# Place Prediction
mutation PlacePrediction($roundId: String!, $direction: String!, $amount: Int!) {
  placeCryptoPrediction(roundId: $roundId, direction: $direction, amount: $amount)
}

# Submit Multiplayer Result
mutation SubmitMultiplayerResult(
  $gameType: String!
  $roomCode: String!
  $isWinner: Boolean!
  $opponentUsername: String!
) {
  submitMultiplayerResult(
    gameType: $gameType
    roomCode: $roomCode
    isWinner: $isWinner
    opponentUsername: $opponentUsername
  )
}

# Claim Daily Bonus
mutation ClaimDaily {
  claimDailyBonus
}
```

---

## 📄 Pages Overview

### 🏠 Home Page
- Platform introduction with animated UI
- Quick access to all features
- Display of live statistics

### 🎮 Games Page
- Grid of 8 mini games
- Click to play instantly
- See high scores

### 🎯 Game Play Page
- Full-screen game experience
- Real-time score tracking
- On-chain score submission with wallet signature

### 🆚 Multiplayer Page
- Browse 9 multiplayer games
- Create room (get 6-character code)
- Join room via code or shared URL
- Real-time gameplay via WebSocket
- On-chain result submission after game ends

### 📈 Predictions Page
- Live BTC/ETH prices (CryptoCompare)
- Active prediction rounds with countdown
- Place predictions (UP/DOWN)
- Stake selection (preset or custom amount)
- View prediction history and results

### 🏆 Leaderboard Page
- Global XP rankings
- Player levels and stats
- Your current position highlighted

### 📊 Activity Page
- Real-time platform activity feed
- Filter by activity type
- See wins, games, predictions, bonuses

### 👤 Profile Page
- Your wallet address
- Total XP and level
- Coin balance
- Daily bonus claim button
- Your recent activity

---

## 🔄 User Flows

### First-Time User
```
1. Visit linera-arcadee.vercel.app
2. Click "Connect Wallet" (Dynamic.xyz)
3. Choose username → Sign registration tx
4. Receive 100 welcome coins
5. Start playing games or making predictions!
```

### Playing a Game
```
1. Go to Games page
2. Select a mini game
3. Play and achieve a score
4. Click "Submit Score" → Sign tx
5. XP awarded and recorded on-chain
6. Check leaderboard for your rank
```

### Multiplayer Game
```
1. Go to Multiplayer page
2. Enter your display name
3. Create room → Get 6-char code
4. Share code with friend
5. Friend joins → Game starts
6. Play in real-time via WebSocket
7. Winner clicks "Claim Victory!" → Sign tx
8. XP + Coins recorded on blockchain
```

### Making a Prediction
```
1. Go to Predictions page
2. Select BTC or ETH round
3. Choose stake amount (or enter custom)
4. Click UP ⬆️ or DOWN ⬇️
5. Sign transaction with wallet
6. Wait for 5-minute round to end
7. Auto-resolved with real price
8. WIN: Get 1.9x stake back | LOSE: Forfeit stake
```

---

## 📁 Project Structure

```
linera/
├── contracts/                 # Smart contract (Rust/WASM)
│   └── arcade_hub/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs         # Operations & types
│           ├── contract.rs    # Business logic
│           ├── service.rs     # GraphQL queries
│           └── state.rs       # State management
│
├── frontend/                  # React frontend
│   ├── src/
│   │   ├── components/        # UI components
│   │   ├── games/             # Game implementations
│   │   ├── pages/             # Route pages
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/
│   │   │   ├── arcade/        # ArcadeAPI & queries
│   │   │   ├── api/           # Backend API client
│   │   │   ├── linera/        # Linera adapter
│   │   │   └── graphql/       # GraphQL client
│   │   └── types/             # TypeScript types
│   └── package.json
│
├── backend/                   # Express backend
│   ├── src/
│   │   ├── index.ts           # Server entry
│   │   ├── routes/api.ts      # REST endpoints
│   │   ├── db/
│   │   │   ├── memory.ts      # In-memory DB (dev)
│   │   │   ├── postgres.ts    # PostgreSQL (prod)
│   │   │   └── selector.ts    # DB selection
│   │   ├── services/
│   │   │   └── binance.ts     # Price feeds
│   │   └── repositories/      # Data access
│   └── package.json
│
└── scripts/                   # Deployment scripts
    ├── deploy-arcade-hub.sh
    ├── build.sh
    └── start-backend.sh
```

---

## 🔐 Security

- **Wallet Signatures**: All on-chain actions require wallet signature
- **No Private Keys**: Wallet handles signing (Dynamic.xyz)
- **API Key Auth**: Backend endpoints protected
- **CORS**: Restricted to frontend domain
- **Input Validation**: Zod schemas on all endpoints

---

## 🧪 Testing

### Verified Features ✅

- [x] User registration with custom username
- [x] All 8 mini games playable
- [x] Score submission on-chain
- [x] 9 multiplayer games functional
- [x] Multiplayer result submission on-chain
- [x] Crypto predictions with real prices
- [x] Auto-resolution of prediction rounds
- [x] Daily bonus claiming
- [x] Global leaderboard updates
- [x] Activity feed showing all actions
- [x] Data persistence (PostgreSQL)
- [x] Cross-wallet global data visibility

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Linera](https://linera.io) - Blockchain platform
- [Dynamic.xyz](https://dynamic.xyz) - Wallet infrastructure
- [CryptoCompare](https://cryptocompare.com) - Price data API
- [Vercel](https://vercel.com) - Frontend hosting
- [Render](https://render.com) - Backend hosting

---

<div align="center">
  <p>Built with ❤️ on Linera Conway Testnet</p>
  <p>
    <a href="https://linera-arcadee.vercel.app">🎮 Play Now</a> •
    <a href="https://github.com/mohamedwael201193/Linera-Arcade/issues">🐛 Report Bug</a> •
    <a href="https://github.com/mohamedwael201193/Linera-Arcade/issues">💡 Request Feature</a>
  </p>
</div>
