/**
 * Chess - On-Chain Multiplayer Version (CROSS-CHAIN PATTERN)
 * 
 * Strategic chess game using FEN notation for board state.
 * Enter moves in algebraic notation (e.g., e2e4, Nf3, O-O).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Loader2, Crown, RotateCcw } from 'lucide-react';
import { 
  MultiplayerGameRoom, 
  multiplayerPolling,
  getMultiplayerRoom,
  makeMove,
  forfeitGame,
  normalizePlayer,
  normalizeStatus,
  isStatusWaitingForPlayer,
  claimMultiplayerRewards,
} from '../../lib/multiplayer/onchain';
import { useLineraConnection } from '../../hooks/useLineraConnection';

interface Props {
  onLeave: () => void;
}

// Chess piece Unicode characters with colors
const WHITE_PIECES: Record<string, string> = {
  'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
};
const BLACK_PIECES: Record<string, string> = {
  'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟',
};

// Parse FEN string to 64-square board array
// This only PARSES the on-chain FEN - NO game logic computation
function parseFEN(fen: string): string[] {
  const board: string[] = Array(64).fill('');
  if (!fen) return board;
  
  const fenParts = fen.split(' ');
  if (!fenParts[0]) return board;
  const rows = fenParts[0].split('/');
  let idx = 0;
  
  for (const row of rows) {
    for (const char of row) {
      if (char >= '1' && char <= '8') {
        idx += parseInt(char);
      } else {
        board[idx] = char;
        idx++;
      }
    }
  }
  
  return board;
}

// Get square name from index (0=a8, 63=h1)
function getSquareName(idx: number): string {
  const file = String.fromCharCode(97 + (idx % 8));
  const rank = 8 - Math.floor(idx / 8);
  return `${file}${rank}`;
}

export function ChessOnChain({ onLeave }: Props) {
  const { chainId, walletAddress } = useLineraConnection();
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMakingMove, setIsMakingMove] = useState(false);
  const [selectedSquare, setSelectedSquare] = useState<number | null>(null);
  const [moveInput, setMoveInput] = useState('');
  
  // Rewards state
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{ xp: number; coins: number } | null>(null);

  // Player identity
  const getMyIndex = (): number => {
    if (!room) return -1;
    if (chainId && room.playerChainIds) {
      const chainIndex = room.playerChainIds.findIndex(id => 
        id && id.toLowerCase() === chainId.toLowerCase()
      );
      if (chainIndex !== -1) return chainIndex;
    }
    if (walletAddress && room.players) {
      const walletLower = walletAddress.toLowerCase();
      const playerIndex = room.players.findIndex(p => 
        p && (p.toLowerCase() === walletLower || p.toLowerCase() === `user:${walletLower}` || p.toLowerCase().includes(walletLower))
      );
      if (playerIndex !== -1) return playerIndex;
    }
    return -1;
  };
  
  const myIndex = getMyIndex();
  const myPlayerNum = myIndex === 0 ? 'One' : 'Two';
  const normalizedStatus = room?.status ? normalizeStatus(room.status) : null;
  const normalizedTurn = normalizePlayer(room?.currentTurn ?? null);
  const isMyTurn = normalizedStatus === 'InProgress' && normalizedTurn === myPlayerNum;
  const iPlayWhite = myIndex === 0; // Player One = White

  // Debug logging
  useEffect(() => {
    if (room) {
      console.log('♔ Chess Debug:', {
        myIndex,
        myPlayerNum,
        currentTurn: room.currentTurn,
        normalizedTurn,
        isMyTurn,
        iPlayWhite,
        chessBoard: room.chessBoard,
        gameType: room.gameType,
      });
    }
  }, [room, myIndex, myPlayerNum, normalizedTurn, isMyTurn, iPlayWhite]);

  // Start polling - only set room if it's a Chess game
  useEffect(() => {
    multiplayerPolling.startPolling((roomData, err) => {
      setIsLoading(false);
      if (err) {
        setError(err.message);
      } else if (roomData) {
        // Validate that this is a Chess room, not a stale room from another game
        const roomGameType = roomData.gameType?.toString().toUpperCase().replace('_', '');
        const isChessRoom = roomGameType === 'CHESS' || roomGameType === 'Chess';
        
        if (isChessRoom) {
          setRoom(roomData);
          setError(null);
          const status = roomData?.status ? normalizeStatus(roomData.status) : null;
          if (status === 'Finished' || status === 'Draw') {
            multiplayerPolling.setInterval(5000);
          }
        } else {
          // Got a room of the wrong type - likely stale data
          console.warn(`♔ Chess: Ignoring room with wrong gameType: ${roomData.gameType}`);
          setRoom(null);
          setError('Waiting for Chess game to initialize...');
        }
      } else {
        setRoom(null);
        setError(null);
      }
    }, 800);

    return () => multiplayerPolling.stopPolling();
  }, []);

  // Handle move submission
  const handleSubmitMove = useCallback(async () => {
    console.log('♟️ Chess handleSubmitMove:', { moveInput, isMakingMove, isMyTurn });
    if (!moveInput.trim() || isMakingMove || !isMyTurn) {
      console.log('♟️ Chess move blocked:', { empty: !moveInput.trim(), making: isMakingMove, notMyTurn: !isMyTurn });
      return;
    }

    setIsMakingMove(true);
    setError(null);
    try {
      console.log('♟️ Chess sending move:', moveInput.trim());
      await makeMove({ chess_move: moveInput.trim() });
      console.log('♟️ Chess move sent, fetching updated room...');
      const updated = await getMultiplayerRoom();
      console.log('♟️ Chess updated room:', updated);
      setRoom(updated);
      setMoveInput('');
      setSelectedSquare(null);
    } catch (err) {
      console.error('♟️ Chess move error:', err);
      setError((err as Error).message);
    } finally {
      setIsMakingMove(false);
    }
  }, [moveInput, isMakingMove, isMyTurn]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmitMove();
  };

  // Handle square click for move input help
  const handleSquareClick = (idx: number) => {
    if (!isMyTurn) return;
    
    const squareName = getSquareName(idx);
    
    if (selectedSquare === null) {
      setSelectedSquare(idx);
      setMoveInput(getSquareName(idx));
    } else {
      // Complete the move
      const fromSquare = getSquareName(selectedSquare);
      setMoveInput(`${fromSquare}${squareName}`);
      setSelectedSquare(null);
    }
  };

  const handleForfeit = useCallback(async () => {
    try {
      await forfeitGame();
      const updated = await getMultiplayerRoom();
      setRoom(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Game results (moved before handleClaimRewards)
  const isFinished = normalizedStatus === 'Finished' || normalizedStatus === 'Draw';
  const isDraw = normalizedStatus === 'Draw';
  const winner = normalizePlayer(room?.winner ?? null);
  const iWon = winner === myPlayerNum;

  const handleClaimRewards = useCallback(async () => {
    if (isClaiming || rewardsClaimed || !room) return;
    setIsClaiming(true);
    try {
      const result = await claimMultiplayerRewards(
        iWon,
        isDraw,
        'Chess',
        room.usernames[myIndex === 0 ? 1 : 0],
        room.hostChainId
      );
      setClaimedRewards(result);
      setRewardsClaimed(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsClaiming(false);
    }
  }, [isClaiming, rewardsClaimed, room, iWon, isDraw, myIndex]);

  // Get board from on-chain FEN (no client-side game logic!)
  // The contract updates the FEN after each move
  const fen = room?.chessBoard?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const board = parseFEN(fen);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
        <span className="text-gray-400">Loading Chess...</span>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-6 text-center">
          <p className="text-yellow-400 mb-4">Room not found.</p>
          <button onClick={onLeave} className="text-gray-400 hover:text-white underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
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
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-purple-500" />
          <span className="font-arcade text-purple-500 text-sm">CHESS</span>
        </div>
      </div>

      {/* Waiting for opponent */}
      {isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card border border-purple-500/30 rounded-xl p-8 text-center"
        >
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white font-medium text-lg mb-2">Waiting for opponent...</p>
          <p className="text-gray-400 text-sm">Share your Host Chain ID to invite a friend!</p>
        </motion.div>
      )}

      {/* Game in Progress or Finished */}
      {!isStatusWaitingForPlayer(room.status) && (
        <>
          {/* Players */}
          <div className="flex justify-between items-center mb-4">
            {room.players.map((_player, index) => {
              const isWhite = index === 0;
              const isCurrentTurn = normalizedTurn === (index === 0 ? 'One' : 'Two');
              const isMe = index === myIndex;
              return (
                <motion.div
                  key={`player-${index}`}
                  animate={{ scale: isCurrentTurn && !isFinished ? 1.05 : 1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentTurn && !isFinished
                      ? 'bg-purple-500/20 border-2 border-purple-500'
                      : 'bg-dark-card border border-dark-border'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-2xl ${
                    isWhite ? 'bg-white text-gray-900' : 'bg-gray-900 text-white border border-gray-600'
                  }`}>
                    {isWhite ? '♔' : '♚'}
                  </div>
                  <div>
                    <p className={`font-medium ${isMe ? 'text-purple-400' : 'text-white'}`}>
                      {room.usernames[index] || `Player ${index + 1}`}
                      {isMe && ' (You)'}
                    </p>
                    <p className={`text-xs ${isWhite ? 'text-amber-400' : 'text-gray-400'}`}>
                      {isWhite ? 'White' : 'Black'}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Chess Board */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 flex flex-col items-center"
          >
            {/* Flip button for black player */}
            {!iPlayWhite && (
              <div className="mb-2 text-sm text-gray-400 flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> Board flipped (you play Black)
              </div>
            )}
            
            <div className="bg-amber-900 rounded-xl p-2 shadow-2xl">
              <div className={`grid grid-cols-8 gap-0 ${!iPlayWhite ? 'rotate-180' : ''}`}>
                {board.map((piece, idx) => {
                  const row = Math.floor(idx / 8);
                  const col = idx % 8;
                  const isLight = (row + col) % 2 === 0;
                  const isSelected = selectedSquare === idx;
                  const isWhitePiece = piece === piece.toUpperCase() && piece !== '';
                  
                  return (
                    <motion.button
                      key={idx}
                      onClick={() => handleSquareClick(idx)}
                      whileHover={isMyTurn ? { scale: 1.05 } : {}}
                      className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-3xl sm:text-4xl transition-all
                        ${isLight ? 'bg-amber-200' : 'bg-amber-700'}
                        ${isSelected ? 'ring-4 ring-purple-500 ring-inset' : ''}
                        ${isMyTurn ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                        ${!iPlayWhite ? 'rotate-180' : ''}
                      `}
                    >
                      <span className={isWhitePiece ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}>
                        {WHITE_PIECES[piece] || BLACK_PIECES[piece] || ''}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
            
            {/* File labels */}
            <div className={`flex justify-center mt-1 ${!iPlayWhite ? 'flex-row-reverse' : ''}`}>
              {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(f => (
                <span key={f} className="w-10 sm:w-12 text-center text-gray-500 text-xs">{f}</span>
              ))}
            </div>
          </motion.div>

          {/* Move History */}
          {room.chessBoard?.moves && room.chessBoard.moves.length > 0 && (
            <div className="mb-4 p-3 bg-dark-card rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Move History:</p>
              <p className="text-sm text-gray-300 font-mono">
                {room.chessBoard.moves.slice(-6).join(' ')}
              </p>
            </div>
          )}

          {/* Move Input */}
          {normalizedStatus === 'InProgress' && (
            <div className="mb-6">
              <p className={`text-center mb-3 ${isMyTurn ? 'text-purple-400' : 'text-gray-400'}`}>
                {isMyTurn 
                  ? "Your turn! Click squares or type move (e.g., e2e4):" 
                  : `Waiting for ${room.usernames[normalizedTurn === 'One' ? 0 : 1]}...`
                }
              </p>
              {isMyTurn && (
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={moveInput}
                    onChange={(e) => setMoveInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="e2e4"
                    className="flex-1 bg-dark-bg border-2 border-purple-500/30 rounded-xl px-4 py-3 text-white text-center font-mono text-lg focus:outline-none focus:border-purple-500"
                  />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSubmitMove}
                    disabled={isMakingMove || !moveInput.trim()}
                    className="px-6 py-3 bg-purple-500 text-white font-arcade rounded-xl disabled:opacity-50"
                  >
                    {isMakingMove ? <Loader2 className="w-5 h-5 animate-spin" /> : 'MOVE'}
                  </motion.button>
                </div>
              )}
              {error && (
                <p className="text-red-400 text-sm text-center mt-2">{error}</p>
              )}
            </div>
          )}

          {/* Game Over */}
          {isFinished && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              {isDraw ? (
                <p className="font-arcade text-3xl text-yellow-500 mb-4">STALEMATE!</p>
              ) : (
                <div className="mb-4">
                  <Trophy className={`w-16 h-16 mx-auto mb-3 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
                  <p className={`font-arcade text-3xl ${iWon ? 'text-green-400' : 'text-red-400'}`}>
                    {iWon ? 'CHECKMATE! YOU WIN!' : 'CHECKMATE! YOU LOSE!'}
                  </p>
                </div>
              )}

              {/* Claim Rewards */}
              <div className="my-6 p-6 bg-dark-card rounded-xl border border-purple-500/30">
                {rewardsClaimed && claimedRewards ? (
                  <div className="text-center">
                    <p className="text-green-400 font-medium text-lg mb-2">🎉 Rewards Claimed!</p>
                    <p className="text-white text-xl">+{claimedRewards.xp} XP, +{claimedRewards.coins} Coins</p>
                  </div>
                ) : (
                  <>
                    <p className="text-gray-400 text-sm mb-4">
                      Your rewards are ready! Claim them to update your profile.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleClaimRewards}
                      disabled={isClaiming}
                      className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white font-arcade rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isClaiming ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Claiming...
                        </>
                      ) : (
                        <>
                          <Trophy className="w-5 h-5" />
                          Claim Rewards
                        </>
                      )}
                    </motion.button>
                  </>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onLeave}
                className="px-8 py-3 bg-purple-500 text-white font-arcade rounded-xl flex items-center gap-2 mx-auto"
              >
                <ArrowLeft className="w-5 h-5" />
                BACK TO LOBBY
              </motion.button>
            </motion.div>
          )}

          {/* Forfeit button */}
          {normalizedStatus === 'InProgress' && (
            <div className="text-center mt-4">
              <button onClick={handleForfeit} className="text-gray-500 hover:text-red-400 text-sm underline">
                Forfeit game
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ChessOnChain;
