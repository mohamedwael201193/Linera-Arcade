/**
 * Tic Tac Toe - On-Chain Multiplayer Version (CROSS-CHAIN PATTERN)
 * 
 * Uses cross-chain messaging for game state sync.
 * Each player queries their own chain's multiplayer_room.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, X, Circle, Loader2 } from 'lucide-react';
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

export function TicTacToeOnChain({ onLeave }: Props) {
  const { chainId, walletAddress } = useLineraConnection();
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMakingMove, setIsMakingMove] = useState(false);
  
  // Rewards state
  const [rewardsClaimed, setRewardsClaimed] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const [claimedRewards, setClaimedRewards] = useState<{ xp: number; coins: number } | null>(null);

  // Determine which player index I am (0 or 1)
  // Primary: Match by chain ID (playerChainIds[0] = host/Player One, [1] = joiner/Player Two)
  // Fallback: Match by wallet address in players array
  const getMyIndex = (): number => {
    if (!room) return -1;
    
    // Try chain ID matching first
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
  
  // Debug logging
  useEffect(() => {
    if (room) {
      console.log('🎮 TicTacToe Debug:', {
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
  
  // Get board cells (convert from Cell[] to simple array)
  const board = room?.ticTacToeBoard?.cells.map((c: { player: string | null }) => 
    normalizePlayer(c.player as 'One' | 'Two' | 'ONE' | 'TWO' | null)
  ) ?? Array(9).fill(null);

  // Start polling when component mounts (no roomId needed - queries local chain)
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
          multiplayerPolling.setInterval(5000); // Poll every 5s when finished
        }
      }
    }, 500); // Poll every 500ms during active game

    return () => {
      multiplayerPolling.stopPolling();
    };
  }, []);

  // Handle cell click
  const handleCellClick = useCallback(async (position: number) => {
    if (!isMyTurn || board[position] !== null || isMakingMove) return;
    if (normalizedStatus !== 'InProgress') return;

    setIsMakingMove(true);
    try {
      await makeMove({ position });
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

  // Check game result
  const isFinished = normalizedStatus === 'Finished' || normalizedStatus === 'Draw';
  const isDraw = normalizedStatus === 'Draw';
  const winner = normalizePlayer(room?.winner ?? null);
  const iWon = winner === myPlayerNum;

  // Get opponent username for backend sync
  const opponentUsername = room?.usernames ? room.usernames[myIndex === 0 ? 1 : 0] : 'Unknown';

  // Handle claiming rewards
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
      <div className="max-w-lg mx-auto px-4 py-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-orange animate-spin" />
        <span className="ml-2 text-gray-400">Loading game...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
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
      <div className="max-w-lg mx-auto px-4 py-8">
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
        <span className="font-arcade text-accent-orange text-xs">
          TIC TAC TOE
        </span>
      </div>

      {/* Waiting for opponent */}
      {isStatusWaitingForPlayer(room.status) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-dark-card border border-accent-orange/30 rounded-xl p-6 mb-6 text-center"
        >
          <Loader2 className="w-8 h-8 text-accent-orange animate-spin mx-auto mb-4" />
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
          className="bg-dark-card border-2 border-accent-orange/30 rounded-xl p-4 mb-6"
        >
          <div className="grid grid-cols-3 gap-2">
            {board.map((cell: string | null, index: number) => (
              <motion.button
                key={index}
                whileHover={!cell && isMyTurn && !isFinished ? { scale: 1.05 } : {}}
                whileTap={!cell && isMyTurn && !isFinished ? { scale: 0.95 } : {}}
                onClick={() => handleCellClick(index)}
                disabled={!!cell || !isMyTurn || isFinished || isMakingMove}
                className={`aspect-square rounded-xl flex items-center justify-center text-5xl font-arcade transition-all ${
                  cell
                    ? 'bg-dark-bg'
                    : isMyTurn && !isFinished
                      ? 'bg-dark-bg hover:bg-accent-orange/10 cursor-pointer'
                      : 'bg-dark-bg/50 cursor-not-allowed'
                } ${isMakingMove ? 'opacity-50' : ''}`}
              >
                {cell === 'One' && (
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                  >
                    <X className="w-12 h-12 text-accent-orange" strokeWidth={3} />
                  </motion.div>
                )}
                {cell === 'Two' && (
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
      )}

      {/* Status */}
      <div className="text-center">
        {normalizedStatus === 'InProgress' && (
          <>
            <p className={`text-lg ${isMyTurn ? 'text-accent-orange' : 'text-gray-400'}`}>
              {isMyTurn ? "Your turn!" : `${room.usernames[normalizedTurn === 'One' ? 0 : 1]}'s turn...`}
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

            {/* Claim Rewards Button */}
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
              className="mt-4 px-6 py-3 bg-accent-orange text-dark-bg font-arcade rounded-lg flex items-center gap-2 mx-auto"
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

export default TicTacToeOnChain;
