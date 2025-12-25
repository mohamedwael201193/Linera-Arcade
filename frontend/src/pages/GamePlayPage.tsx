import { useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  Play, 
  Trophy, 
  Sparkles, 
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { useArcade } from '../hooks';
import { 
  GameType, 
  getGameConfig, 
  GAME_CONFIGS, 
  estimateXp,
  GAME_TYPE_TO_CONTRACT,
  type GameResult 
} from '../types';
import { GameType as ContractGameType } from '../lib/arcade';

// Import game components
import { SpeedClickerGame } from '../games/SpeedClicker';
import { MemoryMatrixGame } from '../games/MemoryMatrix';
import { ReactionStrikeGame } from '../games/ReactionStrike';
import { MathBlitzGame } from '../games/MathBlitz';
import { SnakeSprintGame } from '../games/SnakeSprint';

type GameState = 'ready' | 'playing' | 'finished' | 'submitting' | 'submitted';

const GAME_COMPONENTS: Record<GameType, React.FC<{ onComplete: (result: GameResult) => void }>> = {
  SPEED_CLICKER: SpeedClickerGame,
  MEMORY_MATRIX: MemoryMatrixGame,
  REACTION_STRIKE: ReactionStrikeGame,
  MATH_BLITZ: MathBlitzGame,
  SNAKE_SPRINT: SnakeSprintGame,
};

export function GamePlayPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { 
    submitScore, 
    isRegistered, 
    player, 
    canSubmitScore,
    isAppConnected 
  } = useArcade();

  const [gameState, setGameState] = useState<GameState>('ready');
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Validate game ID
  if (!gameId || !(gameId in GAME_CONFIGS)) {
    return (
      <div className="text-center py-20">
        <h1 className="font-arcade text-2xl text-red-400 mb-4">GAME NOT FOUND</h1>
        <Link to="/games" className="text-neon-cyan hover:underline">
          ← Back to Games
        </Link>
      </div>
    );
  }

  const gameType = gameId as GameType;
  const gameConfig = getGameConfig(gameType);
  const GameComponent = GAME_COMPONENTS[gameType];

  const handleStartGame = () => {
    setGameState('playing');
    setGameResult(null);
    setError(null);
  };

  const handleGameComplete = useCallback((result: GameResult) => {
    setGameResult(result);
    setGameState('finished');
    
    // Calculate estimated XP
    const estimated = estimateXp(gameType, result.score, result.bonusData);
    setXpEarned(estimated);
  }, [gameType]);

  const handleSubmitScore = async () => {
    if (!gameResult || !canSubmitScore) return;

    setGameState('submitting');
    setError(null);

    try {
      // Convert frontend GameType to contract GameType
      const contractGameType = GAME_TYPE_TO_CONTRACT[gameType] as ContractGameType;
      
      // submitScore returns boolean, bonusData is an optional number
      const success = await submitScore(
        contractGameType, 
        gameResult.score, 
        gameResult.bonusData
      );
      
      if (success) {
        // Estimate XP earned based on game type and score
        setXpEarned(estimateXp(gameType, gameResult.score, gameResult.bonusData));
        setGameState('submitted');
      } else {
        setError('Failed to submit score. Please try again.');
        setGameState('finished');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit score');
      setGameState('finished');
    }
  };

  const handlePlayAgain = () => {
    setGameState('ready');
    setGameResult(null);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link 
          to="/games"
          className="p-2 rounded-lg bg-arcade-card border border-arcade-border hover:border-neon-cyan transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div>
          <h1 
            className="font-arcade text-2xl"
            style={{ color: gameConfig.color }}
          >
            {gameConfig.name}
          </h1>
          <p className="text-gray-400 text-sm">{gameConfig.description}</p>
        </div>
      </motion.div>

      {/* Game Container */}
      <div className="arcade-card rounded-xl overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Ready State */}
          {gameState === 'ready' && (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              <h2 className="font-arcade text-xl mb-6" style={{ color: gameConfig.color }}>
                HOW TO PLAY
              </h2>
              
              <ul className="text-left max-w-md mx-auto mb-8 space-y-3">
                {gameConfig.instructions.map((instruction, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <span 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: gameConfig.color, color: '#0a0a12' }}
                    >
                      {i + 1}
                    </span>
                    {instruction}
                  </li>
                ))}
              </ul>

              <div className="bg-arcade-darker rounded-lg p-4 mb-8 inline-block">
                <p className="text-gray-500 text-xs mb-1">XP FORMULA</p>
                <p className="font-mono text-neon-green">{gameConfig.xpFormula}</p>
              </div>

              <div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartGame}
                  className="px-8 py-4 rounded-lg font-arcade text-lg flex items-center justify-center gap-3 mx-auto"
                  style={{ 
                    backgroundColor: gameConfig.color,
                    color: '#0a0a12'
                  }}
                >
                  <Play className="w-6 h-6" />
                  START GAME
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* Playing State */}
          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="game-container"
            >
              <GameComponent onComplete={handleGameComplete} />
            </motion.div>
          )}

          {/* Finished State */}
          {(gameState === 'finished' || gameState === 'submitting' || gameState === 'submitted') && gameResult && (
            <motion.div
              key="finished"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="p-8 text-center"
            >
              {gameState === 'submitted' ? (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle className="w-20 h-20 text-neon-green mx-auto mb-4" />
                  </motion.div>
                  <h2 className="font-arcade text-2xl text-neon-green mb-2">
                    SCORE SUBMITTED!
                  </h2>
                  <p className="text-gray-400 text-sm mb-4">
                    Your score has been recorded on the Linera blockchain
                  </p>
                </>
              ) : (
                <>
                  <Trophy className="w-16 h-16 text-neon-yellow mx-auto mb-4" />
                  <h2 className="font-arcade text-2xl mb-2">GAME OVER</h2>
                </>
              )}

              {/* Score Display */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto my-8">
                <div className="bg-arcade-darker rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-1">SCORE</p>
                  <p 
                    className="font-arcade text-3xl"
                    style={{ color: gameConfig.color }}
                  >
                    {(gameResult?.score ?? 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-arcade-darker rounded-lg p-4">
                  <p className="text-gray-500 text-xs mb-1">XP EARNED</p>
                  <p className="font-arcade text-3xl text-neon-yellow flex items-center justify-center gap-2">
                    <Sparkles className="w-6 h-6" />
                    {(xpEarned ?? 0).toLocaleString()}
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm mb-4 justify-center">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap justify-center gap-4">
                {gameState === 'finished' && (
                  <>
                    {canSubmitScore ? (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleSubmitScore}
                        className="px-6 py-3 rounded-lg bg-neon-cyan text-arcade-darker font-arcade flex items-center gap-2"
                      >
                        <Trophy className="w-5 h-5" />
                        SUBMIT SCORE
                      </motion.button>
                    ) : !isAppConnected ? (
                      <p className="text-gray-400 text-sm">
                        Connect wallet to submit scores to blockchain
                      </p>
                    ) : !isRegistered ? (
                      <Link to="/profile">
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="px-6 py-3 rounded-lg bg-neon-pink text-arcade-darker font-arcade"
                        >
                          REGISTER TO SUBMIT
                        </motion.button>
                      </Link>
                    ) : (
                      <p className="text-gray-400 text-sm">
                        Cannot submit score at this time
                      </p>
                    )}
                  </>
                )}

                {gameState === 'submitting' && (
                  <div className="flex items-center gap-3 text-neon-cyan">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="font-arcade">SUBMITTING TO BLOCKCHAIN...</span>
                  </div>
                )}

                {(gameState === 'finished' || gameState === 'submitted') && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePlayAgain}
                    className="px-6 py-3 rounded-lg border-2 border-arcade-border text-gray-300 font-arcade hover:border-neon-pink hover:text-neon-pink transition-colors"
                  >
                    PLAY AGAIN
                  </motion.button>
                )}

                {gameState === 'submitted' && (
                  <Link to="/leaderboard">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className="px-6 py-3 rounded-lg border-2 border-neon-yellow text-neon-yellow font-arcade"
                    >
                      VIEW LEADERBOARD
                    </motion.button>
                  </Link>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Player Info */}
      {player && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 arcade-card rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan flex items-center justify-center font-bold">
              {player.username.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-arcade text-sm">{player.username}</p>
              <p className="text-gray-500 text-xs">Level {player.level ?? 1}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-gray-500 text-xs">TOTAL XP</p>
            <p className="font-arcade text-neon-yellow">
              {(player.totalXp ?? 0).toLocaleString()}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
