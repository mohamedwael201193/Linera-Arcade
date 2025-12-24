import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { GameResult } from '../types';

interface ReactionStrikeGameProps {
  onComplete: (result: GameResult) => void;
}

const TOTAL_TARGETS = 15;
const MAX_MISSES = 3;
const MIN_DELAY = 500;
const MAX_DELAY = 2000;
const TARGET_VISIBLE_TIME = 1500;

interface Target {
  id: number;
  x: number;
  y: number;
  size: number;
}

export function ReactionStrikeGame({ onComplete }: ReactionStrikeGameProps) {
  const [targetsHit, setTargetsHit] = useState(0);
  const [misses, setMisses] = useState(0);
  const [reactionTimes, setReactionTimes] = useState<number[]>([]);
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [isWaiting, setIsWaiting] = useState(true);
  const [showStart, setShowStart] = useState(true);
  
  const targetAppearTime = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Spawn a new target
  const spawnTarget = useCallback(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const padding = 60;
    const size = 50 + Math.random() * 30;
    
    const target: Target = {
      id: Date.now(),
      x: padding + Math.random() * (rect.width - padding * 2 - size),
      y: padding + Math.random() * (rect.height - padding * 2 - size),
      size,
    };

    setCurrentTarget(target);
    targetAppearTime.current = performance.now();
    setIsWaiting(false);

    // Auto-miss if not clicked in time
    const missTimeout = setTimeout(() => {
      if (currentTarget?.id === target.id) {
        handleMiss();
      }
    }, TARGET_VISIBLE_TIME);

    return () => clearTimeout(missTimeout);
  }, []);

  // Schedule next target
  const scheduleNextTarget = useCallback(() => {
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY);
    setIsWaiting(true);
    setCurrentTarget(null);
    
    const timeout = setTimeout(spawnTarget, delay);
    return () => clearTimeout(timeout);
  }, [spawnTarget]);

  // Handle target hit
  const handleTargetHit = () => {
    if (!currentTarget || gameOver) return;

    const reactionTime = performance.now() - targetAppearTime.current;
    setReactionTimes(prev => [...prev, reactionTime]);
    setTargetsHit(prev => {
      const newCount = prev + 1;
      if (newCount >= TOTAL_TARGETS) {
        // Game complete!
        const avgReaction = [...reactionTimes, reactionTime].reduce((a, b) => a + b, 0) / (reactionTimes.length + 1);
        setGameOver(true);
        onComplete({
          score: Math.round(avgReaction),
          bonusData: newCount,
          timeElapsed: 0,
        });
      }
      return newCount;
    });
    
    if (targetsHit + 1 < TOTAL_TARGETS) {
      scheduleNextTarget();
    }
  };

  // Handle miss (clicked wrong area or timeout)
  const handleMiss = () => {
    if (gameOver) return;
    
    setMisses(prev => {
      const newMisses = prev + 1;
      if (newMisses >= MAX_MISSES) {
        const avgReaction = reactionTimes.length > 0
          ? reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length
          : 1000;
        setGameOver(true);
        onComplete({
          score: Math.round(avgReaction),
          bonusData: targetsHit,
          timeElapsed: 0,
        });
      }
      return newMisses;
    });
    
    if (misses + 1 < MAX_MISSES) {
      scheduleNextTarget();
    }
  };

  // Handle background click (miss)
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === containerRef.current && currentTarget && !gameOver) {
      handleMiss();
    }
  };

  // Start game
  const startGame = () => {
    setShowStart(false);
    scheduleNextTarget();
  };

  // Calculate average reaction time
  const avgReaction = reactionTimes.length > 0
    ? Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    : 0;

  return (
    <div className="h-full flex flex-col">
      {/* Stats Bar */}
      <div className="flex items-center justify-between p-4 bg-arcade-darker border-b border-arcade-border">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-gray-500 text-xs">TARGETS</p>
            <p className="font-arcade text-lg text-neon-green">
              {targetsHit}/{TOTAL_TARGETS}
            </p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">MISSES</p>
            <p className="font-arcade text-lg text-red-500">
              {misses}/{MAX_MISSES}
            </p>
          </div>
        </div>
        <div>
          <p className="text-gray-500 text-xs">AVG REACTION</p>
          <p className="font-arcade text-lg text-neon-cyan">
            {avgReaction}ms
          </p>
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={containerRef}
        onClick={handleBackgroundClick}
        className="flex-1 relative bg-arcade-dark cursor-crosshair overflow-hidden"
      >
        {/* Start overlay */}
        {showStart && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-arcade-dark/80 z-10"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              className="px-8 py-4 rounded-lg bg-neon-green text-arcade-darker font-arcade text-lg"
            >
              START GAME
            </motion.button>
          </motion.div>
        )}

        {/* Waiting indicator */}
        {isWaiting && !showStart && !gameOver && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-arcade text-gray-600 animate-pulse">
              WAIT FOR TARGET...
            </p>
          </div>
        )}

        {/* Target */}
        {currentTarget && !gameOver && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              handleTargetHit();
            }}
            className="absolute rounded-full bg-neon-green cursor-pointer"
            style={{
              left: currentTarget.x,
              top: currentTarget.y,
              width: currentTarget.size,
              height: currentTarget.size,
              boxShadow: '0 0 20px #00ff00, 0 0 40px #00ff0040',
            }}
          />
        )}

        {/* Game Over */}
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-arcade-dark/80"
          >
            <div className="text-center">
              <p className="font-arcade text-2xl text-neon-green mb-2">
                {targetsHit >= TOTAL_TARGETS ? 'COMPLETE!' : 'GAME OVER'}
              </p>
              <p className="text-gray-400">
                Average reaction: {avgReaction}ms
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
