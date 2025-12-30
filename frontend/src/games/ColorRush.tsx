/**
 * Color Rush Game
 * 
 * The Stroop Effect Game!
 * You see a color word displayed in a certain color.
 * You must click the button matching the DISPLAY COLOR (the ink color),
 * NOT the word itself.
 * 
 * Example: If you see "BLUE" written in RED ink, click the RED button!
 * 
 * XP Formula: matches * 30 + streak_bonus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Play, RotateCcw } from 'lucide-react';
import type { GameResult } from '../types';

interface ColorRushGameProps {
  onComplete: (result: GameResult) => void;
}

const COLORS = [
  { name: 'RED', hex: '#ef4444', glow: 'rgba(239,68,68,0.5)' },
  { name: 'BLUE', hex: '#3b82f6', glow: 'rgba(59,130,246,0.5)' },
  { name: 'GREEN', hex: '#22c55e', glow: 'rgba(34,197,94,0.5)' },
  { name: 'YELLOW', hex: '#eab308', glow: 'rgba(234,179,8,0.5)' },
  { name: 'PURPLE', hex: '#a855f7', glow: 'rgba(168,85,247,0.5)' },
  { name: 'ORANGE', hex: '#ff6b00', glow: 'rgba(255,107,0,0.5)' },
];

const GAME_DURATION = 45; // seconds
const INITIAL_TIME_PER_ROUND = 3500; // ms
const MIN_TIME_PER_ROUND = 1000; // ms
const TIME_DECREASE_PER_LEVEL = 80; // ms

export function ColorRushGame({ onComplete }: ColorRushGameProps) {
  const [gameState, setGameState] = useState<'ready' | 'playing' | 'ended'>('ready');
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [matches, setMatches] = useState(0);
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState(100);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [level, setLevel] = useState(1);
  
  // The word displayed (e.g., "BLUE")
  const [displayWord, setDisplayWord] = useState('');
  // The color the word is displayed in (e.g., red hex) - THIS IS WHAT PLAYER MUST CLICK
  const [displayColor, setDisplayColor] = useState('');
  // The correct answer (the color name matching displayColor)
  const [correctAnswer, setCorrectAnswer] = useState('');
  
  const roundTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const roundStartRef = useRef<number>(0);
  const gameStartedRef = useRef(false);

  const getTimeForRound = useCallback(() => {
    return Math.max(MIN_TIME_PER_ROUND, INITIAL_TIME_PER_ROUND - (level - 1) * TIME_DECREASE_PER_LEVEL);
  }, [level]);

  const generateRound = useCallback(() => {
    // Pick random word to display
    const wordIndex = Math.floor(Math.random() * COLORS.length);
    const word = COLORS[wordIndex]!;
    
    // Pick random color to display it in (this is the correct answer!)
    // Make it different from the word ~60% of the time to create the Stroop effect
    let colorIndex: number;
    if (Math.random() > 0.4) {
      // Different color than word (trick!)
      const otherIndices = COLORS.map((_, i) => i).filter(i => i !== wordIndex);
      colorIndex = otherIndices[Math.floor(Math.random() * otherIndices.length)]!;
    } else {
      // Same color as word (easy)
      colorIndex = wordIndex;
    }
    
    const color = COLORS[colorIndex]!;
    
    setDisplayWord(word.name);
    setDisplayColor(color.hex);
    setCorrectAnswer(color.name); // The DISPLAY COLOR is the correct answer
    
    // Reset round timer
    roundStartRef.current = Date.now();
    setRoundTimeLeft(100);
  }, []);

  const handleColorClick = useCallback((clickedColor: typeof COLORS[0]) => {
    if (gameState !== 'playing') return;
    
    // Player must click the color that the word is DISPLAYED in
    const isCorrect = clickedColor.name === correctAnswer;
    
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setShowFeedback(null), 250);
    
    if (isCorrect) {
      setMatches(m => m + 1);
      setStreak(s => {
        const newStreak = s + 1;
        setMaxStreak(m => Math.max(m, newStreak));
        // Level up every 5 correct answers
        if (newStreak % 5 === 0) {
          setLevel(l => l + 1);
        }
        return newStreak;
      });
    } else {
      setMisses(m => m + 1);
      setStreak(0);
    }
    
    generateRound();
  }, [correctAnswer, gameState, generateRound]);

  // Game timer
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          setGameState('ended');
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState, timeLeft]);

  // Round timer (progress bar)
  useEffect(() => {
    if (gameState !== 'playing' || timeLeft <= 0) return;

    const roundTime = getTimeForRound();
    const updateInterval = 50;
    
    if (roundTimerRef.current) {
      clearInterval(roundTimerRef.current);
    }
    
    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, 100 - (elapsed / roundTime) * 100);
      setRoundTimeLeft(remaining);
      
      if (remaining <= 0) {
        // Time's up for this round - count as miss
        setMisses(m => m + 1);
        setStreak(0);
        generateRound();
      }
    }, updateInterval);

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    };
  }, [gameState, timeLeft, getTimeForRound, generateRound]);

  // Game end
  useEffect(() => {
    if (gameState === 'ended' && gameStartedRef.current) {
      gameStartedRef.current = false;
      onComplete({
        score: matches,
        bonusData: maxStreak,
        timeElapsed: GAME_DURATION,
      });
    }
  }, [gameState, matches, maxStreak, onComplete]);

  const startGame = () => {
    gameStartedRef.current = true;
    setGameState('playing');
    setTimeLeft(GAME_DURATION);
    setMatches(0);
    setMisses(0);
    setStreak(0);
    setMaxStreak(0);
    setLevel(1);
    generateRound();
  };

  const restartGame = () => {
    setGameState('ready');
  };

  // Ready screen
  if (gameState === 'ready') {
    return (
      <div className="flex flex-col items-center justify-start p-4 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center max-w-md w-full"
        >
          <div className="relative mb-4">
            <div className="absolute inset-0 bg-accent-orange/30 rounded-full blur-3xl scale-75" />
            <Palette className="w-16 h-16 text-accent-orange mx-auto relative" />
          </div>
          
          <h2 className="font-arcade text-2xl mb-3 text-accent-orange">COLOR RUSH</h2>
          
          <div className="bg-dark-card/50 rounded-xl p-4 mb-4 border border-accent-orange/20">
            <p className="text-white text-base mb-3">
              Click the <span className="text-accent-orange font-bold">INK COLOR</span>, not the word!
            </p>
            
            <div className="bg-dark-bg/50 rounded-lg p-3 mb-3">
              <p className="text-gray-500 text-xs mb-1">EXAMPLE:</p>
              <p className="font-arcade text-2xl text-blue-500 mb-1">RED</p>
              <p className="text-gray-400 text-xs">
                Written in <span className="text-blue-500 font-bold">BLUE</span> ink → Click <span className="text-blue-500 font-bold">BLUE</span> ✓
              </p>
            </div>
            
            <div className="text-left text-xs text-gray-400 space-y-1">
              <p>⚡ Speed increases as you level up</p>
              <p>🔥 Build streaks for bonus XP</p>
              <p>⏱️ {GAME_DURATION} seconds to score high!</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-orange to-accent-orange-light text-dark-bg font-arcade text-lg flex items-center gap-2 mx-auto shadow-[0_0_30px_rgba(255,107,0,0.4)]"
          >
            <Play className="w-5 h-5" />
            START
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Game ended screen
  if (gameState === 'ended') {
    const accuracy = matches + misses > 0 ? Math.round((matches / (matches + misses)) * 100) : 0;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <h2 className="font-arcade text-3xl mb-6 text-accent-orange">TIME'S UP!</h2>
          
          <div className="bg-dark-card/50 rounded-xl p-6 mb-6 border border-accent-orange/20 min-w-[280px]">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <p className="text-gray-500 text-xs uppercase">Matches</p>
                <p className="font-arcade text-3xl text-green-400">{matches}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs uppercase">Misses</p>
                <p className="font-arcade text-3xl text-red-400">{misses}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs uppercase">Max Streak</p>
                <p className="font-arcade text-2xl text-orange-400">🔥 {maxStreak}</p>
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-xs uppercase">Accuracy</p>
                <p className="font-arcade text-2xl text-blue-400">{accuracy}%</p>
              </div>
            </div>
            <div className="text-center border-t border-gray-700 pt-4">
              <p className="text-gray-500 text-xs uppercase">Level Reached</p>
              <p className="font-arcade text-2xl text-accent-orange">Level {level}</p>
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={restartGame}
            className="px-6 py-3 rounded-lg bg-gradient-to-r from-accent-orange to-accent-orange-light text-dark-bg font-arcade flex items-center gap-2 mx-auto"
          >
            <RotateCcw className="w-5 h-5" />
            PLAY AGAIN
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Playing screen
  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* Stats Bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase">Score</p>
            <p className="font-arcade text-xl text-green-400">{matches}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase">Streak</p>
            <p className="font-arcade text-xl text-orange-400">🔥{streak}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs uppercase">Level</p>
            <p className="font-arcade text-xl text-accent-orange">{level}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs uppercase">Time</p>
          <p className={`font-arcade text-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* Round Timer Bar */}
      <div className="h-2 bg-dark-card rounded-full mb-6 overflow-hidden">
        <motion.div
          className={`h-full transition-all duration-75 ${
            roundTimeLeft > 50 ? 'bg-green-500' : 
            roundTimeLeft > 25 ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${roundTimeLeft}%` }}
        />
      </div>

      {/* Instruction reminder */}
      <p className="text-center text-gray-500 text-sm mb-4">
        Click the <span className="text-accent-orange">INK COLOR</span> ↓
      </p>

      {/* Target Display */}
      <motion.div
        key={displayWord + displayColor}
        initial={{ scale: 0.8, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', duration: 0.3 }}
        className="text-center mb-8"
      >
        <motion.h1
          className="font-arcade text-5xl md:text-7xl py-4"
          style={{ 
            color: displayColor,
            textShadow: `0 0 30px ${displayColor}, 0 0 60px ${displayColor}40`
          }}
        >
          {displayWord}
        </motion.h1>
      </motion.div>

      {/* Color Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {COLORS.map(color => (
          <motion.button
            key={color.name}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleColorClick(color)}
            className="w-full h-20 md:h-24 rounded-xl flex items-center justify-center font-arcade text-white text-xs transition-all border-2 border-white/10 hover:border-white/30"
            style={{
              backgroundColor: color.hex,
              boxShadow: `0 4px 20px ${color.glow}`,
            }}
          >
            {color.name}
          </motion.button>
        ))}
      </div>

      {/* Feedback Overlay */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`fixed inset-0 pointer-events-none flex items-center justify-center z-50 ${
              showFeedback === 'correct' ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}
          >
            <motion.span
              initial={{ scale: 0.5 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.5 }}
              className={`font-arcade text-8xl ${
                showFeedback === 'correct' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {showFeedback === 'correct' ? '✓' : '✗'}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
