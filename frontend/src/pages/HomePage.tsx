import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Gamepad2, 
  Trophy, 
  Users, 
  Zap, 
  ArrowRight,
  TrendingUp,
  Activity,
  Coins,
  Target,
  Timer,
  Shield,
  Cpu,
  ChevronRight,
  Star,
  Gift,
  BarChart3
} from 'lucide-react';
import { useLeaderboard, useLineraConnection } from '../hooks';
import { GAME_CONFIGS } from '../types';

export function HomePage() {
  const { isAppConnected } = useLineraConnection();
  const { leaderboard } = useLeaderboard();

  const stats = {
    totalPlayers: leaderboard.length,
    totalXpEarned: leaderboard.reduce((sum, e) => sum + e.totalXp, 0),
  };

  return (
    <div className="space-y-20">
      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        {/* Animated background effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-96 h-96 bg-accent-orange/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-20 right-10 w-80 h-80 bg-accent-orange/5 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-accent-orange/5 to-transparent rounded-full" />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-20" />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center max-w-5xl mx-auto px-4"
        >
          {/* Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8 flex justify-center"
          >
            <div className="relative">
              {/* Glow effect behind logo */}
              <div className="absolute inset-0 bg-accent-orange/40 rounded-full blur-3xl scale-75" />
              <img 
                src="/logo.png" 
                alt="Linera Arcade" 
                className="relative w-40 h-40 object-contain drop-shadow-[0_0_30px_rgba(255,107,0,0.5)]"
              />
            </div>
          </motion.div>

          <h1 className="font-arcade text-5xl md:text-7xl mb-6 leading-tight">
            <span className="text-accent-orange drop-shadow-[0_0_20px_rgba(255,107,0,0.5)]">LINERA</span>
            <br />
            <span className="text-white">ARCADE</span>
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed">
            The ultimate <span className="text-accent-orange font-semibold">on-chain gaming</span> and{' '}
            <span className="text-accent-orange font-semibold">prediction</span> platform. 
            Play 8 arcade games, predict crypto prices, earn XP, and compete globally — 
            all powered by <span className="text-white">Linera microchains</span>.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link to="/games">
              <motion.button
                whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(255, 107, 0, 0.4)' }}
                whileTap={{ scale: 0.95 }}
                className="btn-primary"
              >
                <span className="flex items-center gap-2">
                  <Gamepad2 className="w-5 h-5" />
                  PLAY GAMES
                  <ArrowRight className="w-4 h-4" />
                </span>
              </motion.button>
            </Link>
            <Link to="/predictions">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="btn-secondary"
              >
                <span className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  PREDICTIONS
                </span>
              </motion.button>
            </Link>
          </div>

          {/* Live Stats Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="inline-flex items-center gap-6 px-6 py-3 rounded-full bg-dark-card/80 border border-dark-border backdrop-blur-sm"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-gray-400 text-sm">Live on Conway Testnet</span>
            </div>
            <div className="w-px h-4 bg-dark-border" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent-orange" />
              <span className="text-white font-semibold">{stats.totalPlayers}</span>
              <span className="text-gray-400 text-sm">Players</span>
            </div>
            <div className="w-px h-4 bg-dark-border" />
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-accent-orange" />
              <span className="text-white font-semibold">{stats.totalXpEarned.toLocaleString()}</span>
              <span className="text-gray-400 text-sm">Total XP</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* Platform Features Section */}
      <section className="px-4">
        <div className="text-center mb-12">
          <h2 className="font-arcade text-3xl mb-4">
            <span className="text-accent-orange">COMPLETE</span> GAMING ECOSYSTEM
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Everything you need for on-chain gaming and predictions in one platform
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={Gamepad2}
            title="8 Mini Games"
            description="Speed Clicker, Memory Matrix, Snake Sprint, Math Blitz, and more"
            link="/games"
            delay={0}
          />
          <FeatureCard
            icon={TrendingUp}
            title="Crypto Predictions"
            description="Predict BTC & ETH prices. Real-time data, auto-resolved rounds"
            link="/predictions"
            delay={0.1}
          />
          <FeatureCard
            icon={Activity}
            title="Live Activity"
            description="Real-time feed of all games, predictions, and wins across the platform"
            link="/activity"
            delay={0.2}
          />
          <FeatureCard
            icon={Trophy}
            title="Global Leaderboard"
            description="Compete for the top spot. Earn XP and climb the ranks"
            link="/leaderboard"
            delay={0.3}
          />
        </div>
      </section>

      {/* Token Economy Section */}
      <section className="px-4">
        <div className="gradient-card rounded-2xl p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-arcade text-3xl mb-6">
                <span className="text-accent-orange">ARCADE</span> COINS
              </h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Our in-game token economy rewards active players. Earn coins by playing games, 
                claim daily bonuses, and use them to make predictions on crypto prices.
              </p>
              <ul className="space-y-4">
                <TokenFeature icon={Gift} text="100 coins welcome bonus on registration" />
                <TokenFeature icon={Timer} text="Claim 100 coins daily bonus every 24 hours" />
                <TokenFeature icon={Target} text="Win up to 1.9x on correct predictions" />
                <TokenFeature icon={BarChart3} text="Track your balance and history" />
              </ul>
            </div>
            <div className="flex justify-center">
              <motion.div
                animate={{ 
                  rotateY: [0, 10, 0, -10, 0],
                  y: [0, -10, 0]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="w-48 h-48 rounded-full bg-gradient-to-br from-accent-orange to-yellow-500 flex items-center justify-center shadow-[0_0_60px_rgba(255,107,0,0.4)]">
                  <Coins className="w-24 h-24 text-dark-bg" />
                </div>
                <div className="absolute -top-2 -right-2 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                  +
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Games Section */}
      <section className="px-4">
        <div className="flex items-center justify-between mb-8">
          <h2 className="font-arcade text-2xl">
            <span className="text-accent-orange">FEATURED</span> GAMES
          </h2>
          <Link 
            to="/games"
            className="text-accent-orange hover:text-white flex items-center gap-2 transition-colors group"
          >
            View All 8 Games
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Object.values(GAME_CONFIGS).slice(0, 4).map((game, index) => (
            <GameCard key={game.id} game={game} index={index} />
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="px-4 py-12">
        <h2 className="font-arcade text-3xl text-center mb-12">
          HOW IT <span className="text-accent-orange">WORKS</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              step: 1,
              title: 'Connect Wallet',
              description: 'Link your wallet via Dynamic.xyz',
              icon: Shield,
            },
            {
              step: 2,
              title: 'Register & Get Coins',
              description: 'Create profile, get 100 welcome coins',
              icon: Gift,
            },
            {
              step: 3,
              title: 'Play & Predict',
              description: 'Games for XP, predictions for coins',
              icon: Target,
            },
            {
              step: 4,
              title: 'Earn & Compete',
              description: 'Climb leaderboard, win rewards',
              icon: Trophy,
            },
          ].map((item, index) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              <div className="step-card rounded-xl p-6 text-center h-full">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-accent-orange flex items-center justify-center font-arcade text-dark-bg font-bold text-sm">
                  {item.step}
                </div>
                <div className="w-14 h-14 mx-auto mb-4 mt-4 rounded-lg bg-accent-orange/10 flex items-center justify-center">
                  <item.icon className="w-7 h-7 text-accent-orange" />
                </div>
                <h3 className="font-arcade text-sm text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-400 text-sm">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Prediction Markets Preview */}
      <section className="px-4">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="dark-card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <span className="text-2xl">₿</span>
              </div>
              <div>
                <h3 className="font-arcade text-lg text-white">BTC/USD</h3>
                <p className="text-gray-400 text-sm">5-minute rounds</p>
              </div>
            </div>
            <p className="text-gray-400 mb-6">
              Predict if Bitcoin price will go UP or DOWN. Real-time prices from CryptoCompare API.
            </p>
            <Link to="/predictions">
              <button className="btn-secondary w-full">
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Trade Now
                </span>
              </button>
            </Link>
          </div>

          <div className="dark-card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <span className="text-2xl">Ξ</span>
              </div>
              <div>
                <h3 className="font-arcade text-lg text-white">ETH/USD</h3>
                <p className="text-gray-400 text-sm">5-minute rounds</p>
              </div>
            </div>
            <p className="text-gray-400 mb-6">
              Predict Ethereum price movements. Auto-resolved with real market data.
            </p>
            <Link to="/predictions">
              <button className="btn-secondary w-full">
                <span className="flex items-center justify-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Trade Now
                </span>
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="px-4">
        <div className="dark-card rounded-2xl p-8 md:p-12 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Cpu className="w-8 h-8 text-accent-orange" />
            <h2 className="font-arcade text-2xl">
              POWERED BY <span className="text-accent-orange">LINERA</span>
            </h2>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto mb-8">
            Built on Linera's revolutionary microchain architecture. Each player gets their own 
            chain for instant, scalable gaming with full on-chain verification.
          </p>
          
          <div className="flex flex-wrap justify-center gap-3 mb-8">
            {[
              'Microchains', 
              'Rust Smart Contracts', 
              'GraphQL API', 
              'Conway Testnet',
              'PostgreSQL',
              'Real-time Prices'
            ].map((tech) => (
              <span 
                key={tech}
                className="px-4 py-2 rounded-full bg-dark-bg border border-dark-border text-gray-300 text-sm"
              >
                {tech}
              </span>
            ))}
          </div>
          
          {/* Connection status */}
          <div className="pt-6 border-t border-dark-border">
            <div className="flex items-center justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isAppConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-gray-400">
                {isAppConnected ? 'Connected to Linera Conway Testnet' : 'Connect wallet to interact with blockchain'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="cta-card rounded-2xl p-12 text-center"
        >
          <h2 className="font-arcade text-3xl md:text-4xl mb-6 text-white">
            READY TO <span className="text-accent-orange">PLAY</span>?
          </h2>
          <p className="text-gray-300 text-lg max-w-xl mx-auto mb-8">
            Join the Linera Arcade community. Play games, make predictions, and compete for glory.
          </p>
          <Link to="/games">
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 40px rgba(255, 107, 0, 0.5)' }}
              whileTap={{ scale: 0.95 }}
              className="btn-primary text-lg px-10 py-4"
            >
              <span className="flex items-center gap-3">
                START PLAYING
                <ArrowRight className="w-5 h-5" />
              </span>
            </motion.button>
          </Link>
        </motion.div>
      </section>
    </div>
  );
}

// Feature Card Component
interface FeatureCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  link: string;
  delay: number;
}

function FeatureCard({ icon: Icon, title, description, link, delay }: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
    >
      <Link to={link}>
        <div className="feature-card rounded-xl p-6 h-full group">
          <div className="w-12 h-12 rounded-lg bg-accent-orange/10 flex items-center justify-center mb-4 group-hover:bg-accent-orange/20 transition-colors">
            <Icon className="w-6 h-6 text-accent-orange" />
          </div>
          <h3 className="font-arcade text-lg text-white mb-2 group-hover:text-accent-orange transition-colors">
            {title}
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed">
            {description}
          </p>
          <div className="mt-4 flex items-center gap-2 text-accent-orange text-sm opacity-0 group-hover:opacity-100 transition-opacity">
            Explore <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// Token Feature Item
function TokenFeature({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-accent-orange/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-accent-orange" />
      </div>
      <span className="text-gray-300">{text}</span>
    </li>
  );
}

// Game Card Component
interface GameCardProps {
  game: typeof GAME_CONFIGS[keyof typeof GAME_CONFIGS];
  index: number;
}

function GameCard({ game, index }: GameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1 }}
    >
      <Link to={`/games/${game.id}`}>
        <div className="game-card rounded-xl p-6 h-full group">
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
            style={{ backgroundColor: `${game.color}15` }}
          >
            <Zap className="w-6 h-6" style={{ color: game.color }} />
          </div>
          
          <h3 
            className="font-arcade text-lg mb-2 transition-colors"
            style={{ color: game.color }}
          >
            {game.name}
          </h3>
          
          <p className="text-gray-400 text-sm mb-4 line-clamp-2">
            {game.description}
          </p>
          
          <div className="flex items-center justify-between pt-4 border-t border-dark-border">
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
