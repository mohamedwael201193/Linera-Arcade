import { motion } from 'framer-motion';
import { TrendingUp, Gamepad2, Star } from 'lucide-react';
import type { Player } from '../lib/arcade';
import { levelProgress, xpForLevel } from '../types';

interface PlayerStatsProps {
  player: Player;
}

export function PlayerStats({ player }: PlayerStatsProps) {
  const progress = levelProgress(player.totalXp);
  const nextLevelXp = xpForLevel(player.level);
  const xpToNext = nextLevelXp - player.totalXp;

  return (
    <div className="arcade-card rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-16 h-16 rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan flex items-center justify-center text-2xl font-bold"
        >
          {player.username.charAt(0).toUpperCase()}
        </motion.div>
        <div>
          <h2 className="font-arcade text-xl text-white">{player.username}</h2>
          <p className="text-gray-400 text-sm">
            Joined {formatDate(player.registeredAt)}
          </p>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-neon-green" />
            <span className="font-arcade text-sm text-neon-green">
              LEVEL {player.level}
            </span>
          </div>
          <span className="text-gray-400 text-xs">
            {xpToNext.toLocaleString()} XP to next level
          </span>
        </div>
        <div className="xp-bar">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="xp-bar-fill"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          icon={Star}
          label="TOTAL XP"
          value={player.totalXp.toLocaleString()}
          color="#ffff00"
        />
        <StatCard
          icon={Gamepad2}
          label="GAMES"
          value={player.gamesPlayed.toString()}
          color="#00ffff"
        />
        <StatCard
          icon={TrendingUp}
          label="LEVEL"
          value={player.level.toString()}
          color="#00ff00"
        />
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: React.FC<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  color: string;
}

function StatCard({ icon: Icon, label, value, color }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="bg-arcade-darker rounded-lg p-4 text-center"
    >
      <Icon 
        className="w-6 h-6 mx-auto mb-2"
        style={{ color }}
      />
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p 
        className="font-arcade text-lg"
        style={{ color }}
      >
        {value}
      </p>
    </motion.div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
}
