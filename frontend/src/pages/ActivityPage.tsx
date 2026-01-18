/**
 * Activity Page
 * 
 * Real-time activity feed showing:
 * - Recent predictions across all users
 * - Game scores
 * - Daily bonus claims
 * - Wins and payouts
 * 
 * LINERA-NATIVE ARCHITECTURE:
 * - Uses polling (1s) instead of WebSockets for real-time updates
 * - Polling is deterministic, ordered, and consistent with blockchain state
 * - No race conditions or duplicate updates
 */

import { useEffect } from 'react';
import { usePredictions } from '../hooks/usePredictions';
import { useArcade } from '../hooks/useArcade';
import { formatCoins } from '../types';
import { ActivityLogEntry } from '../lib/api/backendApi';

// Polling interval for real-time updates (Linera-native)
const POLL_INTERVAL = 10000; // 10 seconds - balance between real-time and performance

// Activity type icons
const ACTIVITY_ICONS: Record<string, string> = {
  PREDICTION: '🎯',
  GAME: '🎮',
  CLAIM_BONUS: '🎁',
  WIN: '🏆',
};

// Activity type colors
const ACTIVITY_COLORS: Record<string, string> = {
  PREDICTION: 'text-cyan-400',
  GAME: 'text-purple-400',
  CLAIM_BONUS: 'text-green-400',
  WIN: 'text-yellow-400',
};

// Time ago formatter
function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Activity card component
function ActivityCard({ activity }: { activity: ActivityLogEntry }) {
  if (!activity || !activity.activityType) {
    return null; // Skip invalid activities
  }
  
  const icon = ACTIVITY_ICONS[activity.activityType] || '📝';
  const colorClass = ACTIVITY_COLORS[activity.activityType] || 'text-gray-400';
  
  // Format the activity type for display
  const activityTypeDisplay = activity.activityType?.toLowerCase().replace(/_/g, ' ') || 'activity';
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-all duration-200">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="text-2xl">{icon}</div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-white truncate max-w-[150px]">
              {activity.username || (activity.walletAddress ? activity.walletAddress.slice(0, 8) + '...' : 'Unknown')}
            </span>
            <span className={`text-sm ${colorClass}`}>
              {activityTypeDisplay}
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">{activity.description || ''}</p>
        </div>
        
        {/* Coins & Time */}
        <div className="text-right flex-shrink-0">
          {activity.coinsChange !== 0 && activity.coinsChange !== undefined && (
            <p className={`font-medium ${activity.coinsChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {activity.coinsChange > 0 ? '+' : ''}{formatCoins(activity.coinsChange)} 🪙
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">{activity.createdAt ? timeAgo(activity.createdAt) : ''}</p>
        </div>
      </div>
    </div>
  );
}

// Stats card component
function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 border border-gray-700`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-xs text-gray-300">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function ActivityPage() {
  const { walletAddress } = useArcade();
  const predictions = usePredictions(walletAddress);
  
  // Initial load with loading spinner
  useEffect(() => {
    predictions.refreshActivity(true);
  }, []);
  
  // Background polling for real-time updates (Linera-native approach)
  // Uses silent refresh (no loading spinner) for better UX
  useEffect(() => {
    const interval = setInterval(() => {
      predictions.refreshActivity(false); // Silent refresh - no spinner
    }, POLL_INTERVAL);
    
    return () => clearInterval(interval);
  }, [predictions.refreshActivity]);

  // Calculate stats from activity
  const stats = {
    totalPredictions: predictions.activityFeed.filter(a => a.activityType === 'PREDICTION').length,
    totalGames: predictions.activityFeed.filter(a => a.activityType === 'GAME').length,
    totalWins: predictions.activityFeed.filter(a => a.activityType === 'WIN').length,
    totalCoinsWon: predictions.activityFeed
      .filter(a => a.coinsChange > 0)
      .reduce((sum, a) => sum + a.coinsChange, 0),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Live Activity
            </span>
          </h1>
          <p className="text-gray-400">Real-time feed of predictions, games, and wins</p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Predictions"
            value={stats.totalPredictions}
            icon="🎯"
            color="from-cyan-900/30 to-cyan-800/20"
          />
          <StatCard
            label="Games Played"
            value={stats.totalGames}
            icon="🎮"
            color="from-purple-900/30 to-purple-800/20"
          />
          <StatCard
            label="Wins"
            value={stats.totalWins}
            icon="🏆"
            color="from-yellow-900/30 to-yellow-800/20"
          />
          <StatCard
            label="Coins Won"
            value={formatCoins(stats.totalCoinsWon)}
            icon="🪙"
            color="from-green-900/30 to-green-800/20"
          />
        </div>
        
        {/* Activity Feed */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
            <button
              onClick={() => predictions.refreshActivity(true)}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
          
          {predictions.activityLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin text-4xl mb-4">🔄</div>
              <p className="text-gray-400">Loading activity...</p>
            </div>
          ) : predictions.activityFeed.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-12 text-center border border-gray-700">
              <span className="text-4xl mb-4 block">📭</span>
              <p className="text-gray-400">No activity yet</p>
              <p className="text-sm text-gray-500 mt-2">
                Play games and make predictions to see activity here!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.activityFeed.map((activity) => (
                <ActivityCard key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>
        
        {/* Load More (placeholder for pagination) */}
        {predictions.activityFeed.length > 0 && (
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Showing latest {predictions.activityFeed.length} activities
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityPage;
