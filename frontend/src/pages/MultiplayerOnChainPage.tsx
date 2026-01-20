/**
 * On-Chain Multiplayer Games Hub (CROSS-CHAIN PATTERN)
 * 
 * Create or join game rooms using cross-chain messaging.
 * - Host creates room on their chain -> gets hostChainId to share
 * - Joiner enters hostChainId to join via cross-chain message
 * - Both players query their own chain for synchronized room state
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  ArrowRight, 
  Crown,
  Grid3X3,
  Brain,
  ArrowLeft,
  Loader2,
  Link2,
  Copy,
  Check,
} from 'lucide-react';
import { useLineraConnection } from '../hooks';
import { 
  TicTacToeOnChain,
  ConnectFourOnChain,
  QuickMathOnChain,
  ChessOnChain,
  CheckersOnChain,
} from '../games/multiplayer';
import { 
  createMultiplayerRoom, 
  joinMultiplayerRoom,
  getMultiplayerRoom,
  getMultiplayerRoomSynced,
  clearRoom,
  isStatusWaitingForPlayer,
  normalizeGameType,
  type MultiplayerGameType,
  type MultiplayerGameRoom,
} from '../lib/multiplayer/onchain';

// Game types available for on-chain multiplayer
const GAME_TYPES: Array<{
  id: MultiplayerGameType;
  name: string;
  description: string;
  icon: typeof Grid3X3;
  color: string;
  emoji: string;
}> = [
  {
    id: 'TicTacToe',
    name: 'Tic Tac Toe',
    description: 'Classic X vs O battle',
    icon: Grid3X3,
    color: '#ff6b00',
    emoji: '❌',
  },
  {
    id: 'ConnectFour',
    name: 'Connect Four',
    description: 'Drop 4 in a row!',
    icon: Grid3X3,
    color: '#ef4444',
    emoji: '🔴',
  },
  {
    id: 'QuickMath',
    name: 'Quick Math',
    description: 'Solve math problems fast!',
    icon: Brain,
    color: '#06b6d4',
    emoji: '🧮',
  },
  {
    id: 'Chess',
    name: 'Chess',
    description: 'Strategic board game',
    icon: Crown,
    color: '#8b5cf6',
    emoji: '♟️',
  },
  {
    id: 'Checkers',
    name: 'Checkers',
    description: 'Jump and capture!',
    icon: Grid3X3,
    color: '#10b981',
    emoji: '⚫',
  },
];

type View = 'lobby' | 'create' | 'join' | 'waiting' | 'game';

export default function MultiplayerOnChainPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isConnected, chainId } = useLineraConnection();
  
  const [view, setView] = useState<View>('lobby');
  const [selectedGame, setSelectedGame] = useState<MultiplayerGameType | null>(null);
  const [hostChainId, setHostChainId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  
  // Current room state (queried from local chain)
  const [room, setRoom] = useState<MultiplayerGameRoom | null>(null);

  // Check URL params for direct room join (only on initial load, not when we navigate)
  useEffect(() => {
    const host = searchParams.get('host');
    // Only set join view if we're in lobby and have a host param
    // Don't override if we're already in game view
    if (host && view === 'lobby') {
      setJoinCode(host);
      setView('join');
    }
  }, []); // Only run once on mount
  
  // Poll for room state when waiting or in game
  // IMPORTANT: Use synced query so host receives JoinRequest cross-chain messages
  useEffect(() => {
    if (view !== 'waiting' && view !== 'game') return;
    
    const pollRoom = async () => {
      try {
        // Use synced query to process cross-chain messages (like JoinRequest)
        const roomState = await getMultiplayerRoomSynced();
        setRoom(roomState);
        
        // Auto-transition from waiting to game when opponent joins
        if (view === 'waiting' && roomState && !isStatusWaitingForPlayer(roomState.status)) {
          setSelectedGame(roomState.gameType);
          setView('game');
        }
      } catch (err) {
        console.error('Failed to poll room:', err);
      }
    };
    
    // Initial poll
    pollRoom();
    
    // Poll every 2 seconds (synced queries are more expensive)
    const interval = setInterval(pollRoom, 2000);
    
    return () => clearInterval(interval);
  }, [view]);

  // Check for existing room when entering lobby (to show Resume Game button)
  useEffect(() => {
    if (view !== 'lobby') return;
    
    const checkRoom = async () => {
      try {
        const roomState = await getMultiplayerRoom();
        setRoom(roomState);
      } catch (err) {
        console.error('Failed to check room:', err);
      }
    };
    
    checkRoom();
  }, [view]);

  // Handle create room
  const handleCreateRoom = async () => {
    if (!selectedGame) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const result = await createMultiplayerRoom(selectedGame);
      setHostChainId(result.hostChainId);
      setView('waiting');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  // Handle join room by hostChainId
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  
  const handleJoinRoom = async () => {
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setError(null);
    
    try {
      const targetHostChainId = joinCode.trim();
      
      console.log(`🔗 Attempting to join room at hostChainId: ${targetHostChainId}`);
      
      // Step 1: Check if room already synced (from previous attempt)
      setJoinStatus('Checking for existing room...');
      const existingRoom = await getMultiplayerRoomSynced();
      
      if (existingRoom && 
          existingRoom.hostChainId === targetHostChainId && 
          (existingRoom.status === 'IN_PROGRESS' || existingRoom.status === 'InProgress')) {
        console.log(`✅ Room already synced! Entering game...`);
        setRoom(existingRoom);
        setSelectedGame(existingRoom.gameType);
        setHostChainId(existingRoom.hostChainId);
        setIsJoining(false);
        setJoinStatus(null);
        setView('game');
        return;
      }
      
      // Step 2: Send join request to host chain
      setJoinStatus('Sending join request to host...');
      await joinMultiplayerRoom(targetHostChainId);
      
      // Step 3: Poll until room is synced (max 40 seconds)
      setJoinStatus('Waiting for room sync...');
      
      for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const roomState = await getMultiplayerRoomSynced();
        
        if (roomState && 
            roomState.hostChainId === targetHostChainId &&
            (roomState.status === 'IN_PROGRESS' || roomState.status === 'InProgress')) {
          console.log(`✅ Room synced after ${attempt + 1} seconds!`);
          setRoom(roomState);
          setSelectedGame(roomState.gameType);
          setHostChainId(roomState.hostChainId);
          setIsJoining(false);
          setJoinStatus(null);
          setView('game');
          return;
        }
        
        setJoinStatus(`Syncing cross-chain state... (${attempt + 1}s)`);
      }
      
      setError('Room sync timed out. The host may need to refresh their page. Try again in a few seconds.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsJoining(false);
      setJoinStatus(null);
    }
  };

  // Copy hostChainId to clipboard
  const handleCopy = async () => {
    if (!hostChainId) return;
    
    try {
      await navigator.clipboard.writeText(hostChainId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Leave game - also clear on-chain room when game is finished to prevent stale state
  const handleLeave = async () => {
    // If the game was finished, clear the on-chain room to prevent it from
    // being reused when creating a new game of a different type
    if (room) {
      const status = room.status?.toString().toUpperCase() || '';
      const isFinished = status.includes('FINISHED') || status.includes('DRAW') || 
                        status.includes('FORFEITED') || status.includes('ABANDONED');
      
      if (isFinished) {
        console.log('🧹 Clearing finished room on-chain before leaving...');
        try {
          await clearRoom();
          console.log('✅ Room cleared');
        } catch (err) {
          console.warn('⚠️ Failed to clear room (non-critical):', err);
          // Non-critical - the create room flow will handle overwriting
        }
      }
    }
    
    setView('lobby');
    setHostChainId(null);
    setSelectedGame(null);
    setRoom(null);
    navigate('/multiplayer', { replace: true });
  };

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-dark-bg p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-accent-orange/30 rounded-2xl p-8 text-center"
          >
            <Users className="w-16 h-16 text-accent-orange mx-auto mb-4" />
            <h1 className="font-arcade text-2xl text-white mb-4">ON-CHAIN MULTIPLAYER</h1>
            <p className="text-gray-400 mb-6">
              Connect your wallet to create or join multiplayer game rooms.
              Games use cross-chain messaging for true decentralization!
            </p>
            <p className="text-accent-orange">
              Please connect your wallet using the button in the navbar.
            </p>
          </motion.div>
        </div>
      </div>
    );
  }

  // Waiting for opponent view
  if (view === 'waiting' && hostChainId) {
    return (
      <div className="min-h-screen bg-dark-bg p-4">
        <div className="max-w-4xl mx-auto pt-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-dark-card border border-accent-orange/30 rounded-2xl p-8 text-center"
          >
            <Loader2 className="w-16 h-16 text-accent-orange mx-auto mb-4 animate-spin" />
            <h1 className="font-arcade text-2xl text-white mb-4">WAITING FOR OPPONENT</h1>
            <p className="text-gray-400 mb-6">
              Share your Host Chain ID with a friend so they can join:
            </p>
            
            <div className="bg-dark-bg border border-dark-border rounded-lg p-4 mb-6">
              <p className="text-gray-500 text-sm mb-2">Host Chain ID:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-accent-orange font-mono text-sm break-all">
                  {hostChainId}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2 bg-accent-orange/20 rounded-lg hover:bg-accent-orange/30 transition-colors"
                >
                  {copied ? (
                    <Check className="w-5 h-5 text-green-400" />
                  ) : (
                    <Copy className="w-5 h-5 text-accent-orange" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="text-gray-500 text-sm mb-6">
              <p>Your friend can join by:</p>
              <p>1. Going to Multiplayer → Join Room</p>
              <p>2. Pasting your Host Chain ID</p>
            </div>
            
            <button
              onClick={handleLeave}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Game view
  if (view === 'game' && room) {
    // Render the appropriate game component based on selectedGame
    const renderGame = () => {
      const gameType = selectedGame || room.gameType;
      
      switch (gameType) {
        case 'TicTacToe':
          return <TicTacToeOnChain onLeave={handleLeave} />;
        case 'ConnectFour':
          return <ConnectFourOnChain onLeave={handleLeave} />;
        case 'QuickMath':
          return <QuickMathOnChain onLeave={handleLeave} />;
        case 'Chess':
          return <ChessOnChain onLeave={handleLeave} />;
        case 'Checkers':
          return <CheckersOnChain onLeave={handleLeave} />;
        default:
          return <TicTacToeOnChain onLeave={handleLeave} />;
      }
    };

    return (
      <div className="min-h-screen bg-dark-bg">
        {renderGame()}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg p-4">
      <div className="max-w-4xl mx-auto pt-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="font-arcade text-3xl text-accent-orange mb-2">
            ON-CHAIN MULTIPLAYER
          </h1>
          <p className="text-gray-400">
            True decentralized gaming on Linera
          </p>
          {chainId && (
            <p className="text-gray-600 text-xs mt-2 font-mono">
              Your chain: {chainId.slice(0, 12)}...
            </p>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          {/* Lobby View */}
          {view === 'lobby' && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-6"
            >
              {/* Create/Join buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('create')}
                  className="bg-dark-card border border-accent-orange/30 rounded-xl p-6 text-left hover:border-accent-orange/60 transition-colors"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-accent-orange/20 rounded-xl flex items-center justify-center">
                      <Plus className="w-6 h-6 text-accent-orange" />
                    </div>
                    <div>
                      <h2 className="font-arcade text-lg text-white">CREATE ROOM</h2>
                      <p className="text-gray-400 text-sm">Host a new game</p>
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setView('join')}
                  className="bg-dark-card border border-accent-orange/30 rounded-xl p-6 text-left hover:border-accent-orange/60 transition-colors"
                >
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
                      <Link2 className="w-6 h-6 text-green-400" />
                    </div>
                    <div>
                      <h2 className="font-arcade text-lg text-white">JOIN ROOM</h2>
                      <p className="text-gray-400 text-sm">Enter host chain ID</p>
                    </div>
                  </div>
                </motion.button>
              </div>

              {/* How it works */}
              <div className="bg-dark-card border border-dark-border rounded-xl p-6">
                <h3 className="font-arcade text-white mb-4">HOW IT WORKS</h3>
                <div className="space-y-3 text-gray-400 text-sm">
                  <p>🎮 Create a room and share your <span className="text-accent-orange">Host Chain ID</span> with a friend</p>
                  <p>🔗 Your friend pastes your chain ID to <span className="text-accent-orange">join via cross-chain message</span></p>
                  <p>⚡ Every move is synced between chains <span className="text-accent-orange">automatically</span></p>
                  <p>🏆 XP and coins are awarded when game ends</p>
                </div>
              </div>

              {/* Resume Active Game - shows when there's an IN_PROGRESS game */}
              {room && (room.status === 'IN_PROGRESS' || room.status === 'InProgress') && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-500/10 border border-green-500/50 rounded-xl p-6"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-arcade text-green-400 mb-1">ACTIVE GAME</h3>
                      <p className="text-gray-400 text-sm">
                        You have a {normalizeGameType(room.gameType)} game in progress vs {room.usernames[1] || room.usernames[0]}
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => {
                        setSelectedGame(normalizeGameType(room.gameType));
                        setHostChainId(room.hostChainId);
                        setView('game');
                      }}
                      className="px-6 py-3 bg-green-500 text-white font-arcade rounded-lg"
                    >
                      RESUME GAME
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Clear Room Section - Always visible, styled based on state */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl p-5 border transition-all ${
                  clearSuccess 
                    ? 'bg-green-500/10 border-green-500/50' 
                    : room 
                      ? 'bg-yellow-500/10 border-yellow-500/50' 
                      : 'bg-dark-card border-dark-border'
                }`}
              >
                {clearSuccess ? (
                  <div className="text-center">
                    <div className="text-4xl mb-2">✨</div>
                    <h3 className="font-arcade text-green-400 mb-1">ROOM CLEARED!</h3>
                    <p className="text-gray-400 text-sm">You're ready to create a new game</p>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className={`font-arcade text-sm mb-1 ${room ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {room ? '⚠️ EXISTING ROOM DETECTED' : '🧹 FRESH START'}
                      </h3>
                      <p className="text-gray-500 text-xs">
                        {room 
                          ? `Clear your ${normalizeGameType(room.gameType)} room (${room.status}) to start fresh`
                          : 'Click to ensure no old rooms are blocking you'
                        }
                      </p>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={async () => {
                        setIsClearing(true);
                        setError(null);
                        try {
                          await clearRoom();
                          setRoom(null);
                          setClearSuccess(true);
                          setTimeout(() => setClearSuccess(false), 3000);
                        } catch (err) {
                          setError(`Failed to clear: ${(err as Error).message}`);
                        } finally {
                          setIsClearing(false);
                        }
                      }}
                      disabled={isClearing}
                      className={`px-5 py-2.5 rounded-lg font-arcade text-sm flex items-center gap-2 transition-all ${
                        room 
                          ? 'bg-yellow-500 text-dark-bg hover:bg-yellow-400' 
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      } ${isClearing ? 'opacity-50 cursor-wait' : ''}`}
                    >
                      {isClearing ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Clearing...
                        </>
                      ) : (
                        <>
                          🗑️ Clear Room
                        </>
                      )}
                    </motion.button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}

          {/* Create Room View */}
          {view === 'create' && (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setView('lobby')}
                className="flex items-center gap-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h2 className="font-arcade text-xl text-white">SELECT A GAME</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {GAME_TYPES.map((game) => {
                  const isSelected = selectedGame === game.id;
                  
                  return (
                    <motion.button
                      key={game.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedGame(game.id)}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-accent-orange bg-accent-orange/10'
                          : 'border-dark-border bg-dark-card hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{game.emoji}</span>
                        <div>
                          <h3 className="font-arcade text-sm text-white">{game.name}</h3>
                          <p className="text-gray-500 text-xs">{game.description}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleCreateRoom}
                disabled={!selectedGame || isCreating}
                className={`w-full py-4 rounded-xl font-arcade text-lg flex items-center justify-center gap-2 ${
                  selectedGame && !isCreating
                    ? 'bg-accent-orange text-dark-bg'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating room...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    CREATE ROOM
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* Join Room View */}
          {view === 'join' && (
            <motion.div
              key="join"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <button
                onClick={() => setView('lobby')}
                className="flex items-center gap-2 text-gray-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>

              <h2 className="font-arcade text-xl text-white">JOIN A ROOM</h2>

              <div className="bg-dark-card border border-dark-border rounded-xl p-6">
                <label className="block text-gray-400 text-sm mb-2">
                  Host Chain ID
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Paste the host's chain ID..."
                  className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-accent-orange focus:outline-none font-mono text-sm"
                />
                <p className="text-gray-500 text-xs mt-2">
                  Ask your friend to copy their Host Chain ID from the waiting screen
                </p>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleJoinRoom}
                disabled={!joinCode.trim() || isJoining}
                className={`w-full py-4 rounded-xl font-arcade text-lg flex items-center justify-center gap-2 ${
                  joinCode.trim() && !isJoining
                    ? 'bg-accent-orange text-dark-bg'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                {isJoining ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {joinStatus || 'Joining...'}
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    JOIN ROOM
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
