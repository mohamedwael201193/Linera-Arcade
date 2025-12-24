import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { GameResult } from '../types';

interface MathBlitzGameProps {
  onComplete: (result: GameResult) => void;
}

const GAME_DURATION = 60; // seconds
const OPERATIONS = ['+', '-', '×'] as const;
type Operation = typeof OPERATIONS[number];

interface Problem {
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
  options: number[];
}

export function MathBlitzGame({ onComplete }: MathBlitzGameProps) {
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showStart, setShowStart] = useState(true);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  // Generate a math problem
  const generateProblem = useCallback((): Problem => {
    const opIndex = Math.floor(Math.random() * OPERATIONS.length);
    const operation = OPERATIONS[opIndex] ?? '+';
    let num1: number, num2: number, answer: number;

    switch (operation) {
      case '+':
        num1 = Math.floor(Math.random() * 50) + 1;
        num2 = Math.floor(Math.random() * 50) + 1;
        answer = num1 + num2;
        break;
      case '-':
        num1 = Math.floor(Math.random() * 50) + 20;
        num2 = Math.floor(Math.random() * num1);
        answer = num1 - num2;
        break;
      case '×':
        num1 = Math.floor(Math.random() * 12) + 1;
        num2 = Math.floor(Math.random() * 12) + 1;
        answer = num1 * num2;
        break;
    }

    // Generate options including the correct answer
    const options = new Set<number>([answer]);
    while (options.size < 4) {
      const offset = Math.floor(Math.random() * 20) - 10;
      const wrongAnswer = answer + offset;
      if (wrongAnswer > 0 && wrongAnswer !== answer) {
        options.add(wrongAnswer);
      }
    }

    return {
      num1,
      num2,
      operation,
      answer,
      options: Array.from(options).sort(() => Math.random() - 0.5),
    };
  }, []);

  // Start game
  const startGame = () => {
    setShowStart(false);
    setIsRunning(true);
    setProblem(generateProblem());
  };

  // Handle answer selection
  const handleAnswer = (selectedAnswer: number) => {
    if (!problem || !isRunning) return;

    if (selectedAnswer === problem.answer) {
      // Correct!
      setCorrectCount(s => s + 1);
      setStreak(s => {
        const newStreak = s + 1;
        setMaxStreak(m => Math.max(m, newStreak));
        return newStreak;
      });
      setFeedback('correct');
    } else {
      // Wrong
      setStreak(0);
      setFeedback('wrong');
    }

    // Show feedback briefly
    setTimeout(() => {
      setFeedback(null);
      setProblem(generateProblem());
    }, 200);
  };

  // Timer
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          setIsRunning(false);
          onComplete({
            score: correctCount,
            bonusData: maxStreak,
            timeElapsed: GAME_DURATION,
          });
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, correctCount, maxStreak, onComplete]);

  // Update maxStreak when streak changes
  useEffect(() => {
    setMaxStreak(m => Math.max(m, streak));
  }, [streak]);

  return (
    <div className="h-full flex flex-col items-center justify-center p-8">
      {/* Stats */}
      <div className="flex items-center gap-8 mb-8">
        <div className="text-center">
          <p className="text-gray-500 text-xs">TIME</p>
          <motion.p
            key={timeLeft}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            className={`font-arcade text-3xl ${
              timeLeft <= 10 ? 'text-red-500' : 'text-neon-cyan'
            }`}
          >
            {timeLeft}s
          </motion.p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">CORRECT</p>
          <p className="font-arcade text-3xl text-neon-yellow">{correctCount}</p>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">STREAK</p>
          <p className="font-arcade text-3xl text-neon-orange">
            {streak}🔥
          </p>
        </div>
      </div>

      {/* Start overlay */}
      {showStart && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="text-gray-400 mb-6">
            Solve as many math problems as possible in 60 seconds!
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-8 py-4 rounded-lg bg-neon-yellow text-arcade-darker font-arcade text-lg"
          >
            START GAME
          </motion.button>
        </motion.div>
      )}

      {/* Problem */}
      {problem && isRunning && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          {/* Equation */}
          <motion.div
            key={problem.num1 + problem.operation + problem.num2}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className={`font-arcade text-5xl mb-8 transition-colors ${
              feedback === 'correct' 
                ? 'text-neon-green' 
                : feedback === 'wrong' 
                ? 'text-red-500' 
                : 'text-white'
            }`}
          >
            {problem.num1} {problem.operation} {problem.num2} = ?
          </motion.div>

          {/* Options */}
          <div className="grid grid-cols-2 gap-4">
            {problem.options.map((option, i) => (
              <motion.button
                key={i}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleAnswer(option)}
                className="px-8 py-4 rounded-lg bg-arcade-card border-2 border-arcade-border font-arcade text-2xl text-white hover:border-neon-yellow hover:text-neon-yellow transition-colors"
              >
                {option}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Game Over */}
      {!isRunning && !showStart && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <p className="font-arcade text-2xl text-neon-yellow mb-2">
            TIME'S UP!
          </p>
          <p className="text-gray-400">
            Score: {correctCount} | Max Streak: {maxStreak}
          </p>
        </motion.div>
      )}
    </div>
  );
}
