import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GameResult } from '../types';

interface MemoryMatrixGameProps {
  onComplete: (result: GameResult) => void;
}

const GRID_SIZE = 4;
const INITIAL_PATTERN_LENGTH = 3;
const SHOW_DELAY = 800; // ms per tile
const GAME_OVER_LIVES = 3;

export function MemoryMatrixGame({ onComplete }: MemoryMatrixGameProps) {
  const [level, setLevel] = useState(1);
  const [pattern, setPattern] = useState<number[]>([]);
  const [playerPattern, setPlayerPattern] = useState<number[]>([]);
  const [showingPattern, setShowingPattern] = useState(false);
  const [highlightedTile, setHighlightedTile] = useState<number | null>(null);
  const [lives, setLives] = useState(GAME_OVER_LIVES);
  const [perfectRounds, setPerfectRounds] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isReady, setIsReady] = useState(true);
  const [wrongTile, setWrongTile] = useState<number | null>(null);

  // Generate new pattern
  const generatePattern = useCallback((length: number) => {
    const newPattern: number[] = [];
    for (let i = 0; i < length; i++) {
      newPattern.push(Math.floor(Math.random() * (GRID_SIZE * GRID_SIZE)));
    }
    return newPattern;
  }, []);

  // Start new round
  const startRound = useCallback(() => {
    const patternLength = INITIAL_PATTERN_LENGTH + level - 1;
    const newPattern = generatePattern(patternLength);
    setPattern(newPattern);
    setPlayerPattern([]);
    setIsReady(false);
    setShowingPattern(true);
    setWrongTile(null);

    // Show pattern sequence
    let index = 0;
    const interval = setInterval(() => {
      if (index < newPattern.length) {
        const tile = newPattern[index];
        if (tile !== undefined) {
          setHighlightedTile(tile);
          setTimeout(() => setHighlightedTile(null), SHOW_DELAY / 2);
        }
        index++;
      } else {
        clearInterval(interval);
        setShowingPattern(false);
      }
    }, SHOW_DELAY);

    return () => clearInterval(interval);
  }, [level, generatePattern]);

  // Start first round on mount
  useEffect(() => {
    if (isReady && !gameOver) {
      const timer = setTimeout(startRound, 1000);
      return () => clearTimeout(timer);
    }
  }, [isReady, gameOver, startRound]);

  // Handle tile click
  const handleTileClick = (tileIndex: number) => {
    if (showingPattern || gameOver) return;

    const expectedTile = pattern[playerPattern.length];
    const newPlayerPattern = [...playerPattern, tileIndex];
    setPlayerPattern(newPlayerPattern);

    if (tileIndex !== expectedTile) {
      // Wrong tile
      setWrongTile(tileIndex);
      const newLives = lives - 1;
      setLives(newLives);

      if (newLives <= 0) {
        setGameOver(true);
        onComplete({
          score: level,
          bonusData: perfectRounds,
          timeElapsed: 0,
        });
      } else {
        // Restart same level
        setTimeout(() => {
          setIsReady(true);
        }, 1000);
      }
      return;
    }

    // Highlight correct tile
    setHighlightedTile(tileIndex);
    setTimeout(() => setHighlightedTile(null), 200);

    // Check if pattern complete
    if (newPlayerPattern.length === pattern.length) {
      // Level complete!
      if (lives === GAME_OVER_LIVES) {
        setPerfectRounds(p => p + 1);
      }
      setLevel(l => l + 1);
      setTimeout(() => {
        setIsReady(true);
      }, 500);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Stats */}
      <div className="flex items-center gap-8 mb-8">
        <div className="text-center">
          <p className="text-gray-500 text-xs">LEVEL</p>
          <p className="font-arcade text-2xl text-neon-cyan">{level}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">LIVES</p>
          <p className="font-arcade text-2xl text-neon-pink">
            {'❤️'.repeat(lives)}{'🖤'.repeat(GAME_OVER_LIVES - lives)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">PERFECT</p>
          <p className="font-arcade text-2xl text-neon-yellow">{perfectRounds}</p>
        </div>
      </div>

      {/* Status */}
      <div className="mb-6 h-8">
        {showingPattern && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-arcade text-neon-cyan"
          >
            WATCH THE PATTERN...
          </motion.p>
        )}
        {!showingPattern && !gameOver && pattern.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-arcade text-neon-green"
          >
            YOUR TURN! ({playerPattern.length}/{pattern.length})
          </motion.p>
        )}
        {gameOver && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-arcade text-red-500"
          >
            GAME OVER!
          </motion.p>
        )}
      </div>

      {/* Grid */}
      <div 
        className="grid gap-3"
        style={{ 
          gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
          width: `${GRID_SIZE * 80}px`
        }}
      >
        {Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, i) => (
          <motion.button
            key={i}
            whileHover={!showingPattern && !gameOver ? { scale: 1.05 } : {}}
            whileTap={!showingPattern && !gameOver ? { scale: 0.95 } : {}}
            onClick={() => handleTileClick(i)}
            disabled={showingPattern || gameOver}
            className={`w-16 h-16 rounded-lg transition-all ${
              highlightedTile === i
                ? 'bg-neon-cyan shadow-neon-cyan'
                : wrongTile === i
                ? 'bg-red-500'
                : 'bg-arcade-card border border-arcade-border hover:border-neon-cyan'
            }`}
            style={{
              boxShadow: highlightedTile === i ? '0 0 20px #00ffff' : undefined,
            }}
          />
        ))}
      </div>

      {/* Instructions */}
      {isReady && !gameOver && (
        <p className="mt-6 text-gray-500 text-sm">
          Watch the pattern, then repeat it!
        </p>
      )}
    </div>
  );
}
