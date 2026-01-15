/**
 * Arcade API - High-level interface for Arcade Hub operations
 * 
 * HYBRID ARCHITECTURE:
 * - READS (leaderboard, stats, etc.) → Backend API (for global aggregation)
 * - WRITES (register, submit score) → Linera blockchain (for authenticity)
 * 
 * After each blockchain write, we also sync to the backend for global visibility.
 */

import { lineraAdapter } from '../linera';
import { backendApi } from '../api/backendApi';
import {
  GET_PLAYER,
  REGISTER_PLAYER,
  SUBMIT_SCORE,
  GET_COIN_BALANCE,
  CLAIM_DAILY_BONUS,
  CREATE_CRYPTO_ROUND,
  PLACE_CRYPTO_PREDICTION,
  PLACE_EVENT_PREDICTION,
} from './queries';
import type {
  Player,
  LeaderboardEntry,
  GameScore,
  GameHighScoreEntry,
} from './types';
import { GameType } from './types';

// =============================================================================
// RESPONSE TYPES (for blockchain queries)
// =============================================================================

interface PlayerResponse {
  player: Player | null;
}

interface RegisterPlayerResponse {
  registerPlayer: string | null;
}

interface SubmitScoreResponse {
  submitScore: string | null;
}

// =============================================================================
// XP CALCULATION (must match contract)
// =============================================================================

function calculateXP(gameType: GameType, score: number, bonusData?: number): number {
  switch (gameType) {
    case GameType.SPEED_CLICKER:
      return score * 10;
    case GameType.MEMORY_MATRIX:
      return score * 100 + (bonusData || 0) * 50;
    case GameType.REACTION_STRIKE:
      const base = Math.max(0, 1000 - score);
      return base * (bonusData || 0);
    case GameType.MATH_BLITZ:
      return score * 25 + (bonusData || 0) * 10;
    case GameType.SNAKE_SPRINT:
      return score * 15 + (bonusData || 0) * 5;
    case GameType.AIM_TRAINER:
      return score * 20 + Math.floor((bonusData || 0) / 10) * 5;
    case GameType.COLOR_RUSH:
      return score * 30 + (bonusData || 0) * 10;
    case GameType.TYPING_BLITZ:
      return score * 25 + Math.floor((bonusData || 0) / 10) * 5;
    default:
      return score;
  }
}

// =============================================================================
// ARCADE API CLASS
// =============================================================================

/**
 * ArcadeApi provides typed access to all Arcade Hub operations
 * Uses backend API for reads and blockchain for writes
 */
class ArcadeApiClass {
  /**
   * Normalize wallet address to lowercase
   */
  private normalizeWallet(wallet: string): string {
    return wallet.toLowerCase();
  }

  // ===========================================================================
  // PLAYER OPERATIONS
  // ===========================================================================

  /**
   * Get a player by wallet address
   * First tries backend, falls back to blockchain for own chain data.
   * Auto-syncs to backend if player exists on blockchain but not on backend.
   * IMPORTANT: For blockchain queries, uses autoSignerAddress (what contract sees)
   * 
   * @param wallet - Wallet address (0x...)
   * @returns Player or null if not registered
   */
  async getPlayer(wallet: string): Promise<Player | null> {
    const normalizedWallet = this.normalizeWallet(wallet);
    
    // Try backend first (has global data)
    try {
      const backendPlayer = await backendApi.getPlayer(wallet);
      if (backendPlayer) {
        return {
          owner: backendPlayer.walletAddress,
          username: backendPlayer.username,
          totalXp: backendPlayer.totalXp,
          level: backendPlayer.level,
          gamesPlayed: 0,
          registeredAt: 0,
        };
      }
    } catch {
      // Backend player not found, try blockchain
    }
    
    // Fall back to blockchain query (own chain)
    // IMPORTANT: Use autoSignerAddress because that's what the contract sees
    try {
      const autoSignerAddress = lineraAdapter.getAutoSignerAddress();
      const queryAddress = autoSignerAddress || normalizedWallet;
      
      const result = await lineraAdapter.query<PlayerResponse>(
        GET_PLAYER,
        { wallet: queryAddress }
      );
      
      if (result.player) {
        // Auto-sync to backend if player exists on blockchain but not on backend
        console.log('📡 Player found on blockchain but not backend, auto-syncing...');
        try {
          const chainId = lineraAdapter.getChainId();
          await backendApi.registerPlayer(wallet, result.player.username, chainId || undefined);
          console.log('✅ Player auto-synced to backend!');
        } catch (syncErr) {
          console.warn('⚠️ Failed to auto-sync player to backend:', syncErr);
        }
        
        return result.player;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get player from blockchain:', error);
      return null;
    }
  }

  /**
   * Get all registered players from backend
   * 
   * @returns Array of all players
   */
  async getAllPlayers(): Promise<Player[]> {
    try {
      const players = await backendApi.getAllPlayers();
      return players.map(p => ({
        owner: p.walletAddress,
        username: p.username,
        totalXp: p.totalXp,
        level: p.level,
        gamesPlayed: 0,
        registeredAt: 0,
      }));
    } catch (error) {
      console.error('Failed to get all players:', error);
      return [];
    }
  }

  /**
   * Register a new player
   * 1. Submits to blockchain (for authenticity)
   * 2. Syncs to backend (for global visibility)
   * 
   * @param username - Display username (3-20 chars, alphanumeric + underscore/hyphen)
   * @returns true if registration was initiated
   */
  async registerPlayer(username: string): Promise<boolean> {
    console.log(`📝 Registering player: ${username}`);
    
    // Step 1: Submit to blockchain
    await lineraAdapter.mutate<RegisterPlayerResponse>(
      REGISTER_PLAYER,
      { username }
    );
    
    console.log('✅ Player registered on blockchain');
    
    // Step 2: Sync to backend (async, don't wait)
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (wallet) {
      backendApi.registerPlayer(wallet, username, chainId || undefined)
        .then(() => console.log('✅ Player synced to backend'))
        .catch(err => console.warn('⚠️ Failed to sync to backend:', err));
    }
    
    return true;
  }

  /**
   * Sync existing blockchain player to backend leaderboard
   * Call this manually if player exists on blockchain but not on backend
   * 
   * @returns true if sync was successful
   */
  async syncToLeaderboard(): Promise<boolean> {
    const wallet = lineraAdapter.getAddress();
    const chainId = lineraAdapter.getChainId();
    
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    console.log('📡 Syncing player to global leaderboard...');
    
    // Get player from blockchain
    const result = await lineraAdapter.query<PlayerResponse>(
      GET_PLAYER,
      { wallet: wallet.toLowerCase() }
    );
    
    if (!result.player) {
      throw new Error('Player not found on blockchain. Please register first.');
    }
    
    // Sync to backend
    await backendApi.registerPlayer(wallet, result.player.username, chainId || undefined);
    
    // Also sync XP if they have any
    if (result.player.totalXp > 0) {
      await backendApi.submitScore(
        wallet,
        GameType.SNAKE_SPRINT, // Use proper enum value (SCREAMING_SNAKE_CASE)
        0,
        result.player.totalXp,
        undefined,
        chainId || undefined
      );
    }
    
    console.log('✅ Player synced to global leaderboard!');
    return true;
  }

  // ===========================================================================
  // LEADERBOARD OPERATIONS (from backend)
  // ===========================================================================

  /**
   * Get global leaderboard ranked by XP
   * Fetches from backend which aggregates all players
   * 
   * @param limit - Maximum number of entries (default 100)
   * @returns Array of LeaderboardEntry
   */
  async getLeaderboard(limit: number = 100): Promise<LeaderboardEntry[]> {
    try {
      const entries = await backendApi.getLeaderboard(limit);
      return entries.map(e => ({
        walletAddress: e.walletAddress,
        username: e.username,
        totalXp: e.totalXp,
        level: e.level,
        rank: e.rank,
      }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * Get a player's rank on the global leaderboard
   * 
   * @param wallet - Wallet address
   * @returns Rank (1-indexed) or null if not on leaderboard
   */
  async getPlayerRank(wallet: string): Promise<number | null> {
    try {
      return await backendApi.getPlayerRank(wallet);
    } catch (error) {
      console.error('Failed to get player rank:', error);
      return null;
    }
  }

  // ===========================================================================
  // SCORE OPERATIONS
  // ===========================================================================

  /**
   * Submit a game score
   * 1. Auto-registers player if not registered
   * 2. Submits to blockchain (for authenticity and XP calculation)
   * 3. Syncs to backend (for global leaderboard)
   * 
   * @param gameType - Type of game played
   * @param score - Raw score achieved
   * @param bonusData - Optional bonus data (varies by game)
   * @param dynamicUsername - Optional username from Dynamic Wallet for auto-registration
   * @returns true if score submission was initiated
   */
  async submitScore(
    gameType: GameType,
    score: number,
    bonusData?: number,
    dynamicUsername?: string
  ): Promise<boolean> {
    console.log(`🎮 Submitting score: ${score} for ${gameType}`);
    
    const wallet = lineraAdapter.getAddress();
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    // Step 0: Check if player is registered, if not auto-register
    // IMPORTANT: Use autoSignerAddress because that's what the contract sees as authenticated_signer()
    try {
      const autoSignerAddress = lineraAdapter.getAutoSignerAddress();
      if (autoSignerAddress) {
        const playerCheck = await lineraAdapter.query<PlayerResponse>(
          GET_PLAYER,
          { wallet: autoSignerAddress }
        );
        
        if (!playerCheck?.player) {
          console.log('📝 Player not registered, auto-registering...');
          // Use Dynamic Wallet username if available, otherwise generate default
          const username = dynamicUsername || `Player_${autoSignerAddress.slice(0, 8)}`;
          console.log(`📝 Using username: ${username} (from ${dynamicUsername ? 'Dynamic Wallet' : 'auto-generated'})`);
          await this.registerPlayer(username);
          console.log('✅ Player auto-registered!');
          // Small delay to ensure registration is processed
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          console.log(`✅ Player already registered as: ${playerCheck.player.username}`);
        }
      }
    } catch (regErr) {
      console.warn('⚠️ Could not verify/register player:', regErr);
      // Continue anyway - let the contract handle it
    }
    
    // Step 1: Submit to blockchain
    await lineraAdapter.mutate<SubmitScoreResponse>(
      SUBMIT_SCORE,
      {
        gameType,
        score,
        bonusData: bonusData ?? null,
      }
    );
    
    console.log('✅ Score submitted to blockchain');
    
    // Step 2: Calculate XP (same formula as contract)
    const xpEarned = calculateXP(gameType, score, bonusData);
    
    // Step 3: Sync to backend (async, don't wait)
    const chainId = lineraAdapter.getChainId();
    
    if (wallet) {
      backendApi.submitScore(wallet, gameType, score, xpEarned, bonusData, chainId || undefined)
        .then(() => console.log('✅ Score synced to backend'))
        .catch(err => console.warn('⚠️ Failed to sync score to backend:', err));
    }
    
    return true;
  }

  /**
   * Get recent scores across all games (from backend)
   * 
   * @param limit - Maximum number of scores (default 50)
   * @returns Array of recent GameScore
   */
  async getRecentScores(limit: number = 50): Promise<GameScore[]> {
    try {
      const scores = await backendApi.getRecentScores(limit);
      return scores.map(s => ({
        id: s.id,
        gameType: s.gameType as unknown as GameType,
        player: s.player,
        score: s.score,
        xpEarned: s.xpEarned,
        bonusData: s.bonusData ?? null,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get recent scores:', error);
      return [];
    }
  }

  /**
   * Get scores for a specific game type (from backend)
   * 
   * @param gameType - Type of game
   * @param limit - Maximum number of scores (default 50)
   * @returns Array of GameScore
   */
  async getGameScores(gameType: GameType, limit: number = 50): Promise<GameScore[]> {
    try {
      const scores = await backendApi.getGameScores(gameType, limit);
      return scores.map(s => ({
        id: s.id,
        gameType: s.gameType as unknown as GameType,
        player: s.player,
        score: s.score,
        xpEarned: s.xpEarned,
        bonusData: s.bonusData ?? null,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get game scores:', error);
      return [];
    }
  }

  /**
   * Get high scores for a specific game type (from backend)
   * 
   * @param gameType - Type of game
   * @param limit - Maximum number of entries (default 10)
   * @returns Array of GameHighScoreEntry
   */
  async getGameHighScores(
    gameType: GameType,
    limit: number = 10
  ): Promise<GameHighScoreEntry[]> {
    try {
      const scores = await backendApi.getGameHighScores(gameType, limit);
      return scores.map(s => ({
        player: s.player,
        username: s.playerName,
        score: s.score,
        xpEarned: s.xpEarned,
        timestamp: s.timestamp,
      }));
    } catch (error) {
      console.error('Failed to get game high scores:', error);
      return [];
    }
  }

  /**
   * Get global stats from backend
   */
  async getStats(): Promise<{
    totalPlayers: number;
    totalGamesPlayed: number;
    totalXpEarned: number;
    topXp: number;
    highestLevel: number;
  }> {
    try {
      return await backendApi.getStats();
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalPlayers: 0,
        totalGamesPlayed: 0,
        totalXpEarned: 0,
        topXp: 0,
        highestLevel: 1,
      };
    }
  }

  // ===========================================================================
  // COIN & PREDICTION OPERATIONS (NEW)
  // ===========================================================================

  /**
   * Get user's coin balance from blockchain
   * 
   * @param wallet - Wallet address
   * @returns Coin balance or 0 if not found
   */
  async getCoinBalance(wallet: string): Promise<number> {
    try {
      const result = await lineraAdapter.query<{ coinBalance: number }>(
        GET_COIN_BALANCE,
        { wallet: wallet.toLowerCase() }
      );
      return result.coinBalance || 0;
    } catch (error) {
      console.error('Failed to get coin balance:', error);
      // Fall back to backend
      try {
        const balance = await backendApi.getCoinBalance(wallet);
        return balance.balance || 0;
      } catch {
        return 0;
      }
    }
  }

  /**
   * Claim daily bonus (100 coins)
   * 1. Submits to blockchain
   * 2. Syncs to backend
   * 
   * @returns true if bonus was claimed
   */
  async claimDailyBonus(): Promise<boolean> {
    console.log('🎁 Claiming daily bonus...');
    
    try {
      // Step 1: Submit to blockchain
      await lineraAdapter.mutate<{ claimDailyBonus: boolean }>(
        CLAIM_DAILY_BONUS,
        {}
      );
      
      console.log('✅ Daily bonus claimed on blockchain');
      
      // Step 2: Sync to backend
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        backendApi.claimDailyBonus(wallet)
          .then(() => console.log('✅ Daily bonus synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync bonus to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to claim daily bonus:', error);
      
      // Try backend-only claim if blockchain fails
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        try {
          const result = await backendApi.claimDailyBonus(wallet);
          return result.success;
        } catch {
          return false;
        }
      }
      return false;
    }
  }

  // =============================================================================
  // CRYPTO PREDICTION METHODS (ON-CHAIN)
  // =============================================================================

  /**
   * Create a crypto prediction round ON-CHAIN
   * This must be called before predictions can be placed on-chain.
   * 
   * @param asset - 'BTC' or 'ETH'
   * @param startPrice - Current price in cents (e.g., 8752300 for $87,523.00)
   * @param durationSecs - Duration in seconds (default 300 = 5 min)
   * @returns The on-chain round ID, or null if failed
   */
  async createCryptoRound(
    asset: 'BTC' | 'ETH',
    startPrice: number,
    durationSecs: number = 300
  ): Promise<number | null> {
    console.log(`🎰 Creating crypto round on-chain: ${asset} at $${(startPrice / 100).toFixed(2)}`);
    
    try {
      // Submit to blockchain
      // Variable names must match the GraphQL mutation: asset, start_price, duration_secs
      const result = await lineraAdapter.mutate<{ createCryptoRound: number | null }>(
        CREATE_CRYPTO_ROUND,
        { 
          asset: asset.toUpperCase(), 
          start_price: Math.floor(startPrice), 
          duration_secs: durationSecs 
        }
      );
      
      console.log('📥 createCryptoRound result:', result);
      
      // The GraphQL mutation doesn't return the ID directly (returns empty array)
      // The ID is in the operation_results but not accessible via GraphQL
      // We need to query for active rounds to find our newly created round
      console.log('🔍 Querying for newly created round...');
      
      // Wait a moment for the blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Query for active rounds and find the one matching our asset
      const activeRounds = await this.getActiveCryptoRoundsOnChain();
      console.log('📋 Active rounds after creation:', activeRounds);
      
      const assetUpper = asset.toUpperCase();
      const newRound = activeRounds.find(r => {
        const roundAsset = String(r.asset).toUpperCase();
        console.log(`  Checking round ${r.id}: asset=${roundAsset} vs ${assetUpper}`);
        return roundAsset === assetUpper || roundAsset.includes(assetUpper);
      });
      
      if (newRound) {
        console.log(`✅ Found created round with ID: ${newRound.id}`);
        return newRound.id;
      }
      
      // Fallback: if we have any active rounds, use the latest one (highest ID)
      if (activeRounds.length > 0) {
        const sortedRounds = [...activeRounds].sort((a, b) => b.id - a.id);
        const latestRound = sortedRounds[0];
        if (latestRound) {
          console.log(`⚠️ Using latest round as fallback: ID ${latestRound.id}`);
          return latestRound.id;
        }
      }
      
      // Last resort: return 0 since that's likely the first round created
      console.warn('⚠️ Could not find newly created round, trying ID 0');
      return 0;
    } catch (error) {
      console.error('❌ Failed to create crypto round:', error);
      return null;
    }
  }

  /**
   * Get active crypto rounds from blockchain
   * Note: CryptoRound has durationSecs, not endTime - we calculate endTime from startTime + durationSecs
   */
  async getActiveCryptoRoundsOnChain(): Promise<Array<{ id: number; asset: string; startPrice: number; startTime: number; durationSecs: number }>> {
    try {
      const result = await lineraAdapter.query<{ activeCryptoRounds: Array<{
        id: number;
        asset: string;
        startPrice: number;
        startTime: number;
        durationSecs: number;
        status: string;
      }> }>(`
        query GetActiveCryptoRounds {
          activeCryptoRounds {
            id
            asset
            startPrice
            startTime
            durationSecs
            status
          }
        }
      `);
      
      return result?.activeCryptoRounds || [];
    } catch (error) {
      console.error('Failed to get active crypto rounds:', error);
      return [];
    }
  }

  /**
   * Place a crypto prediction (UP/DOWN)
   * 
   * FIXED: Now ensures the round exists on-chain before placing bet.
   * If no round exists for the asset, creates one first.
   * 
   * @param roundId - Backend round ID (will find/create matching on-chain round)
   * @param direction - 'UP' or 'DOWN'
   * @param coinsStaked - Amount of coins to stake
   * @param backendRound - Optional: backend round data for creating on-chain round
   * @returns true if prediction was placed
   */
  async placeCryptoPrediction(
    roundId: number,
    direction: 'UP' | 'DOWN',
    coinsStaked: number,
    dynamicUsername?: string,
    backendRound?: { asset: string; start_price: number; duration_secs?: number }
  ): Promise<boolean> {
    console.log(`📊 Placing crypto prediction: ${direction} with ${coinsStaked} coins`);
    
    const wallet = lineraAdapter.getAddress();
    if (!wallet) {
      throw new Error('No wallet connected');
    }
    
    try {
      // Step 0: Check if player is registered, if not auto-register
      // IMPORTANT: Use autoSignerAddress because that's what the contract sees as authenticated_signer()
      try {
        const autoSignerAddress = lineraAdapter.getAutoSignerAddress();
        if (autoSignerAddress) {
          const playerCheck = await lineraAdapter.query<PlayerResponse>(
            GET_PLAYER,
            { wallet: autoSignerAddress }
          );
          
          if (!playerCheck?.player) {
            console.log('📝 Player not registered, auto-registering...');
            // Use Dynamic Wallet username if available, otherwise generate default
            const username = dynamicUsername || `Player_${autoSignerAddress.slice(0, 8)}`;
            console.log(`📝 Using username: ${username} (from ${dynamicUsername ? 'Dynamic Wallet' : 'auto-generated'})`);
            await this.registerPlayer(username);
            console.log('✅ Player auto-registered!');
            await new Promise(resolve => setTimeout(resolve, 500));
          } else {
            console.log(`✅ Player already registered as: ${playerCheck.player.username}`);
          }
        }
      } catch (regErr) {
        console.warn('⚠️ Could not verify/register player:', regErr);
      }
      
      // Step 1: Ensure round exists on-chain
      // Check for active rounds on blockchain
      let onChainRoundId: number | null = null;
      
      try {
        const activeRounds = await this.getActiveCryptoRoundsOnChain();
        console.log(`📋 Active on-chain rounds: ${activeRounds.length}`, activeRounds);
        
        // Helper to check if a round is still accepting bets
        // Contract locks betting 30 seconds before end
        const isRoundAcceptingBets = (round: { startTime: number; durationSecs: number }) => {
          const currentTimeMicros = Date.now() * 1000; // Convert JS ms to microseconds
          const lockTime = round.startTime + (round.durationSecs - 30) * 1_000_000;
          const isAccepting = currentTimeMicros < lockTime;
          console.log(`⏱️ Round timing check: current=${currentTimeMicros}, lockTime=${lockTime}, accepting=${isAccepting}`);
          return isAccepting;
        };
        
        // Try to find a matching round by asset that is STILL ACCEPTING BETS
        if (backendRound) {
          const assetUpper = backendRound.asset.toUpperCase();
          const matchingRound = activeRounds.find(r => {
            const assetMatch = r.asset.toUpperCase() === assetUpper || 
                              r.asset.toUpperCase().includes(assetUpper);
            if (!assetMatch) return false;
            
            // Check if round is still accepting bets (not past lock time)
            return isRoundAcceptingBets(r);
          });
          
          if (matchingRound) {
            console.log(`✅ Found existing on-chain round for ${assetUpper}: ID ${matchingRound.id} (still accepting bets)`);
            onChainRoundId = matchingRound.id;
          } else {
            // Found rounds for asset but they're all past lock time
            const expiredRound = activeRounds.find(r => 
              r.asset.toUpperCase() === assetUpper || r.asset.toUpperCase().includes(assetUpper)
            );
            if (expiredRound) {
              console.log(`⚠️ Found round for ${assetUpper} but it's past lock time, will create new one`);
            }
          }
        }
        
        // If no matching round found (or existing one is expired), create one
        if ((onChainRoundId === null || onChainRoundId === undefined) && backendRound) {
          console.log(`📝 Creating fresh on-chain round for ${backendRound.asset}...`);
          const createdId = await this.createCryptoRound(
            backendRound.asset as 'BTC' | 'ETH',
            backendRound.start_price,
            backendRound.duration_secs || 300
          );
          
          // createCryptoRound now returns 0 as fallback, so check for null/undefined explicitly
          if (createdId === null || createdId === undefined) {
            throw new Error('Failed to create on-chain round');
          }
          onChainRoundId = createdId;
          console.log(`✅ Created on-chain round with ID: ${onChainRoundId}`);
          
          // Wait for chain to process
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Fallback: use the first active round that's accepting bets
        if ((onChainRoundId === null || onChainRoundId === undefined) && activeRounds.length > 0) {
          const acceptingRound = activeRounds.find(r => isRoundAcceptingBets(r));
          if (acceptingRound) {
            console.log(`⚠️ Using first available accepting round: ID ${acceptingRound.id}`);
            onChainRoundId = acceptingRound.id;
          }
        }
      } catch (roundErr) {
        console.error('⚠️ Could not verify/create on-chain round:', roundErr);
      }
      
      // If we still don't have an on-chain round, we need to create one
      if (onChainRoundId === null || onChainRoundId === undefined) {
        if (backendRound) {
          console.log(`📝 Creating on-chain round for ${backendRound.asset}...`);
          const createdId = await this.createCryptoRound(
            backendRound.asset as 'BTC' | 'ETH',
            backendRound.start_price,
            backendRound.duration_secs || 300
          );
          
          if (createdId === null || createdId === undefined) {
            console.error('❌ Failed to create on-chain round');
            throw new Error('Cannot place prediction: failed to create on-chain round');
          }
          onChainRoundId = createdId;
          
          // Wait for chain to process
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          console.error('❌ No on-chain round available and no backend round data to create one');
          throw new Error('Cannot place prediction: no round available');
        }
      }
      
      console.log(`🎯 Using on-chain round ID: ${onChainRoundId} for prediction`);
      
      // Step 2: Submit to blockchain with the ON-CHAIN round ID
      // Variable names must match the GraphQL mutation: round_id, direction, amount
      const mutationResult = await lineraAdapter.mutate<{ placeCryptoPrediction: unknown }>(
        PLACE_CRYPTO_PREDICTION,
        { round_id: onChainRoundId, direction, amount: coinsStaked }
      );
      
      console.log('📥 placeCryptoPrediction result:', mutationResult);
      
      // In Linera GraphQL, mutations return [] on success (actual result is in operation_results of the block)
      // An empty array [] means the operation was submitted successfully
      // Only null/undefined or GraphQL errors indicate failure
      const resultData = mutationResult?.placeCryptoPrediction;
      if (resultData === null || resultData === undefined) {
        console.warn('⚠️ Prediction submission returned null - may have failed');
      } else if (Array.isArray(resultData)) {
        // Empty array [] is SUCCESS in Linera - the actual response is in the block's operation_results
        // Response would decode to: CryptoPredictionPlaced { prediction_id, odds }
        console.log('✅ Crypto prediction placed on blockchain (mutation accepted)');
      }
      
      // Step 3: Sync to backend (use original backend round ID for tracking)
      if (wallet) {
        backendApi.placeCryptoPrediction(wallet, roundId, direction, coinsStaked)
          .then(() => console.log('✅ Prediction synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync prediction to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to place crypto prediction:', error);
      return false;
    }
  }

  /**
   * Place a world event prediction
   * 1. Submits to blockchain
   * 2. Syncs to backend
   * 
   * @param eventId - World event ID
   * @param outcome - Predicted outcome ('YES' or 'NO')
   * @param coinsStaked - Amount of coins to stake
   * @returns true if prediction was placed
   */
  async placeEventPrediction(
    eventId: number,
    outcome: string,
    coinsStaked: number
  ): Promise<boolean> {
    console.log(`🌍 Placing event prediction: ${outcome} with ${coinsStaked} coins`);
    
    try {
      // Convert outcome string to boolean (YES = true, NO = false)
      const predictionBool = outcome.toUpperCase() === 'YES';
      
      // Step 1: Submit to blockchain
      // Variable names must match the GraphQL mutation: event_id, prediction (bool), amount
      await lineraAdapter.mutate<{ placeEventPrediction: boolean }>(
        PLACE_EVENT_PREDICTION,
        { event_id: eventId, prediction: predictionBool, amount: coinsStaked }
      );
      
      console.log('✅ Event prediction placed on blockchain');
      
      // Step 2: Sync to backend
      const wallet = lineraAdapter.getAddress();
      if (wallet) {
        backendApi.placeEventPrediction(wallet, eventId, outcome, coinsStaked)
          .then(() => console.log('✅ Prediction synced to backend'))
          .catch(err => console.warn('⚠️ Failed to sync prediction to backend:', err));
      }
      
      return true;
    } catch (error) {
      console.error('Failed to place event prediction:', error);
      return false;
    }
  }
}

// Export singleton instance
export const arcadeApi = new ArcadeApiClass();

// Also export the class for testing
export { ArcadeApiClass };
