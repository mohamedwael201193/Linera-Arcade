import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RockPaperScissorsProps {
  gameState: {
    round: number;
    maxRounds: number;
    choices: Record<string, string>;
    scores: Record<string, number>;
    roundResult?: { winner: string | null; playerChoices: Record<string, string> };
    status: 'choosing' | 'reveal' | 'waiting';
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; choice?: string }) => void;
}

const CHOICES = [
  { id: 'rock', emoji: '🪨', name: 'Rock', beats: 'scissors' },
  { id: 'paper', emoji: '📄', name: 'Paper', beats: 'rock' },
  { id: 'scissors', emoji: '✂️', name: 'Scissors', beats: 'paper' },
];

export default function RockPaperScissors({ gameState, playerId, players, onAction }: RockPaperScissorsProps) {
  const [myChoice, setMyChoice] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const lastRoundRef = useRef(gameState.round);
  
  const myScore = gameState.scores[playerId] || 0;
  const opponent = players.find(p => p.id !== playerId);
  const opponentScore = opponent ? (gameState.scores[opponent.id] || 0) : 0;
  const hasChosen = gameState.choices[playerId] !== undefined;
  const opponentChosen = opponent && gameState.choices[opponent.id] !== undefined;

  // Handle round result and advance to next round
  useEffect(() => {
    if (gameState.roundResult && gameState.status === 'reveal') {
      setShowResult(true);
      const timer = setTimeout(() => {
        setShowResult(false);
        setMyChoice(null);
        // Request next round (only one player needs to do this)
        if (players[0]?.id === playerId && gameState.round < gameState.maxRounds) {
          onAction({ type: 'next-round' });
        }
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [gameState.roundResult, gameState.status, gameState.round, gameState.maxRounds, playerId, players, onAction]);

  // Reset choice when new round starts
  useEffect(() => {
    if (gameState.round !== lastRoundRef.current) {
      lastRoundRef.current = gameState.round;
      setMyChoice(null);
      setShowResult(false);
    }
  }, [gameState.round]);

  const handleChoice = (choice: string) => {
    if (hasChosen || showResult) return;
    setMyChoice(choice);
    onAction({ type: 'choose', choice });
  };

  const getResultEmoji = () => {
    if (!gameState.roundResult) return '';
    const { winner } = gameState.roundResult;
    if (winner === playerId) return '🎉';
    if (winner === null) return '🤝';
    return '😔';
  };

  const getResultText = () => {
    if (!gameState.roundResult) return '';
    const { winner } = gameState.roundResult;
    if (winner === playerId) return 'You Win This Round!';
    if (winner === null) return "It's a Tie!";
    return 'You Lost This Round';
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Round indicator */}
      <div className="text-center">
        <div className="text-gray-400 text-sm">Round</div>
        <div className="text-2xl font-bold text-orange-400">
          {gameState.round} / {gameState.maxRounds}
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

      {/* Battle arena */}
      <div className="flex items-center justify-center gap-8 py-6">
        {/* Your choice */}
        <motion.div
          className="w-24 h-24 rounded-2xl bg-orange-500/20 border-2 border-orange-500 flex items-center justify-center"
          animate={showResult && gameState.roundResult?.winner === playerId ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: showResult ? 3 : 0, duration: 0.3 }}
        >
          {myChoice || hasChosen ? (
            <span className="text-5xl">
              {CHOICES.find(c => c.id === (showResult ? gameState.roundResult?.playerChoices[playerId] : myChoice))?.emoji || '❓'}
            </span>
          ) : (
            <span className="text-4xl text-gray-500">?</span>
          )}
        </motion.div>

        <div className="text-3xl font-bold text-gray-500">⚡</div>

        {/* Opponent choice */}
        <motion.div
          className="w-24 h-24 rounded-2xl bg-blue-500/20 border-2 border-blue-500 flex items-center justify-center"
          animate={showResult && gameState.roundResult?.winner === opponent?.id ? { scale: [1, 1.1, 1] } : {}}
          transition={{ repeat: showResult ? 3 : 0, duration: 0.3 }}
        >
          {showResult && gameState.roundResult ? (
            <span className="text-5xl">
              {CHOICES.find(c => c.id === gameState.roundResult?.playerChoices[opponent?.id || ''])?.emoji || '❓'}
            </span>
          ) : opponentChosen ? (
            <span className="text-4xl">✅</span>
          ) : (
            <span className="text-4xl text-gray-500">?</span>
          )}
        </motion.div>
      </div>

      {/* Result display */}
      <AnimatePresence>
        {showResult && gameState.roundResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center"
          >
            <div className="text-4xl mb-2">{getResultEmoji()}</div>
            <div className="text-xl font-bold text-white">{getResultText()}</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choice buttons */}
      {!hasChosen && !showResult && (
        <div className="flex gap-4">
          {CHOICES.map((choice) => (
            <motion.button
              key={choice.id}
              onClick={() => handleChoice(choice.id)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-800 hover:bg-gray-700 border-2 border-gray-600 hover:border-orange-500 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-4xl">{choice.emoji}</span>
              <span className="text-sm text-gray-400">{choice.name}</span>
            </motion.button>
          ))}
        </div>
      )}

      {/* Waiting status */}
      {hasChosen && !showResult && (
        <div className="text-center text-gray-400">
          {opponentChosen ? (
            <span>Revealing...</span>
          ) : (
            <span>Waiting for {opponent?.name || 'opponent'}...</span>
          )}
        </div>
      )}
    </div>
  );
}
