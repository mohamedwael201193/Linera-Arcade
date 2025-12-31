/**
 * Word Duel - Type faster than your opponent!
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Trophy, Type, Zap } from 'lucide-react';
import { multiplayerService } from '../../lib/multiplayer/socket';
import { BlockchainResultSubmit } from '../../components/BlockchainResultSubmit';

interface Room {
  id: string;
  gameType: string;
  players: { id: string; name: string; score: number }[];
  state: {
    currentWord: string;
    round: number;
    maxRounds: number;
    scores: number[];
    roundWinner: number | null;
  };
  status: string;
}

interface Props {
  room: Room;
  onLeave: () => void;
  onRematch: () => void;
}

export function WordDuelGame({ room, onLeave, onRematch }: Props) {
  const [input, setInput] = useState('');
  const [showResult, setShowResult] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const myIndex = room.players.findIndex(p => p.id === multiplayerService.socketId);
  
  const isFinished = room.state.round >= room.state.maxRounds && room.state.roundWinner !== null;
  const score0 = room.state.scores[0] ?? 0;
  const score1 = room.state.scores[1] ?? 0;
  const winner = score0 > score1 ? 0 : score1 > score0 ? 1 : -1;
  const iWon = winner === myIndex;

  useEffect(() => {
    // Start first round if no word yet
    if (!room.state.currentWord && room.state.round === 0) {
      multiplayerService.sendAction(room.id, { type: 'start-round' });
    }
  }, []);

  useEffect(() => {
    // Show round result
    if (room.state.roundWinner !== null) {
      setShowResult(true);
      setInput('');
      
      // Start next round after delay
      if (room.state.round < room.state.maxRounds) {
        setTimeout(() => {
          setShowResult(false);
          multiplayerService.sendAction(room.id, { type: 'start-round' });
        }, 1500);
      }
    }
  }, [room.state.roundWinner, room.state.round]);

  useEffect(() => {
    // Focus input when new word appears
    if (room.state.currentWord && !showResult) {
      inputRef.current?.focus();
    }
  }, [room.state.currentWord, showResult]);

  const handleInput = (value: string) => {
    setInput(value);
    if (value.toLowerCase() === room.state.currentWord.toLowerCase()) {
      multiplayerService.sendAction(room.id, { type: 'word-typed', word: value });
    }
  };

  const getCharStatus = (index: number) => {
    const typed = input[index]?.toLowerCase();
    const target = room.state.currentWord[index]?.toLowerCase();
    if (!typed) return 'pending';
    if (typed === target) return 'correct';
    return 'wrong';
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onLeave}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave
        </motion.button>
        <div className="text-gray-500 text-sm">
          Round {room.state.round}/{room.state.maxRounds}
        </div>
      </div>

      {/* Players */}
      <div className="flex justify-between items-center mb-8">
        {room.players.map((player, index) => (
          <div
            key={player.id}
            className={`text-center ${index === 1 ? 'text-right' : ''}`}
          >
            <p className="text-white font-medium">
              {player.name}
              {player.id === multiplayerService.socketId && ' (You)'}
            </p>
            <p className="font-arcade text-3xl text-accent-orange">{room.state.scores[index]}</p>
          </div>
        ))}
      </div>

      {/* Word Display */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-8 mb-6 text-center"
      >
        {showResult ? (
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
          >
            {room.state.roundWinner === myIndex ? (
              <>
                <Zap className="w-16 h-16 text-green-400 mx-auto mb-2" />
                <p className="font-arcade text-2xl text-green-400">YOU WIN ROUND!</p>
              </>
            ) : (
              <>
                <Type className="w-16 h-16 text-red-400 mx-auto mb-2" />
                <p className="font-arcade text-2xl text-red-400">TOO SLOW!</p>
              </>
            )}
          </motion.div>
        ) : isFinished ? (
          <motion.div
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
          >
            <Trophy className={`w-16 h-16 mx-auto mb-4 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
            <p className={`font-arcade text-3xl mb-2 ${
              winner === -1 ? 'text-yellow-500' : iWon ? 'text-green-400' : 'text-red-400'
            }`}>
              {winner === -1 ? "IT'S A TIE!" : iWon ? 'YOU WIN!' : 'YOU LOSE!'}
            </p>
            <p className="text-gray-400 mb-4">
              Final Score: {room.state.scores[myIndex]} - {room.state.scores[1 - myIndex]}
            </p>
            
            {/* Blockchain Submit - Get XP & Coins! */}
            {winner !== -1 && (
              <BlockchainResultSubmit
                gameType="word-duel"
                roomCode={room.id}
                isWinner={iWon}
                opponentName={room.players[iWon ? 1 - myIndex : myIndex]?.name || 'opponent'}
              />
            )}
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onRematch}
              className="mt-4 px-6 py-3 bg-accent-orange text-dark-bg font-arcade rounded-lg flex items-center gap-2 mx-auto"
            >
              <RotateCcw className="w-5 h-5" />
              REMATCH
            </motion.button>
          </motion.div>
        ) : (
          <>
            <p className="text-gray-500 text-sm mb-4">TYPE THIS WORD:</p>
            <div className="flex justify-center gap-1 mb-6">
              {room.state.currentWord.split('').map((char, i) => {
                const status = getCharStatus(i);
                return (
                  <motion.span
                    key={i}
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`font-arcade text-4xl px-2 py-1 rounded ${
                      status === 'correct' ? 'text-green-400 bg-green-500/20' :
                      status === 'wrong' ? 'text-red-400 bg-red-500/20' :
                      'text-white'
                    }`}
                  >
                    {char.toUpperCase()}
                  </motion.span>
                );
              })}
            </div>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => handleInput(e.target.value)}
              className="w-full bg-dark-bg border-2 border-accent-orange/50 rounded-xl px-6 py-4 text-center font-arcade text-2xl text-white focus:border-accent-orange focus:outline-none"
              placeholder="Type here..."
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </>
        )}
      </motion.div>

      <p className="text-center text-gray-500 text-sm">
        First to type the word correctly wins the round!
      </p>
    </div>
  );
}
