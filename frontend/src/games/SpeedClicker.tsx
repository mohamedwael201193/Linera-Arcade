import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GameResult } from '../types';

interface SpeedClickerGameProps {
  onComplete: (result: GameResult) => void;
}

const GAME_DURATION = 10; // seconds

export function SpeedClickerGame({ onComplete }: SpeedClickerGameProps) {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Start countdown on first click
  const handleClick = useCallback(() => {
    if (!hasStarted) {
      setHasStarted(true);
      setIsRunning(true);
    }
    if (isRunning) {
      setClicks(c => c + 1);
    }
  }, [hasStarted, isRunning]);

  // Timer effect
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Game over effect
  useEffect(() => {
    if (hasStarted && !isRunning && timeLeft === 0) {
      onComplete({
        score: clicks,
        timeElapsed: GAME_DURATION,
      });
    }
  }, [hasStarted, isRunning, timeLeft, clicks, onComplete]);

  const clicksPerSecond = hasStarted && GAME_DURATION - timeLeft > 0
    ? (clicks / (GAME_DURATION - timeLeft)).toFixed(1)
    : '0.0';

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 select-none">
      {/* Timer */}
      <div className="mb-8">
        <motion.div
          key={timeLeft}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className={`font-arcade text-6xl ${
            timeLeft <= 3 ? 'text-red-500' : 'text-neon-cyan'
          }`}
        >
          {timeLeft}s
        </motion.div>
      </div>

      {/* Click Counter */}
      <div className="mb-4 text-center">
        <motion.p
          key={clicks}
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          className="font-arcade text-5xl text-neon-pink"
        >
          {clicks}
        </motion.p>
        <p className="text-gray-400 text-sm">CLICKS</p>
      </div>

      {/* CPS Display */}
      <div className="mb-8 text-center">
        <p className="font-mono text-neon-green text-lg">
          {clicksPerSecond} CPS
        </p>
      </div>

      {/* Click Button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        disabled={hasStarted && !isRunning}
        className={`w-64 h-64 rounded-full font-arcade text-2xl transition-all ${
          !hasStarted
            ? 'bg-neon-pink text-arcade-darker animate-pulse'
            : isRunning
            ? 'bg-neon-pink text-arcade-darker shadow-neon-pink'
            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
        }`}
        style={{
          boxShadow: isRunning ? '0 0 40px #ff00ff, 0 0 80px #ff00ff40' : undefined,
        }}
      >
        {!hasStarted ? 'CLICK TO START' : isRunning ? 'CLICK!' : 'FINISHED!'}
      </motion.button>

      {/* Instructions */}
      {!hasStarted && (
        <p className="mt-6 text-gray-500 text-sm">
          Click as fast as you can for 10 seconds!
        </p>
      )}
    </div>
  );
}
