/**
 * Typing Blitz Game
 * 
 * Type the words/sentences as fast as possible!
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

// Extensive word lists with many more options
const WORD_LISTS = {
  easy: [
    'cat', 'dog', 'sun', 'run', 'fun', 'hot', 'red', 'big', 'cup', 'hat',
    'map', 'pen', 'box', 'car', 'key', 'ice', 'top', 'low', 'sky', 'fly',
    'web', 'net', 'win', 'sea', 'bee', 'owl', 'fox', 'gem', 'joy', 'zen',
    'hop', 'zip', 'tap', 'mud', 'fog', 'dew', 'oak', 'elm', 'ivy', 'fir',
    'bay', 'cub', 'den', 'fin', 'jaw', 'kit', 'lab', 'log', 'nap', 'pad',
    'rib', 'sap', 'tab', 'van', 'wax', 'yak', 'zap', 'art', 'bug', 'cog',
  ],
  medium: [
    'apple', 'brain', 'cloud', 'dream', 'flame', 'grape', 'house', 'juice',
    'lemon', 'mango', 'night', 'ocean', 'piano', 'queen', 'river', 'storm',
    'tiger', 'uncle', 'vivid', 'water', 'xenon', 'yield', 'zebra', 'angel',
    'beach', 'coral', 'delta', 'eagle', 'frost', 'globe', 'happy', 'ivory',
    'joker', 'karma', 'lunar', 'magic', 'noble', 'orbit', 'pixel', 'quest',
    'radar', 'solar', 'token', 'ultra', 'vapor', 'wheel', 'youth', 'zesty',
    'amber', 'blaze', 'crypt', 'dwarf', 'ember', 'flora', 'ghost', 'hyper',
    'index', 'joint', 'kraft', 'logic', 'metro', 'nexus', 'omega', 'prism',
  ],
  hard: [
    'arcade', 'blazing', 'crystal', 'digital', 'eclipse', 'fantasy', 'gateway',
    'harmony', 'infinity', 'journey', 'kingdom', 'legends', 'mystery', 'nebula',
    'phoenix', 'quantum', 'radiant', 'stellar', 'thunder', 'ultimate', 'voltage',
    'whisper', 'xylonet', 'zephyr', 'alchemy', 'bounty', 'cascade', 'dynamo',
    'entropy', 'fractal', 'glacier', 'holistic', 'impulse', 'jubilee', 'kinetic',
    'labyrinth', 'mirage', 'nucleus', 'obsidian', 'paradox', 'quasar', 'remnant',
    'spectrum', 'tempest', 'utopia', 'vanguard', 'wisteria', 'zenith', 'aurora',
    'bastion', 'chimera', 'duality', 'ethereal', 'fortress', 'gravity', 'horizon',
  ],
  expert: [
    'blockchain', 'cyberpunk', 'dashboard', 'encryption', 'framework', 'galactic',
    'hologram', 'interface', 'javascript', 'kubernetes', 'lightning', 'metaverse',
    'neon', 'optimize', 'protocol', 'quantum', 'resilient', 'synthesis', 'terminal',
    'universal', 'virtualize', 'wavelength', 'xenomorph', 'yellowstone', 'zealously',
    'algorithm', 'bandwidth', 'compression', 'decentralize', 'ecosystem', 'firewall',
    'generation', 'hyperloop', 'innovation', 'javascript', 'knowledge', 'laboratory',
    'multimedia', 'networking', 'orchestrate', 'peripheral', 'quarantine', 'revolution',
    'systematic', 'technology', 'underlying', 'validation', 'workstation', 'xylophone',
  ],
};

// Sentences for sentence mode (appears after 40 words)
const SENTENCES = [
  'the quick brown fox jumps over the lazy dog',
  'pack my box with five dozen liquor jugs',
  'how vexingly quick daft zebras jump',
  'the five boxing wizards jump quickly',
  'sphinx of black quartz judge my vow',
  'two driven jocks help fax my big quiz',
  'the jay pig fox dwelt quiz buck',
  'jackdaws love my big sphinx of quartz',
  'crazy frederick bought many very exquisite opal jewels',
  'we promptly judged antique ivory buckles for the next prize',
  'a wizard quick job vexes many dwarfs',
  'jaded zombies acted quaintly but kept driving their oxen forward',
  'the quick onyx goblin jumps over the lazy dwarf',
  'grumpy wizards make toxic brew for the evil queen and jack',
  'all questions asked by five watched experts amaze the judge',
  'playing video games can improve your reaction time',
  'blockchain technology enables decentralized applications',
  'artificial intelligence is transforming many industries',
  'the linera arcade hub rewards skilled gamers with experience points',
  'practice makes perfect when it comes to typing speed',
  'muscle memory develops through consistent daily practice',
  'focus on accuracy first then gradually increase your speed',
  'ergonomic keyboards can help prevent repetitive strain injuries',
  'touch typing is faster than hunting and pecking',
  'the average typing speed is around forty words per minute',
  'professional typists can exceed one hundred words per minute',
  'coding requires precise typing and attention to detail',
  'cryptocurrency wallets store digital assets securely',
  'smart contracts execute automatically when conditions are met',
  'decentralized finance offers new opportunities for everyone',
];

// Programming/tech phrases for ultimate challenge
const TECH_PHRASES = [
  'const blockchain = new Linera()',
  'function calculateXP(score) { return score * 10; }',
  'await wallet.connect()',
  'npm install @linera/client',
  'git push origin main',
  'docker-compose up -d',
  'SELECT * FROM players ORDER BY xp DESC',
  'export default function App() {}',
  'useState, useEffect, useCallback',
  'async function fetchLeaderboard() {}',
  'return <motion.div animate={{ scale: 1 }} />',
  'border-radius: 8px; background: linear-gradient',
];

const GAME_DURATION = 60; // seconds

// Fisher-Yates shuffle for randomization
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  return shuffled;
}

export function TypingBlitzGame({ onComplete }: TypingBlitzGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [currentText, setCurrentText] = useState('');
  const [userInput, setUserInput] = useState('');
  const [wordsTyped, setWordsTyped] = useState(0);
  const [correctChars, setCorrectChars] = useState(0);
  const [totalChars, setTotalChars] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'expert' | 'sentence' | 'tech'>('easy');
  const [showCorrect, setShowCorrect] = useState(false);
  const [showWrong, setShowWrong] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<number>(0);
  const usedTextsRef = useRef<Set<string>>(new Set());

  const getRandomText = useCallback((): string => {
    let textPool: string[];
    
    if (difficulty === 'sentence') {
      textPool = SENTENCES;
    } else if (difficulty === 'tech') {
      textPool = TECH_PHRASES;
    } else {
      textPool = WORD_LISTS[difficulty];
    }
    
    // Filter out recently used texts
    let availableTexts = textPool.filter(t => !usedTextsRef.current.has(t));
    
    // If we've used too many, reset the used set
    if (availableTexts.length < 5) {
      usedTextsRef.current.clear();
      availableTexts = textPool;
    }
    
    // Shuffle and pick one
    const shuffled = shuffleArray(availableTexts);
    const selected = shuffled[0] || 'arcade';
    usedTextsRef.current.add(selected);
    
    return selected;
  }, [difficulty]);

  const nextText = useCallback(() => {
    setCurrentText(getRandomText());
    setUserInput('');
  }, [getRandomText]);

  const updateDifficulty = useCallback((typed: number) => {
    if (typed >= 50) setDifficulty('tech');
    else if (typed >= 40) setDifficulty('sentence');
    else if (typed >= 25) setDifficulty('expert');
    else if (typed >= 15) setDifficulty('hard');
    else if (typed >= 8) setDifficulty('medium');
    else setDifficulty('easy');
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUserInput(value);
    setTotalChars(t => t + 1);

    // Check if text is complete
    if (value.toLowerCase() === currentText.toLowerCase()) {
      const wordCount = currentText.split(' ').length;
      setWordsTyped(w => {
        const newCount = w + wordCount;
        updateDifficulty(newCount);
        return newCount;
      });
      setCorrectChars(c => c + currentText.length);
      setStreak(s => {
        const newStreak = s + 1;
        setMaxStreak(m => Math.max(m, newStreak));
        return newStreak;
      });
      setShowCorrect(true);
      setTimeout(() => setShowCorrect(false), 200);
      nextText();
    } else if (value.length > 0 && !currentText.toLowerCase().startsWith(value.toLowerCase())) {
      // Wrong character - flash red but don't reset
      setShowWrong(true);
      setTimeout(() => setShowWrong(false), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Skip text with Tab
    if (e.key === 'Tab') {
      e.preventDefault();
      setStreak(0);
      nextText();
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
    usedTextsRef.current.clear();
    startTimeRef.current = Date.now();
    nextText();
  };

  const accuracy = totalChars > 0 ? Math.round((correctChars / totalChars) * 100) : 100;
  const elapsedSeconds = GAME_DURATION - timeLeft;
  const wpm = elapsedSeconds > 0 ? Math.round((wordsTyped / elapsedSeconds) * 60) : 0;

  const getDifficultyColor = () => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'hard': return 'bg-orange-500/20 text-orange-400';
      case 'expert': return 'bg-red-500/20 text-red-400';
      case 'sentence': return 'bg-purple-500/20 text-purple-400';
      case 'tech': return 'bg-cyan-500/20 text-cyan-400';
    }
  };

  const getDifficultyLabel = () => {
    switch (difficulty) {
      case 'sentence': return 'SENTENCES';
      case 'tech': return 'CODE MODE';
      default: return difficulty.toUpperCase();
    }
  };

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
          <p className="text-gray-400 mb-2">Type words, sentences, and code!</p>
          <p className="text-gray-500 text-sm mb-6">Difficulty increases as you progress - reach CODE MODE!</p>
          
          <div className="bg-arcade-darker rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm">XP FORMULA</p>
            <p className="text-emerald-400 font-mono">
              XP = words × 25 + WPM_bonus
            </p>
          </div>

          <div className="text-gray-500 text-xs mb-6 space-y-1">
            <p>🟢 Easy → 🟡 Medium → 🟠 Hard → 🔴 Expert → 🟣 Sentences → 🔵 Code</p>
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
        <span className={`px-3 py-1 rounded-full text-xs font-arcade ${getDifficultyColor()}`}>
          {getDifficultyLabel()}
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
        
        <p className="text-gray-500 text-sm mb-4">
          {difficulty === 'sentence' ? 'TYPE THIS SENTENCE:' : 
           difficulty === 'tech' ? 'TYPE THIS CODE:' : 'TYPE THIS WORD:'}
        </p>
        <div className={`font-mono tracking-wider mb-4 ${
          difficulty === 'sentence' || difficulty === 'tech' 
            ? 'text-xl md:text-2xl' 
            : 'text-4xl md:text-6xl'
        }`}>
          {currentText.split('').map((char, i) => {
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
