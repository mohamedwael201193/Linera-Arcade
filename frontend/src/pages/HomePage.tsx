import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Gamepad2, 
  Trophy, 
  Users, 
  Zap, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useLeaderboard, useLineraConnection } from '../hooks';
import { GAME_CONFIGS } from '../types';

export function HomePage() {
  const { isAppConnected } = useLineraConnection();
  const { leaderboard } = useLeaderboard();

  // Calculate stats from leaderboard
  // Note: LeaderboardEntry doesn't have gamesPlayed - we can only count players and total XP
  const stats = {
    totalPlayers: leaderboard.length,
    totalGamesPlayed: 0, // Not available from LeaderboardEntry
    totalXpEarned: leaderboard.reduce((sum, e) => sum + e.totalXp, 0),
  };

  return (
    <div className="space-y-16">
      {/* Hero Section */}
      <section className="relative py-20 text-center">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-neon-pink/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-neon-cyan/20 rounded-full blur-3xl" />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10"
        >
          <motion.div
            animate={{ 
              scale: [1, 1.02, 1],
              rotate: [0, 1, -1, 0]
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="inline-block mb-8"
          >
            <Gamepad2 className="w-24 h-24 text-neon-cyan mx-auto" />
          </motion.div>

          <h1 className="font-arcade text-4xl md:text-6xl mb-6">
            <span className="neon-text-pink">LINERA</span>
            <br />
            <span className="neon-text-cyan">ARCADE HUB</span>
          </h1>

          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-8">
            Experience blockchain gaming at its finest. Play 5 unique games, 
            earn XP on-chain, and compete for global leaderboard dominance — 
            all powered by Linera microchains.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/games">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-neon text-neon-cyan border-neon-cyan"
              >
                <span className="flex items-center gap-2">
                  PLAY NOW
                  <ArrowRight className="w-4 h-4" />
                </span>
              </motion.button>
            </Link>
            <Link to="/leaderboard">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-neon text-neon-pink border-neon-pink"
              >
                <span className="flex items-center gap-2">
                  <Trophy className="w-4 h-4" />
                  LEADERBOARD
                </span>
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard
          icon={Users}
          label="TOTAL PLAYERS"
          value={stats.totalPlayers}
          color="#ff00ff"
          delay={0}
        />
        <StatsCard
          icon={Gamepad2}
          label="GAMES PLAYED"
          value={stats.totalGamesPlayed}
          color="#00ffff"
          delay={0.1}
        />
        <StatsCard
          icon={Sparkles}
          label="XP EARNED"
          value={stats.totalXpEarned}
          color="#00ff00"
          delay={0.2}
        />
      </section>

      {/* Featured Games */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-arcade text-2xl">
            <span className="neon-text-cyan">FEATURED</span> GAMES
          </h2>
          <Link 
            to="/games"
            className="text-neon-cyan hover:text-white flex items-center gap-2 transition-colors"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Object.values(GAME_CONFIGS).slice(0, 3).map((game, index) => (
            <FeaturedGameCard key={game.id} game={game} index={index} />
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12">
        <h2 className="font-arcade text-2xl text-center mb-12">
          HOW IT <span className="neon-text-pink">WORKS</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            {
              step: 1,
              title: 'Connect Wallet',
              description: 'Link your wallet via Dynamic to get started',
              icon: '🔗',
            },
            {
              step: 2,
              title: 'Register',
              description: 'Create your arcade profile with a username',
              icon: '👤',
            },
            {
              step: 3,
              title: 'Play Games',
              description: 'Choose from 5 unique arcade games',
              icon: '🎮',
            },
            {
              step: 4,
              title: 'Earn XP',
              description: 'Submit scores on-chain and climb the ranks',
              icon: '⭐',
            },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="arcade-card rounded-xl p-6 text-center relative"
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-neon-cyan flex items-center justify-center font-arcade text-arcade-darker font-bold">
                {item.step}
              </div>
              <div className="text-4xl mb-4 mt-4">{item.icon}</div>
              <h3 className="font-arcade text-sm text-neon-cyan mb-2">
                {item.title}
              </h3>
              <p className="text-gray-400 text-sm">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="arcade-card rounded-xl p-8 text-center">
        <h2 className="font-arcade text-xl mb-6">
          POWERED BY <span className="neon-text-purple">LINERA</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto mb-6">
          Linera is a decentralized protocol designed from the ground up for 
          high-performance Web3 applications. Each player gets their own 
          microchain for instant, scalable gaming.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          {['Microchains', 'Rust Smart Contracts', 'GraphQL API', 'Conway Testnet'].map((tech) => (
            <span 
              key={tech}
              className="px-4 py-2 rounded-full bg-arcade-darker border border-arcade-border text-gray-300 text-sm"
            >
              {tech}
            </span>
          ))}
        </div>
        
        {/* Connection status */}
        <div className="mt-6 pt-6 border-t border-arcade-border">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isAppConnected ? 'bg-neon-green animate-pulse' : 'bg-gray-500'}`} />
            <span className="text-gray-400 text-sm">
              {isAppConnected ? 'Connected to Linera Conway Testnet' : 'Connect wallet to interact with blockchain'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}

// Stats Card Component
interface StatsCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  delay: number;
}

function StatsCard({ icon: Icon, label, value, color, delay }: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="arcade-card rounded-xl p-6"
    >
      <div className="flex items-center gap-4">
        <div 
          className="p-3 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-6 h-6" style={{ color }} />
        </div>
        <div>
          <p className="text-gray-500 text-xs">{label}</p>
          <p className="font-arcade text-2xl" style={{ color }}>
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// Featured Game Card Component
interface FeaturedGameCardProps {
  game: typeof GAME_CONFIGS[keyof typeof GAME_CONFIGS];
  index: number;
}

function FeaturedGameCard({ game, index }: FeaturedGameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Link to={`/games/${game.id}`}>
        <div 
          className="arcade-card rounded-xl p-6 h-full hover:border-opacity-100 transition-all duration-300 group"
          style={{ 
            borderColor: `${game.color}50`,
            borderWidth: 1,
          }}
        >
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${game.color}20` }}
          >
            <Zap className="w-6 h-6" style={{ color: game.color }} />
          </div>
          
          <h3 
            className="font-arcade text-lg mb-2"
            style={{ color: game.color }}
          >
            {game.name}
          </h3>
          
          <p className="text-gray-400 text-sm mb-4">
            {game.description}
          </p>
          
          <div className="flex items-center justify-between">
            <span className="text-gray-500 text-xs">{game.xpFormula}</span>
            <ArrowRight 
              className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" 
              style={{ color: game.color }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
