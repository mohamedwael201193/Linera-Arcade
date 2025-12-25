import { motion } from 'framer-motion';
import { Trophy, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import { useLeaderboard, useArcade } from '../hooks';

export function LeaderboardPage() {
  const { player } = useArcade();
  const { leaderboard, stats, isLoading, error, refresh, lastUpdated } = useLeaderboard();

  const handleRefresh = () => {
    refresh();
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get rank display (medal for top 3)
  const getRankDisplay = (rank: number): string => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Trophy className="w-8 h-8 text-neon-yellow" />
          <h1 className="font-arcade text-3xl">
            <span className="neon-text-yellow">GLOBAL</span> LEADERBOARD
          </h1>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdated && (
            <p className="text-gray-500 text-xs">
              Updated: {lastUpdated.toLocaleTimeString()}
            </p>
          )}
          <motion.button
            whileHover={{ scale: 1.05, rotate: 180 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-3 rounded-lg bg-arcade-card border border-arcade-border hover:border-neon-cyan transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-neon-cyan animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5 text-gray-400" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Description */}
      <p className="text-gray-400 text-center max-w-2xl mx-auto">
        The global leaderboard aggregates all player XP from the Linera blockchain.
        Play games to earn XP and climb the ranks!
      </p>

      {/* Error State */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <span className="text-red-200">{error}</span>
          <button
            onClick={handleRefresh}
            className="ml-auto text-red-400 hover:text-red-300 text-sm"
          >
            Retry
          </button>
        </motion.div>
      )}

      {/* Loading State */}
      {isLoading && leaderboard.length === 0 && (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-neon-cyan animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading leaderboard...</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && leaderboard.length === 0 && !error && (
        <div className="text-center py-12">
          <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No players on the leaderboard yet</p>
          <p className="text-gray-500 text-sm">Be the first to register and play!</p>
        </div>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="arcade-card rounded-xl overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-arcade-border">
                <th className="px-4 py-3 text-left text-gray-500 text-xs font-normal">RANK</th>
                <th className="px-4 py-3 text-left text-gray-500 text-xs font-normal">PLAYER</th>
                <th className="px-4 py-3 text-right text-gray-500 text-xs font-normal">LEVEL</th>
                <th className="px-4 py-3 text-right text-gray-500 text-xs font-normal">GAMES</th>
                <th className="px-4 py-3 text-right text-gray-500 text-xs font-normal">TOTAL XP</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, index) => {
                const entryWallet = entry.walletAddress || '';
                const playerWallet = player?.owner || '';
                const isCurrentPlayer = playerWallet && entryWallet && 
                  entryWallet.toLowerCase() === playerWallet.toLowerCase();
                
                return (
                  <motion.tr
                    key={entryWallet || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-arcade-border/50 hover:bg-arcade-darker/50 transition-colors ${
                      isCurrentPlayer ? 'bg-neon-cyan/10' : ''
                    }`}
                  >
                    <td className="px-4 py-4">
                      <span className={`font-arcade ${entry.rank <= 3 ? 'text-2xl' : 'text-gray-400'}`}>
                        {getRankDisplay(entry.rank)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          entry.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                          entry.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                          entry.rank === 3 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                          'bg-gradient-to-br from-neon-pink to-neon-cyan'
                        }`}>
                          {entry.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-arcade text-sm ${isCurrentPlayer ? 'text-neon-cyan' : ''}`}>
                            {entry.username}
                            {isCurrentPlayer && <span className="ml-2 text-xs">(YOU)</span>}
                          </p>
                          <p className="text-gray-500 text-xs">
                            {formatAddress(entry.walletAddress)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-arcade text-neon-green">
                        LV.{entry.level}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400">
                      -
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-arcade text-neon-yellow">
                        {(entry.totalXp ?? 0).toLocaleString()}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Stats Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <div className="arcade-card rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">TOTAL PLAYERS</p>
          <p className="font-arcade text-xl text-neon-pink">
            {stats.totalPlayers || leaderboard.length}
          </p>
        </div>
        <div className="arcade-card rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">TOP XP</p>
          <p className="font-arcade text-xl text-neon-yellow">
            {(stats.topXp || leaderboard[0]?.totalXp || 0).toLocaleString()}
          </p>
        </div>
        <div className="arcade-card rounded-xl p-4 text-center">
          <p className="text-gray-500 text-xs mb-1">HIGHEST LEVEL</p>
          <p className="font-arcade text-xl text-neon-green">
            LV.{stats.highestLevel || leaderboard[0]?.level || 1}
          </p>
        </div>
      </motion.div>
    </div>
  );
}
