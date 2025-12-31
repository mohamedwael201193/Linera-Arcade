/**
 * Tic Tac Toe - Multiplayer Version
 */

import { motion } from 'framer-motion';
import { ArrowLeft, RotateCcw, Trophy, X, Circle } from 'lucide-react';
import { multiplayerService } from '../../lib/multiplayer/socket';
import { BlockchainResultSubmit } from '../../components/BlockchainResultSubmit';

interface Room {
  id: string;
  gameType: string;
  players: { id: string; name: string; score: number }[];
  state: {
    board: (string | null)[];
    currentTurn: number;
  };
  status: string;
}

interface Props {
  room: Room;
  onLeave: () => void;
  onRematch: () => void;
}

export function TicTacToeGame({ room, onLeave, onRematch }: Props) {
  const myIndex = room.players.findIndex(p => p.id === multiplayerService.socketId);
  const isMyTurn = room.state.currentTurn === myIndex;
  
  const handleCellClick = (position: number) => {
    if (!isMyTurn || room.state.board[position] || room.status === 'finished') return;
    multiplayerService.sendAction(room.id, { position });
  };

  const getWinner = () => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (const line of lines) {
      const [a, b, c] = line;
      if (a !== undefined && b !== undefined && c !== undefined &&
          room.state.board[a] && 
          room.state.board[a] === room.state.board[b] && 
          room.state.board[a] === room.state.board[c]) {
        return room.state.board[a] === 'X' ? 0 : 1;
      }
    }
    if (room.state.board.every(cell => cell !== null)) return -1; // Draw
    return null;
  };

  const winner = getWinner();
  const isDraw = winner === -1;
  const isFinished = winner !== null;
  const iWon = winner === myIndex;

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
        <div className="font-arcade text-accent-orange">{room.id}</div>
      </div>

      {/* Players */}
      <div className="flex justify-between items-center mb-6">
        {room.players.map((player, index) => (
          <motion.div
            key={player.id}
            animate={{ 
              scale: room.state.currentTurn === index && !isFinished ? 1.05 : 1,
              opacity: room.state.currentTurn === index || isFinished ? 1 : 0.5,
            }}
            className={`flex items-center gap-3 p-3 rounded-xl ${
              room.state.currentTurn === index && !isFinished
                ? 'bg-accent-orange/20 border border-accent-orange/50'
                : 'bg-dark-card border border-dark-border'
            }`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              index === 0 ? 'bg-accent-orange/20' : 'bg-blue-500/20'
            }`}>
              {index === 0 ? (
                <X className="w-6 h-6 text-accent-orange" />
              ) : (
                <Circle className="w-6 h-6 text-blue-500" />
              )}
            </div>
            <div>
              <p className="text-white text-sm font-medium">
                {player.name}
                {player.id === multiplayerService.socketId && ' (You)'}
              </p>
              <p className="text-gray-500 text-xs">Score: {player.score}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Game Board */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-4 mb-6"
      >
        <div className="grid grid-cols-3 gap-2">
          {room.state.board.map((cell, index) => (
            <motion.button
              key={index}
              whileHover={!cell && isMyTurn && !isFinished ? { scale: 1.05 } : {}}
              whileTap={!cell && isMyTurn && !isFinished ? { scale: 0.95 } : {}}
              onClick={() => handleCellClick(index)}
              disabled={!!cell || !isMyTurn || isFinished}
              className={`aspect-square rounded-xl flex items-center justify-center text-5xl font-arcade transition-all ${
                cell 
                  ? 'bg-dark-bg' 
                  : isMyTurn && !isFinished
                    ? 'bg-dark-bg hover:bg-accent-orange/10 cursor-pointer'
                    : 'bg-dark-bg/50 cursor-not-allowed'
              }`}
            >
              {cell === 'X' && (
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                >
                  <X className="w-12 h-12 text-accent-orange" strokeWidth={3} />
                </motion.div>
              )}
              {cell === 'O' && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <Circle className="w-10 h-10 text-blue-500" strokeWidth={3} />
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Status */}
      <div className="text-center">
        {!isFinished && (
          <p className={`text-lg ${isMyTurn ? 'text-accent-orange' : 'text-gray-400'}`}>
            {isMyTurn ? "Your turn!" : `${room.players[room.state.currentTurn]?.name}'s turn...`}
          </p>
        )}

        {isFinished && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            {isDraw ? (
              <p className="font-arcade text-2xl text-yellow-500 mb-4">IT'S A DRAW!</p>
            ) : (
              <div className="mb-4">
                <Trophy className={`w-12 h-12 mx-auto mb-2 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
                <p className={`font-arcade text-2xl ${iWon ? 'text-green-400' : 'text-red-400'}`}>
                  {iWon ? 'YOU WIN!' : 'YOU LOSE!'}
                </p>
              </div>
            )}
            
            {/* Blockchain Submit - Get XP & Coins! */}
            {!isDraw && (
              <BlockchainResultSubmit
                gameType="tic-tac-toe"
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
        )}
      </div>
    </div>
  );
}
