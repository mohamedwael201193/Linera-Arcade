import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { GameResult } from '../types';

interface SnakeSprintGameProps {
  onComplete: (result: GameResult) => void;
}

const GRID_SIZE = 20;
const CELL_SIZE = 18;
const INITIAL_SPEED = 120;
const SPEED_INCREMENT = 3;
const MIN_SPEED = 50;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

// Food types with different points
const FOOD_TYPES = {
  apple: { points: 1, color: '#22c55e', glow: 'rgba(34, 197, 94, 0.6)' },
  golden: { points: 3, color: '#fbbf24', glow: 'rgba(251, 191, 36, 0.6)' },
  special: { points: 5, color: '#f472b6', glow: 'rgba(244, 114, 182, 0.6)' },
};

type FoodType = keyof typeof FOOD_TYPES;

interface Food {
  position: Position;
  type: FoodType;
}

export function SnakeSprintGame({ onComplete }: SnakeSprintGameProps) {
  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]);
  const [food, setFood] = useState<Food>({ position: { x: 15, y: 10 }, type: 'apple' });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('snake_highscore');
    return saved ? parseInt(saved) : 0;
  });
  const [showStart, setShowStart] = useState(true);
  const [eatAnimation, setEatAnimation] = useState<Position | null>(null);
  const [gameTime, setGameTime] = useState(0);
  
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const gameLoopRef = useRef<ReturnType<typeof setTimeout>>();
  const speedRef = useRef(INITIAL_SPEED);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  // Generate random food position
  const generateFood = useCallback((currentSnake: Position[]): Food => {
    let newPosition: Position;
    do {
      newPosition = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(seg => seg.x === newPosition.x && seg.y === newPosition.y));
    
    // Random food type (70% apple, 20% golden, 10% special)
    const rand = Math.random();
    const type: FoodType = rand < 0.7 ? 'apple' : rand < 0.9 ? 'golden' : 'special';
    
    return { position: newPosition, type };
  }, []);

  // Move snake
  const moveSnake = useCallback(() => {
    // Update direction from queue
    directionRef.current = nextDirectionRef.current;
    setDirection(nextDirectionRef.current);
    
    setSnake(prevSnake => {
      const head = prevSnake[0];
      if (!head) return prevSnake;
      
      let newHead: Position;
      switch (directionRef.current) {
        case 'UP':
          newHead = { x: head.x, y: head.y - 1 };
          break;
        case 'DOWN':
          newHead = { x: head.x, y: head.y + 1 };
          break;
        case 'LEFT':
          newHead = { x: head.x - 1, y: head.y };
          break;
        case 'RIGHT':
          newHead = { x: head.x + 1, y: head.y };
          break;
      }

      // Check wall collision
      if (
        newHead.x < 0 || newHead.x >= GRID_SIZE ||
        newHead.y < 0 || newHead.y >= GRID_SIZE
      ) {
        setIsRunning(false);
        setGameOver(true);
        return prevSnake;
      }

      // Check self collision (excluding the tail which will move)
      const bodyToCheck = prevSnake.slice(0, -1);
      if (bodyToCheck.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        setIsRunning(false);
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food collision
      if (newHead.x === food.position.x && newHead.y === food.position.y) {
        const points = FOOD_TYPES[food.type].points;
        setScore(s => s + points * 10);
        setEatAnimation({ ...newHead });
        setTimeout(() => setEatAnimation(null), 300);
        setFood(generateFood(newSnake));
        // Speed up
        speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_INCREMENT);
        return newSnake; // Don't remove tail (snake grows)
      }

      // Remove tail
      newSnake.pop();
      return newSnake;
    });
  }, [food, generateFood]);

  // Game loop
  useEffect(() => {
    if (!isRunning || gameOver || isPaused) {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
      return;
    }

    const tick = () => {
      moveSnake();
      gameLoopRef.current = setTimeout(tick, speedRef.current);
    };

    gameLoopRef.current = setTimeout(tick, speedRef.current);
    
    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, [isRunning, gameOver, isPaused, moveSnake]);

  // Timer
  useEffect(() => {
    if (isRunning && !isPaused && !gameOver) {
      timerRef.current = setInterval(() => {
        setGameTime(t => t + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, isPaused, gameOver]);

  // Handle game over
  useEffect(() => {
    if (gameOver) {
      // Update high score
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('snake_highscore', score.toString());
      }
      
      onComplete({
        score: score,
        bonusData: snake.length,
        timeElapsed: gameTime,
      });
    }
  }, [gameOver, score, snake.length, highScore, gameTime, onComplete]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;

      // Pause control
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (isRunning) {
          setIsPaused(p => !p);
          return;
        }
      }

      // Space to start
      if (e.key === ' ' && showStart) {
        e.preventDefault();
        startGame();
        return;
      }

      if (isPaused || !isRunning) return;

      let newDirection: Direction | null = null;
      const currentDir = directionRef.current;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (currentDir !== 'DOWN') newDirection = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (currentDir !== 'UP') newDirection = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (currentDir !== 'RIGHT') newDirection = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (currentDir !== 'LEFT') newDirection = 'RIGHT';
          break;
      }

      if (newDirection) {
        e.preventDefault();
        nextDirectionRef.current = newDirection;
        // Direction queued
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, isRunning, isPaused, showStart]);

  // Touch controls
  const handleTouchDirection = (newDirection: Direction) => {
    if (gameOver || isPaused || !isRunning) return;
    const currentDir = directionRef.current;
    
    if (
      (newDirection === 'UP' && currentDir !== 'DOWN') ||
      (newDirection === 'DOWN' && currentDir !== 'UP') ||
      (newDirection === 'LEFT' && currentDir !== 'RIGHT') ||
      (newDirection === 'RIGHT' && currentDir !== 'LEFT')
    ) {
      nextDirectionRef.current = newDirection;
      // Direction queued
    }
  };

  // Start game
  const startGame = () => {
    setShowStart(false);
    setIsRunning(true);
  };

  // Restart game
  const restartGame = () => {
    setSnake([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
    setFood({ position: { x: 15, y: 10 }, type: 'apple' });
    setDirection('RIGHT');
    // Direction reset
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    speedRef.current = INITIAL_SPEED;
    setScore(0);
    setGameTime(0);
    setGameOver(false);
    setIsPaused(false);
    setShowStart(true);
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get snake segment style based on position
  const getSegmentStyle = (index: number, total: number) => {
    const isHead = index === 0;
    const progress = index / total;
    
    // Gradient from bright orange (head) to darker orange (tail)
    const r = Math.round(255 - progress * 100);
    const g = Math.round(107 - progress * 60);
    const b = Math.round(0);
    
    return {
      backgroundColor: isHead ? '#ff6b00' : `rgb(${r}, ${g}, ${b})`,
      boxShadow: isHead ? '0 0 15px rgba(255, 107, 0, 0.8)' : undefined,
      borderRadius: isHead ? '6px' : '4px',
      transform: isHead ? 'scale(1.05)' : undefined,
    };
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      {/* Stats Bar */}
      <div className="flex items-center justify-between w-full max-w-md mb-4 px-2">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Score</p>
            <p className="font-arcade text-2xl text-accent-orange">{score}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Length</p>
            <p className="font-arcade text-2xl text-white">{snake.length}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase tracking-wider">Time</p>
            <p className="font-arcade text-xl text-gray-400">{formatTime(gameTime)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-gray-500 text-xs uppercase tracking-wider">Best</p>
          <p className="font-arcade text-xl text-yellow-500">{highScore}</p>
        </div>
      </div>

      {/* Game Board */}
      <div className="relative">
        <motion.div 
          className="relative bg-gradient-to-br from-dark-bg to-dark-card border-2 border-accent-orange/50 rounded-lg overflow-hidden"
          style={{
            width: GRID_SIZE * CELL_SIZE + 4,
            height: GRID_SIZE * CELL_SIZE + 4,
            boxShadow: '0 0 30px rgba(255, 107, 0, 0.2), inset 0 0 60px rgba(0,0,0,0.5)',
          }}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* Grid pattern */}
          <div 
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: `
                linear-gradient(#ff6b00 1px, transparent 1px),
                linear-gradient(90deg, #ff6b00 1px, transparent 1px)
              `,
              backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
            }}
          />

          {/* Snake */}
          {snake.map((segment, i) => (
            <motion.div
              key={`${segment.x}-${segment.y}-${i}`}
              className="absolute"
              style={{
                left: segment.x * CELL_SIZE + 3,
                top: segment.y * CELL_SIZE + 3,
                width: CELL_SIZE - 2,
                height: CELL_SIZE - 2,
                ...getSegmentStyle(i, snake.length),
              }}
              initial={i === 0 ? { scale: 0.8 } : false}
              animate={{ scale: 1 }}
              transition={{ duration: 0.1 }}
            >
              {/* Snake eyes on head */}
              {i === 0 && (
                <>
                  <div 
                    className="absolute w-2 h-2 bg-white rounded-full"
                    style={{
                      top: direction === 'DOWN' ? '10px' : direction === 'UP' ? '2px' : '4px',
                      left: direction === 'RIGHT' ? '10px' : direction === 'LEFT' ? '2px' : '3px',
                    }}
                  >
                    <div 
                      className="absolute w-1 h-1 bg-dark-bg rounded-full"
                      style={{ top: '2px', left: '2px' }}
                    />
                  </div>
                  <div 
                    className="absolute w-2 h-2 bg-white rounded-full"
                    style={{
                      top: direction === 'DOWN' ? '10px' : direction === 'UP' ? '2px' : '4px',
                      right: direction === 'RIGHT' ? '2px' : direction === 'LEFT' ? '10px' : '3px',
                    }}
                  />
                </>
              )}
            </motion.div>
          ))}

          {/* Food */}
          <motion.div
            className="absolute rounded-full"
            style={{
              left: food.position.x * CELL_SIZE + 3,
              top: food.position.y * CELL_SIZE + 3,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              backgroundColor: FOOD_TYPES[food.type].color,
              boxShadow: `0 0 15px ${FOOD_TYPES[food.type].glow}`,
            }}
            animate={{ 
              scale: [1, 1.15, 1],
            }}
            transition={{ 
              duration: 0.6, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />

          {/* Eat animation */}
          <AnimatePresence>
            {eatAnimation && (
              <motion.div
                className="absolute pointer-events-none"
                style={{
                  left: eatAnimation.x * CELL_SIZE,
                  top: eatAnimation.y * CELL_SIZE,
                }}
                initial={{ scale: 1, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div 
                  className="w-5 h-5 rounded-full"
                  style={{ backgroundColor: FOOD_TYPES[food.type].color }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Start overlay */}
          <AnimatePresence>
            {showStart && (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <motion.div
                    initial={{ scale: 0.8, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <h3 className="font-arcade text-3xl text-accent-orange mb-4">SNAKE SPRINT</h3>
                    <div className="text-gray-400 text-sm mb-6 space-y-1">
                      <p>🎮 Use WASD or Arrow Keys</p>
                      <p>🍎 Eat food to grow</p>
                      <p>⚡ Speed increases over time</p>
                      <p className="text-xs mt-2">
                        <span className="text-green-500">●</span> +10 &nbsp;
                        <span className="text-yellow-500">●</span> +30 &nbsp;
                        <span className="text-pink-400">●</span> +50
                      </p>
                    </div>
                    <motion.button
                      onClick={startGame}
                      className="px-8 py-3 rounded-lg bg-gradient-to-r from-accent-orange to-accent-orange-light text-dark-bg font-arcade text-lg shadow-[0_0_20px_rgba(255,107,0,0.4)] hover:shadow-[0_0_30px_rgba(255,107,0,0.6)] transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Play className="inline w-5 h-5 mr-2" />
                      START
                    </motion.button>
                    <p className="text-gray-600 text-xs mt-4">or press SPACE</p>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Pause overlay */}
          <AnimatePresence>
            {isPaused && !gameOver && (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center bg-dark-bg/90 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center">
                  <Pause className="w-16 h-16 text-accent-orange mx-auto mb-4" />
                  <p className="font-arcade text-2xl text-white mb-4">PAUSED</p>
                  <motion.button
                    onClick={() => setIsPaused(false)}
                    className="px-6 py-2 rounded-lg bg-accent-orange text-dark-bg font-arcade"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    RESUME
                  </motion.button>
                  <p className="text-gray-600 text-xs mt-3">Press ESC or P</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Game Over overlay */}
          <AnimatePresence>
            {gameOver && (
              <motion.div 
                className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div 
                  className="text-center"
                  initial={{ scale: 0.8, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h3 className="font-arcade text-3xl text-red-500 mb-4">GAME OVER</h3>
                  <div className="bg-dark-card/50 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-gray-500 text-xs">SCORE</p>
                        <p className="font-arcade text-2xl text-accent-orange">{score}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">LENGTH</p>
                        <p className="font-arcade text-2xl text-white">{snake.length}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">TIME</p>
                        <p className="font-arcade text-xl text-gray-400">{formatTime(gameTime)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs">BEST</p>
                        <p className="font-arcade text-xl text-yellow-500">{highScore}</p>
                      </div>
                    </div>
                    {score >= highScore && score > 0 && (
                      <motion.p 
                        className="text-yellow-500 text-sm mt-3 font-bold"
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 0.5, repeat: Infinity }}
                      >
                        🏆 NEW HIGH SCORE! 🏆
                      </motion.p>
                    )}
                  </div>
                  <motion.button
                    onClick={restartGame}
                    className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-orange to-accent-orange-light text-dark-bg font-arcade shadow-[0_0_20px_rgba(255,107,0,0.4)]"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <RotateCcw className="inline w-5 h-5 mr-2" />
                    PLAY AGAIN
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-6 md:hidden">
        <div className="grid grid-cols-3 gap-2 w-36 mx-auto">
          <div />
          <motion.button
            className="w-12 h-12 rounded-lg bg-dark-card border border-accent-orange/30 flex items-center justify-center text-accent-orange active:bg-accent-orange/20"
            onTouchStart={() => handleTouchDirection('UP')}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronUp className="w-8 h-8" />
          </motion.button>
          <div />
          <motion.button
            className="w-12 h-12 rounded-lg bg-dark-card border border-accent-orange/30 flex items-center justify-center text-accent-orange active:bg-accent-orange/20"
            onTouchStart={() => handleTouchDirection('LEFT')}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeft className="w-8 h-8" />
          </motion.button>
          <motion.button
            className="w-12 h-12 rounded-lg bg-dark-card border border-accent-orange/30 flex items-center justify-center text-accent-orange active:bg-accent-orange/20"
            onTouchStart={() => handleTouchDirection('DOWN')}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronDown className="w-8 h-8" />
          </motion.button>
          <motion.button
            className="w-12 h-12 rounded-lg bg-dark-card border border-accent-orange/30 flex items-center justify-center text-accent-orange active:bg-accent-orange/20"
            onTouchStart={() => handleTouchDirection('RIGHT')}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRight className="w-8 h-8" />
          </motion.button>
        </div>
      </div>

      {/* Desktop Controls hint */}
      <div className="mt-4 text-gray-600 text-xs text-center hidden md:block">
        <p>↑ W  •  ↓ S  •  ← A  •  → D  •  ESC Pause</p>
      </div>

      {/* Pause button for running game */}
      {isRunning && !gameOver && !showStart && (
        <motion.button
          className="absolute top-4 right-4 p-2 rounded-lg bg-dark-card/50 border border-accent-orange/30 text-gray-400 hover:text-accent-orange"
          onClick={() => setIsPaused(!isPaused)}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </motion.button>
      )}
    </div>
  );
}
