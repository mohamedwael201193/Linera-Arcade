import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface QuickMathProps {
  gameState: {
    round: number;
    maxRounds: number;
    problem: { a: number; b: number; operator: string; answer: number } | null;
    scores: Record<string, number>;
    roundWinner: string | null;
    status: 'waiting' | 'playing' | 'result';
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; answer?: number }) => void;
}

export default function QuickMath({ gameState, playerId, players, onAction }: QuickMathProps) {
  const [answer, setAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [lastProblem, setLastProblem] = useState<string | null>(null);
  
  const myScore = gameState.scores[playerId] || 0;
  const opponent = players.find(p => p.id !== playerId);
  const opponentScore = opponent ? (gameState.scores[opponent.id] || 0) : 0;
  const isHost = players[0]?.id === playerId;

  // Show result when round winner is determined
  useEffect(() => {
    if (gameState.roundWinner !== null) {
      setShowResult(true);
      setSubmitted(false);
    }
  }, [gameState.roundWinner]);

  // Reset state when new problem arrives (auto-advanced from server)
  useEffect(() => {
    const problemKey = gameState.problem ? `${gameState.problem.a}${gameState.problem.operator}${gameState.problem.b}` : null;
    if (problemKey && problemKey !== lastProblem) {
      setLastProblem(problemKey);
      setShowResult(false);
      setAnswer('');
      setSubmitted(false);
    }
  }, [gameState.problem, lastProblem]);

  // Start first round (only host)
  useEffect(() => {
    if (gameState.status === 'waiting' && gameState.round === 0 && isHost && !gameState.problem) {
      onAction({ type: 'start-round' });
    }
  }, [gameState.status, gameState.round, onAction, isHost, gameState.problem]);

  const handleSubmit = useCallback(() => {
    if (!answer || submitted) return;
    const numAnswer = parseInt(answer);
    if (isNaN(numAnswer)) return;
    setSubmitted(true);
    onAction({ type: 'answer', answer: numAnswer });
  }, [answer, submitted, onAction]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  }, [handleSubmit]);

  const formatOperator = (op: string) => {
    switch (op) {
      case '+': return '+';
      case '-': return '−';
      case '*': return '×';
      case '/': return '÷';
      default: return op;
    }
  };

  const getResultIcon = () => {
    if (gameState.roundWinner === playerId) return '✅';
    if (gameState.roundWinner === 'tie') return '🤝';
    return '❌';
  };

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

      {/* Math problem */}
      {gameState.problem && !showResult && (
        <motion.div
          key={gameState.round}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-gray-800/50 rounded-2xl p-8 text-center"
        >
          <div className="text-5xl font-bold text-white mb-6">
            {gameState.problem.a} {formatOperator(gameState.problem.operator)} {gameState.problem.b} = ?
          </div>
          
          {!submitted ? (
            <div className="flex gap-3 justify-center">
              <input
                type="number"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Your answer"
                autoFocus
                className="w-32 px-4 py-3 bg-gray-900 border-2 border-gray-700 rounded-xl text-white text-xl text-center focus:border-orange-500 focus:outline-none"
              />
              <motion.button
                onClick={handleSubmit}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl"
              >
                Submit
              </motion.button>
            </div>
          ) : (
            <div className="text-xl text-gray-400">
              ✅ Submitted! Waiting...
            </div>
          )}
        </motion.div>
      )}

      {/* Result */}
      {showResult && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-6xl mb-4">{getResultIcon()}</div>
          <div className="text-2xl font-bold text-white mb-2">
            {gameState.roundWinner === playerId 
              ? '🎉 You got it first!' 
              : gameState.roundWinner === 'tie'
                ? "🤝 It's a tie!"
                : `${opponent?.name || 'Opponent'} was faster!`}
          </div>
          <div className="text-gray-400">
            Answer: {gameState.problem?.answer}
          </div>
        </motion.div>
      )}

      {/* Instructions */}
      <div className="text-center text-gray-400 text-sm mt-4">
        🧮 Solve the problem faster than your opponent!
      </div>
    </div>
  );
}
