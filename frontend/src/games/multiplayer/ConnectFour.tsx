import { useState } from 'react';
import { motion } from 'framer-motion';

interface ConnectFourProps {
  gameState: {
    board: (string | null)[][];
    currentTurn: string;
    winner: string | null;
    winLine: number[][] | null;
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; column?: number }) => void;
}

const ROWS = 6;
const COLS = 7;

export default function ConnectFour({ gameState, playerId, players, onAction }: ConnectFourProps) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  
  const isMyTurn = gameState.currentTurn === playerId;
  const currentPlayer = players.find(p => p.id === gameState.currentTurn);
  const myColor = players[0]?.id === playerId ? '🔴' : '🟡';
  const opponentColor = players[0]?.id === playerId ? '🟡' : '🔴';
  const opponent = players.find(p => p.id !== playerId);

  const handleColumnClick = (col: number) => {
    if (!isMyTurn || gameState.winner) return;
    
    // Check if column is full
    if (!gameState.board || gameState.board[0]?.[col] !== null) return;
    
    onAction({ type: 'drop', column: col });
  };

  const isWinningCell = (row: number, col: number) => {
    if (!gameState.winLine) return false;
    return gameState.winLine.some((cell: number[]) => cell[0] === row && cell[1] === col);
  };

  const getCellContent = (cell: string | null) => {
    if (cell === 'red') return '🔴';
    if (cell === 'yellow') return '🟡';
    return '';
  };

  const getPreviewRow = (col: number) => {
    if (!gameState.board) return -1;
    for (let row = ROWS - 1; row >= 0; row--) {
      if (gameState.board[row]?.[col] === null) {
        return row;
      }
    }
    return -1;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Turn indicator */}
      {!gameState.winner && (
        <motion.div
          key={gameState.currentTurn}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-xl font-bold px-6 py-2 rounded-xl ${
            isMyTurn 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {isMyTurn ? `🎯 Your Turn (${myColor})` : `⏳ ${currentPlayer?.name || 'Opponent'}'s Turn (${opponentColor})`}
        </motion.div>
      )}

      {/* Winner announcement */}
      {gameState.winner && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="text-4xl mb-2">
            {gameState.winner === playerId ? '🎉' : gameState.winner === 'draw' ? '🤝' : '😔'}
          </div>
          <div className="text-2xl font-bold text-white">
            {gameState.winner === playerId 
              ? 'You Win!' 
              : gameState.winner === 'draw'
                ? "It's a Draw!"
                : `${opponent?.name || 'Opponent'} Wins!`}
          </div>
        </motion.div>
      )}

      {/* Game board */}
      <div className="bg-blue-600 p-3 rounded-2xl shadow-2xl">
        {/* Column buttons (invisible, for click handling) */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {Array.from({ length: COLS }).map((_, col) => (
            <motion.div
              key={col}
              className={`h-8 rounded-t-lg flex items-center justify-center cursor-pointer ${
                isMyTurn && getPreviewRow(col) >= 0 && !gameState.winner
                  ? 'hover:bg-blue-500'
                  : ''
              }`}
              onMouseEnter={() => setHoveredCol(col)}
              onMouseLeave={() => setHoveredCol(null)}
              onClick={() => handleColumnClick(col)}
            >
              {hoveredCol === col && isMyTurn && getPreviewRow(col) >= 0 && !gameState.winner && (
                <motion.span
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 0.5, y: 0 }}
                  className="text-2xl"
                >
                  {myColor}
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Board grid */}
        <div className="grid grid-cols-7 gap-1">
          {gameState.board.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <motion.button
                key={`${rowIndex}-${colIndex}`}
                onClick={() => handleColumnClick(colIndex)}
                disabled={!isMyTurn || gameState.winner !== null}
                className={`
                  w-10 h-10 sm:w-12 sm:h-12 rounded-full
                  ${cell 
                    ? 'bg-gray-900' 
                    : 'bg-gray-900 hover:bg-gray-800'
                  }
                  ${isWinningCell(rowIndex, colIndex) ? 'ring-4 ring-yellow-400 animate-pulse' : ''}
                  flex items-center justify-center text-2xl sm:text-3xl
                  transition-all duration-200
                `}
                whileHover={!cell && isMyTurn && !gameState.winner ? { scale: 1.05 } : {}}
              >
                {cell && (
                  <motion.span
                    initial={{ scale: 0, y: -50 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    {getCellContent(cell)}
                  </motion.span>
                )}
              </motion.button>
            ))
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="text-center text-gray-400 text-sm">
        {isMyTurn && !gameState.winner
          ? '👆 Click a column to drop your piece' 
          : !gameState.winner
            ? '⏳ Wait for your opponent...'
            : ''}
      </div>

      {/* Player colors */}
      <div className="flex gap-6 text-sm text-gray-400">
        <span>You: {myColor}</span>
        <span>{opponent?.name || 'Opponent'}: {opponentColor}</span>
      </div>
    </div>
  );
}
