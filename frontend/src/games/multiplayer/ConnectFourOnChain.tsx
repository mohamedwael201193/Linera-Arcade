/**
 * Connect Four - On-Chain Multiplayer Version (CROSS-CHAIN PATTERN)
 * 
 * Uses cross-chain messaging for game state sync.
 * Each player queries their own chain's multiplayer_room.
 * 
 * MATCHES TicTacToeOnChain.tsx exactly in:
 * - Player identity detection (chain ID primary, wallet fallback)
 * - Status/player normalization
 * - Rewards claiming flow
 * - Debug logging
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Loader2 } from 'lucide-react';
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

export function ConnectFourOnChain({ onLeave }: Props) {
  const { chainId, walletAddress } = useLineraConnection();
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMakingMove, setIsMakingMove] = useState(false);
  const [hoverColumn, setHoverColumn] = useState<number | null>(null);
  
  // Rewards state (matches TicTacToe)
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{ xp: number; coins: number } | null>(null);

  // Determine which player index I am (0 or 1)
  // Primary: Match by chain ID (playerChainIds[0] = host/Player One, [1] = joiner/Player Two)
  // Fallback: Match by wallet address in players array
  const getMyIndex = (): number => {
    if (!room) return -1;
    
    // Try chain ID matching first (primary method)
    if (chainId && room.playerChainIds) {
      const chainIndex = room.playerChainIds.findIndex(id => 
        id && id.toLowerCase() === chainId.toLowerCase()
      );
      if (chainIndex !== -1) return chainIndex;
    }
    
    // Fallback: Try wallet address matching (case-insensitive)
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
  
  // Debug logging (matches TicTacToe)
  useEffect(() => {
    if (room) {
      console.log('🔴🟡 ConnectFour Debug:', {
        myChainId: chainId,
        myWallet: walletAddress,
        playerChainIds: room.playerChainIds,
        players: room.players,
        myIndex,
        myPlayerNum,
        currentTurn: room.currentTurn,
        normalizedTurn: normalizePlayer(room.currentTurn ?? null),
        status: room.status,
        isMyTurn: normalizeStatus(room.status) === 'InProgress' && normalizePlayer(room.currentTurn ?? null) === myPlayerNum,
      });
    }
  }, [room, chainId, walletAddress, myIndex, myPlayerNum]);
  
  // Normalize status and current turn for comparison
  const normalizedStatus = room?.status ? normalizeStatus(room.status) : null;
  const normalizedTurn = normalizePlayer(room?.currentTurn ?? null);
  
  // Check if it's my turn
  const isMyTurn = normalizedStatus === 'InProgress' && normalizedTurn === myPlayerNum;
  
  // Get board cells (6 rows x 7 columns = 42 cells)
  // Board is stored row by row from bottom (row 0) to top (row 5)
  const board = room?.connectFourBoard?.cells.map((c: { player: string | null }) => 
    normalizePlayer(c.player as 'One' | 'Two' | 'ONE' | 'TWO' | null)
  ) ?? Array(42).fill(null);

  // Start polling when component mounts
  useEffect(() => {
    multiplayerPolling.startPolling((roomData, err) => {
      setIsLoading(false);
      if (err) {
        setError(err.message);
      } else {
        setRoom(roomData);
        setError(null);
        
        // Slow down polling when game is over
        const status = roomData?.status ? normalizeStatus(roomData.status) : null;
        if (status === 'Finished' || status === 'Draw') {
          multiplayerPolling.setInterval(5000);
        }
      }
    }, 500);

    return () => {
      multiplayerPolling.stopPolling();
    };
  }, []);

  // Handle column click - drop piece in column
  const handleColumnClick = useCallback(async (column: number) => {
    if (!isMyTurn || isMakingMove) return;
    if (normalizedStatus !== 'InProgress') return;

    // Check if column is full (top row has a piece)
    const topRowIndex = 5 * 7 + column;
    if (board[topRowIndex] !== null) return;

    setIsMakingMove(true);
    try {
      await makeMove({ column });
      // Immediately fetch updated state
      const updated = await getMultiplayerRoom();
      setRoom(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsMakingMove(false);
    }
  }, [isMyTurn, board, isMakingMove, normalizedStatus]);

  // Handle forfeit
  const handleForfeit = useCallback(async () => {
    try {
      await forfeitGame();
      const updated = await getMultiplayerRoom();
      setRoom(updated);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  // Get cell value at row, col (row 0 = bottom)
  const getCell = (row: number, col: number) => {
    return board[row * 7 + col];
  };

  // Check game result
  const isFinished = normalizedStatus === 'Finished' || normalizedStatus === 'Draw';
  const isDraw = normalizedStatus === 'Draw';
  const winner = normalizePlayer(room?.winner ?? null);
  const iWon = winner === myPlayerNum;

  // Get opponent username for backend sync
  const opponentUsername = room?.usernames ? room.usernames[myIndex === 0 ? 1 : 0] : 'Unknown';

  // Handle claiming rewards (matches TicTacToe exactly)
  const handleClaimRewards = useCallback(async () => {
    if (!room || isClaiming || rewardsClaimed) return;
    
    setIsClaiming(true);
    try {
      const rewards = await claimMultiplayerRewards(
        iWon, 
        isDraw, 
        room.gameType,
        opponentUsername,
        room.hostChainId
      );
      setClaimedRewards(rewards);
      setRewardsClaimed(true);
      console.log('✅ Rewards claimed:', rewards);
    } catch (err) {
      console.error('Failed to claim rewards:', err);
      setError('Failed to claim rewards. Try again.');
    } finally {
      setIsClaiming(false);
    }
  }, [room, isClaiming, rewardsClaimed, iWon, isDraw, opponentUsername]);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-orange animate-spin" />
        <span className="ml-2 text-gray-400">Loading game...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400">
          <p>Error: {error}</p>
          <button onClick={onLeave} className="mt-2 text-sm underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 text-yellow-400">
          <p>Room not found or not initialized yet.</p>
          <button onClick={onLeave} className="mt-2 text-sm underline">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
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
        <span className="font-arcade text-red-500 text-xs">
          CONNECT FOUR
        </span>
      </div>

      {/* Waiting for opponent */}
      {isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card border border-red-500/30 rounded-xl p-6 mb-6 text-center"
        >
          <Loader2 className="w-8 h-8 text-red-500 animate-spin mx-auto mb-4" />
          <p className="text-white font-medium mb-2">Waiting for opponent...</p>
          <p className="text-gray-400 text-sm">
            Opponent is joining via cross-chain message...
          </p>
        </motion.div>
      )}

      {/* Players */}
      {!isStatusWaitingForPlayer(room.status) && (
        <div className="flex justify-between items-center mb-6">
          {room.players.map((_player, index) => {
            const playerNum = index === 0 ? 'One' : 'Two';
            const isCurrentTurn = normalizedTurn === playerNum;
            
            return (
              <motion.div
                key={`player-${index}`}
                animate={{
                  scale: isCurrentTurn && !isFinished ? 1.05 : 1,
                  opacity: isCurrentTurn || isFinished ? 1 : 0.5,
                }}
                className={`flex items-center gap-3 p-3 rounded-xl ${
                  isCurrentTurn && !isFinished
                    ? index === 0 ? 'bg-red-500/20 border border-red-500/50' : 'bg-yellow-500/20 border border-yellow-500/50'
                    : 'bg-dark-card border border-dark-border'
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${
                  index === 0 ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <div>
                  <p className="text-white text-sm font-medium">
                    {room.usernames[index] || `Player ${index + 1}`}
                    {index === myIndex && ' (You)'}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Game Board */}
      {!isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-blue-600 rounded-xl p-4 mb-6"
        >
          {/* Column hover indicators */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {Array(7).fill(null).map((_, col) => (
              <div
                key={col}
                className={`h-8 rounded-full transition-all ${
                  hoverColumn === col && isMyTurn && !isFinished
                    ? myIndex === 0 ? 'bg-red-500/50' : 'bg-yellow-500/50'
                    : 'bg-transparent'
                }`}
              />
            ))}
          </div>
          
          {/* Board grid - render from top (row 5) to bottom (row 0) */}
          <div className="grid grid-cols-7 gap-1">
            {Array(6).fill(null).map((_, rowFromTop) => {
              const row = 5 - rowFromTop; // Convert to bottom-up indexing
              return Array(7).fill(null).map((_, col) => {
                const cell = getCell(row, col);
                return (
                  <motion.button
                    key={`${row}-${col}`}
                    onMouseEnter={() => setHoverColumn(col)}
                    onMouseLeave={() => setHoverColumn(null)}
                    onClick={() => handleColumnClick(col)}
                    disabled={!isMyTurn || isFinished || isMakingMove}
                    className={`aspect-square rounded-full bg-blue-800 flex items-center justify-center ${
                      isMyTurn && !isFinished && !cell ? 'cursor-pointer hover:bg-blue-700' : ''
                    }`}
                  >
                    {cell && (
                      <motion.div
                        initial={{ y: -100, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ type: 'spring', damping: 10 }}
                        className={`w-[85%] h-[85%] rounded-full ${
                          cell === 'One' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                      />
                    )}
                  </motion.button>
                );
              });
            })}
          </div>
        </motion.div>
      )}

      {/* Status */}
      <div className="text-center">
        {normalizedStatus === 'InProgress' && (
          <>
            <p className={`text-lg ${isMyTurn ? 'text-accent-orange' : 'text-gray-400'}`}>
              {isMyTurn ? "Your turn! Drop a piece" : `${room.usernames[normalizedTurn === 'One' ? 0 : 1]}'s turn...`}
            </p>
            {isMakingMove && (
              <p className="text-sm text-gray-500 mt-2 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting move to chain...
              </p>
            )}
          </>
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

            {/* Claim Rewards Button (matches TicTacToe) */}
            {!rewardsClaimed ? (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleClaimRewards}
                disabled={isClaiming}
                className="mb-4 px-6 py-3 bg-green-500 hover:bg-green-600 text-dark-bg font-arcade rounded-lg flex items-center gap-2 mx-auto disabled:opacity-50"
              >
                {isClaiming ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Claiming rewards...
                  </>
                ) : (
                  <>
                    🎁 CLAIM REWARDS
                  </>
                )}
              </motion.button>
            ) : (
              <div className="mb-4 bg-green-500/20 border border-green-500/50 rounded-xl p-4">
                <p className="text-green-400 font-bold text-lg">
                  🎉 +{claimedRewards?.xp || 0} XP, +{claimedRewards?.coins || 0} Coins
                </p>
                <p className="text-green-300 text-sm">
                  ✅ Rewards claimed! Check your profile.
                </p>
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onLeave}
              className="mt-4 px-6 py-3 bg-red-500 text-white font-arcade rounded-lg flex items-center gap-2 mx-auto"
            >
              <ArrowLeft className="w-5 h-5" />
              BACK TO LOBBY
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Forfeit button */}
      {normalizedStatus === 'InProgress' && (
        <div className="mt-6 text-center">
          <button
            onClick={handleForfeit}
            className="text-gray-500 hover:text-red-400 text-sm underline"
          >
            Forfeit game
          </button>
        </div>
      )}
    </div>
  );
}

export default ConnectFourOnChain;
