/**
 * Typing Blitz Game
 * 
 * Type the words as fast as possible!
 * WPM and accuracy matter.
 * XP Formula: words_typed * 25 + wpm_bonus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Keyboard, Zap } from 'lucide-react';
import type { GameResult } from '../types';

interface TypingBlitzGameProps {
  onComplete: (result: GameResult) => void;
}

const WORD_LISTS = {
  easy: ['cat', 'dog', 'sun', 'run', 'fun', 'hot', 'red', 'big', 'cup', 'hat', 'map', 'pen', 'box', 'car', 'key'],
  medium: ['apple', 'brain', 'cloud', 'dream', 'flame', 'grape', 'house', 'juice', 'lemon', 'mango', 'night', 'ocean', 'piano', 'queen', 'river'],
  hard: ['arcade', 'blazing', 'crystal', 'digital', 'eclipse', 'fantasy', 'gateway', 'harmony', 'infinity', 'journey', 'kingdom', 'legends', 'mystery', 'nebula', 'phoenix'],
  expert: ['blockchain', 'cyberpunk', 'dashboard', 'encryption', 'framework', 'galactic', 'hologram', 'interface', 'javascript', 'kubernetes', 'lightning', 'metaverse', 'neon', 'optimize', 'protocol'],
};

const GAME_DURATION = 60; // seconds

export function TypingBlitzGame({ onComplete }: TypingBlitzGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentWord, setCurrentWord] = useState('');
  const [userInput, setUserInput] = useState('');
  const [wordsTyped, setWordsTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert'>('easy');
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);

  const getRandomWord = useCallback((): string => {
    const words = WORD_LISTS[difficulty];
    const word = words[Math.floor(Math.random() * words.length)];
    return word || 'arcade';
  }, [difficulty]);

  const nextWord = useCallback(() => {
    setCurrentWord(getRandomWord());
    setUserInput('');
  }, [getRandomWord]);

  const updateDifficulty = useCallback((typed: number) => {
    if (typed >= 30) setDifficulty('expert');
    else if (typed >= 20) setDifficulty('hard');
    else if (typed >= 10) setDifficulty('medium');
    else setDifficulty('easy');
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    setTotalChars(t => t + 1);

    // Check if word is complete
    if (value.toLowerCase() === currentWord.toLowerCase()) {
      setWordsTyped(w => {
        const newCount = w + 1;
        updateDifficulty(newCount);
        return newCount;
      });
      setCorrectChars(c => c + currentWord.length);
      setStreak(s => {
        const newStreak = s + 1;
        setMaxStreak(m => Math.max(m, newStreak));
        return newStreak;
      });
      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 200);
      nextWord();
    } else if (value.length > 0 && !currentWord.toLowerCase().startsWith(value.toLowerCase())) {
      // Wrong character - flash red but don't reset
      setShowWrong(true);
      setTimeout(() => setShowWrong(false), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Skip word with Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      setStreak(0);
      nextWord();
    }
    // Clear with Escape
    if (e.key === 'Escape') {
      setUserInput('');
    }
  };

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

  // Focus input when game starts
  useEffect(() => {
    if (gameStarted && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameStarted]);

  // Game end
  useEffect(() => {
    if (gameStarted && timeLeft === 0) {
      const elapsedMinutes = GAME_DURATION / 60;
      const wpm = Math.round(wordsTyped / elapsedMinutes);
      
      onComplete({
        score: wordsTyped,
        bonusData: wpm,
        timeElapsed: GAME_DURATION,
      });
    }
  }, [gameStarted, timeLeft, wordsTyped, onComplete]);

  const startGame = () => {
    setGameStarted(true);
    setTimeLeft(GAME_DURATION);
    setWordsTyped(0);
    setCorrectChars(0);
    setTotalChars(0);
    setStreak(0);
    setMaxStreak(0);
    setDifficulty('easy');
    setUserInput('');
    startTimeRef.current = Date.now();
    nextWord();
  };

  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
  const elapsedSeconds = GAME_DURATION - timeLeft;
  const wpm = elapsedSeconds > 0 ? Math.round((wordsTyped / elapsedSeconds) * 60) : 0;

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <Keyboard className="w-20 h-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="font-arcade text-2xl mb-4 text-emerald-400">TYPING BLITZ</h2>
          <p className="text-gray-400 mb-2">Type the words as fast as you can!</p>
          <p className="text-gray-500 text-sm mb-6">Press TAB to skip, ESC to clear</p>
          
          <div className="bg-arcade-darker rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm">XP FORMULA</p>
            <p className="text-emerald-400 font-mono">
              XP = words × 25 + WPM_bonus
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-8 py-4 rounded-lg bg-emerald-500 text-white font-arcade text-xl flex items-center gap-3 mx-auto"
          >
            <Zap className="w-6 h-6" />
            START TYPING
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Stats Bar */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4">
          <div className="text-center">
            <p className="text-gray-500 text-xs">WORDS</p>
            <p className="font-arcade text-xl text-green-400">{wordsTyped}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">WPM</p>
            <p className="font-arcade text-xl text-cyan-400">{wpm}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">ACCURACY</p>
            <p className="font-arcade text-xl text-yellow-400">{accuracy}%</p>
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

      {/* Difficulty Badge */}
      <div className="text-center mb-4">
        <span className={`px-3 py-1 rounded-full text-xs font-arcade ${
          difficulty === 'easy' ? 'bg-green-500/20 text-green-400' :
          difficulty === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
          difficulty === 'hard' ? 'bg-orange-500/20 text-orange-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {difficulty.toUpperCase()}
        </span>
      </div>

      {/* Word Display */}
      <motion.div
        className={`bg-arcade-darker rounded-xl p-8 mb-6 text-center relative overflow-hidden ${
          showCorrect ? 'ring-2 ring-green-500' : showWrong ? 'ring-2 ring-red-500' : ''
        }`}
      >
        {/* Background animation */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-cyan-500 animate-pulse" />
        </div>
        
        <p className="text-gray-500 text-sm mb-4">TYPE THIS WORD:</p>
        <div className="font-mono text-4xl md:text-6xl tracking-wider mb-4">
          {currentWord.split('').map((char, i) => {
            const inputChar = userInput[i];
            let color = 'text-gray-600';
            if (inputChar) {
              color = inputChar.toLowerCase() === char.toLowerCase() 
                ? 'text-emerald-400' 
                : 'text-red-400';
            }
            return (
              <span key={i} className={color}>
                {char}
              </span>
            );
          })}
        </div>
        
        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="w-full max-w-md mx-auto px-6 py-4 bg-arcade-card border-2 border-emerald-500/50 rounded-lg text-center font-mono text-2xl text-white focus:outline-none focus:border-emerald-500"
          placeholder="Start typing..."
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </motion.div>

      {/* Tips */}
      <div className="text-center text-gray-500 text-sm">
        <p>Press <kbd className="px-2 py-1 bg-arcade-darker rounded">TAB</kbd> to skip word · <kbd className="px-2 py-1 bg-arcade-darker rounded">ESC</kbd> to clear</p>
      </div>

      {/* Max Streak */}
      {maxStreak >= 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-4"
        >
          <span className="text-orange-400 font-arcade">
            BEST STREAK: 🔥{maxStreak}
          </span>
        </motion.div>
      )}
    </div>
  );
}
