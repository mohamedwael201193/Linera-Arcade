import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import { GameGrid } from '../components/GameCard';
import { GAME_CONFIGS } from '../types';

export function GamesPage() {
  const games = Object.values(GAME_CONFIGS);

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="flex items-center justify-center gap-3 mb-4">
          <Gamepad2 className="w-8 h-8 text-neon-cyan" />
          <h1 className="font-arcade text-3xl">
            <span className="neon-text-cyan">ARCADE</span> GAMES
          </h1>
        </div>
        <p className="text-gray-400 max-w-xl mx-auto">
          Choose from 5 unique games. Each game has its own XP formula —
          the better you play, the more you earn!
        </p>
      </motion.div>

      {/* Games Grid */}
      <GameGrid games={games} />

      {/* Info Banner */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="arcade-card rounded-xl p-6 text-center"
      >
        <h3 className="font-arcade text-sm text-neon-yellow mb-2">
          💡 PRO TIP
        </h3>
        <p className="text-gray-400 text-sm">
          Connect your wallet and register a username to save your scores on-chain.
          All scores are permanently recorded on the Linera blockchain!
        </p>
      </motion.div>
    </div>
  );
}
