/**
 * Color Rush Game
 * 
 * Match the color shown before time runs out!
 * Colors flash faster as you progress.
 * XP Formula: matches * 30 + streak_bonus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Sparkles } from 'lucide-react';
import type { GameResult } from '../types';

interface ColorRushGameProps {
  onComplete: (result: GameResult) => void;
}

const COLORS = [
  { name: 'RED', hex: '#ff0055', glow: 'rgba(255,0,85,0.5)' },
  { name: 'BLUE', hex: '#00d4ff', glow: 'rgba(0,212,255,0.5)' },
  { name: 'GREEN', hex: '#00ff88', glow: 'rgba(0,255,136,0.5)' },
  { name: 'YELLOW', hex: '#ffff00', glow: 'rgba(255,255,0,0.5)' },
  { name: 'PURPLE', hex: '#bf00ff', glow: 'rgba(191,0,255,0.5)' },
  { name: 'ORANGE', hex: '#ff8800', glow: 'rgba(255,136,0,0.5)' },
];

const GAME_DURATION = 45; // seconds
const INITIAL_TIME_PER_ROUND = 3000; // ms
const MIN_TIME_PER_ROUND = 800; // ms

export function ColorRushGame({ onComplete }: ColorRushGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targetColor, setTargetColor] = useState(COLORS[0]);
  const [displayedColorName, setDisplayedColorName] = useState('');
  const [displayedColorHex, setDisplayedColorHex] = useState('');
  const [matches, setMatches] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [roundTimeLeft, setRoundTimeLeft] = useState(100);
  const [showFeedback, setShowFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [difficulty, setDifficulty] = useState(0);
  
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const roundStartRef = useRef<number>(0);

  const getTimeForRound = useCallback(() => {
    return Math.max(MIN_TIME_PER_ROUND, INITIAL_TIME_PER_ROUND - difficulty * 100);
  }, [difficulty]);

  const generateRound = useCallback(() => {
    // Pick random target color
    const targetIdx = Math.floor(Math.random() * COLORS.length);
    const target = COLORS[targetIdx];
    if (!target) return;
    
    setTargetColor(target);
    
    // Decide if this is a match or trick round
    const isMatch = Math.random() > 0.4; // 60% match, 40% trick
    
    if (isMatch) {
      // Show correct color name with correct color
      setDisplayedColorName(target.name);
      setDisplayedColorHex(target.hex);
    } else {
      // Show WRONG color name (trick!) - the text says one color but displays another
      const otherColors = COLORS.filter(c => c.name !== target.name);
      const wrongIdx = Math.floor(Math.random() * otherColors.length);
      const wrongColor = otherColors[wrongIdx];
      if (!wrongColor) {
        setDisplayedColorName(target.name);
        setDisplayedColorHex(target.hex);
        return;
      }
      
      // 50% chance: wrong name, correct display color
      // 50% chance: correct name, wrong display color
      if (Math.random() > 0.5) {
        setDisplayedColorName(wrongColor.name);
        setDisplayedColorHex(target.hex);
      } else {
        setDisplayedColorName(target.name);
        setDisplayedColorHex(wrongColor.hex);
      }
    }
    
    // Reset round timer
    roundStartRef.current = Date.now();
    setRoundTimeLeft(100);
  }, []);

  const handleColorClick = useCallback((color: typeof COLORS[0]) => {
    if (!targetColor) return;
    const isCorrect = color.name === targetColor.name;
    
    setShowFeedback(isCorrect ? 'correct' : 'wrong');
    setTimeout(() => setShowFeedback(null), 300);
    
    if (isCorrect) {
      setMatches(m => m + 1);
      setStreak(s => {
        const newStreak = s + 1;
        setMaxStreak(m => Math.max(m, newStreak));
        return newStreak;
      });
      setDifficulty(d => d + 1);
    } else {
      setStreak(0);
    }
    
    generateRound();
  }, [targetColor, generateRound]);

  // Game timer
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStarted, timeLeft]);

  // Round timer (progress bar)
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;

    const roundTime = getTimeForRound();
    const updateInterval = 50;
    
    roundTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - roundStartRef.current;
      const remaining = Math.max(0, 100 - (elapsed / roundTime) * 100);
      setRoundTimeLeft(remaining);
      
      if (remaining <= 0) {
        // Time's up for this round - count as miss
        setStreak(0);
        generateRound();
      }
    }, updateInterval);

    return () => {
      if (roundTimerRef.current) clearInterval(roundTimerRef.current);
    };
  }, [gameStarted, timeLeft, getTimeForRound, generateRound]);

  // Game end
  useEffect(() => {
    if (gameStarted && timeLeft === 0) {
      onComplete({
        score: matches,
        bonusData: maxStreak,
        timeElapsed: GAME_DURATION,
      });
    }
  }, [gameStarted, timeLeft, matches, maxStreak, onComplete]);

  const startGame = () => {
    setGameStarted(true);
    setTimeLeft(GAME_DURATION);
    setMatches(0);
    setStreak(0);
    setMaxStreak(0);
    setDifficulty(0);
    generateRound();
  };

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <Palette className="w-20 h-20 text-pink-500 mx-auto mb-6" />
          <h2 className="font-arcade text-2xl mb-4 text-pink-400">COLOR RUSH</h2>
          <p className="text-gray-400 mb-2">Click the COLOR shown, not the word!</p>
          <p className="text-gray-500 text-sm mb-6">The word might trick you - focus on the color!</p>
          
          <div className="bg-arcade-darker rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm">XP FORMULA</p>
            <p className="text-pink-400 font-mono">
              XP = matches × 30 + streak_bonus
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-8 py-4 rounded-lg bg-gradient-to-r from-pink-500 to-purple-500 text-white font-arcade text-xl flex items-center gap-3 mx-auto"
          >
            <Sparkles className="w-6 h-6" />
            START RUSH
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Stats Bar */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-gray-500 text-xs">MATCHES</p>
            <p className="font-arcade text-xl text-green-400">{matches}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">STREAK</p>
            <p className="font-arcade text-xl text-orange-400">🔥{streak}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">TIME</p>
          <p className={`font-arcade text-2xl ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* Round Timer Bar */}
      <div className="h-2 bg-arcade-darker rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500"
          style={{ width: `${roundTimeLeft}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>

      {/* Target Display */}
      <motion.div
        key={displayedColorName + displayedColorHex}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center mb-8"
      >
        <p className="text-gray-500 text-sm mb-2">CLICK THIS COLOR:</p>
        <motion.h1
          className="font-arcade text-5xl md:text-7xl"
          style={{ 
            color: displayedColorHex,
            textShadow: `0 0 30px ${displayedColorHex}, 0 0 60px ${displayedColorHex}`
          }}
        >
          {displayedColorName}
        </motion.h1>
      </motion.div>

      {/* Color Buttons */}
      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
        {COLORS.map(color => (
          <motion.button
            key={color.name}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleColorClick(color)}
            className="aspect-square rounded-xl flex items-center justify-center font-arcade text-white text-sm transition-all"
            style={{
              backgroundColor: color.hex,
              boxShadow: `0 0 20px ${color.glow}`,
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
            className={`fixed inset-0 pointer-events-none flex items-center justify-center ${
              showFeedback === 'correct' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}
          >
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className={`font-arcade text-6xl ${
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
