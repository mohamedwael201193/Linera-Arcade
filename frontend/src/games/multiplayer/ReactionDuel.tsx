/**
 * Reaction Duel - Who clicks faster when screen turns green?
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Trophy, Zap, AlertCircle } from 'lucide-react';
import { multiplayerService } from '../../lib/multiplayer/socket';
import { BlockchainResultSubmit } from '../../components/BlockchainResultSubmit';

interface Room {
  id: string;
  gameType: string;
  players: { id: string; name: string; score: number }[];
  state: {
    round: number;
    maxRounds: number;
    scores: number[];
    status: 'waiting' | 'ready' | 'go' | 'finished';
    startTime: number | null;
    reactions: (number | null)[];
  };
  status: string;
}

interface Props {
  room: Room;
  onLeave: () => void;
  onRematch: () => void;
}

export function ReactionDuelGame({ room, onLeave, onRematch }: Props) {
  const [localStatus, setLocalStatus] = useState<'waiting' | 'ready' | 'go' | 'result'>('waiting');
  const [myReaction, setMyReaction] = useState<number | null>(null);
  const [falseStart, setFalseStart] = useState(false);
  const [goTime, setGoTime] = useState<number | null>(null);
  
  const myIndex = room.players.findIndex(p => p.id === multiplayerService.socketId);
  const isFinished = room.state.round >= room.state.maxRounds && localStatus === 'result';
  const score0 = room.state.scores[0] ?? 0;
  const score1 = room.state.scores[1] ?? 0;
  const winner = score0 > score1 ? 0 : score1 > score0 ? 1 : -1;
  const iWon = winner === myIndex;

  useEffect(() => {
    // Handle game events
    const handleGameUpdated = ({ result }: any) => {
      if (result?.status === 'ready') {
        setLocalStatus('ready');
        setMyReaction(null);
        setFalseStart(false);
        
        // Set go after delay
        setTimeout(() => {
          setLocalStatus('go');
          setGoTime(Date.now());
        }, result.goDelay);
      }
      
      if (result?.falseStart !== undefined) {
        if (result.falseStart === myIndex) {
          setFalseStart(true);
        }
      }
      
      if (result?.reactions) {
        setLocalStatus('result');
      }
    };

    multiplayerService.on('game-updated', handleGameUpdated);
    return () => multiplayerService.off('game-updated', handleGameUpdated);
  }, [myIndex]);

  const startRound = () => {
    multiplayerService.sendAction(room.id, { type: 'start-round' });
  };

  const handleClick = () => {
    if (localStatus === 'ready') {
      // Too early!
      setFalseStart(true);
      multiplayerService.sendAction(room.id, { type: 'click' });
    } else if (localStatus === 'go' && myReaction === null) {
      const reaction = Date.now() - (goTime || Date.now());
      setMyReaction(reaction);
      multiplayerService.sendAction(room.id, { type: 'click' });
    }
  };

  const getStatusColor = () => {
    if (localStatus === 'ready') return 'bg-red-500';
    if (localStatus === 'go') return 'bg-green-500';
    return 'bg-dark-card';
  };

  const getRoundWinner = () => {
    const r0 = room.state.reactions[0];
    const r1 = room.state.reactions[1];
    if (r0 === null || r0 === undefined || r1 === null || r1 === undefined) return null;
    if (r0 === -1 && r1 === -1) return -1;
    if (r0 === -1) return 1;
    if (r1 === -1) return 0;
    return r0 < r1 ? 0 : 1;
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

      {/* Main Area */}
      {isFinished ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-8 text-center"
        >
          <Trophy className={`w-20 h-20 mx-auto mb-4 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
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
              gameType="reaction-duel"
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
      ) : localStatus === 'waiting' ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-8 text-center"
        >
          <Zap className="w-16 h-16 text-accent-orange mx-auto mb-4" />
          <p className="text-gray-400 mb-6">
            Click the button when it turns GREEN!<br />
            Don't click too early!
          </p>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startRound}
            className="px-8 py-4 bg-accent-orange text-dark-bg font-arcade text-xl rounded-xl"
          >
            START ROUND
          </motion.button>
        </motion.div>
      ) : localStatus === 'result' ? (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-8 text-center"
        >
          {getRoundWinner() === myIndex ? (
            <>
              <Zap className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <p className="font-arcade text-2xl text-green-400 mb-2">YOU WIN ROUND!</p>
            </>
          ) : getRoundWinner() === -1 ? (
            <>
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="font-arcade text-2xl text-yellow-500 mb-2">BOTH FALSE START!</p>
            </>
          ) : (
            <>
              <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
              <p className="font-arcade text-2xl text-red-400 mb-2">
                {falseStart ? 'FALSE START!' : 'TOO SLOW!'}
              </p>
            </>
          )}
          
          <div className="flex justify-around mt-4 mb-6">
            {room.players.map((player, index) => (
              <div key={player.id} className="text-center">
                <p className="text-gray-500 text-sm">{player.name}</p>
                <p className={`font-arcade text-xl ${
                  room.state.reactions[index] === -1 
                    ? 'text-red-400' 
                    : getRoundWinner() === index 
                      ? 'text-green-400' 
                      : 'text-gray-400'
                }`}>
                  {room.state.reactions[index] === -1 
                    ? 'FALSE' 
                    : `${room.state.reactions[index]}ms`}
                </p>
              </div>
            ))}
          </div>

          {room.state.round < room.state.maxRounds && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={startRound}
              className="px-6 py-3 bg-accent-orange text-dark-bg font-arcade rounded-lg"
            >
              NEXT ROUND
            </motion.button>
          )}
        </motion.div>
      ) : (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleClick}
          className={`w-full aspect-square rounded-xl flex flex-col items-center justify-center transition-colors ${getStatusColor()}`}
          disabled={falseStart}
        >
          {falseStart ? (
            <>
              <AlertCircle className="w-20 h-20 text-white mb-4" />
              <p className="font-arcade text-3xl text-white">TOO EARLY!</p>
              <p className="text-white/70">Wait for opponent...</p>
            </>
          ) : localStatus === 'ready' ? (
            <>
              <p className="font-arcade text-4xl text-white">WAIT...</p>
              <p className="text-white/70 mt-2">Don't click yet!</p>
            </>
          ) : localStatus === 'go' ? (
            myReaction !== null ? (
              <>
                <Zap className="w-20 h-20 text-white mb-4" />
                <p className="font-arcade text-4xl text-white">{myReaction}ms</p>
                <p className="text-white/70">Waiting for opponent...</p>
              </>
            ) : (
              <>
                <p className="font-arcade text-6xl text-white">CLICK!</p>
              </>
            )
          ) : null}
        </motion.button>
      )}
    </div>
  );
}
