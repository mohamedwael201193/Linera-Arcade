import { useState } from 'react';
import { motion } from 'framer-motion';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { User, AlertCircle, Wallet, Loader2, Trophy, Gamepad2, Sparkles, Link as LinkIcon, RefreshCw, CheckCircle } from 'lucide-react';
import { useLineraConnection, useArcade, useLeaderboard } from '../hooks';
import { levelProgress, xpForLevel } from '../types';
import { arcadeApi } from '../lib/arcade';

export function ProfilePage() {
  const { primaryWallet } = useDynamicContext();
  const { 
    isConnecting, 
    isAppConnected, 
    chainId,
    error: connectionError,
    retry
  } = useLineraConnection();
  const { 
    player, 
    isRegistered, 
    registerPlayer, 
    error: arcadeError
  } = useArcade();
  const { leaderboard } = useLeaderboard();

  const [newUsername, setNewUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  const error = localError || arcadeError || connectionError;

  // Get player rank from leaderboard
  const playerRank = player && leaderboard.length > 0
    ? leaderboard.findIndex(e => e.walletAddress?.toLowerCase() === player.owner?.toLowerCase()) + 1
    : null;

  // Check if player is on leaderboard
  const isOnLeaderboard = playerRank !== null && playerRank > 0;

  const handleSyncToLeaderboard = async () => {
    setIsSyncing(true);
    setLocalError(null);
    setSyncSuccess(false);
    
    try {
      await arcadeApi.syncToLeaderboard();
      setSyncSuccess(true);
      // Refresh leaderboard data
      setTimeout(() => setSyncSuccess(false), 3000);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRegister = async () => {
    if (!newUsername.trim()) {
      setLocalError('Username is required');
      return;
    }

    if (newUsername.length < 3 || newUsername.length > 20) {
      setLocalError('Username must be 3-20 characters');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
      setLocalError('Username can only contain letters, numbers, underscores and hyphens');
      return;
    }

    setIsSubmitting(true);
    setLocalError(null);

    try {
      const result = await registerPlayer(newUsername);
      if (result) {
        setNewUsername('');
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Not connected state
  if (!primaryWallet) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="arcade-card rounded-xl p-8"
        >
          <Wallet className="w-16 h-16 text-neon-cyan mx-auto mb-6" />
          <h2 className="font-arcade text-xl mb-4">CONNECT WALLET</h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to view your profile, register, and start playing.
          </p>
          <p className="text-gray-500 text-sm">
            Use the wallet button in the navigation bar to connect.
          </p>
        </motion.div>
      </div>
    );
  }

  // Connecting state
  if (isConnecting) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="arcade-card rounded-xl p-8"
        >
          <Loader2 className="w-16 h-16 text-neon-cyan mx-auto mb-6 animate-spin" />
          <h2 className="font-arcade text-xl mb-4">CONNECTING...</h2>
          <p className="text-gray-400">
            Connecting to Linera blockchain...
          </p>
        </motion.div>
      </div>
    );
  }

  // Connection error state
  if (!isAppConnected && connectionError) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="arcade-card rounded-xl p-8"
        >
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
          <h2 className="font-arcade text-xl mb-4 text-red-400">CONNECTION FAILED</h2>
          <p className="text-gray-400 mb-6">{connectionError}</p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={retry}
            className="px-6 py-3 rounded-lg bg-neon-cyan text-arcade-darker font-arcade"
          >
            RETRY CONNECTION
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Registration form (not registered yet)
  if (!isRegistered || !player) {
    return (
      <div className="max-w-md mx-auto py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="arcade-card rounded-xl p-8 text-center"
        >
          <User className="w-16 h-16 text-neon-pink mx-auto mb-6" />
          <h2 className="font-arcade text-xl mb-2">CREATE YOUR PROFILE</h2>
          <p className="text-gray-400 mb-6">
            Choose a username to start your arcade journey.
            This will be recorded on the Linera blockchain.
          </p>

          {/* Connected wallet info */}
          <div className="bg-arcade-darker rounded-lg p-3 mb-6">
            <p className="text-gray-500 text-xs mb-1">CONNECTED WALLET</p>
            <p className="font-mono text-neon-cyan text-sm">
              {formatAddress(primaryWallet.address || '')}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm mb-4 justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <input
              type="text"
              value={newUsername}
              onChange={(e) => {
                setNewUsername(e.target.value);
                setLocalError(null);
              }}
              placeholder="Enter username..."
              className="w-full px-4 py-3 bg-arcade-darker border border-arcade-border rounded-lg text-white font-arcade text-center focus:outline-none focus:border-neon-cyan"
              maxLength={20}
              disabled={isSubmitting}
            />
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRegister}
              disabled={isSubmitting || !newUsername.trim() || !isAppConnected}
              className="w-full py-3 rounded-lg bg-neon-cyan text-arcade-darker font-arcade font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  REGISTERING ON BLOCKCHAIN...
                </span>
              ) : (
                'REGISTER'
              )}
            </motion.button>
          </div>

          <p className="text-gray-500 text-xs mt-4">
            Username: 3-20 characters, letters, numbers, underscores and hyphens only.
          </p>
        </motion.div>
      </div>
    );
  }

  // Registered player view
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <User className="w-8 h-8 text-neon-pink" />
        <h1 className="font-arcade text-3xl">
          <span className="neon-text-pink">YOUR</span> PROFILE
        </h1>
      </motion.div>

      {/* Main Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="arcade-card rounded-xl p-6"
      >
        <div className="flex items-center gap-6 mb-6">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan flex items-center justify-center font-arcade text-3xl">
            {player.username.charAt(0).toUpperCase()}
          </div>
          
          {/* Name & Address */}
          <div className="flex-1">
            <h2 className="font-arcade text-2xl text-white mb-1">{player.username}</h2>
            <p className="text-gray-400 font-mono text-sm flex items-center gap-2">
              <LinkIcon className="w-3 h-3" />
              {formatAddress(player.owner)}
            </p>
            {chainId && (
              <p className="text-gray-500 text-xs mt-1">
                Chain: {formatAddress(chainId)}
              </p>
            )}
          </div>
        </div>

        {/* XP Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Level {player.level}</span>
            <span className="text-gray-400">Level {player.level + 1}</span>
          </div>
          <div className="h-3 bg-arcade-darker rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress(player.totalXp)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-neon-pink to-neon-cyan"
            />
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-neon-yellow">{player.totalXp.toLocaleString()} XP</span>
            <span className="text-gray-500">{xpForLevel(player.level).toLocaleString()} XP needed</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-arcade-darker rounded-lg p-4 text-center">
            <Sparkles className="w-6 h-6 text-neon-yellow mx-auto mb-2" />
            <p className="text-gray-500 text-xs mb-1">TOTAL XP</p>
            <p className="font-arcade text-xl text-neon-yellow">
              {player.totalXp.toLocaleString()}
            </p>
          </div>
          
          <div className="bg-arcade-darker rounded-lg p-4 text-center">
            <Trophy className="w-6 h-6 text-neon-green mx-auto mb-2" />
            <p className="text-gray-500 text-xs mb-1">LEVEL</p>
            <p className="font-arcade text-xl text-neon-green">
              {player.level}
            </p>
          </div>
          
          <div className="bg-arcade-darker rounded-lg p-4 text-center">
            <Gamepad2 className="w-6 h-6 text-neon-pink mx-auto mb-2" />
            <p className="text-gray-500 text-xs mb-1">GAMES</p>
            <p className="font-arcade text-xl text-neon-pink">
              {player.gamesPlayed}
            </p>
          </div>
          
          <div className="bg-arcade-darker rounded-lg p-4 text-center">
            <Trophy className="w-6 h-6 text-neon-cyan mx-auto mb-2" />
            <p className="text-gray-500 text-xs mb-1">RANK</p>
            <p className="font-arcade text-xl text-neon-cyan">
              {playerRank ? `#${playerRank}` : '-'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Registration Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="arcade-card rounded-xl p-4"
      >
        <p className="text-gray-500 text-xs mb-1">REGISTERED ON</p>
        <p className="text-gray-300">
          {new Date(player.registeredAt * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </motion.div>

      {/* Blockchain Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="arcade-card rounded-xl p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
          <p className="text-gray-400 text-sm">Connected to Linera Conway Testnet</p>
        </div>
        <p className="text-gray-500 text-xs">
          Your profile and scores are stored on-chain and verifiable.
        </p>
      </motion.div>

      {/* Sync to Leaderboard Button */}
      {!isOnLeaderboard && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="arcade-card rounded-xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-arcade text-sm mb-1">SYNC TO GLOBAL LEADERBOARD</p>
              <p className="text-gray-500 text-xs">
                Your profile is on blockchain but not yet on the global leaderboard.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSyncToLeaderboard}
              disabled={isSyncing}
              className="px-4 py-2 rounded-lg bg-neon-cyan text-arcade-darker font-arcade text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  SYNCING...
                </>
              ) : syncSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  SYNCED!
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  SYNC NOW
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
