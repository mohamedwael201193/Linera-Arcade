/**
 * Quick Math - On-Chain Multiplayer Version (CROSS-CHAIN PATTERN)
 * 
 * Race to solve math problems! First to answer correctly wins the round.
 * 
 * MATCHES TicTacToeOnChain.tsx exactly in:
 * - Player identity detection (chain ID primary, wallet fallback)
 * - Status/player normalization
 * - Rewards claiming flow
 * - Debug logging
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Trophy, Loader2, Calculator, Zap, Check, X } from 'lucide-react';
import { 
  MultiplayerGameRoom, 
  multiplayerPolling,
  getMultiplayerRoom,
  makeMove,
  forfeitGame,
  normalizePlayer,
  normalizeStatus,
  isStatusWaitingForPlayer,
  claimMultiplayerRewards,
} from '../../lib/multiplayer/onchain';
import { useLineraConnection } from '../../hooks/useLineraConnection';

interface Props {
  onLeave: () => void;
}

export function QuickMathOnChain({ onLeave }: Props) {
  const { chainId, walletAddress } = useLineraConnection();
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [lastRound, setLastRound] = useState(0);
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Rewards state
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{ xp: number; coins: number } | null>(null);

  // Player identity
  const getMyIndex = (): number => {
    if (!room) return -1;
    if (chainId && room.playerChainIds) {
      const chainIndex = room.playerChainIds.findIndex(id => 
        id && id.toLowerCase() === chainId.toLowerCase()
      );
      if (chainIndex !== -1) return chainIndex;
    }
    if (walletAddress && room.players) {
      const walletLower = walletAddress.toLowerCase();
      const playerIndex = room.players.findIndex(p => 
        p && (p.toLowerCase() === walletLower || p.toLowerCase() === `user:${walletLower}` || p.toLowerCase().includes(walletLower))
      );
      if (playerIndex !== -1) return playerIndex;
    }
    return -1;
  };
  
  const myIndex = getMyIndex();
  const myPlayerNum = myIndex === 0 ? 'One' : 'Two';
  const normalizedStatus = room?.status ? normalizeStatus(room.status) : null;
  const mathState = room?.quickMathState;
  
  // Clear answer and focus when new round starts
  useEffect(() => {
    if (mathState && mathState.round !== lastRound) {
      setUserAnswer('');
      setLastRound(mathState.round);
      setShowCorrect(false);
      setShowWrong(false);
      // Focus input for quick typing
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mathState?.round, lastRound]);

  // Debug logging
  useEffect(() => {
    if (room) {
      console.log('🧮 QuickMath Debug:', {
        myIndex,
        status: room.status,
        mathState: room.quickMathState,
        currentProblem: room.quickMathState?.currentProblem,
      });
    }
  }, [room, myIndex]);

  // Start polling
  useEffect(() => {
    multiplayerPolling.startPolling((roomData, err) => {
      setIsLoading(false);
      if (err) {
        setError(err.message);
      } else {
        setRoom(roomData);
        setError(null);
        const status = roomData?.status ? normalizeStatus(roomData.status) : null;
        if (status === 'Finished' || status === 'Draw') {
          multiplayerPolling.setInterval(5000);
        }
      }
    }, 300); // Fast polling for competitive game

    return () => multiplayerPolling.stopPolling();
  }, []);

  // Handle answer submission
  const handleSubmitAnswer = useCallback(async () => {
    if (!userAnswer.trim() || isSubmitting) return;
    if (normalizedStatus !== 'InProgress') return;

    const answer = parseInt(userAnswer, 10);
    if (isNaN(answer)) return;

    setIsSubmitting(true);
    try {
      await makeMove({ answer });
      const updated = await getMultiplayerRoom();
      setRoom(updated);
      
      // Show feedback
      if (updated?.quickMathState?.roundWinner) {
        const winnerNum = normalizePlayer(updated.quickMathState.roundWinner);
        if (winnerNum === myPlayerNum) {
          setShowCorrect(true);
          setTimeout(() => setShowCorrect(false), 1500);
        }
      }
      setUserAnswer('');
    } catch (err) {
      setShowWrong(true);
      setTimeout(() => setShowWrong(false), 1500);
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }, [userAnswer, isSubmitting, normalizedStatus, myPlayerNum]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmitAnswer();
  };

  const handleForfeit = useCallback(async () => {
    try {
      await forfeitGame();
      const updated = await getMultiplayerRoom();
      setRoom(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Game results (moved before handleClaimRewards)
  const isFinished = normalizedStatus === 'Finished' || normalizedStatus === 'Draw';
  const isDraw = normalizedStatus === 'Draw';
  const winner = normalizePlayer(room?.winner ?? null);
  const iWon = winner === myPlayerNum;
  const myScore = myIndex >= 0 ? (mathState?.scores?.[myIndex] ?? 0) : 0;
  const opponentScore = myIndex >= 0 ? (mathState?.scores?.[myIndex === 0 ? 1 : 0] ?? 0) : 0;

  const handleClaimRewards = useCallback(async () => {
    if (isClaiming || rewardsClaimed || !room) return;
    setIsClaiming(true);
    try {
      const result = await claimMultiplayerRewards(
        iWon,
        isDraw,
        'QuickMath',
        room.usernames[myIndex === 0 ? 1 : 0],
        room.hostChainId
      );
      setClaimedRewards(result);
      setRewardsClaimed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsClaiming(false);
    }
  }, [isClaiming, rewardsClaimed, room, iWon, isDraw, myIndex]);

  if (isLoading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
        <span className="text-gray-400">Loading Quick Math...</span>
      </div>
    );
  }

  if (error && !room) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-6 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={onLeave} className="text-gray-400 hover:text-white underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 text-center">
          <p className="text-yellow-400 mb-4">Room not found.</p>
          <button onClick={onLeave} className="text-gray-400 hover:text-white underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLeave}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </motion.button>
        <div className="flex items-center gap-2">
          <Calculator className="w-5 h-5 text-cyan-500" />
          <span className="font-arcade text-cyan-500 text-sm">QUICK MATH</span>
        </div>
      </div>

      {/* Waiting for opponent */}
      {isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card border border-cyan-500/30 rounded-xl p-8 text-center"
        >
          <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-white font-medium text-lg mb-2">Waiting for opponent...</p>
          <p className="text-gray-400 text-sm">Share your Host Chain ID to invite a friend!</p>
        </motion.div>
      )}

      {/* Game in Progress */}
      {normalizedStatus === 'InProgress' && (
        <>
          {/* Score Board */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {room.players.map((_player, index) => {
              const score = mathState?.scores?.[index] ?? 0;
              const isMe = index === myIndex;
              const isWinning = score > (mathState?.scores?.[index === 0 ? 1 : 0] ?? 0);
              return (
                <motion.div
                  key={`player-${index}`}
                  animate={{ scale: isWinning && !isMe ? 0.98 : 1 }}
                  className={`p-4 rounded-xl text-center transition-all ${
                    isMe 
                      ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30 border-2 border-cyan-500' 
                      : 'bg-dark-card border border-dark-border'
                  }`}
                >
                  <p className={`text-sm font-medium mb-2 ${isMe ? 'text-cyan-400' : 'text-gray-400'}`}>
                    {room.usernames[index] || `Player ${index + 1}`}
                    {isMe && ' (You)'}
                  </p>
                  <p className={`text-4xl font-arcade ${isMe ? 'text-cyan-400' : 'text-white'}`}>
                    {score}
                  </p>
                </motion.div>
              );
            })}
          </div>

          {/* Round Progress */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 bg-dark-card px-4 py-2 rounded-full">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="text-gray-400 text-sm">
                Round <span className="text-white font-bold">{mathState?.round || 0}</span> / {mathState?.totalRounds || 10}
              </span>
            </div>
          </div>

          {/* Problem Card */}
          <motion.div
            key={mathState?.currentProblem || 'no-problem'}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative bg-gradient-to-br from-dark-card to-dark-bg border-2 border-cyan-500/50 rounded-2xl p-8 mb-6"
          >
            {mathState?.currentProblem && mathState.currentProblem.trim() !== '' ? (
              <>
                <p className="text-6xl font-arcade text-white text-center mb-8">
                  {mathState.currentProblem}
                </p>
                
                <div className="flex gap-3">
                  <input
                    ref={inputRef}
                    type="number"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="?"
                    autoFocus
                    className="flex-1 bg-dark-bg border-2 border-cyan-500/30 rounded-xl px-6 py-4 text-white text-2xl text-center font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmitAnswer}
                    disabled={isSubmitting || !userAnswer.trim()}
                    className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-arcade text-lg rounded-xl disabled:opacity-50 transition-all"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      'GO!'
                    )}
                  </motion.button>
                </div>

                {/* Feedback */}
                <AnimatePresence>
                  {showCorrect && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded-2xl"
                    >
                      <Check className="w-20 h-20 text-green-500" />
                    </motion.div>
                  )}
                  {showWrong && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="absolute inset-0 flex items-center justify-center bg-red-500/20 rounded-2xl"
                    >
                      <X className="w-20 h-20 text-red-500" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="text-center py-8">
                <Loader2 className="w-16 h-16 text-cyan-500 animate-spin mx-auto mb-4" />
                <p className="text-gray-400 font-medium mb-2">Loading problem from chain...</p>
                <p className="text-gray-500 text-sm">
                  The next problem will appear shortly.
                </p>
              </div>
            )}
            
            {/* Round winner feedback */}
            {mathState?.roundWinner && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mt-4 text-sm text-gray-400"
              >
                {normalizePlayer(mathState.roundWinner) === myPlayerNum 
                  ? '✅ You got it!' 
                  : `${room.usernames[normalizePlayer(mathState.roundWinner) === 'One' ? 0 : 1]} got it!`}
              </motion.p>
            )}
          </motion.div>

          {/* Forfeit */}
          <div className="text-center">
            <button onClick={handleForfeit} className="text-gray-500 hover:text-red-400 text-sm underline">
              Forfeit game
            </button>
          </div>
        </>
      )}

      {/* Game Over */}
      {isFinished && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          {isDraw ? (
            <div className="mb-6">
              <p className="font-arcade text-4xl text-yellow-500 mb-2">IT'S A TIE!</p>
              <p className="text-gray-400">Final Score: {myScore} - {opponentScore}</p>
            </div>
          ) : (
            <div className="mb-6">
              <Trophy className={`w-20 h-20 mx-auto mb-4 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
              <p className={`font-arcade text-4xl mb-2 ${iWon ? 'text-green-400' : 'text-red-400'}`}>
                {iWon ? 'YOU WIN!' : 'YOU LOSE!'}
              </p>
              <p className="text-gray-400 text-lg">Final Score: {myScore} - {opponentScore}</p>
            </div>
          )}

          {/* Claim Rewards */}
          <div className="my-6 p-6 bg-dark-card rounded-xl border border-cyan-500/30">
            {rewardsClaimed && claimedRewards ? (
              <div className="text-center">
                <p className="text-green-400 font-medium text-lg mb-2">🎉 Rewards Claimed!</p>
                <p className="text-white text-xl">+{claimedRewards.xp} XP, +{claimedRewards.coins} Coins</p>
              </div>
            ) : (
              <>
                <p className="text-gray-400 text-sm mb-4">
                  Your rewards are ready! Claim them to update your profile.
                </p>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClaimRewards}
                  disabled={isClaiming}
                  className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-arcade rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Claiming...
                    </>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5" />
                      Claim Rewards
                    </>
                  )}
                </motion.button>
              </>
            )}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onLeave}
            className="px-8 py-3 bg-cyan-500 text-white font-arcade rounded-xl flex items-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            BACK TO LOBBY
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

export default QuickMathOnChain;
