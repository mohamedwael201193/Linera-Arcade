import { motion } from 'framer-motion';
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react';
import type { LeaderboardEntry } from '../lib/arcade';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  currentUserWallet?: string;
  isLoading?: boolean;
}

export function LeaderboardTable({ 
  entries, 
  currentUserWallet,
  isLoading 
}: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="arcade-card rounded-xl p-8 flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="arcade-card rounded-xl p-8 text-center">
        <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No players on the leaderboard yet.</p>
        <p className="text-gray-500 text-sm mt-2">Be the first to play and earn XP!</p>
      </div>
    );
  }

  return (
    <div className="arcade-card rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 p-4 bg-arcade-darker border-b border-arcade-border text-gray-400 text-sm font-arcade">
        <div className="col-span-1 text-center">#</div>
        <div className="col-span-5">PLAYER</div>
        <div className="col-span-2 text-center">LEVEL</div>
        <div className="col-span-4 text-right">XP</div>
      </div>

      {/* Entries */}
      <div className="divide-y divide-arcade-border">
        {entries.map((entry, index) => (
          <LeaderboardRow 
            key={entry.walletAddress} 
            entry={entry} 
            index={index}
            isCurrentUser={entry.walletAddress.toLowerCase() === currentUserWallet?.toLowerCase()}
          />
        ))}
      </div>
    </div>
  );
}

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
}

function LeaderboardRow({ entry, index, isCurrentUser }: LeaderboardRowProps) {
  const rank = entry.rank || index + 1;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors ${
        isCurrentUser 
          ? 'bg-neon-cyan/10 border-l-2 border-neon-cyan' 
          : 'hover:bg-arcade-darker/50'
      }`}
    >
      {/* Rank */}
      <div className="col-span-1 flex justify-center">
        <RankBadge rank={rank} />
      </div>

      {/* Player Info */}
      <div className="col-span-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-purple to-neon-cyan flex items-center justify-center text-sm font-bold">
          {entry.username.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-arcade text-sm">
            {entry.username}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-neon-cyan">(YOU)</span>
            )}
          </p>
          <p className="text-gray-500 text-xs font-mono truncate max-w-[150px]">
            {truncateAddress(entry.walletAddress)}
          </p>
        </div>
      </div>

      {/* Level */}
      <div className="col-span-2 flex justify-center">
        <div className="flex items-center gap-1 bg-arcade-darker px-3 py-1 rounded-full">
          <TrendingUp className="w-3 h-3 text-neon-green" />
          <span className="text-sm font-arcade text-neon-green">
            LV.{entry.level}
          </span>
        </div>
      </div>

      {/* XP */}
      <div className="col-span-4 text-right">
        <span className="font-arcade text-lg text-neon-yellow">
          {formatNumber(entry.totalXp)}
        </span>
        <span className="text-gray-500 text-sm ml-1">XP</span>
      </div>
    </motion.div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="w-8 h-8 rank-gold rounded-full flex items-center justify-center"
      >
        <Trophy className="w-4 h-4" />
      </motion.div>
    );
  }
  
  if (rank === 2) {
    return (
      <div className="w-8 h-8 rank-silver rounded-full flex items-center justify-center">
        <Medal className="w-4 h-4" />
      </div>
    );
  }
  
  if (rank === 3) {
    return (
      <div className="w-8 h-8 rank-bronze rounded-full flex items-center justify-center">
        <Award className="w-4 h-4" />
      </div>
    );
  }

  return (
    <div className="w-8 h-8 bg-arcade-darker rounded-full flex items-center justify-center text-gray-400 font-arcade text-sm">
      {rank}
    </div>
  );
}

// Helpers
function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}
