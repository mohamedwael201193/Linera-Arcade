/**
 * In-Memory Database for Development
 * 
 * Simple in-memory storage when PostgreSQL is not available.
 * Data is lost on restart but works for testing.
 */

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

export interface Score {
  id: number;
  player_wallet: string;
  game_type: string;
  score: number;
  xp_earned: number;
  bonus_data: number | null;
  chain_id: string | null;
  submitted_at: Date;
}

// In-memory storage
const players: Map<string, Player> = new Map();
const scores: Score[] = [];
let nextPlayerId = 1;
let nextScoreId = 1;

// Stats
const stats = {
  total_players: 0,
  total_games_played: 0,
  total_xp_earned: 0,
};

/**
 * In-memory database implementation
 */
export const memoryDb = {
  // Player operations
  async createPlayer(input: { wallet_address: string; username: string; chain_id?: string }): Promise<Player> {
    const wallet = input.wallet_address.toLowerCase();
    
    // Check if exists
    const existing = players.get(wallet);
    if (existing) {
      existing.username = input.username;
      existing.updated_at = new Date();
      return existing;
    }
    
    const player: Player = {
      id: nextPlayerId++,
      wallet_address: wallet,
      username: input.username,
      total_xp: 0,
      level: 1,
      games_played: 0,
      chain_id: input.chain_id || null,
      registered_at: new Date(),
      updated_at: new Date(),
    };
    
    players.set(wallet, player);
    stats.total_players++;
    
    return player;
  },

  async getPlayerByWallet(wallet: string): Promise<Player | null> {
    return players.get(wallet.toLowerCase()) || null;
  },

  async getAllPlayers(): Promise<Player[]> {
    return Array.from(players.values()).sort((a, b) => b.total_xp - a.total_xp);
  },

  async updatePlayerXP(wallet: string, xpEarned: number): Promise<Player | null> {
    const player = players.get(wallet.toLowerCase());
    if (!player) return null;
    
    player.total_xp += xpEarned;
    player.games_played++;
    player.level = Math.floor(Math.sqrt(player.total_xp / 100)) + 1;
    player.updated_at = new Date();
    
    return player;
  },

  async getLeaderboard(limit: number = 100): Promise<(Player & { rank: number })[]> {
    const sorted = Array.from(players.values())
      .sort((a, b) => b.total_xp - a.total_xp)
      .slice(0, limit);
    
    return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
  },

  async getPlayerRank(wallet: string): Promise<number | null> {
    const sorted = Array.from(players.values())
      .sort((a, b) => b.total_xp - a.total_xp);
    
    const index = sorted.findIndex(p => p.wallet_address === wallet.toLowerCase());
    return index >= 0 ? index + 1 : null;
  },

  // Score operations
  async createScore(input: {
    player_wallet: string;
    game_type: string;
    score: number;
    xp_earned: number;
    bonus_data?: number;
    chain_id?: string;
  }): Promise<Score> {
    const score: Score = {
      id: nextScoreId++,
      player_wallet: input.player_wallet.toLowerCase(),
      game_type: input.game_type,
      score: input.score,
      xp_earned: input.xp_earned,
      bonus_data: input.bonus_data || null,
      chain_id: input.chain_id || null,
      submitted_at: new Date(),
    };
    
    scores.push(score);
    stats.total_games_played++;
    stats.total_xp_earned += input.xp_earned;
    
    return score;
  },

  async getRecentScores(limit: number = 50): Promise<(Score & { username: string })[]> {
    return scores
      .slice(-limit)
      .reverse()
      .map(s => ({
        ...s,
        username: players.get(s.player_wallet)?.username || 'Unknown',
      }));
  },

  async getGameScores(gameType: string, limit: number = 50): Promise<(Score & { username: string })[]> {
    return scores
      .filter(s => s.game_type === gameType)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => ({
        ...s,
        username: players.get(s.player_wallet)?.username || 'Unknown',
      }));
  },

  async getGameHighScores(gameType: string, limit: number = 10): Promise<{
    player_wallet: string;
    username: string;
    score: number;
    xp_earned: number;
    rank: number;
    submitted_at: Date;
  }[]> {
    // Get best score per player
    const bestScores = new Map<string, Score>();
    
    for (const score of scores) {
      if (score.game_type !== gameType) continue;
      
      const existing = bestScores.get(score.player_wallet);
      if (!existing || score.score > existing.score) {
        bestScores.set(score.player_wallet, score);
      }
    }
    
    return Array.from(bestScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s, i) => ({
        player_wallet: s.player_wallet,
        username: players.get(s.player_wallet)?.username || 'Unknown',
        score: s.score,
        xp_earned: s.xp_earned,
        rank: i + 1,
        submitted_at: s.submitted_at,
      }));
  },

  async getGlobalStats(): Promise<{
    totalPlayers: number;
    totalGamesPlayed: number;
    totalXpEarned: number;
    topXp: number;
    highestLevel: number;
  }> {
    const allPlayers = Array.from(players.values());
    const topPlayer = allPlayers.sort((a, b) => b.total_xp - a.total_xp)[0];
    
    return {
      totalPlayers: players.size,
      totalGamesPlayed: stats.total_games_played,
      totalXpEarned: stats.total_xp_earned,
      topXp: topPlayer?.total_xp || 0,
      highestLevel: topPlayer?.level || 1,
    };
  },

  // Seed some test data
  async seed() {
    const testPlayers = [
      { wallet: '0x1234567890abcdef1234567890abcdef12345678', username: 'CryptoGamer', xp: 15000 },
      { wallet: '0xabcdef1234567890abcdef1234567890abcdef12', username: 'BlockchainPro', xp: 12500 },
      { wallet: '0x9876543210fedcba9876543210fedcba98765432', username: 'LineraKing', xp: 10000 },
      { wallet: '0xfedcba9876543210fedcba9876543210fedcba98', username: 'ArcadeChamp', xp: 8500 },
      { wallet: '0x1111222233334444555566667777888899990000', username: 'PixelMaster', xp: 7000 },
    ];
    
    for (const p of testPlayers) {
      const player = await this.createPlayer({ wallet_address: p.wallet, username: p.username });
      player.total_xp = p.xp;
      player.level = Math.floor(Math.sqrt(p.xp / 100)) + 1;
      player.games_played = Math.floor(p.xp / 100);
    }
    
    console.log('✅ Seeded test data with 5 players');
  }
};
