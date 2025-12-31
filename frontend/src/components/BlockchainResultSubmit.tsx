/**
 * BlockchainResultSubmit Component
 * 
 * Reusable component for submitting multiplayer game results to blockchain.
 * HYBRID SYSTEM: Games play via WebSocket (fast), results saved on-chain (1 signature).
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Check, Loader2, Link, Trophy, Coins, Star, Sparkles, AlertCircle } from 'lucide-react';
import { useLineraConnection } from '../hooks';
import { lineraAdapter } from '../lib/linera/lineraAdapter';
import { SUBMIT_MULTIPLAYER_RESULT } from '../lib/arcade/queries';

// Backend URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface Props {
  gameType: string;
  roomCode: string;
  isWinner: boolean;
  opponentName: string;
  finalStats?: Record<string, unknown>;
}

// XP values by game type (must match contract - IMPROVED REWARDS!)
const XP_BY_GAME: Record<string, number> = {
  'tic-tac-toe': 200,
  'connect-four': 250,
  'chess': 500,
  'checkers': 350,
  'rock-paper-scissors': 150,
  'word-duel': 200,
  'reaction-duel': 180,
  'quick-math': 220,
  'emoji-race': 180,
};

// Coin rewards (flat rates)
const WINNER_COINS = 100;
const LOSER_COINS = 30;

// Game display names
const GAME_NAMES: Record<string, string> = {
  'tic-tac-toe': 'Tic Tac Toe',
  'connect-four': 'Connect Four',
  'chess': 'Chess',
  'checkers': 'Checkers',
  'rock-paper-scissors': 'Rock Paper Scissors',
  'word-duel': 'Word Duel',
  'reaction-duel': 'Reaction Duel',
  'quick-math': 'Quick Math',
  'emoji-race': 'Emoji Race',
};

export function BlockchainResultSubmit({ 
  gameType, 
  roomCode, 
  isWinner, 
  opponentName,
}: Props) {
  const { walletAddress, isAppConnected, chainId } = useLineraConnection();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ xp: number; coins: number; won: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  // Calculate expected XP and coins (same formula as contract - IMPROVED REWARDS!)
  const baseXp = XP_BY_GAME[gameType] || 150;
  const expectedXp = isWinner ? baseXp : Math.floor(baseXp / 4); // 25% for loser
  const expectedCoins = isWinner ? WINNER_COINS : LOSER_COINS; // Flat rates: 100 winner, 30 loser

  // Sync result to backend for activity feed and leaderboard
  const syncToBackend = async (xp: number, coins: number) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/multiplayer/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          game_type: gameType,
          room_code: roomCode,
          is_winner: isWinner,
          opponent_username: opponentName,
          xp_earned: xp,
          coins_earned: coins,
          chain_id: chainId,
        }),
      });
      
      if (!response.ok) {
        console.warn('Backend sync failed:', await response.text());
      } else {
        console.log('✅ Result synced to backend for activity feed');
      }
    } catch (err) {
      console.warn('Backend sync error:', err);
      // Don't fail the submission if backend sync fails
    }
  };

  // Submit result to blockchain (only 1 signature!)
  const submitToBlockchain = async () => {
    if (!walletAddress || !isAppConnected) {
      setError('Please connect wallet first');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Use the same pattern as single-player submitScore
      console.log('🎮 Submitting multiplayer result to blockchain...');
      console.log('  gameType:', gameType);
      console.log('  roomCode:', roomCode);
      console.log('  isWinner:', isWinner);
      console.log('  opponentUsername:', opponentName);
      
      const result = await lineraAdapter.mutate(SUBMIT_MULTIPLAYER_RESULT, {
        gameType,
        roomCode,
        isWinner,
        opponentUsername: opponentName,
      });
      
      console.log('✅ Multiplayer result submitted to blockchain:', result);
      
      // Calculate XP and coins
      const xp = expectedXp;
      const coins = expectedCoins;
      
      // Sync to backend for activity feed
      await syncToBackend(xp, coins);
      
      setSubmitResult({ xp, coins, won: isWinner });
      setSubmitted(true);
      
      // Show celebration for winners
      if (isWinner) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 3000);
      }
    } catch (err) {
      console.error('❌ Failed to submit multiplayer result:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit result');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Not connected - show connect hint
  if (!walletAddress) {
    return (
      <div className="bg-gray-500/10 border border-gray-500/30 rounded-xl p-4 mt-4">
        <p className="text-gray-400 text-sm flex items-center gap-2">
          <Link className="w-4 h-4" />
          Connect wallet to save your result on Linera blockchain!
        </p>
      </div>
    );
  }

  // Already submitted - show amazing success celebration
  if (submitted && submitResult) {
    const gameName = GAME_NAMES[gameType] || gameType;
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`relative overflow-hidden rounded-xl p-6 mt-4 ${
          submitResult.won 
            ? 'bg-gradient-to-r from-yellow-500/20 via-orange-500/20 to-yellow-500/20 border-2 border-yellow-500/50' 
            : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30'
        }`}
      >
        {/* Celebration particles for winners */}
        <AnimatePresence>
          {showCelebration && (
            <>
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    opacity: 1, 
                    y: 0, 
                    x: 0,
                    scale: 1,
                  }}
                  animate={{ 
                    opacity: 0, 
                    y: -100 - Math.random() * 50,
                    x: (Math.random() - 0.5) * 200,
                    scale: 0,
                    rotate: Math.random() * 360,
                  }}
                  transition={{ duration: 1.5 + Math.random(), ease: "easeOut" }}
                  className="absolute text-2xl"
                  style={{ 
                    left: `${20 + Math.random() * 60}%`,
                    top: `${30 + Math.random() * 40}%`,
                  }}
                >
                  {['🎉', '✨', '🏆', '💰', '⭐', '🌟'][i % 6]}
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>
        
        <div className="relative z-10">
          {submitResult.won ? (
            // Winner celebration
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="inline-block mb-3"
              >
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Trophy className="w-10 h-10 text-white" />
                </div>
              </motion.div>
              
              <motion.h3
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-yellow-400 mb-2"
              >
                🎉 VICTORY RECORDED! 🎉
              </motion.h3>
              
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-gray-300 mb-4"
              >
                You dominated {gameName} vs {opponentName}!
              </motion.p>
              
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="flex justify-center gap-6"
              >
                <div className="bg-purple-500/20 rounded-xl px-6 py-3 border border-purple-500/30">
                  <div className="flex items-center gap-2 text-purple-400">
                    <Star className="w-5 h-5" />
                    <span className="text-2xl font-bold">+{submitResult.xp}</span>
                  </div>
                  <p className="text-purple-300 text-sm">XP Earned</p>
                </div>
                
                <div className="bg-yellow-500/20 rounded-xl px-6 py-3 border border-yellow-500/30">
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Coins className="w-5 h-5" />
                    <span className="text-2xl font-bold">+{submitResult.coins}</span>
                  </div>
                  <p className="text-yellow-300 text-sm">Coins Won</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 flex items-center justify-center gap-2 text-green-400 text-sm"
              >
                <Check className="w-4 h-4" />
                Saved on Linera Blockchain
              </motion.div>
            </div>
          ) : (
            // Loss - still encouraging
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Sparkles className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-bold text-blue-400">Game Recorded!</h3>
              </div>
              
              <p className="text-gray-300 mb-4">
                Good game vs {opponentName}! Keep playing to improve.
              </p>
              
              <div className="flex justify-center gap-6">
                <div className="bg-blue-500/20 rounded-xl px-5 py-2 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Star className="w-4 h-4" />
                    <span className="text-xl font-bold">+{submitResult.xp}</span>
                  </div>
                  <p className="text-blue-300 text-xs">Participation XP</p>
                </div>
                
                <div className="bg-blue-500/20 rounded-xl px-5 py-2 border border-blue-500/30">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Coins className="w-4 h-4" />
                    <span className="text-xl font-bold">+{submitResult.coins}</span>
                  </div>
                  <p className="text-blue-300 text-xs">Coins</p>
                </div>
              </div>
              
              <div className="mt-3 flex items-center justify-center gap-2 text-green-400 text-xs">
                <Check className="w-3 h-3" />
                Saved on Linera Blockchain
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Not application connected
  if (!isAppConnected) {
    return (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-4">
        <p className="text-yellow-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Connecting to Linera blockchain...
        </p>
      </div>
    );
  }

  // Submit button with expected rewards preview
  const gameName = GAME_NAMES[gameType] || gameType;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl p-5 mt-4 ${
        isWinner 
          ? 'bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-purple-500/10 border-yellow-500/30' 
          : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-purple-500/30'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-white font-bold text-lg flex items-center gap-2">
            {isWinner ? (
              <>
                <Trophy className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400">Victory!</span>
              </>
            ) : (
              <>
                <Award className="w-5 h-5 text-purple-400" />
                <span>Game Complete</span>
              </>
            )}
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            {isWinner 
              ? `You beat ${opponentName} at ${gameName}! Claim your rewards.`
              : `Record your ${gameName} match vs ${opponentName}`
            }
          </p>
          
          {/* Expected rewards preview */}
          <div className="flex items-center gap-4 mt-3">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
              isWinner ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Star className="w-4 h-4" />
              <span className="font-bold">+{expectedXp}</span>
              <span className="text-xs opacity-75">XP</span>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
              isWinner ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'
            }`}>
              <Coins className="w-4 h-4" />
              <span className="font-bold">+{expectedCoins}</span>
              <span className="text-xs opacity-75">coins</span>
            </div>
          </div>
        </div>
        
        <button
          onClick={submitToBlockchain}
          disabled={isSubmitting}
          className={`px-6 py-3 font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg ${
            isWinner
              ? 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-white shadow-orange-500/20'
              : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/20'
          } disabled:opacity-50`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Signing...
            </>
          ) : (
            <>
              {isWinner ? <Trophy className="w-5 h-5" /> : <Award className="w-5 h-5" />}
              {isWinner ? 'Claim Victory!' : 'Save Result'}
            </>
          )}
        </button>
      </div>
      
      <p className="text-gray-500 text-xs mt-3 flex items-center gap-1">
        <Link className="w-3 h-3" />
        Requires 1 signature to record on Linera blockchain
      </p>
      
      {error && (
        <p className="text-red-400 text-sm mt-2 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
    </motion.div>
  );
}
