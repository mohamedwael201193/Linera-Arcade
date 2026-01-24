/**
 * Tournament On-Chain Games Page
 * 
 * 🟣 TOURNAMENT ON-CHAIN GAMES
 * 
 * This page is designed FIRST for:
 * - Weekly Linera community challenges
 * - Competitive tournaments
 * - On-chain verification
 * - Leaderboards as a CORE feature
 * 
 * "I am entering a competitive on-chain arena, not a casual mini-game."
 */

import { useState, useEffect } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useTournament, TournamentLeaderboardEntry } from '../hooks/useTournament';

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Tournament Banner - Shows time remaining and tournament info
 */
function TournamentBanner({ 
  tournament, 
  timeRemaining 
}: { 
  tournament: { name: string; seed: string; topScore: number; topScorer: string; isActive?: boolean } | null;
  timeRemaining: number;
}) {
  if (!tournament) {
    return (
      <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 rounded-xl p-6 border border-purple-500/30">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 bg-green-500/30 rounded text-green-300 text-xs font-bold">
                NEW
              </span>
              <span className="text-purple-400 text-sm">30-DAY TOURNAMENT</span>
            </div>
            <h2 className="text-3xl font-bold text-white">🏆 Chain Reaction Challenge</h2>
            <p className="text-gray-400 mt-1">
              Start your first game to begin the tournament!
            </p>
          </div>
          <div className="text-right">
            <div className="text-gray-400 mb-2">Duration</div>
            <div className="text-2xl font-bold text-white">30 Days</div>
            <p className="text-sm text-gray-400 mt-1">Auto-creates on first game</p>
          </div>
        </div>
      </div>
    );
  }

  const isEnded = timeRemaining <= 0;
  const days = Math.floor(timeRemaining / 86400);
  const hours = Math.floor((timeRemaining % 86400) / 3600);
  const minutes = Math.floor((timeRemaining % 3600) / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className={`rounded-xl p-6 border ${isEnded 
      ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-600' 
      : 'bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-purple-500/30'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {isEnded ? (
              <>
                <span className="px-2 py-1 bg-gray-600/50 rounded text-gray-300 text-xs font-bold">
                  ENDED
                </span>
                <span className="text-gray-400 text-sm">TOURNAMENT COMPLETE</span>
              </>
            ) : (
              <>
                <span className="px-2 py-1 bg-purple-500/30 rounded text-purple-300 text-xs font-bold">
                  LIVE
                </span>
                <span className="text-purple-400 text-sm">TOURNAMENT</span>
              </>
            )}
          </div>
          <h2 className="text-3xl font-bold text-white">{tournament.name}</h2>
          <p className="text-gray-400 mt-1">
            Fixed Seed: <code className="text-purple-300">{tournament.seed}</code>
          </p>
        </div>

        <div className="text-right">
          {isEnded ? (
            <div className="bg-black/30 rounded px-4 py-3">
              <p className="text-gray-400 text-sm mb-1">FINAL RESULTS</p>
              <p className="text-xl font-bold text-white">Competition Closed</p>
            </div>
          ) : (
            <>
              <p className="text-gray-400 text-sm mb-1">TIME REMAINING</p>
              <div className="flex gap-2 text-center">
                {days > 0 && (
                  <div className="bg-black/30 rounded px-3 py-2">
                    <div className="text-2xl font-bold text-white">{days}</div>
                    <div className="text-xs text-gray-500">DAYS</div>
                  </div>
                )}
                <div className="bg-black/30 rounded px-3 py-2">
                  <div className="text-2xl font-bold text-white">{hours.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">HRS</div>
                </div>
                <div className="bg-black/30 rounded px-3 py-2">
                  <div className="text-2xl font-bold text-white">{minutes.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">MIN</div>
                </div>
                <div className="bg-black/30 rounded px-3 py-2">
                  <div className="text-2xl font-bold text-white">{seconds.toString().padStart(2, '0')}</div>
                  <div className="text-xs text-gray-500">SEC</div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Current Leader */}
      {tournament.topScore > 0 && (
        <div className="mt-4 pt-4 border-t border-purple-500/20">
          <div className="flex justify-between items-center">
            <span className="text-gray-400">{isEnded ? '🏆 Winner' : '🏆 Current Leader'}</span>
            <span className="text-white font-bold">
              {tournament.topScorer} - <span className="text-yellow-400">{tournament.topScore.toLocaleString()} pts</span>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * On-Chain Indicator - Shows that actions are recorded on blockchain
 */
function OnChainIndicator({ seed, isProcessing }: { seed?: string; isProcessing?: boolean }) {
  return (
    <div className="bg-black/40 rounded-lg p-3 border border-green-500/30">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${isProcessing ? 'bg-yellow-400 animate-pulse' : 'bg-green-400'}`} />
        <span className="text-green-400 text-sm font-mono">
          {isProcessing ? 'RECORDING ON-CHAIN...' : 'VERIFIED ON-CHAIN'}
        </span>
      </div>
      {seed && (
        <p className="text-xs text-gray-500 mt-1 font-mono">
          Seed: {seed} (verifiable by anyone)
        </p>
      )}
    </div>
  );
}

/**
 * Chain Reaction Grid Component
 */
function ChainReactionGrid({ 
  grid, 
  onCellClick, 
  disabled 
}: { 
  grid: number[];
  onCellClick: (position: number) => void;
  disabled: boolean;
}) {
  const getEnergyColor = (energy: number) => {
    switch (energy) {
      case 0: return 'bg-gray-800 hover:bg-gray-700';
      case 1: return 'bg-blue-600 hover:bg-blue-500';
      case 2: return 'bg-yellow-500 hover:bg-yellow-400';
      case 3: return 'bg-orange-500 hover:bg-orange-400 animate-pulse';
      default: return 'bg-red-500 animate-ping'; // Shouldn't happen
    }
  };

  return (
    <div className="grid grid-cols-6 gap-2 max-w-md mx-auto">
      {grid.map((energy, index) => (
        <button
          key={index}
          onClick={() => onCellClick(index)}
          disabled={disabled || energy >= 4}
          className={`
            w-12 h-12 sm:w-14 sm:h-14 rounded-lg
            ${getEnergyColor(energy)}
            flex items-center justify-center
            text-white font-bold text-xl
            transition-all duration-200
            hover:scale-105 hover:brightness-110
            disabled:opacity-50 disabled:cursor-not-allowed
            border border-white/10
          `}
        >
          {energy > 0 && energy}
        </button>
      ))}
    </div>
  );
}

/**
 * Score Header - Shows current game stats
 */
function ScoreHeader({ 
  score, 
  movesUsed, 
  maxMoves, 
  bestChain, 
  currentChain 
}: { 
  score: number;
  movesUsed: number;
  maxMoves: number;
  bestChain: number;
  currentChain: number;
}) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-black/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-white">{score.toLocaleString()}</div>
        <div className="text-xs text-gray-500">SCORE</div>
      </div>
      <div className="bg-black/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-white">{maxMoves - movesUsed}</div>
        <div className="text-xs text-gray-500">MOVES LEFT</div>
      </div>
      <div className="bg-black/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-yellow-400">{bestChain}</div>
        <div className="text-xs text-gray-500">BEST CHAIN</div>
      </div>
      <div className="bg-black/30 rounded-lg p-3 text-center">
        <div className="text-2xl font-bold text-purple-400">{currentChain}</div>
        <div className="text-xs text-gray-500">LAST CHAIN</div>
      </div>
    </div>
  );
}

/**
 * Leaderboard Table
 */
function LeaderboardTable({ 
  entries, 
  currentWallet,
  onVerify
}: { 
  entries: TournamentLeaderboardEntry[];
  currentWallet?: string;
  onVerify: (seed: string, moves: number[]) => void;
}) {
  return (
    <div className="bg-gray-900/50 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-black/40 text-gray-400 text-sm">
              <th className="px-4 py-3 text-left">RANK</th>
              <th className="px-4 py-3 text-left">PLAYER</th>
              <th className="px-4 py-3 text-right">SCORE</th>
              <th className="px-4 py-3 text-right">CHAIN</th>
              <th className="px-4 py-3 text-right">MOVES</th>
              <th className="px-4 py-3 text-center">VERIFY</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No submissions yet. Be the first to compete!
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const playerAddress = entry.player || entry.player_address;
                const isCurrentUser = playerAddress?.toLowerCase() === currentWallet?.toLowerCase();
                const rankDisplay = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
                const movesUsed = entry.movesUsed ?? entry.moves_used;
                const submittedAt = entry.submittedAt ?? (entry.submitted_at ? new Date(entry.submitted_at).getTime() : 0);
                
                return (
                  <tr 
                    key={`${playerAddress}-${submittedAt}`}
                    className={`border-t border-gray-800 ${isCurrentUser ? 'bg-purple-900/30' : 'hover:bg-gray-800/50'}`}
                  >
                    <td className="px-4 py-3">
                      <span className={entry.rank <= 3 ? 'text-2xl' : 'text-gray-400'}>
                        {rankDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${isCurrentUser ? 'text-purple-300' : 'text-white'}`}>
                          {entry.username}
                        </span>
                        {isCurrentUser && (
                          <span className="px-1.5 py-0.5 bg-purple-500/30 rounded text-purple-300 text-xs">
                            YOU
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-yellow-400">
                      {entry.score.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      x{entry.bestChain ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-400">
                      {movesUsed}/10
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onVerify(String(entry.seed), entry.moves)}
                        className="text-green-400 hover:text-green-300 text-sm underline"
                        title="Verify this score by replaying moves"
                      >
                        ✓ Verify
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Game Over Modal - RANK is PRIMARY reward
 */
function GameOverModal({ 
  game, 
  playerStats,
  onPlayAgain, 
  onViewLeaderboard 
}: { 
  game: { score: number; bestChain: number; status: string; rank?: number };
  playerStats: { bestRank: number } | null;
  onPlayAgain: () => void;
  onViewLeaderboard: () => void;
}) {
  const isPerfectClear = game.status === 'PERFECT_CLEAR';
  const rank = game.rank || playerStats?.bestRank || 0;
  
  // Calculate rank-based coins (same logic as contract)
  // Note: Actual rewards are minimal - rank is the primary reward
  const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank <= 10 ? '🏅' : '🎮';
  const isTopThree = rank >= 1 && rank <= 3;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl p-8 max-w-md w-full border border-purple-500/30">
        <div className="text-center">
          <div className="text-6xl mb-4">{isPerfectClear ? '🎯' : rankEmoji}</div>
          <h2 className="text-3xl font-bold text-white mb-2">
            {isPerfectClear ? 'PERFECT CLEAR!' : isTopThree ? '🎉 PODIUM FINISH!' : 'GAME OVER'}
          </h2>
          
          {/* RANK - PRIMARY DISPLAY */}
          <div className={`bg-gradient-to-r ${isTopThree ? 'from-yellow-900/50 to-amber-900/50 border-yellow-500/30' : 'from-purple-900/50 to-indigo-900/50 border-purple-500/30'} rounded-xl p-6 my-6 border`}>
            <div className="text-sm text-gray-400 mb-2">YOUR RANK</div>
            <div className={`text-5xl font-bold mb-2 ${isTopThree ? 'text-yellow-400' : 'text-purple-400'}`}>
              #{rank || '-'}
            </div>
            <div className="text-gray-400 text-sm">
              Score: <span className="text-white font-bold">{game.score.toLocaleString()}</span>
              {' • '}
              Best Chain: <span className="text-cyan-400 font-bold">x{game.bestChain}</span>
            </div>
          </div>
          
          {/* PARTICIPATION REWARDS - Minimal */}
          <div className="bg-black/40 rounded-lg p-4 mb-6">
            <div className="text-xs text-gray-500 mb-2">PARTICIPATION REWARDS</div>
            <div className="flex justify-center gap-6">
              <div>
                <span className="text-yellow-400 font-bold text-lg">+20</span>
                <span className="text-gray-500 text-sm ml-1">coins</span>
              </div>
              <div>
                <span className="text-green-400 font-bold text-lg">+25</span>
                <span className="text-gray-500 text-sm ml-1">XP</span>
              </div>
            </div>
            <div className="text-xs text-gray-600 mt-2">
              🏆 RANK is your primary reward - climb the leaderboard!
            </div>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={onPlayAgain}
              className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              PLAY AGAIN
            </button>
            <button
              onClick={onViewLeaderboard}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              LEADERBOARD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN PAGE COMPONENT
// =============================================================================

export default function TournamentPage() {
  const { primaryWallet } = useDynamicContext();
  const {
    tournament,
    game,
    leaderboard,
    playerStats,
    isLoading,
    isProcessingMove,
    error,
    timeRemaining,
    isGameActive,
    isTournamentActive,
    canStartGame,
    startGame,
    makeMove,
    forfeitGame,
    verifyGame,
    refresh,
  } = useTournament();

  const [view, setView] = useState<'play' | 'leaderboard'>('play');
  const [showGameOver, setShowGameOver] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{ valid: boolean; score: number; message: string } | null>(null);

  // Handle game over
  useEffect(() => {
    if (game && game.status !== 'IN_PROGRESS') {
      setShowGameOver(true);
    }
  }, [game?.status]);

  const handleCellClick = async (position: number) => {
    if (!isGameActive || isProcessingMove) return;
    
    const result = await makeMove(position);
    if (result && result.status !== 'IN_PROGRESS') {
      setShowGameOver(true);
    }
  };

  const handleStartGame = async () => {
    setShowGameOver(false);
    await startGame();
  };

  const handleVerify = async (seed: string, moves: number[]) => {
    const result = await verifyGame(seed, moves);
    if (result) {
      setVerificationResult({
        valid: result.valid,
        score: result.computedScore,
        message: result.message,
      });
      setTimeout(() => setVerificationResult(null), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400">🟣</span>
            <span className="text-purple-400 font-mono text-sm">TOURNAMENT ON-CHAIN GAMES</span>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Chain Reaction</h1>
          <p className="text-gray-400">
            Every move recorded on-chain. Every score verifiable. Powered by Linera.
          </p>
        </div>

        {/* Tournament Banner - auto-created on first game start */}
        <div className="mb-8">
          <TournamentBanner tournament={tournament} timeRemaining={timeRemaining} />
        </div>

        {/* Verification Result Toast */}
        {verificationResult && (
          <div className={`fixed top-4 right-4 p-4 rounded-lg border z-50 ${
            verificationResult.valid 
              ? 'bg-green-900/90 border-green-500' 
              : 'bg-red-900/90 border-red-500'
          }`}>
            <div className="flex items-center gap-2">
              <span>{verificationResult.valid ? '✓' : '✗'}</span>
              <span className="font-bold">{verificationResult.valid ? 'Verified!' : 'Invalid'}</span>
            </div>
            <p className="text-sm text-gray-300 mt-1">{verificationResult.message}</p>
            {verificationResult.valid && (
              <p className="text-sm text-gray-300">Score: {verificationResult.score.toLocaleString()}</p>
            )}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView('play')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              view === 'play'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🎮 PLAY
          </button>
          <button
            onClick={() => setView('leaderboard')}
            className={`px-6 py-3 rounded-lg font-bold transition-colors ${
              view === 'leaderboard'
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            🏆 LEADERBOARD
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500/50 rounded-lg p-4 mb-6">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Main Content */}
        {view === 'play' ? (
          <div className="space-y-6">
            {/* Player Prestige Card - RANK IS PRIMARY */}
            {playerStats && (
              <div className="bg-gradient-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-5 border border-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">Your Tournament Profile</h3>
                </div>
                
                <div className="grid grid-cols-3 gap-3">
                  {/* Global Rank - PRIMARY */}
                  <div className="bg-black/30 rounded-lg p-3 text-center border border-purple-500/20">
                    <div className="text-2xl font-bold text-purple-400">#{playerStats.bestRank || '-'}</div>
                    <div className="text-xs text-gray-500">CURRENT RANK</div>
                  </div>
                  {/* Best Score */}
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">{playerStats.bestScore.toLocaleString()}</div>
                    <div className="text-xs text-gray-500">BEST SCORE</div>
                  </div>
                  {/* Attempts */}
                  <div className="bg-black/30 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-white">{playerStats.attempts}</div>
                    <div className="text-xs text-gray-500">ATTEMPTS</div>
                  </div>
                </div>
              </div>
            )}

            {/* Game Area */}
            <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
              {!primaryWallet ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg mb-4">Connect your wallet to compete</p>
                  <p className="text-gray-600 text-sm">Your score will be verified on your Linera microchain</p>
                </div>
              ) : !isTournamentActive ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">🏁 Tournament Ended</p>
                  <p className="text-gray-600 text-sm mt-2">
                    The competition has closed. View the final standings on the Leaderboard!
                  </p>
                  <button
                    onClick={() => setView('leaderboard')}
                    className="mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                  >
                    View Final Leaderboard
                  </button>
                </div>
              ) : !isGameActive && canStartGame ? (
                <div className="text-center py-12">
                  <h3 className="text-2xl font-bold text-white mb-4">Ready to Compete?</h3>
                  <p className="text-gray-400 mb-6">
                    This week's grid is the same for everyone.<br />
                    Every move will be recorded on your Linera microchain.
                  </p>
                  <button
                    onClick={handleStartGame}
                    disabled={isLoading}
                    className="bg-purple-600 hover:bg-purple-500 disabled:bg-gray-600 text-white font-bold py-4 px-8 rounded-lg text-xl transition-colors"
                  >
                    {isLoading ? 'STARTING...' : '▶ START TOURNAMENT GAME'}
                  </button>
                  <p className="text-gray-600 text-xs mt-4">
                    10 moves • Same seed as everyone • Verifiable on-chain
                  </p>
                </div>
              ) : game ? (
                <div>
                  {/* Score Header */}
                  <ScoreHeader
                    score={game.score}
                    movesUsed={game.movesUsed}
                    maxMoves={game.maxMoves}
                    bestChain={game.bestChain}
                    currentChain={game.currentChain}
                  />

                  {/* Grid */}
                  <ChainReactionGrid
                    grid={game.grid}
                    onCellClick={handleCellClick}
                    disabled={!isGameActive || isProcessingMove}
                  />

                  {/* On-Chain Indicator */}
                  <div className="mt-6">
                    <OnChainIndicator 
                      seed={game.seed} 
                      isProcessing={isProcessingMove} 
                    />
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 text-center text-sm text-gray-500">
                    Click any cell to place energy. Cells explode at 4 → chain reaction!
                  </div>

                  {/* Forfeit Button */}
                  <div className="mt-6 text-center">
                    <button
                      onClick={forfeitGame}
                      className="text-red-400 hover:text-red-300 text-sm underline"
                    >
                      Forfeit Game
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-400">Loading game state...</p>
                </div>
              )}
            </div>

            {/* How to Play */}
            <div className="bg-gray-900/30 rounded-xl p-6 border border-gray-800">
              <h3 className="text-lg font-bold text-white mb-4">How to Play</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="text-blue-400 font-bold mb-2">1. Place Energy</div>
                  <p className="text-gray-400">Click any cell to add +1 energy. Each click is recorded on-chain.</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="text-yellow-400 font-bold mb-2">2. Chain Reaction</div>
                  <p className="text-gray-400">When a cell reaches 4 energy, it explodes and spreads to adjacent cells.</p>
                </div>
                <div className="bg-black/30 rounded-lg p-4">
                  <div className="text-green-400 font-bold mb-2">3. Score Points</div>
                  <p className="text-gray-400">Score = cells cleared × chain length × 10. Clear the grid for bonus!</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Leaderboard View */
          <div className="space-y-6">
            <LeaderboardTable 
              entries={leaderboard} 
              currentWallet={primaryWallet?.address}
              onVerify={handleVerify}
            />
            
            {/* Verification Info */}
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <span>✓</span>
                <span className="font-bold">Public Verification</span>
              </div>
              <p className="text-sm text-gray-400">
                Any Linera community member can verify any score by clicking "Verify". 
                The game will be replayed from the seed using the recorded moves to confirm the final score.
              </p>
            </div>
          </div>
        )}

        {/* Game Over Modal */}
        {showGameOver && game && game.status !== 'IN_PROGRESS' && (
          <GameOverModal
            game={game}
            playerStats={playerStats}
            onPlayAgain={() => {
              setShowGameOver(false);
              handleStartGame();
            }}
            onViewLeaderboard={() => {
              setShowGameOver(false);
              setView('leaderboard');
              refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
