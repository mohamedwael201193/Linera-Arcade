# Linera Arcade Backend

Backend indexer service for Linera Arcade Hub that aggregates leaderboard data from all users across all Linera microchains.

## Features

- 🎮 Global leaderboard aggregation
- 👤 Player registration and profiles
- 📊 Game scores and high scores
- 🏆 Real-time rankings
- 🔒 API key authentication for writes

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Language**: TypeScript
- **Validation**: Zod

## Quick Start

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your database URL
   ```

3. **Run migrations**:
   ```bash
   npm run db:migrate
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`.

### Database Setup

For local development, you need PostgreSQL running:

```bash
# Using Docker
docker run --name arcade-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=linera_arcade -p 5432:5432 -d postgres:15

# Connection string
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/linera_arcade
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Players
- `GET /api/players` - Get all players
- `GET /api/players/:wallet` - Get player by wallet address
- `POST /api/players` - Register new player (requires API key)

### Leaderboard
- `GET /api/leaderboard?limit=100` - Get global leaderboard
- `GET /api/leaderboard/rank/:wallet` - Get player's rank

### Scores
- `POST /api/scores` - Submit a new score (requires API key)
- `GET /api/scores/recent?limit=50` - Get recent scores
- `GET /api/scores/game/:gameType?limit=50` - Get scores for a game
- `GET /api/scores/highscores/:gameType?limit=10` - Get high scores for a game

### Stats
- `GET /api/stats` - Get global statistics

## Deployment to Render

1. **Create a new Web Service** on [Render](https://render.com)
2. **Connect your repository**
3. **Configure build settings**:
   - Build Command: `npm install && npm run build && npm run db:migrate`
   - Start Command: `npm start`
4. **Add PostgreSQL database**
5. **Set environment variables**:
   - `DATABASE_URL` - Auto-filled from database
   - `CORS_ORIGINS` - Your Vercel frontend URL
   - `API_SECRET_KEY` - Generate a secure random string

Or use the `render.yaml` for Infrastructure as Code deployment.

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `CORS_ORIGINS` | Allowed origins (comma-separated) | Yes |
| `API_SECRET_KEY` | Secret key for write operations | Yes (production) |

## Security

- Write operations (POST) require `X-Api-Key` header in production
- CORS is configured for specific frontend origins
- Database connections use SSL in production

## License

MIT
