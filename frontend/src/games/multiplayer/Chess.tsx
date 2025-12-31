import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ChessProps {
  gameState: {
    board: (string | null)[][];
    currentTurn: string;
    winner: string | null;
    selectedPiece: { row: number; col: number } | null;
    validMoves: { row: number; col: number }[];
    capturedWhite: string[];
    capturedBlack: string[];
    inCheck: string | null;
    lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
  };
  playerId: string;
  players: Array<{ id: string; name: string }>;
  onAction: (action: { type: string; from?: { row: number; col: number }; to?: { row: number; col: number } }) => void;
}

// Chess pieces with Unicode symbols
const PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

export default function Chess({ gameState, playerId, players, onAction }: ChessProps) {
  const [selectedSquare, setSelectedSquare] = useState<{ row: number; col: number } | null>(null);
  const [validMoves, setValidMoves] = useState<{ row: number; col: number }[]>([]);
  
  const isMyTurn = gameState.currentTurn === playerId;
  const myColor = players[0]?.id === playerId ? 'white' : 'black';
  const opponent = players.find(p => p.id !== playerId);
  const currentPlayer = players.find(p => p.id === gameState.currentTurn);

  // Check if a piece belongs to the current player
  const isMyPiece = useCallback((piece: string | null) => {
    if (!piece) return false;
    const isWhitePiece = piece === piece.toUpperCase();
    return (myColor === 'white' && isWhitePiece) || (myColor === 'black' && !isWhitePiece);
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
      // If clicking on own piece, change selection
      if (piece && isMyPiece(piece)) {
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

  const isLastMoveSquare = (row: number, col: number) => {
    if (!gameState.lastMove) return false;
    return (gameState.lastMove.from.row === row && gameState.lastMove.from.col === col) ||
           (gameState.lastMove.to.row === row && gameState.lastMove.to.col === col);
  };

  const isLightSquare = (row: number, col: number) => (row + col) % 2 === 0;

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
          {isMyTurn ? `♟️ Your Turn (${myColor})` : `⏳ ${currentPlayer?.name || 'Opponent'}'s Turn`}
        </motion.div>
      )}

      {/* Check warning */}
      {gameState.inCheck && !gameState.winner && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded-xl font-bold"
        >
          ⚠️ {gameState.inCheck === playerId ? 'You are' : `${opponent?.name || 'Opponent'} is`} in CHECK!
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
            {gameState.winner === playerId ? '🎉👑🎉' : gameState.winner === 'draw' ? '🤝' : '😔'}
          </div>
          <div className="text-2xl font-bold text-white">
            {gameState.winner === playerId 
              ? 'Checkmate! You Win!' 
              : gameState.winner === 'draw'
                ? "Stalemate - It's a Draw!"
                : `Checkmate! ${opponent?.name || 'Opponent'} Wins!`}
          </div>
        </motion.div>
      )}

      {/* Captured pieces (opponent's) */}
      <div className="flex items-center gap-2 h-8">
        <span className="text-gray-500 text-sm">Captured:</span>
        <div className="flex gap-1">
          {(myColor === 'white' ? gameState.capturedBlack : gameState.capturedWhite)?.map((piece, i) => (
            <span key={i} className="text-xl opacity-60">{PIECES[piece]}</span>
          ))}
        </div>
      </div>

      {/* Chess board */}
      <div className="relative">
        {/* Board container with wooden frame effect */}
        <div className="bg-gradient-to-br from-amber-900 to-amber-950 p-3 rounded-lg shadow-2xl">
          {/* File labels (top) */}
          <div className="flex mb-1">
            <div className="w-6" />
            {(myColor === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a']).map(file => (
              <div key={file} className="w-10 sm:w-12 text-center text-amber-300/60 text-xs font-mono">
                {file}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Rank labels (left) */}
            <div className="flex flex-col justify-around mr-1">
              {(myColor === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8]).map(rank => (
                <div key={rank} className="h-10 sm:h-12 flex items-center text-amber-300/60 text-xs font-mono w-5">
                  {rank}
                </div>
              ))}
            </div>

            {/* Board grid */}
            <div className="grid grid-cols-8 border-2 border-amber-800 rounded overflow-hidden">
              {displayBoard.map((row, displayRow) =>
                row.map((piece, displayCol) => {
                  const { row: actualRow, col: actualCol } = getDisplayCoords(displayRow, displayCol);
                  const isLight = isLightSquare(displayRow, displayCol);
                  const isSelected = selectedSquare?.row === actualRow && selectedSquare?.col === actualCol;
                  const isValid = isValidMove(actualRow, actualCol);
                  const isLastMove = isLastMoveSquare(actualRow, actualCol);
                  const pieceOnSquare = piece;

                  return (
                    <motion.button
                      key={`${displayRow}-${displayCol}`}
                      onClick={() => handleSquareClick(actualRow, actualCol)}
                      disabled={!isMyTurn || gameState.winner !== null}
                      className={`
                        w-10 h-10 sm:w-12 sm:h-12 relative
                        flex items-center justify-center
                        transition-all duration-150
                        ${isLight 
                          ? 'bg-amber-100' 
                          : 'bg-amber-700'
                        }
                        ${isSelected ? 'ring-4 ring-orange-500 ring-inset z-10' : ''}
                        ${isLastMove ? 'bg-yellow-400/40' : ''}
                        ${isMyTurn && !gameState.winner ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                      `}
                      whileHover={isMyTurn && !gameState.winner ? { scale: 1.02 } : {}}
                    >
                      {/* Valid move indicator */}
                      {isValid && !pieceOnSquare && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute w-3 h-3 rounded-full bg-green-500/50"
                        />
                      )}
                      
                      {/* Capture indicator */}
                      {isValid && pieceOnSquare && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute inset-1 rounded-full border-4 border-red-500/50"
                        />
                      )}

                      {/* Chess piece */}
                      {pieceOnSquare && (
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={`${actualRow}-${actualCol}-${pieceOnSquare}`}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className={`
                              text-3xl sm:text-4xl select-none
                              ${pieceOnSquare === pieceOnSquare.toUpperCase() 
                                ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' 
                                : 'text-gray-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.3)]'
                              }
                              ${isSelected ? 'animate-pulse' : ''}
                            `}
                            style={{ 
                              textShadow: pieceOnSquare === pieceOnSquare.toUpperCase()
                                ? '0 0 8px rgba(255,255,255,0.5)'
                                : '0 0 8px rgba(0,0,0,0.5)'
                            }}
                          >
                            {PIECES[pieceOnSquare]}
                          </motion.span>
                        </AnimatePresence>
                      )}
                    </motion.button>
                  );
                })
              )}
            </div>

            {/* Rank labels (right) */}
            <div className="flex flex-col justify-around ml-1">
              {(myColor === 'white' ? [8,7,6,5,4,3,2,1] : [1,2,3,4,5,6,7,8]).map(rank => (
                <div key={rank} className="h-10 sm:h-12 flex items-center text-amber-300/60 text-xs font-mono w-5">
                  {rank}
                </div>
              ))}
            </div>
          </div>

          {/* File labels (bottom) */}
          <div className="flex mt-1">
            <div className="w-6" />
            {(myColor === 'white' ? ['a','b','c','d','e','f','g','h'] : ['h','g','f','e','d','c','b','a']).map(file => (
              <div key={file} className="w-10 sm:w-12 text-center text-amber-300/60 text-xs font-mono">
                {file}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Captured pieces (mine) */}
      <div className="flex items-center gap-2 h-8">
        <span className="text-gray-500 text-sm">Lost:</span>
        <div className="flex gap-1">
          {(myColor === 'white' ? gameState.capturedWhite : gameState.capturedBlack)?.map((piece, i) => (
            <span key={i} className="text-xl opacity-60">{PIECES[piece]}</span>
          ))}
        </div>
      </div>

      {/* Player info */}
      <div className="flex gap-8 text-sm">
        <div className={`flex items-center gap-2 ${myColor === 'white' ? 'text-white' : 'text-gray-400'}`}>
          <span className="text-2xl">{myColor === 'white' ? '♔' : '♚'}</span>
          <span>You ({myColor})</span>
        </div>
        <div className={`flex items-center gap-2 ${myColor === 'black' ? 'text-white' : 'text-gray-400'}`}>
          <span className="text-2xl">{myColor === 'black' ? '♔' : '♚'}</span>
          <span>{opponent?.name || 'Opponent'} ({myColor === 'white' ? 'black' : 'white'})</span>
        </div>
      </div>

      {/* Instructions */}
      {!gameState.winner && (
        <div className="text-center text-gray-400 text-sm">
          {isMyTurn 
            ? selectedSquare 
              ? '👆 Click a highlighted square to move, or click another piece'
              : '👆 Click one of your pieces to select it'
            : '⏳ Wait for your opponent to move...'}
        </div>
      )}
    </div>
  );
}
