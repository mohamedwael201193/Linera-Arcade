import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MousePointerClick, 
  Grid3X3, 
  Zap, 
  Calculator, 
  Gamepad2,
  Play
} from 'lucide-react';
import type { GameConfig } from '../types';

interface GameCardProps {
  game: GameConfig;
  index: number;
}

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  MousePointerClick,
  Grid3X3,
  Zap,
  Calculator,
  Gamepad2,
};

export function GameCard({ game, index }: GameCardProps) {
  const IconComponent = iconMap[game.icon] || Gamepad2;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ scale: 1.02 }}
      className="arcade-card rounded-xl overflow-hidden group"
    >
      {/* Header with icon */}
      <div 
        className="h-32 flex items-center justify-center relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${game.color}20, transparent)` }}
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 4, 
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          <IconComponent 
            className="w-16 h-16" 
            style={{ color: game.color }}
          />
        </motion.div>
        
        {/* Glow effect */}
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-300"
          style={{ 
            background: `radial-gradient(circle at center, ${game.color}, transparent 70%)`
          }}
        />
      </div>

      {/* Content */}
      <div className="p-6">
        <h3 
          className="font-arcade text-xl mb-2"
          style={{ color: game.color }}
        >
          {game.name}
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          {game.description}
        </p>

        {/* XP Formula */}
        <div className="bg-arcade-darker rounded-lg p-3 mb-4">
          <p className="text-xs text-gray-500 mb-1">XP FORMULA</p>
          <p className="font-mono text-sm text-neon-green">
            {game.xpFormula}
          </p>
        </div>

        {/* Play Button */}
        <Link to={`/games/${game.id}`}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="w-full py-3 rounded-lg font-arcade text-sm flex items-center justify-center gap-2 transition-all"
            style={{ 
              border: `2px solid ${game.color}`,
              color: game.color,
              boxShadow: `0 0 10px ${game.color}40`
            }}
          >
            <Play className="w-4 h-4" />
            PLAY NOW
          </motion.button>
        </Link>
      </div>
    </motion.div>
  );
}

// Grid of game cards
interface GameGridProps {
  games: GameConfig[];
}

export function GameGrid({ games }: GameGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {games.map((game, index) => (
        <GameCard key={game.id} game={game} index={index} />
      ))}
    </div>
  );
}
