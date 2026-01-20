/**
 * Checkers - On-Chain Multiplayer Version (CROSS-CHAIN PATTERN)
 * 
 * Classic checkers game with jumping and capturing mechanics.
 * Uses 32-square representation (dark squares only).
 * 
 * IMPORTANT: All game logic is on-chain. Frontend only renders state.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Loader2, Circle } from 'lucide-react';
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

// Convert 32-square index to 64-square index (dark squares only)
// This is for DISPLAY only - no game logic
function to64Index(idx32: number): number {
  const row = Math.floor(idx32 / 4);
  const col = (idx32 % 4) * 2 + (row % 2 === 0 ? 1 : 0);
  return row * 8 + col;
}

// Convert 64-square index to 32-square index
// This is for converting clicks to contract format
function to32Index(idx64: number): number {
  const row = Math.floor(idx64 / 8);
  const col = idx64 % 8;
  const isValidDarkSquare = (row + col) % 2 === 1;
  if (!isValidDarkSquare) return -1;
  return row * 4 + Math.floor(col / 2);
}

// Get 64-square board from 32-square representation (DISPLAY ONLY)
function expandBoard(squares32: number[]): number[] {
  const board64: number[] = Array(64).fill(-1); // -1 = light square
  
  for (let i = 0; i < 32; i++) {
    const idx64 = to64Index(i);
    board64[idx64] = squares32[i] ?? 0;
  }
  
  return board64;
}

// Default starting position (fallback only)
function getDefaultSquares(): number[] {
  const squares = Array(32).fill(0);
  for (let i = 0; i < 12; i++) squares[i] = 2;
  for (let i = 20; i < 32; i++) squares[i] = 1;
  return squares;
}

export function CheckersOnChain({ onLeave }: Props) {
  const { chainId, walletAddress } = useLineraConnection();
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMakingMove, setIsMakingMove] = useState(false);
  const [selectedPiece, setSelectedPiece] = useState<number | null>(null); // 32-index
  
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
  const iPlayRed = myIndex === 0; // Player One = Red

  // Debug logging
  useEffect(() => {
    if (room) {
      console.log('🔴 Checkers Debug:', {
        myIndex,
        myPlayerNum,
        currentTurn: room.currentTurn,
        normalizedTurn,
        isMyTurn,
        iPlayRed,
        checkersBoard: room.checkersBoard,
      });
    }
  }, [room, myIndex, myPlayerNum, normalizedTurn, isMyTurn, iPlayRed]);

  // Start polling
  useEffect(() => {
    multiplayerPolling.startPolling((roomData, err) => {
      setIsLoading(false);
      if (err) {
        setError(err.message);
      } else {
        setRoom(roomData);
        setError(null);
        const status = roomData?.status ? normalizeStatus(roomData.status) : null;
        if (status === 'Finished' || status === 'Draw') {
          multiplayerPolling.setInterval(5000);
        }
      }
    }, 600);

    return () => multiplayerPolling.stopPolling();
  }, []);

  // Handle square click - use on-chain board state
  const handleSquareClick = useCallback(async (idx64: number) => {
    if (!isMyTurn || isMakingMove) return;
    
    const idx32 = to32Index(idx64);
    if (idx32 === -1) return; // Light square clicked
    
    // Get current board from on-chain state (no client-side computation!)
    const currentSquares = room?.checkersBoard?.squares || getDefaultSquares();
    const piece = currentSquares[idx32];
    
    // Check if this is my piece
    const isMyPiece = iPlayRed 
      ? (piece === 1 || piece === 3)  // Red pieces
      : (piece === 2 || piece === 4); // Black pieces
    
    if (selectedPiece === null) {
      // Select a piece
      if (isMyPiece) {
        setSelectedPiece(idx32);
      }
    } else {
      if (idx32 === selectedPiece) {
        // Deselect
        setSelectedPiece(null);
        return;
      }
      
      if (isMyPiece) {
        // Select different piece
        setSelectedPiece(idx32);
        return;
      }
      
      // Try to move - contract validates and updates state
      console.log('🔴 Checkers attempting move:', { from: selectedPiece, to: idx32 });
      setIsMakingMove(true);
      setError(null);
      try {
        await makeMove({ from_pos: selectedPiece, to_pos: idx32 });
        console.log('🔴 Checkers move sent, fetching updated room...');
        const updated = await getMultiplayerRoom();
        console.log('🔴 Checkers updated room:', updated);
        setRoom(updated);
        setSelectedPiece(null);
      } catch (err) {
        console.error('🔴 Checkers move error:', err);
        setError((err as Error).message);
        setSelectedPiece(null);
      } finally {
        setIsMakingMove(false);
      }
    }
  }, [selectedPiece, isMyTurn, isMakingMove, room?.checkersBoard?.squares, iPlayRed]);

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
        'Checkers',
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

  // Get board from on-chain state (no client-side game logic!)
  // The contract updates squares[] after each move
  const squares32 = room?.checkersBoard?.squares || getDefaultSquares();
  const board64 = expandBoard(squares32);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 text-green-500 animate-spin mb-4" />
        <span className="text-gray-400">Loading Checkers...</span>
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
          <Circle className="w-5 h-5 text-green-500" fill="currentColor" />
          <span className="font-arcade text-green-500 text-sm">CHECKERS</span>
        </div>
      </div>

      {/* Waiting for opponent */}
      {isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card border border-green-500/30 rounded-xl p-8 text-center"
        >
          <Loader2 className="w-12 h-12 text-green-500 animate-spin mx-auto mb-4" />
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
              const isRed = index === 0;
              const isCurrentTurn = normalizedTurn === (index === 0 ? 'One' : 'Two');
              const isMe = index === myIndex;
              return (
                <motion.div
                  key={`player-${index}`}
                  animate={{ scale: isCurrentTurn && !isFinished ? 1.05 : 1 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isCurrentTurn && !isFinished
                      ? 'bg-green-500/20 border-2 border-green-500'
                      : 'bg-dark-card border border-dark-border'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full shadow-lg ${
                    isRed 
                      ? 'bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-400' 
                      : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500'
                  }`} />
                  <div>
                    <p className={`font-medium ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {room.usernames[index] || `Player ${index + 1}`}
                      {isMe && ' (You)'}
                    </p>
                    <p className={`text-xs ${isRed ? 'text-red-400' : 'text-gray-400'}`}>
                      {isRed ? 'Red' : 'Black'}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Checkers Board */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mb-6 flex flex-col items-center"
          >
            <div className="bg-amber-900 rounded-xl p-2 shadow-2xl">
              <div className={`grid grid-cols-8 gap-0 ${!iPlayRed ? 'rotate-180' : ''}`}>
                {board64.map((piece, idx64) => {
                  const row = Math.floor(idx64 / 8);
                  const col = idx64 % 8;
                  const isDark = (row + col) % 2 === 1;
                  const idx32 = to32Index(idx64);
                  const isSelected = selectedPiece !== null && selectedPiece === idx32;
                  
                  // Check if this is a valid piece I can select
                  const isMyPiece = piece === (iPlayRed ? 1 : 2) || piece === (iPlayRed ? 3 : 4);
                  const isKing = piece === 3 || piece === 4;
                  
                  return (
                    <motion.button
                      key={idx64}
                      onClick={() => isDark && handleSquareClick(idx64)}
                      whileHover={isDark && isMyTurn ? { scale: 1.05 } : {}}
                      disabled={!isDark}
                      className={`w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center transition-all
                        ${isDark ? 'bg-green-800' : 'bg-amber-200'}
                        ${isSelected ? 'ring-4 ring-yellow-400 ring-inset' : ''}
                        ${isDark && isMyTurn && isMyPiece ? 'cursor-pointer hover:brightness-125' : 'cursor-default'}
                        ${!iPlayRed ? 'rotate-180' : ''}
                      `}
                    >
                      {piece > 0 && (
                        <div className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full shadow-lg flex items-center justify-center
                          ${piece === 1 || piece === 3 
                            ? 'bg-gradient-to-br from-red-500 to-red-700 border-2 border-red-300' 
                            : 'bg-gradient-to-br from-gray-700 to-gray-900 border-2 border-gray-500'
                          }
                        `}>
                          {isKing && (
                            <span className="text-yellow-400 text-xs sm:text-sm font-bold">♔</span>
                          )}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Status */}
          {normalizedStatus === 'InProgress' && (
            <div className="text-center mb-4">
              <p className={`text-lg ${isMyTurn ? 'text-green-400' : 'text-gray-400'}`}>
                {isMyTurn 
                  ? selectedPiece !== null 
                    ? "Now click where to move" 
                    : "Your turn! Click a piece to select"
                  : `Waiting for ${room.usernames[normalizedTurn === 'One' ? 0 : 1]}...`
                }
              </p>
              {isMakingMove && (
                <p className="text-sm text-gray-500 mt-2 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting move...
                </p>
              )}
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
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
                <p className="font-arcade text-3xl text-yellow-500 mb-4">IT'S A DRAW!</p>
              ) : (
                <div className="mb-4">
                  <Trophy className={`w-16 h-16 mx-auto mb-3 ${iWon ? 'text-yellow-500' : 'text-gray-500'}`} />
                  <p className={`font-arcade text-3xl ${iWon ? 'text-green-400' : 'text-red-400'}`}>
                    {iWon ? 'YOU WIN!' : 'YOU LOSE!'}
                  </p>
                </div>
              )}

              {/* Claim Rewards */}
              <div className="my-6 p-6 bg-dark-card rounded-xl border border-green-500/30">
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
                className="px-8 py-3 bg-green-500 text-white font-arcade rounded-xl flex items-center gap-2 mx-auto"
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

export default CheckersOnChain;
