/**
 * Multiplayer Games Hub
 * Create or join game rooms for real-time multiplayer battles!
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Users, 
  Plus, 
  ArrowRight, 
  Copy, 
  Check, 
  Crown,
  Swords,
  Zap,
  Brain,
  Grid3X3,
  Type,
  Timer,
  Share2,
  ArrowLeft
} from 'lucide-react';
import { multiplayerService } from '../lib/multiplayer/socket';
import { useLineraConnection } from '../hooks';
import { BlockchainResultSubmit } from '../components/BlockchainResultSubmit';
import { TicTacToeGame } from '../games/multiplayer/TicTacToe';
import { WordDuelGame } from '../games/multiplayer/WordDuel';
import { ReactionDuelGame } from '../games/multiplayer/ReactionDuel';
import RockPaperScissors from '../games/multiplayer/RockPaperScissors';
import QuickMath from '../games/multiplayer/QuickMath';
import ConnectFour from '../games/multiplayer/ConnectFour';
import EmojiRace from '../games/multiplayer/EmojiRace';
import Chess from '../games/multiplayer/Chess';
import Checkers from '../games/multiplayer/Checkers';

// Game types
const GAME_TYPES = [
  {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    description: 'Classic X vs O battle',
    icon: Grid3X3,
    color: '#ff6b00',
    players: 2,
    emoji: '❌',
  },
  {
    id: 'connect-four',
    name: 'Connect Four',
    description: 'Drop 4 in a row!',
    icon: Grid3X3,
    color: '#ef4444',
    players: 2,
    emoji: '🔴',
  },
  {
    id: 'rock-paper-scissors',
    name: 'Rock Paper Scissors',
    description: 'Classic hand game!',
    icon: Swords,
    color: '#f59e0b',
    players: 2,
    emoji: '✊',
  },
  {
    id: 'word-duel',
    name: 'Word Duel',
    description: 'Type the word first!',
    icon: Type,
    color: '#22c55e',
    players: 2,
    emoji: '⌨️',
  },
  {
    id: 'quick-math',
    name: 'Quick Math',
    description: 'Solve math problems fast!',
    icon: Brain,
    color: '#06b6d4',
    players: 2,
    emoji: '🧮',
  },
  {
    id: 'reaction-duel',
    name: 'Reaction Duel',
    description: 'Who clicks faster?',
    icon: Zap,
    color: '#3b82f6',
    players: 2,
    emoji: '⚡',
  },
  {
    id: 'emoji-race',
    name: 'Emoji Race',
    description: 'Find the emoji first!',
    icon: Timer,
    color: '#ec4899',
    players: 2,
    emoji: '🎯',
  },
  {
    id: 'chess',
    name: 'Chess',
    description: 'The classic strategy game!',
    icon: Crown,
    color: '#a855f7',
    players: 2,
    emoji: '♟️',
  },
  {
    id: 'checkers',
    name: 'Checkers',
    description: 'Jump and capture!',
    icon: Grid3X3,
    color: '#dc2626',
    players: 2,
    emoji: '🔴',
  },
];

interface Player {
  id: string;
  name: string;
  wallet?: string;
  ready: boolean;
  score: number;
}

interface Room {
  id: string;
  gameType: string;
  players: Player[];
  state: any;
  status: 'waiting' | 'playing' | 'finished';
  hostId: string;
}

export function MultiplayerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { walletAddress } = useLineraConnection();
  
  const [view, setView] = useState<'lobby' | 'room' | 'game'>('lobby');
  const [room, setRoom] = useState<Room | null>(null);
  const [joinCode, setJoinCode] = useState(searchParams.get('room') || '');
  const [playerName, setPlayerName] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    multiplayerService.connect();

    // Event handlers
    const handleRoomCreated = ({ roomCode, room }: any) => {
      setRoom(room);
      setView('room');
      // Update URL with room code
      navigate(`/multiplayer?room=${roomCode}`, { replace: true });
    };

    const handlePlayerJoined = ({ room }: any) => {
      setRoom(room);
      if (view === 'lobby') setView('room');
    };

    const handlePlayerLeft = ({ room }: any) => {
      setRoom(room);
    };

    const handleRoomUpdated = ({ room }: any) => {
      setRoom(room);
    };

    const handleGameStart = ({ room }: any) => {
      setRoom(room);
      setView('game');
    };

    const handleGameUpdated = ({ room }: any) => {
      setRoom(room);
    };

    const handleGameOver = ({ room }: any) => {
      setRoom(room);
    };

    const handleError = ({ message }: any) => {
      setError(message);
      setTimeout(() => setError(''), 3000);
    };

    multiplayerService.on('room-created', handleRoomCreated);
    multiplayerService.on('player-joined', handlePlayerJoined);
    multiplayerService.on('player-left', handlePlayerLeft);
    multiplayerService.on('room-updated', handleRoomUpdated);
    multiplayerService.on('game-start', handleGameStart);
    multiplayerService.on('game-updated', handleGameUpdated);
    multiplayerService.on('game-over', handleGameOver);
    multiplayerService.on('error', handleError);

    // Auto-join if room code in URL
    const roomCode = searchParams.get('room');
    if (roomCode && playerName) {
      multiplayerService.joinRoom(roomCode, playerName, walletAddress || undefined);
    }

    return () => {
      multiplayerService.off('room-created', handleRoomCreated);
      multiplayerService.off('player-joined', handlePlayerJoined);
      multiplayerService.off('player-left', handlePlayerLeft);
      multiplayerService.off('room-updated', handleRoomUpdated);
      multiplayerService.off('game-start', handleGameStart);
      multiplayerService.off('game-updated', handleGameUpdated);
      multiplayerService.off('game-over', handleGameOver);
      multiplayerService.off('error', handleError);
    };
  }, []);

  const createRoom = (gameType: string) => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    multiplayerService.createRoom(gameType, playerName, walletAddress || undefined);
  };

  const joinRoom = () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Please enter a room code');
      return;
    }
    multiplayerService.joinRoom(joinCode.toUpperCase(), playerName, walletAddress || undefined);
  };

  const copyRoomLink = () => {
    if (!room) return;
    const link = `${window.location.origin}/multiplayer?room=${room.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setReady = () => {
    if (room) {
      multiplayerService.setReady(room.id);
    }
  };

  const leaveRoom = () => {
    if (room) {
      multiplayerService.leaveRoom(room.id);
    }
    setRoom(null);
    setView('lobby');
    navigate('/multiplayer', { replace: true });
  };

  // Render lobby view
  if (view === 'lobby') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            <Users className="w-10 h-10 text-accent-orange" />
            <h1 className="font-arcade text-3xl text-white">MULTIPLAYER</h1>
          </div>
          <p className="text-gray-400">Challenge friends to real-time battles!</p>
        </motion.div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-6 text-center text-red-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player Name Input */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-dark-card border border-dark-border rounded-xl p-6 mb-8"
        >
          <label className="block text-gray-400 text-sm mb-2">Your Name</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            className="w-full bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-accent-orange focus:outline-none"
            maxLength={20}
          />
        </motion.div>

        {/* Join Room */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-dark-card border border-dark-border rounded-xl p-6 mb-8"
        >
          <h2 className="font-arcade text-xl text-white mb-4 flex items-center gap-2">
            <ArrowRight className="w-5 h-5 text-accent-orange" />
            JOIN ROOM
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Enter room code..."
              className="flex-1 bg-dark-bg border border-dark-border rounded-lg px-4 py-3 text-white placeholder-gray-600 focus:border-accent-orange focus:outline-none font-mono tracking-widest"
              maxLength={6}
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={joinRoom}
              className="px-6 py-3 bg-accent-orange text-dark-bg font-arcade rounded-lg"
            >
              JOIN
            </motion.button>
          </div>
        </motion.div>

        {/* Create Room - Game Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-arcade text-xl text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-accent-orange" />
              CREATE ROOM
            </h2>
            {!playerName.trim() && (
              <span className="text-yellow-400 text-sm flex items-center gap-1">
                ⚠️ Enter your name above to create a room
              </span>
            )}
          </div>
          
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${!playerName.trim() ? 'opacity-50 pointer-events-none' : ''}`}>
            {GAME_TYPES.map((game, index) => (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => createRoom(game.id)}
                className="bg-dark-card border border-dark-border hover:border-accent-orange/50 rounded-xl p-6 text-left transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${game.color}20` }}
                  >
                    <game.icon className="w-7 h-7" style={{ color: game.color }} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-arcade text-lg text-white group-hover:text-accent-orange transition-colors">
                      {game.name}
                    </h3>
                    <p className="text-gray-500 text-sm">{game.description}</p>
                    <p className="text-gray-600 text-xs mt-1">{game.players} Players</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-accent-orange transition-colors" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  // Render waiting room
  if (view === 'room' && room) {
    const gameConfig = GAME_TYPES.find(g => g.id === room.gameType);
    const myPlayer = room.players.find(p => p.id === multiplayerService.socketId);
    
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={leaveRoom}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Leave Room
        </motion.button>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-dark-card border border-dark-border rounded-xl p-8"
        >
          {/* Game Type */}
          <div className="flex items-center justify-center gap-3 mb-6">
            {gameConfig && (
              <>
                <gameConfig.icon className="w-8 h-8" style={{ color: gameConfig.color }} />
                <h2 className="font-arcade text-2xl text-white">{gameConfig.name}</h2>
              </>
            )}
          </div>

          {/* Room Code */}
          <div className="text-center mb-8">
            <p className="text-gray-500 text-sm mb-2">ROOM CODE</p>
            <div className="flex items-center justify-center gap-3">
              <span className="font-arcade text-4xl text-accent-orange tracking-widest">{room.id}</span>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={copyRoomLink}
                className="p-2 rounded-lg bg-dark-bg hover:bg-accent-orange/20 text-gray-400 hover:text-accent-orange"
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </motion.button>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={copyRoomLink}
              className="mt-3 flex items-center gap-2 mx-auto text-sm text-gray-500 hover:text-accent-orange"
            >
              <Share2 className="w-4 h-4" />
              {copied ? 'Link Copied!' : 'Share Link'}
            </motion.button>
          </div>

          {/* Players */}
          <div className="space-y-3 mb-8">
            <p className="text-gray-500 text-sm text-center">PLAYERS ({room.players.length}/2)</p>
            
            {[0, 1].map((slot) => {
              const player = room.players[slot];
              return (
                <motion.div
                  key={slot}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: slot * 0.1 }}
                  className={`flex items-center justify-between p-4 rounded-xl border ${
                    player 
                      ? 'bg-dark-bg border-dark-border' 
                      : 'bg-dark-bg/50 border-dashed border-gray-700'
                  }`}
                >
                  {player ? (
                    <>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent-orange/20 flex items-center justify-center">
                          <span className="font-arcade text-accent-orange">
                            {player.name[0]?.toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white font-medium flex items-center gap-2">
                            {player.name}
                            {slot === 0 && <Crown className="w-4 h-4 text-yellow-500" />}
                          </p>
                          {player.wallet && (
                            <p className="text-gray-600 text-xs">
                              {player.wallet.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        player.ready 
                          ? 'bg-green-500/20 text-green-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {player.ready ? 'READY' : 'WAITING'}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-3 w-full justify-center text-gray-600">
                      <Timer className="w-5 h-5 animate-pulse" />
                      <span>Waiting for player...</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Ready Button */}
          {room.players.length === 2 && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={setReady}
              disabled={myPlayer?.ready}
              className={`w-full py-4 rounded-xl font-arcade text-xl flex items-center justify-center gap-3 ${
                myPlayer?.ready
                  ? 'bg-green-500/20 text-green-400 cursor-default'
                  : 'bg-gradient-to-r from-accent-orange to-accent-orange-light text-dark-bg'
              }`}
            >
              {myPlayer?.ready ? (
                <>
                  <Check className="w-6 h-6" />
                  READY!
                </>
              ) : (
                <>
                  <Swords className="w-6 h-6" />
                  I'M READY
                </>
              )}
            </motion.button>
          )}

          {room.players.length < 2 && (
            <p className="text-center text-gray-500 text-sm">
              Share the room code with a friend to start!
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // Render game view
  if (view === 'game' && room) {
    return (
      <MultiplayerGame 
        room={room} 
        onLeave={leaveRoom}
        onRematch={() => multiplayerService.requestRematch(room.id)}
      />
    );
  }

  return null;
}

// Game component that renders based on game type
function MultiplayerGame({ room, onLeave, onRematch }: { 
  room: Room; 
  onLeave: () => void;
  onRematch: () => void;
}) {
  const myId = multiplayerService.getSocketId();
  
  const handleAction = (action: any) => {
    multiplayerService.sendAction(room.id, action);
  };
  
  const gameProps = {
    gameState: room.state,
    playerId: myId || '',
    players: room.players,
    onAction: handleAction,
  };

  switch (room.gameType) {
    case 'tic-tac-toe':
      return <TicTacToeGame room={room} onLeave={onLeave} onRematch={onRematch} />;
    case 'word-duel':
      return <WordDuelGame room={room} onLeave={onLeave} onRematch={onRematch} />;
    case 'reaction-duel':
      return <ReactionDuelGame room={room} onLeave={onLeave} onRematch={onRematch} />;
    case 'rock-paper-scissors':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <RockPaperScissors {...gameProps} />
        </GameWrapper>
      );
    case 'quick-math':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <QuickMath {...gameProps} />
        </GameWrapper>
      );
    case 'connect-four':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <ConnectFour {...gameProps} />
        </GameWrapper>
      );
    case 'emoji-race':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <EmojiRace {...gameProps} />
        </GameWrapper>
      );
    case 'chess':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <Chess {...gameProps} />
        </GameWrapper>
      );
    case 'checkers':
      return (
        <GameWrapper room={room} onLeave={onLeave} onRematch={onRematch}>
          <Checkers {...gameProps} />
        </GameWrapper>
      );
    default:
      return <div>Unknown game type</div>;
  }
}

// Generic game wrapper with header and buttons
function GameWrapper({ room, onLeave, onRematch, children }: {
  room: Room;
  onLeave: () => void;
  onRematch: () => void;
  children: React.ReactNode;
}) {
  const gameInfo = GAME_TYPES.find(g => g.id === room.gameType);
  const myId = multiplayerService.getSocketId() || '';
  const myIndex = room.players.findIndex(p => p.id === myId);
  const opponent = room.players.find(p => p.id !== myId);
  
  // Determine winner based on game state
  const getWinnerInfo = () => {
    const state = room.state;
    if (!state) return { isWinner: false, isDraw: false };
    
    // Different game types have different win conditions
    // Connect Four, Chess, Checkers: state.winner is the player ID
    if (state.winner !== undefined) {
      if (state.winner === 'draw') return { isWinner: false, isDraw: true };
      return { isWinner: state.winner === myId, isDraw: false };
    }
    
    // Rock Paper Scissors, Quick Math, Emoji Race: scores-based
    if (state.scores && myIndex >= 0) {
      const myScore = state.scores[myId] ?? state.scores[myIndex] ?? 0;
      const opponentIndex = 1 - myIndex;
      const opponentScore = opponent ? (state.scores[opponent.id] ?? state.scores[opponentIndex] ?? 0) : 0;
      if (myScore === opponentScore) return { isWinner: false, isDraw: true };
      return { isWinner: myScore > opponentScore, isDraw: false };
    }
    
    return { isWinner: false, isDraw: false };
  };
  
  const { isWinner, isDraw } = getWinnerInfo();
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="container mx-auto max-w-2xl px-4 py-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onLeave}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Leave
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 justify-center">
            <span>{gameInfo?.emoji}</span>
            {gameInfo?.name || 'Game'}
          </h2>
          <span className="text-sm text-gray-400">Room: {room.id}</span>
        </div>
        <div className="w-20" />
      </div>

      {/* Game content */}
      <div className="bg-gray-900/50 rounded-2xl p-6 border border-gray-800">
        {children}
      </div>

      {/* Blockchain Submit + Rematch button when game finished */}
      {room.status === 'finished' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {/* Blockchain Submit - Get XP & Coins! */}
          {!isDraw && (
            <BlockchainResultSubmit
              gameType={room.gameType}
              roomCode={room.id}
              isWinner={isWinner}
              opponentName={opponent?.name || 'opponent'}
            />
          )}
          
          <div className="flex justify-center mt-4">
            <button
              onClick={onRematch}
              className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
            >
              🔄 Play Again
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
