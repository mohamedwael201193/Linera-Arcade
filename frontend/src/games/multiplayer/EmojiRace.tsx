import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmojiRaceProps {
  gameState: {
    targetEmoji: string;
    emojis: string[];
    round: number;
    maxRounds: number;
    scores: Record<string, number>;
    roundWinner: string | null;
    status: 'playing' | 'result';
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; index?: number }) => void;
}

export default function EmojiRace({ gameState, playerId, players, onAction }: EmojiRaceProps) {
  const [showResult, setShowResult] = useState(false);
  const [clicked, setClicked] = useState(false);
  const [lastTargetEmoji, setLastTargetEmoji] = useState<string | null>(null);
  
  const myScore = gameState.scores[playerId] || 0;
  const opponent = players.find(p => p.id !== playerId);
  const opponentScore = opponent ? (gameState.scores[opponent.id] || 0) : 0;
  const isHost = players[0]?.id === playerId;

  // Show result when round winner is determined
  useEffect(() => {
    if (gameState.roundWinner !== null) {
      setShowResult(true);
      setClicked(false);
    }
  }, [gameState.roundWinner]);

  // Reset state when new emojis arrive (auto-advanced from server)
  useEffect(() => {
    if (gameState.targetEmoji && gameState.targetEmoji !== lastTargetEmoji) {
      setLastTargetEmoji(gameState.targetEmoji);
      setShowResult(false);
      setClicked(false);
    }
  }, [gameState.targetEmoji, lastTargetEmoji]);

  // Start first round (only host)
  useEffect(() => {
    if (gameState.status === 'playing' && gameState.round === 0 && !gameState.targetEmoji && isHost) {
      onAction({ type: 'start-round' });
    }
  }, [gameState.status, gameState.round, gameState.targetEmoji, onAction, isHost]);

  const handleEmojiClick = useCallback((index: number) => {
    if (clicked || showResult) return;
    setClicked(true);
    onAction({ type: 'click', index });
  }, [clicked, showResult, onAction]);

  const isGameOver = gameState.round >= gameState.maxRounds && gameState.roundWinner !== null;

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Round indicator */}
      <div className="text-center">
        <div className="text-gray-400 text-sm">Round</div>
        <div className="text-2xl font-bold text-orange-400">
          {Math.min(gameState.round + 1, gameState.maxRounds)} / {gameState.maxRounds}
        </div>
      </div>

      {/* Scores */}
      <div className="flex justify-center gap-8 mb-4">
        <div className="text-center p-3 rounded-xl bg-gray-800/50">
          <div className="text-sm text-gray-400">You</div>
          <div className="text-3xl font-bold text-orange-400">{myScore}</div>
        </div>
        <div className="text-2xl font-bold text-gray-500 self-center">VS</div>
        <div className="text-center p-3 rounded-xl bg-gray-800/50">
          <div className="text-sm text-gray-400">{opponent?.name || 'Opponent'}</div>
          <div className="text-3xl font-bold text-blue-400">{opponentScore}</div>
        </div>
      </div>

      {/* Target emoji */}
      {gameState.targetEmoji && !showResult && !isGameOver && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <div className="text-gray-400 text-sm mb-2">Find this emoji!</div>
          <motion.div
            className="text-7xl p-4 bg-orange-500/20 rounded-2xl border-2 border-orange-500"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 1 }}
          >
            {gameState.targetEmoji}
          </motion.div>
        </motion.div>
      )}

      {/* Emoji grid */}
      {gameState.emojis && gameState.emojis.length > 0 && !showResult && !isGameOver && (
        <motion.div
          key={gameState.round}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="grid grid-cols-5 gap-2 p-4 bg-gray-800/50 rounded-2xl"
        >
          {gameState.emojis.map((emoji, index) => (
            <motion.button
              key={index}
              onClick={() => handleEmojiClick(index)}
              disabled={clicked}
              className={`
                w-12 h-12 sm:w-14 sm:h-14 rounded-xl text-2xl sm:text-3xl
                flex items-center justify-center
                ${clicked 
                  ? 'bg-gray-700 cursor-not-allowed' 
                  : 'bg-gray-700 hover:bg-gray-600 cursor-pointer'
                }
                transition-all duration-150
              `}
              whileHover={!clicked ? { scale: 1.1 } : {}}
              whileTap={!clicked ? { scale: 0.9 } : {}}
            >
              {emoji}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Round result */}
      <AnimatePresence>
        {showResult && !isGameOver && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="text-center"
          >
            <div className="text-5xl mb-2">
              {gameState.roundWinner === playerId ? '✅' : gameState.roundWinner === 'wrong' ? '❌' : '😔'}
            </div>
            <div className="text-xl font-bold text-white">
              {gameState.roundWinner === playerId 
                ? 'You found it first!' 
                : gameState.roundWinner === 'wrong'
                  ? 'Wrong emoji!'
                  : `${opponent?.name || 'Opponent'} was faster!`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game over */}
      {isGameOver && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-5xl mb-4">
            {myScore > opponentScore ? '🎉🏆🎉' : myScore < opponentScore ? '😔' : '🤝'}
          </div>
          <div className="text-2xl font-bold text-white mb-2">
            {myScore > opponentScore 
              ? 'You Win!' 
              : myScore < opponentScore 
                ? `${opponent?.name || 'Opponent'} Wins!`
                : "It's a Tie!"}
          </div>
          <div className="text-gray-400">
            Final Score: {myScore} - {opponentScore}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      {!showResult && !isGameOver && (
        <div className="text-center text-gray-400 text-sm">
          👆 Be the first to click the target emoji!
        </div>
      )}
    </div>
  );
}
