/**
 * Tournament On-Chain Game Hook (Chain Reaction)
 * 
 * DESIGN PHILOSOPHY:
 * - Every move is on-chain, executed on player's microchain
 * - No backend mediation, no optimistic UI
 * - Mutation → block confirmation → query → render
 * - If it feels slow, we ACCEPT it - this is a SHOWCASE
 * 
 * LEADERBOARD ARCHITECTURE:
 * - Backend acts as READ-ONLY INDEXER for global leaderboard
 * - Score is calculated ONLY on-chain during gameplay
 * - When game completes, frontend submits entry to backend indexer
 * - Verification is ALWAYS on-chain (replay the moves)
 * 
 * "This game only makes sense on Linera."
 */

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useLineraConnection } from './useLineraConnection';
import { lineraAdapter } from '../lib/linera';
import { backendApi } from '../lib/api/backendApi';
import {
  GET_ACTIVE_TOURNAMENT,
  GET_PLAYER_TOURNAMENT_GAME,
  GET_PLAYER_TOURNAMENT_STATS,
  START_TOURNAMENT_GAME,
  TOURNAMENT_MOVE,
  FORFEIT_TOURNAMENT_GAME,
  VERIFY_TOURNAMENT_GAME,
} from '../lib/arcade/queries';

// =============================================================================
// TYPES
// =============================================================================

export type ChainReactionGameStatus = 'IN_PROGRESS' | 'COMPLETED' | 'PERFECT_CLEAR' | 'FORFEITED';

export interface ChainReactionGame {
  grid: number[];
  movesUsed: number;
  maxMoves: number;
  score: number;
  currentChain: number;
  bestChain: number;
  status: ChainReactionGameStatus;
  seed: string;
  moveHistory: number[];
  tournamentId: number;
  startedAt: number;
  endedAt: number;
  cellsCleared: number;
  rank?: number;  // Actual rank from backend (after submission)
}

export interface ChainReactionTournament {
  id: number;
  name: string;
  seed: string;
  startTime: number;
  endTime: number;
  isActive: boolean;
  maxAttempts: number;
  totalSubmissions: number;
  topScore: number;
  topScorer: string;
}

export interface TournamentLeaderboardEntry {
  id?: number;
  tournament_id?: number;
  tournament_name?: string;
  player_address: string;
  username: string;
  chain_id?: string;
  score: number;
  seed: number | string;  // On-chain uses string, backend uses number
  moves: number[];
  moves_used: number;
  movesUsed?: number;  // Alias for moves_used (compatibility)
  submitted_at?: string | number;  // Backend uses string, on-chain uses number (timestamp)
  rank: number;
  // Legacy fields for compatibility with on-chain format
  player?: string;
  bestChain?: number;
  submittedAt?: number;
  attempts?: number;
}

export interface PlayerTournamentStats {
  bestScore: number;
  bestRank: number;
  attempts: number;
  tournamentId: number;
  tournamentName: string;
  totalSubmissions: number;
}

export interface TournamentMoveResult {
  success: boolean;
  grid: number[];
  score: number;
  cellsCleared: number;
  chainLength: number;
  movesRemaining: number;
  status: ChainReactionGameStatus;
  xpEarned?: number;
  coinsEarned?: number;
  rank?: number;
  // Rank-based reward breakdown
  rankReward?: {
    rank: number;
    coinsForRank: number;
    xpForParticipation: number;
    xpForPercentile: number;
  };
}

export interface GameVerificationResult {
  valid: boolean;
  computedScore: number;
  message: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useTournament() {
  const { primaryWallet } = useDynamicContext();
  const { isConnected } = useLineraConnection();
  const walletAddress = primaryWallet?.address?.toLowerCase();
  
  // Get the auto-signer address - this is what signs mutations and stores data
  // Game data is keyed by auto-signer address, NOT user wallet address
  const autoSignerAddress = lineraAdapter.getAutoSignerAddress();

  // State
  const [tournament, setTournament] = useState<ChainReactionTournament | null>(null);
  const [game, setGame] = useState<ChainReactionGame | null>(null);
  const [leaderboard, setLeaderboard] = useState<TournamentLeaderboardEntry[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerTournamentStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingMove, setIsProcessingMove] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // =============================================================================
  // QUERIES - All on-chain, no backend
  // =============================================================================

  /**
   * Load active tournament from blockchain
   */
  const loadTournament = useCallback(async () => {
    if (!isConnected) return;

    try {
      const result = await lineraAdapter.query<{ activeTournament: ChainReactionTournament | null }>(
        GET_ACTIVE_TOURNAMENT
      );
      setTournament(result.activeTournament);
      
      if (result.activeTournament) {
        const now = Date.now() * 1000; // Convert to microseconds
        const remaining = Math.max(0, result.activeTournament.endTime - now);
        setTimeRemaining(Math.floor(remaining / 1_000_000)); // Convert to seconds
      }
    } catch (err) {
      console.error('Failed to load tournament:', err);
    }
  }, [isConnected]);

  /**
   * Load player's active tournament game from their microchain
   * Uses autoSignerAddress because that's what signs mutations and stores the game
   */
  const loadGame = useCallback(async () => {
    // Use autoSignerAddress for queries - game data is keyed by auto-signer, not user wallet
    const queryAddress = autoSignerAddress || walletAddress;
    if (!isConnected || !queryAddress) return;

    console.log('loadGame: querying with address:', queryAddress, '(autoSigner:', autoSignerAddress, ', wallet:', walletAddress, ')');

    try {
      const result = await lineraAdapter.query<{ playerTournamentGame: ChainReactionGame | null }>(
        GET_PLAYER_TOURNAMENT_GAME,
        { wallet: queryAddress }
      );
      console.log('loadGame result:', result.playerTournamentGame);
      setGame(result.playerTournamentGame);
    } catch (err) {
      console.error('Failed to load tournament game:', err);
    }
  }, [isConnected, walletAddress, autoSignerAddress]);

  /**
   * Load tournament leaderboard from BACKEND INDEXER.
   * 
   * ARCHITECTURE CHANGE:
   * - Previously used cross-chain pattern (failed due to chain ownership)
   * - Now uses backend as read-only indexer
   * - Score is STILL calculated on-chain during gameplay
   * - Backend just aggregates submissions for global view
   * - Verification is always on-chain (replay moves)
   */
  const loadLeaderboard = useCallback(async (limit: number = 100) => {
    if (!tournament) {
      console.log('📊 No tournament loaded yet, skipping leaderboard fetch');
      return;
    }

    try {
      console.log(`📊 Fetching leaderboard for tournament ${tournament.id} from backend...`);
      
      const entries = await backendApi.getTournamentLeaderboard(tournament.id, limit);
      
      console.log(`📊 Received ${entries.length} leaderboard entries`);
      
      // Transform backend entries to match our hook's expected format
      const transformedEntries: TournamentLeaderboardEntry[] = entries.map(entry => ({
        ...entry,
        player: entry.player_address,
        movesUsed: entry.moves_used,
        submittedAt: new Date(entry.submitted_at).getTime(),
      }));
      
      setLeaderboard(transformedEntries);
    } catch (err) {
      console.error('Failed to load leaderboard from backend:', err);
      setLeaderboard([]);
    }
  }, [tournament]);

  /**
   * Load player's tournament stats
   * Uses autoSignerAddress because that's what signs mutations and stores the data
   */
  const loadPlayerStats = useCallback(async () => {
    // Use autoSignerAddress for queries - stats are keyed by auto-signer, not user wallet
    const queryAddress = autoSignerAddress || walletAddress;
    if (!isConnected || !queryAddress) return;

    console.log('loadPlayerStats: querying with address:', queryAddress);

    try {
      const result = await lineraAdapter.query<{ playerTournamentStats: PlayerTournamentStats | null }>(
        GET_PLAYER_TOURNAMENT_STATS,
        { wallet: queryAddress }
      );
      console.log('loadPlayerStats result:', result.playerTournamentStats);
      setPlayerStats(result.playerTournamentStats);
    } catch (err) {
      console.error('Failed to load player stats:', err);
    }
  }, [isConnected, walletAddress, autoSignerAddress]);

  /**
   * Submit tournament entry to backend indexer.
   * 
   * IMPORTANT: This is called AFTER the game completes on-chain.
   * The score has already been calculated and validated by the contract.
   * The backend indexes this for global leaderboard display AND awards XP/coins.
   * Verification can always be done on-chain by replaying the moves.
   * 
   * Returns the player's actual rank in the tournament.
   */
  const submitToBackend = useCallback(async (completedGame: ChainReactionGame): Promise<number> => {
    if (!tournament || !walletAddress) {
      console.log('⚠️ Cannot submit to backend: missing tournament or wallet');
      return 0;
    }

    // Get the chain ID - this is what the user can query to verify on-chain
    const chainId = lineraAdapter.getChainId() || 'unknown';
    
    // Try to get username from backend player profile, fallback to wallet prefix
    let username = walletAddress.slice(0, 8);
    try {
      const player = await backendApi.getPlayer(walletAddress);
      if (player?.username) {
        username = player.username;
      }
    } catch {
      // Ignore - use default username
    }

    // Calculate rewards based on score
    // XP: base 25 + score bonus (1 XP per 10 points, max 50 bonus)
    const xpEarned = Math.min(25 + Math.floor(completedGame.score / 10), 75);
    // Coins: base 20 + score bonus (1 coin per 20 points, max 30 bonus)
    const coinsEarned = Math.min(20 + Math.floor(completedGame.score / 20), 50);

    try {
      console.log('📤 Submitting tournament entry to backend indexer...');
      console.log(`   Player: ${username}, Score: ${completedGame.score}, Moves: ${completedGame.movesUsed}`);
      console.log(`   Rewards: +${xpEarned} XP, +${coinsEarned} coins`);
      
      const result = await backendApi.submitTournamentEntry({
        tournament_id: tournament.id,
        tournament_name: tournament.name,
        player_address: walletAddress.toLowerCase(),
        username,
        chain_id: chainId,
        score: completedGame.score,
        seed: parseInt(completedGame.seed) || 0,  // Convert string seed to number
        moves: completedGame.moveHistory,
        moves_used: completedGame.movesUsed,
        xp_earned: xpEarned,
        coins_earned: coinsEarned,
      });
      
      if (result.rewards_awarded) {
        console.log(`✅ Backend submission result: ${result.message} (+${result.xp_earned} XP, +${result.coins_earned} coins), Rank: #${result.rank}`);
      } else {
        console.log(`✅ Backend submission result: ${result.message}, Rank: #${result.rank}`);
      }
      
      return result.rank || 0;
    } catch (err) {
      // Don't fail the game if backend submission fails
      // The on-chain record is the source of truth
      console.error('⚠️ Failed to submit to backend (non-critical):', err);
      return 0;
    }
  }, [tournament, walletAddress]);

  // =============================================================================
  // MUTATIONS - All on-chain, no backend
  // =============================================================================

  /**
   * Start a new tournament game
   * 
   * MICROCHAIN EXECUTION:
   * - Mutation sent to player's microchain
   * - Block confirmation required before game starts
   * - No optimistic UI - wait for on-chain result
   */
  const startGame = useCallback(async (): Promise<boolean> => {
    if (!isConnected) {
      setError('Not connected to Linera');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🎮 Starting tournament game on-chain...');
      
      // Execute mutation on player's microchain
      await lineraAdapter.mutate(START_TOURNAMENT_GAME);
      
      console.log('✅ Tournament game started on-chain');
      
      // Wait for block confirmation - Linera needs time to propagate
      // Retry loading game state until it appears (max 5 attempts)
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        // Use autoSignerAddress for queries - game data is keyed by auto-signer, not user wallet
        const queryAddress = autoSignerAddress || walletAddress;
        console.log(`🔄 Loading game state (attempt ${attempts}/${maxAttempts}), address: ${queryAddress}...`);
        
        const result = await lineraAdapter.query<{ playerTournamentGame: ChainReactionGame | null }>(
          GET_PLAYER_TOURNAMENT_GAME,
          { wallet: queryAddress }
        );
        
        if (result.playerTournamentGame) {
          console.log('✅ Game loaded successfully!');
          setGame(result.playerTournamentGame);
          await loadTournament();
          return true;
        }
        
        console.log('⏳ Game not ready yet, retrying...');
      }
      
      // Final attempt - load all state
      await loadGame();
      await loadTournament();
      
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start game';
      setError(message);
      console.error('❌ Failed to start tournament game:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, walletAddress, autoSignerAddress, loadGame, loadTournament]);

  /**
   * Make a move in the tournament game
   * 
   * CRITICAL: Each move is recorded on-chain
   * The chain reaction is computed ENTIRELY on-chain
   * Frontend only displays the result
   * 
   * @param position Grid position (0-35)
   */
  const makeMove = useCallback(async (position: number): Promise<TournamentMoveResult | null> => {
    if (!isConnected || !game) {
      setError('No active game');
      return null;
    }

    if (position < 0 || position >= 36) {
      setError('Invalid grid position');
      return null;
    }

    setIsProcessingMove(true);
    setError(null);

    try {
      console.log(`🎯 Making tournament move: position ${position}`);
      console.log('📡 This move will be recorded on-chain...');
      
      // Execute mutation on player's microchain
      // The contract computes the entire chain reaction
      await lineraAdapter.mutate(TOURNAMENT_MOVE, { position });
      
      console.log('✅ Move confirmed on-chain');
      
      // Wait for state propagation
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Query updated game state (state diff pattern)
      // Use autoSignerAddress - game data is keyed by auto-signer, not user wallet
      const queryAddress = autoSignerAddress || walletAddress;
      const result = await lineraAdapter.query<{ playerTournamentGame: ChainReactionGame | null }>(
        GET_PLAYER_TOURNAMENT_GAME,
        { wallet: queryAddress }
      );
      
      if (result.playerTournamentGame) {
        const newGame = result.playerTournamentGame;
        
        // If game ended, submit to backend indexer and get rank
        let playerRank = 0;
        if (newGame.status !== 'IN_PROGRESS') {
          // Submit to backend FIRST and get the actual rank
          playerRank = await submitToBackend(newGame);
          // Set game with the actual rank
          setGame({ ...newGame, rank: playerRank });
          // Then reload leaderboard from backend
          await loadLeaderboard();
          await loadPlayerStats();
        } else {
          setGame(newGame);
        }
        
        return {
          success: true,
          grid: newGame.grid,
          score: newGame.score,
          cellsCleared: newGame.cellsCleared,
          chainLength: newGame.currentChain,
          movesRemaining: newGame.maxMoves - newGame.movesUsed,
          status: newGame.status,
          rank: playerRank > 0 ? playerRank : undefined,
          // XP/coins are SECONDARY rewards
          xpEarned: newGame.status !== 'IN_PROGRESS' ? 50 : undefined, // Capped
          coinsEarned: newGame.status !== 'IN_PROGRESS' ? 30 : undefined, // Capped
        };
      }
      
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to make move';
      setError(message);
      console.error('❌ Failed to make tournament move:', err);
      return null;
    } finally {
      setIsProcessingMove(false);
    }
  }, [isConnected, game, walletAddress, autoSignerAddress, submitToBackend, loadLeaderboard, loadPlayerStats]);

  /**
   * Forfeit the current game
   */
  const forfeitGame = useCallback(async (): Promise<boolean> => {
    if (!isConnected || !game) {
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      await lineraAdapter.mutate(FORFEIT_TOURNAMENT_GAME);
      await loadGame();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to forfeit');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, game, loadGame]);

  /**
  /**
   * Verify any tournament entry
   * 
   * PUBLIC VERIFICATION: Any Linera community member can verify any entry
   * "Any top score can be publicly verified by replaying the moves."
   */
  const verifyGame = useCallback(async (
    seed: string,
    moves: number[]
  ): Promise<GameVerificationResult | null> => {
    if (!isConnected) return null;

    try {
      const result = await lineraAdapter.query<{ verifyTournamentGame: GameVerificationResult }>(
        VERIFY_TOURNAMENT_GAME,
        { seed, moves }
      );
      return result.verifyTournamentGame;
    } catch (err) {
      console.error('Failed to verify game:', err);
      return null;
    }
  }, [isConnected]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Initial load - load tournament first
  useEffect(() => {
    if (isConnected) {
      loadTournament();
    }
  }, [isConnected, loadTournament]);

  // Load leaderboard after tournament is loaded (needs tournament.id)
  useEffect(() => {
    if (isConnected && tournament) {
      loadLeaderboard();
    }
  }, [isConnected, tournament, loadLeaderboard]);

  // Load player-specific data when wallet or auto-signer available
  useEffect(() => {
    // Need either autoSignerAddress (preferred) or walletAddress to query player data
    if (isConnected && (autoSignerAddress || walletAddress)) {
      loadGame();
      loadPlayerStats();
    }
  }, [isConnected, walletAddress, autoSignerAddress, loadGame, loadPlayerStats]);

  // AUTO-SYNC: If player has a completed game on-chain but not in backend, sync it
  // This handles scores that were recorded before the backend indexer was implemented
  useEffect(() => {
    const syncExistingGame = async () => {
      // Need game, tournament, and wallet to sync
      if (!game || !tournament || !walletAddress) return;
      
      // Only sync completed games
      if (game.status === 'IN_PROGRESS') return;
      
      // Check if this game is already in the backend
      try {
        const existingEntry = await backendApi.getPlayerTournamentEntry(tournament.id, walletAddress);
        
        if (!existingEntry) {
          console.log('🔄 Auto-syncing existing on-chain game to backend...');
          await submitToBackend(game);
          // Reload leaderboard to show the new entry
          await loadLeaderboard();
        }
      } catch (err) {
        // If 404 (not found), submit the game
        console.log('🔄 No backend entry found, syncing on-chain game...');
        await submitToBackend(game);
        await loadLeaderboard();
      }
    };

    syncExistingGame();
  }, [game, tournament, walletAddress, submitToBackend, loadLeaderboard]);

  // Time remaining countdown
  useEffect(() => {
    if (timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // State
    tournament,
    game,
    leaderboard,
    playerStats,
    isLoading,
    isProcessingMove,
    error,
    timeRemaining,
    isConnected,

    // Computed - tournament auto-creates on first game start
    isGameActive: game?.status === 'IN_PROGRESS',
    // Tournament is active if it exists and has time, OR if no tournament exists (will auto-create)
    isTournamentActive: tournament === null || (tournament !== null && timeRemaining > 0),
    // Allow starting game even if no tournament - it auto-creates on-chain
    canStartGame: !game || game.status !== 'IN_PROGRESS',
    playerRank: playerStats?.bestRank ?? null,

    // Actions
    startGame,
    makeMove,
    forfeitGame,
    verifyGame,
    refresh: useCallback(async () => {
      await Promise.all([
        loadTournament(),
        loadGame(),
        loadLeaderboard(),
        loadPlayerStats(),
      ]);
    }, [loadTournament, loadGame, loadLeaderboard, loadPlayerStats]),
  };
}
