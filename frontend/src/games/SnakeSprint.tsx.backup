import { useState, useEffect, useCallback, useRef } from 'react';
import type { GameResult } from '../types';

interface SnakeSprintGameProps {
  onComplete: (result: GameResult) => void;
}

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;
const SPEED_INCREMENT = 5;
const MIN_SPEED = 60;

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

export function SnakeSprintGame({ onComplete }: SnakeSprintGameProps) {
  const [snake, setSnake] = useState<Position[]>([{ x: 10, y: 10 }]);
  const [apple, setApple] = useState<Position>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>('RIGHT');
  const [isRunning, setIsRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [applesEaten, setApplesEaten] = useState(0);
  const [showStart, setShowStart] = useState(true);
  
  const directionRef = useRef(direction);
  const gameLoopRef = useRef<number>();
  const speedRef = useRef(INITIAL_SPEED);

  // Generate random apple position
  const generateApple = useCallback((currentSnake: Position[]): Position => {
    let newApple: Position;
    do {
      newApple = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
    } while (currentSnake.some(seg => seg.x === newApple.x && seg.y === newApple.y));
    return newApple;
  }, []);

  // Move snake
  const moveSnake = useCallback(() => {
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

      // Check self collision
      if (prevSnake.some(seg => seg.x === newHead.x && seg.y === newHead.y)) {
        setIsRunning(false);
        setGameOver(true);
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check apple collision
      if (newHead.x === apple.x && newHead.y === apple.y) {
        setApplesEaten(a => a + 1);
        setApple(generateApple(newSnake));
        // Speed up
        speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_INCREMENT);
        return newSnake; // Don't remove tail (snake grows)
      }

      // Remove tail
      newSnake.pop();
      return newSnake;
    });
  }, [apple, generateApple]);

  // Game loop
  useEffect(() => {
    if (!isRunning || gameOver) return;

    const tick = () => {
      moveSnake();
      gameLoopRef.current = window.setTimeout(tick, speedRef.current);
    };

    gameLoopRef.current = window.setTimeout(tick, speedRef.current);
    
    return () => {
      if (gameLoopRef.current) {
        clearTimeout(gameLoopRef.current);
      }
    };
  }, [isRunning, gameOver, moveSnake]);

  // Handle game over
  useEffect(() => {
    if (gameOver) {
      onComplete({
        score: snake.length,
        bonusData: applesEaten,
        timeElapsed: 0,
      });
    }
  }, [gameOver, snake.length, applesEaten, onComplete]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameOver) return;

      let newDirection: Direction | null = null;

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (directionRef.current !== 'DOWN') newDirection = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (directionRef.current !== 'UP') newDirection = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (directionRef.current !== 'RIGHT') newDirection = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (directionRef.current !== 'LEFT') newDirection = 'RIGHT';
          break;
      }

      if (newDirection) {
        e.preventDefault();
        directionRef.current = newDirection;
        setDirection(newDirection);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver]);

  // Start game
  const startGame = () => {
    setShowStart(false);
    setIsRunning(true);
  };

  return (
    <div className="h-full flex flex-col items-center justify-center p-4">
      {/* Stats */}
      <div className="flex items-center gap-8 mb-4">
        <div className="text-center">
          <p className="text-gray-500 text-xs">LENGTH</p>
          <p className="font-arcade text-2xl text-neon-orange">{snake.length}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">APPLES</p>
          <p className="font-arcade text-2xl text-neon-green">{applesEaten}</p>
        </div>
      </div>

      {/* Game Board */}
      <div 
        className="relative bg-arcade-dark border-2 border-neon-orange"
        style={{
          width: GRID_SIZE * CELL_SIZE,
          height: GRID_SIZE * CELL_SIZE,
          boxShadow: '0 0 20px rgba(255, 136, 0, 0.3)',
        }}
      >
        {/* Grid lines */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(#ff8800 1px, transparent 1px),
              linear-gradient(90deg, #ff8800 1px, transparent 1px)
            `,
            backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px`,
          }}
        />

        {/* Snake */}
        {snake.map((segment, i) => (
          <div
            key={i}
            className={`absolute rounded-sm ${i === 0 ? 'bg-neon-orange' : 'bg-orange-500'}`}
            style={{
              left: segment.x * CELL_SIZE + 1,
              top: segment.y * CELL_SIZE + 1,
              width: CELL_SIZE - 2,
              height: CELL_SIZE - 2,
              boxShadow: i === 0 ? '0 0 10px #ff8800' : undefined,
            }}
          />
        ))}

        {/* Apple */}
        <div
          className="absolute rounded-full bg-neon-green"
          style={{
            left: apple.x * CELL_SIZE + 2,
            top: apple.y * CELL_SIZE + 2,
            width: CELL_SIZE - 4,
            height: CELL_SIZE - 4,
            boxShadow: '0 0 10px #00ff00',
          }}
        />

        {/* Start overlay */}
        {showStart && (
          <div className="absolute inset-0 flex items-center justify-center bg-arcade-dark/90">
            <div className="text-center">
              <p className="text-gray-400 text-sm mb-4">
                Use WASD or Arrow Keys to move
              </p>
              <button
                onClick={startGame}
                className="px-6 py-3 rounded-lg bg-neon-orange text-arcade-darker font-arcade"
              >
                START
              </button>
            </div>
          </div>
        )}

        {/* Game Over overlay */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-arcade-dark/90">
            <div className="text-center">
              <p className="font-arcade text-2xl text-red-500 mb-2">
                GAME OVER
              </p>
              <p className="text-gray-400">
                Length: {snake.length} | Apples: {applesEaten}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Controls hint */}
      <div className="mt-4 text-gray-500 text-sm text-center">
        <p>↑ W | ↓ S | ← A | → D</p>
      </div>
    </div>
  );
}
