import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CheckersProps {
  gameState: {
    board: (string | null)[][];
    currentTurn: string;
    winner: string | null;
    selectedPiece: { row: number; col: number } | null;
    validMoves: { row: number; col: number; captures?: { row: number; col: number }[] }[];
    capturedRed: number;
    capturedBlack: number;
    mustJump: boolean;
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; from?: { row: number; col: number }; to?: { row: number; col: number } }) => void;
}

// Checker pieces
const PIECES: Record<string, { symbol: string; color: string }> = {
  'r': { symbol: '⬤', color: '#ef4444' },      // Red piece
  'R': { symbol: '👑', color: '#ef4444' },      // Red king
  'b': { symbol: '⬤', color: '#1f2937' },      // Black piece
  'B': { symbol: '👑', color: '#1f2937' },      // Black king
};

export default function Checkers({ gameState, playerId, players, onAction }: CheckersProps) {
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<{ row: number; col: number }[]>([]);
  
  const isMyTurn = gameState.currentTurn === playerId;
  const myColor = players[0]?.id === playerId ? 'red' : 'black';
  const opponent = players.find(p => p.id !== playerId);
  const currentPlayer = players.find(p => p.id === gameState.currentTurn);

  // Check if a piece belongs to the current player
  const isMyPiece = useCallback((piece: string | null) => {
    if (!piece) return false;
    const isRedPiece = piece.toLowerCase() === 'r';
    return (myColor === 'red' && isRedPiece) || (myColor === 'black' && !isRedPiece);
  }, [myColor]);

  // Reset selection when turn changes
  useEffect(() => {
    setSelectedSquare(null);
    setValidMoves([]);
  }, [gameState.currentTurn]);

  // Update valid moves from game state
  useEffect(() => {
    if (gameState.validMoves) {
      setValidMoves(gameState.validMoves);
    }
  }, [gameState.validMoves]);

  const handleSquareClick = (row: number, col: number) => {
    if (!isMyTurn || gameState.winner) return;

    const piece = gameState.board?.[row]?.[col];

    // If no piece is selected and clicked on own piece, select it
    if (!selectedSquare && piece && isMyPiece(piece)) {
      setSelectedSquare({ row, col });
      onAction({ type: 'select', from: { row, col } });
      return;
    }

    // If a piece is selected
    if (selectedSquare) {
      // If clicking on own piece, change selection (unless must continue jumping)
      if (piece && isMyPiece(piece) && !gameState.mustJump) {
        setSelectedSquare({ row, col });
        onAction({ type: 'select', from: { row, col } });
        return;
      }

      // Try to move to the clicked square
      onAction({ 
        type: 'move', 
        from: selectedSquare, 
        to: { row, col } 
      });
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  const isValidMove = (row: number, col: number) => {
    return validMoves.some(m => m.row === row && m.col === col);
  };

  const isPlayableSquare = (row: number, col: number) => (row + col) % 2 === 1;

  // Flip board for black player
  const getDisplayBoard = () => {
    if (!gameState.board) return Array(8).fill(null).map(() => Array(8).fill(null));
    if (myColor === 'black') {
      return gameState.board.map(row => [...row].reverse()).reverse();
    }
    return gameState.board;
  };

  const getDisplayCoords = (row: number, col: number) => {
    if (myColor === 'black') {
      return { row: 7 - row, col: 7 - col };
    }
    return { row, col };
  };

  const displayBoard = getDisplayBoard();

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Status indicator */}
      {!gameState.winner && (
        <motion.div
          key={gameState.currentTurn}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={`text-lg font-bold px-6 py-2 rounded-xl ${
            isMyTurn 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {isMyTurn 
            ? `🎯 Your Turn (${myColor})${gameState.mustJump ? ' - Must Jump!' : ''}` 
            : `⏳ ${currentPlayer?.name || 'Opponent'}'s Turn`}
        </motion.div>
      )}

      {/* Must jump warning */}
      {gameState.mustJump && isMyTurn && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-2 rounded-xl font-bold"
        >
          ⚠️ You must continue jumping!
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
            {gameState.winner === playerId ? '🎉🏆🎉' : '😔'}
          </div>
          <div className="text-2xl font-bold text-white">
            {gameState.winner === playerId 
              ? 'You Win!' 
              : `${opponent?.name || 'Opponent'} Wins!`}
          </div>
        </motion.div>
      )}

      {/* Score display */}
      <div className="flex justify-center gap-8 mb-2">
        <div className={`text-center p-3 rounded-xl ${myColor === 'red' ? 'ring-2 ring-red-500' : ''}`}>
          <div className="text-sm text-gray-400">
            {myColor === 'red' ? 'You' : opponent?.name || 'Opponent'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" style={{ color: '#ef4444' }}>⬤</span>
            <span className="text-2xl font-bold text-red-400">
              {12 - (gameState.capturedRed || 0)}
            </span>
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-500 self-center">VS</div>
        <div className={`text-center p-3 rounded-xl ${myColor === 'black' ? 'ring-2 ring-gray-500' : ''}`}>
          <div className="text-sm text-gray-400">
            {myColor === 'black' ? 'You' : opponent?.name || 'Opponent'}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl" style={{ color: '#1f2937' }}>⬤</span>
            <span className="text-2xl font-bold text-gray-400">
              {12 - (gameState.capturedBlack || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Checkers board */}
      <div className="relative">
        {/* Board container with wooden frame effect */}
        <div className="bg-gradient-to-br from-amber-900 to-amber-950 p-3 rounded-lg shadow-2xl">
          {/* Board grid */}
          <div className="grid grid-cols-8 border-4 border-amber-800 rounded overflow-hidden">
            {displayBoard.map((row, displayRow) =>
              row.map((piece, displayCol) => {
                const { row: actualRow, col: actualCol } = getDisplayCoords(displayRow, displayCol);
                const isPlayable = isPlayableSquare(displayRow, displayCol);
                const isSelected = selectedSquare?.row === actualRow && selectedSquare?.col === actualCol;
                const isValid = isValidMove(actualRow, actualCol);
                const pieceOnSquare = piece;
                const pieceInfo = pieceOnSquare ? PIECES[pieceOnSquare] : null;

                return (
                  <motion.button
                    key={`${displayRow}-${displayCol}`}
                    onClick={() => handleSquareClick(actualRow, actualCol)}
                    disabled={!isMyTurn || gameState.winner !== null || !isPlayable}
                    className={`
                      w-10 h-10 sm:w-12 sm:h-12 relative
                      flex items-center justify-center
                      transition-all duration-150
                      ${isPlayable 
                        ? 'bg-green-800' 
                        : 'bg-amber-200'
                      }
                      ${isSelected ? 'ring-4 ring-yellow-400 ring-inset z-10' : ''}
                      ${isMyTurn && !gameState.winner && isPlayable ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                    `}
                    whileHover={isMyTurn && !gameState.winner && isPlayable ? { scale: 1.02 } : {}}
                  >
                    {/* Valid move indicator */}
                    {isValid && !pieceOnSquare && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute w-4 h-4 rounded-full bg-yellow-400/70 shadow-lg"
                      />
                    )}
                    
                    {/* Capture indicator */}
                    {isValid && pieceOnSquare && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute inset-1 rounded-full border-4 border-red-500 animate-pulse"
                      />
                    )}

                    {/* Checker piece */}
                    {pieceOnSquare && pieceInfo && (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${actualRow}-${actualCol}-${pieceOnSquare}`}
                          initial={{ scale: 0, y: -20 }}
                          animate={{ scale: 1, y: 0 }}
                          exit={{ scale: 0, y: 20 }}
                          className={`
                            relative w-8 h-8 sm:w-10 sm:h-10 rounded-full
                            flex items-center justify-center
                            ${isSelected ? 'animate-bounce' : ''}
                          `}
                          style={{
                            backgroundColor: pieceInfo.color,
                            boxShadow: `
                              inset 0 -4px 8px rgba(0,0,0,0.4),
                              inset 0 4px 8px rgba(255,255,255,0.2),
                              0 4px 8px rgba(0,0,0,0.5)
                            `,
                          }}
                        >
                          {/* King crown */}
                          {(pieceOnSquare === 'R' || pieceOnSquare === 'B') && (
                            <span className="text-xl sm:text-2xl" style={{ 
                              filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                              color: pieceOnSquare === 'R' ? '#fbbf24' : '#fbbf24'
                            }}>
                              👑
                            </span>
                          )}
                          
                          {/* Highlight ring for pieces */}
                          <div 
                            className="absolute inset-1 rounded-full border-2 opacity-30"
                            style={{ borderColor: pieceOnSquare.toLowerCase() === 'r' ? '#fca5a5' : '#9ca3af' }}
                          />
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </motion.button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Player info */}
      <div className="flex gap-8 text-sm">
        <div className={`flex items-center gap-2 ${myColor === 'red' ? 'text-red-400' : 'text-gray-400'}`}>
          <span className="text-2xl" style={{ color: myColor === 'red' ? '#ef4444' : '#1f2937' }}>⬤</span>
          <span>You ({myColor})</span>
        </div>
        <div className={`flex items-center gap-2 ${myColor === 'black' ? 'text-gray-400' : 'text-red-400'}`}>
          <span className="text-2xl" style={{ color: myColor === 'black' ? '#ef4444' : '#1f2937' }}>⬤</span>
          <span>{opponent?.name || 'Opponent'} ({myColor === 'red' ? 'black' : 'red'})</span>
        </div>
      </div>

      {/* Instructions */}
      {!gameState.winner && (
        <div className="text-center text-gray-400 text-sm">
          {isMyTurn 
            ? selectedSquare 
              ? '👆 Click a highlighted square to move'
              : '👆 Click one of your pieces to select it'
            : '⏳ Wait for your opponent to move...'}
        </div>
      )}

      {/* Rules reminder */}
      <div className="text-center text-gray-500 text-xs mt-2">
        💡 Capture all opponent pieces or block them to win. Kings can move backwards!
      </div>
    </div>
  );
}
