/**
 * Aim Trainer Game
 * 
 * Click on targets as fast as possible!
 * Score based on accuracy and speed.
 * XP Formula: hits * 20 + accuracy_bonus
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, Zap } from 'lucide-react';
import type { GameResult } from '../types';

interface AimTrainerGameProps {
  onComplete: (result: GameResult) => void;
}

interface TargetPosition {
  id: number;
  x: number;
  y: number;
  size: number;
  spawned: number;
}

const GAME_DURATION = 30; // seconds
const TARGET_LIFETIME = 1500; // ms before target disappears
const MIN_SIZE = 30;
const MAX_SIZE = 60;

export function AimTrainerGame({ onComplete }: AimTrainerGameProps) {
  const [gameStarted, setGameStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [targets, setTargets] = useState<TargetPosition[]>([]);
  const [hits, setHits] = useState(0);
  const [totalTargets, setTotalTargets] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  
  const gameAreaRef = useRef<HTMLDivElement>(null);
  const targetIdRef = useRef(0);

  const spawnTarget = useCallback(() => {
    if (!gameAreaRef.current) return;
    
    const rect = gameAreaRef.current.getBoundingClientRect();
    const size = Math.random() * (MAX_SIZE - MIN_SIZE) + MIN_SIZE;
    const padding = size;
    
    const newTarget: TargetPosition = {
      id: targetIdRef.current++,
      x: Math.random() * (rect.width - padding * 2) + padding,
      y: Math.random() * (rect.height - padding * 2) + padding,
      size,
      spawned: Date.now(),
    };
    
    setTargets(prev => [...prev, newTarget]);
    setTotalTargets(prev => prev + 1);
    
    // Remove target after lifetime
    setTimeout(() => {
      setTargets(prev => {
        const target = prev.find(t => t.id === newTarget.id);
        if (target) {
          setCombo(0);
        }
        return prev.filter(t => t.id !== newTarget.id);
      });
    }, TARGET_LIFETIME);
  }, []);

  const handleTargetClick = useCallback((targetId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    
    setTargets(prev => prev.filter(t => t.id !== targetId));
    setHits(h => h + 1);
    setCombo(c => {
      const newCombo = c + 1;
      setMaxCombo(m => Math.max(m, newCombo));
      return newCombo;
    });
  }, []);

  const handleMiss = useCallback(() => {
    setCombo(0);
  }, []);

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

  // Spawn targets
  useEffect(() => {
    if (!gameStarted || timeLeft <= 0) return;

    // Spawn rate increases as time goes on
    const spawnRate = Math.max(400, 1000 - (GAME_DURATION - timeLeft) * 20);
    
    const spawner = setInterval(spawnTarget, spawnRate);
    return () => clearInterval(spawner);
  }, [gameStarted, timeLeft, spawnTarget]);

  // Game end
  useEffect(() => {
    if (gameStarted && timeLeft === 0) {
      const accuracy = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 0;
      
      onComplete({
        score: hits,
        bonusData: accuracy, // Store accuracy as bonus
        timeElapsed: GAME_DURATION,
      });
    }
  }, [gameStarted, timeLeft, hits, totalTargets, onComplete]);

  const startGame = () => {
    setGameStarted(true);
    setTimeLeft(GAME_DURATION);
    setTargets([]);
    setHits(0);
    setTotalTargets(0);
    setCombo(0);
    setMaxCombo(0);
    targetIdRef.current = 0;
  };

  const accuracy = totalTargets > 0 ? Math.round((hits / totalTargets) * 100) : 100;

  if (!gameStarted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center"
        >
          <Target className="w-20 h-20 text-red-500 mx-auto mb-6" />
          <h2 className="font-arcade text-2xl mb-4 text-red-400">AIM TRAINER</h2>
          <p className="text-gray-400 mb-2">Click targets before they disappear!</p>
          <p className="text-gray-500 text-sm mb-6">Smaller targets = harder but faster spawns</p>
          
          <div className="bg-arcade-darker rounded-lg p-4 mb-6">
            <p className="text-gray-400 text-sm">XP FORMULA</p>
            <p className="text-red-400 font-mono">
              XP = hits × 20 + accuracy_bonus
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startGame}
            className="px-8 py-4 rounded-lg bg-red-500 text-white font-arcade text-xl flex items-center gap-3 mx-auto"
          >
            <Zap className="w-6 h-6" />
            START TRAINING
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
            <p className="text-gray-500 text-xs">HITS</p>
            <p className="font-arcade text-xl text-green-400">{hits}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">ACCURACY</p>
            <p className="font-arcade text-xl text-yellow-400">{accuracy}%</p>
          </div>
          <div className="text-center">
            <p className="text-gray-500 text-xs">COMBO</p>
            <p className="font-arcade text-xl text-purple-400">×{combo}</p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-gray-500 text-xs">TIME</p>
          <p className={`font-arcade text-2xl ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {timeLeft}s
          </p>
        </div>
      </div>

      {/* Game Area */}
      <div
        ref={gameAreaRef}
        onClick={handleMiss}
        className="relative bg-arcade-darker rounded-xl border-2 border-red-500/30 overflow-hidden cursor-crosshair"
        style={{ height: '400px' }}
      >
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,0,0,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,0,0,0.3) 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
        
        <AnimatePresence>
          {targets.map(target => (
            <motion.button
              key={target.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.1 }}
              onClick={(e) => handleTargetClick(target.id, e)}
              className="absolute rounded-full cursor-pointer"
              style={{
                left: target.x - target.size / 2,
                top: target.y - target.size / 2,
                width: target.size,
                height: target.size,
                background: 'radial-gradient(circle, #ff0000 0%, #ff0000 30%, #990000 60%, transparent 70%)',
                boxShadow: '0 0 20px rgba(255,0,0,0.5)',
              }}
            >
              {/* Target rings */}
              <div 
                className="absolute inset-2 rounded-full border-2 border-white/50"
              />
              <div 
                className="absolute inset-4 rounded-full bg-white"
                style={{ width: '30%', height: '30%', left: '35%', top: '35%' }}
              />
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Center crosshair guide */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-8 h-0.5 bg-red-500" />
          <div className="w-0.5 h-8 bg-red-500 absolute" />
        </div>
      </div>

      {/* Max Combo Display */}
      {maxCombo > 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-4"
        >
          <span className="text-purple-400 font-arcade">
            MAX COMBO: ×{maxCombo}
          </span>
        </motion.div>
      )}
    </div>
  );
}
