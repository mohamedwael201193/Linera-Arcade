/**
 * Multiplayer Game Room System
 * Real-time games using Socket.IO
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';

interface Player {
  id: string;
  name: string;
  wallet?: string;
  ready: boolean;
  score: number;
}

interface GameRoom {
  id: string;
  gameType: 'tic-tac-toe' | 'word-duel' | 'reaction-duel' | 'rock-paper-scissors' | 'quick-math' | 'connect-four' | 'emoji-race' | 'chess' | 'checkers';
  players: Player[];
  state: any;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: number;
  hostId: string;
}

const rooms = new Map<string, GameRoom>();

// Generate 6-character room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Word lists for Word Duel
const WORD_LISTS = {
  easy: ['cat', 'dog', 'sun', 'moon', 'star', 'tree', 'book', 'fish', 'bird', 'rain'],
  medium: ['python', 'rocket', 'planet', 'crypto', 'arcade', 'gaming', 'winner', 'battle', 'turbo', 'speed'],
  hard: ['blockchain', 'typescript', 'javascript', 'microchain', 'decentralized', 'algorithm', 'multiplayer', 'competition'],
};

export function initializeMultiplayer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: ['http://localhost:3006', 'http://127.0.0.1:3006', 'https://linera-arcade.vercel.app'],
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🎮 Player connected: ${socket.id}`);

    // Create a new game room
    socket.on('create-room', ({ gameType, playerName, wallet }) => {
      const roomCode = generateRoomCode();
      const room: GameRoom = {
        id: roomCode,
        gameType,
        players: [{
          id: socket.id,
          name: playerName || 'Player 1',
          wallet,
          ready: false,
          score: 0,
        }],
        state: initGameState(gameType),
        status: 'waiting',
        createdAt: Date.now(),
        hostId: socket.id,
      };
      
      rooms.set(roomCode, room);
      socket.join(roomCode);
      
      socket.emit('room-created', { roomCode, room });
      console.log(`🏠 Room created: ${roomCode} - ${gameType}`);
    });

    // Join existing room
    socket.on('join-room', ({ roomCode, playerName, wallet }) => {
      const room = rooms.get(roomCode.toUpperCase());
      
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      if (room.players.length >= 2) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      
      if (room.status !== 'waiting') {
        socket.emit('error', { message: 'Game already in progress' });
        return;
      }

      room.players.push({
        id: socket.id,
        name: playerName || 'Player 2',
        wallet,
        ready: false,
        score: 0,
      });
      
      socket.join(roomCode.toUpperCase());
      io.to(roomCode.toUpperCase()).emit('player-joined', { room });
      console.log(`👤 Player joined room: ${roomCode}`);
    });

    // Player ready
    socket.on('player-ready', ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.ready = true;
        io.to(roomCode).emit('room-updated', { room });

        // Start game if both players ready
        if (room.players.length === 2 && room.players.every(p => p.ready)) {
          room.status = 'playing';
          room.state = initGameState(room.gameType);
          
          // Initialize player-specific state
          initPlayerState(room);
          
          io.to(roomCode).emit('game-start', { room });
          console.log(`🎮 Game started in room: ${roomCode}`);
        }
      }
    });

    // Game action (generic for all game types)
    socket.on('game-action', ({ roomCode, action }) => {
      const room = rooms.get(roomCode);
      if (!room || room.status !== 'playing') return;

      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex === -1) return;

      // Process game action based on game type
      const result = processGameAction(room, playerIndex, action, io, roomCode);
      
      if (result.valid) {
        io.to(roomCode).emit('game-updated', { room, result });
        
        if (result.gameOver) {
          room.status = 'finished';
          io.to(roomCode).emit('game-over', { room, winner: result.winner, result });
        }
      }
    });

    // Rematch request
    socket.on('rematch', ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;

      room.status = 'waiting';
      room.state = initGameState(room.gameType);
      room.players.forEach(p => {
        p.ready = false;
        p.score = 0;
      });
      
      io.to(roomCode).emit('room-updated', { room });
    });

    // Leave room
    socket.on('leave-room', ({ roomCode }) => {
      handleLeaveRoom(socket, roomCode, io);
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`👋 Player disconnected: ${socket.id}`);
      // Find and cleanup any rooms this player was in
      rooms.forEach((room, roomCode) => {
        if (room.players.some(p => p.id === socket.id)) {
          handleLeaveRoom(socket, roomCode, io);
        }
      });
    });
  });

  // Cleanup old rooms every 5 minutes
  setInterval(() => {
    const now = Date.now();
    rooms.forEach((room, code) => {
      if (now - room.createdAt > 30 * 60 * 1000) { // 30 minutes
        rooms.delete(code);
        console.log(`🗑️ Cleaned up old room: ${code}`);
      }
    });
  }, 5 * 60 * 1000);

  console.log('🎮 Multiplayer system initialized');
  return io;
}

function handleLeaveRoom(socket: Socket, roomCode: string, io: Server) {
  const room = rooms.get(roomCode);
  if (!room) return;

  room.players = room.players.filter(p => p.id !== socket.id);
  socket.leave(roomCode);

  if (room.players.length === 0) {
    rooms.delete(roomCode);
    console.log(`🗑️ Room deleted: ${roomCode}`);
  } else {
    // If host left, assign new host
    if (room.hostId === socket.id && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }
    room.status = 'waiting';
    io.to(roomCode).emit('player-left', { room });
  }
}

function initGameState(gameType: string): any {
  switch (gameType) {
    case 'tic-tac-toe':
      return {
        board: Array(9).fill(null),
        currentTurn: 0, // player index
      };
    case 'word-duel':
      return {
        currentWord: '',
        round: 0,
        maxRounds: 10,
        scores: [0, 0],
        roundWinner: null,
        difficulty: 'medium',
      };
    case 'reaction-duel':
      return {
        round: 0,
        maxRounds: 5,
        scores: [0, 0],
        status: 'waiting', // waiting, ready, go, finished
        startTime: null,
        reactions: [null, null],
      };
    case 'rock-paper-scissors':
      return {
        round: 1,
        maxRounds: 5,
        choices: {} as Record<string, string>,
        scores: {} as Record<string, number>,
        roundResult: null,
        status: 'choosing',
      };
    case 'quick-math':
      return {
        round: 0,
        maxRounds: 10,
        problem: null,
        scores: {} as Record<string, number>,
        answers: {} as Record<string, number>,
        roundWinner: null,
        status: 'waiting',
      };
    case 'connect-four':
      return {
        board: Array(6).fill(null).map(() => Array(7).fill(null)),
        currentTurn: '', // Will be set to first player
        winner: null,
        winLine: null,
      };
    case 'emoji-race':
      return {
        targetEmoji: '',
        emojis: [],
        round: 0,
        maxRounds: 10,
        scores: {} as Record<string, number>,
        roundWinner: null,
        status: 'playing',
      };
    case 'chess':
      return initChessGame();
    case 'checkers':
      return initCheckersGame();
    default:
      return {};
  }
}

// Initialize player-specific state after both players join
function initPlayerState(room: GameRoom) {
  const state = room.state;
  const p1 = room.players[0];
  const p2 = room.players[1];
  
  switch (room.gameType) {
    case 'connect-four':
      state.currentTurn = p1.id;
      break;
    case 'rock-paper-scissors':
      state.scores = { [p1.id]: 0, [p2.id]: 0 };
      state.choices = {};
      break;
    case 'quick-math':
      state.scores = { [p1.id]: 0, [p2.id]: 0 };
      break;
    case 'emoji-race':
      state.scores = { [p1.id]: 0, [p2.id]: 0 };
      break;
    case 'chess':
      state.currentTurn = p1.id; // White goes first
      break;
    case 'checkers':
      state.currentTurn = p1.id; // Red goes first
      break;
  }
}

function processGameAction(room: GameRoom, playerIndex: number, action: any, io?: Server, roomCode?: string): any {
  switch (room.gameType) {
    case 'tic-tac-toe':
      return processTicTacToe(room, playerIndex, action);
    case 'word-duel':
      return processWordDuel(room, playerIndex, action);
    case 'reaction-duel':
      return processReactionDuel(room, playerIndex, action);
    case 'rock-paper-scissors':
      return processRockPaperScissors(room, playerIndex, action, io, roomCode);
    case 'quick-math':
      return processQuickMath(room, playerIndex, action, io, roomCode);
    case 'connect-four':
      return processConnectFour(room, playerIndex, action);
    case 'emoji-race':
      return processEmojiRace(room, playerIndex, action, io, roomCode);
    case 'chess':
      return processChess(room, playerIndex, action);
    case 'checkers':
      return processCheckers(room, playerIndex, action);
    default:
      return { valid: false };
  }
}

function processTicTacToe(room: GameRoom, playerIndex: number, action: any): any {
  const { position } = action;
  const state = room.state;

  // Check if it's this player's turn
  if (state.currentTurn !== playerIndex) {
    return { valid: false, message: 'Not your turn' };
  }

  // Check if position is valid
  if (position < 0 || position > 8 || state.board[position] !== null) {
    return { valid: false, message: 'Invalid move' };
  }

  // Make move
  state.board[position] = playerIndex === 0 ? 'X' : 'O';
  state.currentTurn = 1 - playerIndex;

  // Check for winner
  const winner = checkTicTacToeWinner(state.board);
  if (winner !== null) {
    const winnerIndex = winner === 'X' ? 0 : 1;
    room.players[winnerIndex].score += 1;
    return { valid: true, gameOver: true, winner: winnerIndex, winLine: getWinLine(state.board) };
  }

  // Check for draw
  if (state.board.every((cell: any) => cell !== null)) {
    return { valid: true, gameOver: true, winner: -1, draw: true };
  }

  return { valid: true };
}

function checkTicTacToeWinner(board: any[]): string | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
    [0, 4, 8], [2, 4, 6], // diags
  ];

  for (const [a, b, c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function getWinLine(board: any[]): number[] | null {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return line;
    }
  }
  return null;
}

function processWordDuel(room: GameRoom, playerIndex: number, action: any): any {
  const state = room.state;

  if (action.type === 'start-round') {
    // Pick a random word
    const words = WORD_LISTS[state.difficulty as keyof typeof WORD_LISTS];
    state.currentWord = words[Math.floor(Math.random() * words.length)];
    state.round++;
    state.roundWinner = null;
    return { valid: true, newWord: state.currentWord };
  }

  if (action.type === 'word-typed') {
    if (action.word.toLowerCase() === state.currentWord.toLowerCase() && state.roundWinner === null) {
      state.roundWinner = playerIndex;
      state.scores[playerIndex]++;
      room.players[playerIndex].score = state.scores[playerIndex];

      if (state.round >= state.maxRounds) {
        const winner = state.scores[0] > state.scores[1] ? 0 : 
                       state.scores[1] > state.scores[0] ? 1 : -1;
        return { valid: true, gameOver: true, winner, roundWinner: playerIndex };
      }

      return { valid: true, roundWinner: playerIndex };
    }
  }

  return { valid: false };
}

function processReactionDuel(room: GameRoom, playerIndex: number, action: any): any {
  const state = room.state;

  if (action.type === 'start-round') {
    state.status = 'ready';
    state.reactions = [null, null];
    state.round++;
    
    // Random delay 2-5 seconds before "GO"
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      if (room.status === 'playing') {
        state.status = 'go';
        state.startTime = Date.now();
        // Emit to room - this needs io reference, handled differently
      }
    }, delay);
    
    return { valid: true, status: 'ready', goDelay: delay };
  }

  if (action.type === 'click') {
    if (state.status === 'ready') {
      // Clicked too early!
      state.reactions[playerIndex] = -1; // -1 means false start
      return { valid: true, falseStart: playerIndex };
    }
    
    if (state.status === 'go' && state.reactions[playerIndex] === null) {
      state.reactions[playerIndex] = Date.now() - state.startTime;
      
      // Check if both players have reacted
      if (state.reactions.every((r: any) => r !== null)) {
        const p0 = state.reactions[0];
        const p1 = state.reactions[1];
        
        let roundWinner = -1;
        if (p0 === -1 && p1 === -1) roundWinner = -1;
        else if (p0 === -1) roundWinner = 1;
        else if (p1 === -1) roundWinner = 0;
        else roundWinner = p0 < p1 ? 0 : 1;

        if (roundWinner !== -1) {
          state.scores[roundWinner]++;
          room.players[roundWinner].score = state.scores[roundWinner];
        }

        state.status = 'finished';

        if (state.round >= state.maxRounds) {
          const winner = state.scores[0] > state.scores[1] ? 0 :
                         state.scores[1] > state.scores[0] ? 1 : -1;
          return { valid: true, gameOver: true, winner, reactions: state.reactions, roundWinner };
        }

        return { valid: true, reactions: state.reactions, roundWinner };
      }
      
      return { valid: true, reactionTime: state.reactions[playerIndex] };
    }
  }

  return { valid: false };
}

// Rock Paper Scissors logic
function processRockPaperScissors(room: GameRoom, playerIndex: number, action: any, io?: Server, roomCode?: string): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  
  // Initialize scores if not set
  if (Object.keys(state.scores).length === 0) {
    room.players.forEach(p => {
      state.scores[p.id] = 0;
    });
  }

  if (action.type === 'choose') {
    state.choices[playerId] = action.choice;
    
    // Check if both players have chosen
    if (Object.keys(state.choices).length === 2) {
      const p1Id = room.players[0].id;
      const p2Id = room.players[1].id;
      const c1 = state.choices[p1Id];
      const c2 = state.choices[p2Id];
      
      // Determine winner
      let winner: string | null = null;
      if (c1 !== c2) {
        const beats: Record<string, string> = {
          rock: 'scissors',
          paper: 'rock',
          scissors: 'paper',
        };
        winner = beats[c1] === c2 ? p1Id : p2Id;
        state.scores[winner]++;
        const winnerIdx = room.players.findIndex(p => p.id === winner);
        room.players[winnerIdx].score = state.scores[winner];
      }
      
      state.roundResult = { winner, playerChoices: { ...state.choices } };
      state.status = 'reveal';
      
      // Check if game over
      if (state.round >= state.maxRounds) {
        const finalWinner = state.scores[p1Id] > state.scores[p2Id] ? p1Id :
                           state.scores[p2Id] > state.scores[p1Id] ? p2Id : null;
        return { valid: true, gameOver: true, winner: finalWinner, roundResult: state.roundResult };
      }
      
      // Auto-advance to next round after delay
      if (io && roomCode) {
        setTimeout(() => {
          state.choices = {};
          state.roundResult = null;
          state.round++;
          state.status = 'choosing';
          io.to(roomCode).emit('game-updated', { room, result: { valid: true, newRound: state.round } });
        }, 2500);
      }
      
      return { valid: true, roundResult: state.roundResult };
    }
    
    return { valid: true };
  }
  
  // Start next round (fallback)
  if (action.type === 'next-round') {
    state.choices = {};
    state.roundResult = null;
    state.round++;
    state.status = 'choosing';
    return { valid: true, newRound: state.round };
  }

  return { valid: false };
}

// Helper to generate a new math problem
function generateMathProblem() {
  const operators = ['+', '-', '*'];
  const op = operators[Math.floor(Math.random() * operators.length)];
  let a: number, b: number, answer: number;
  
  switch (op) {
    case '+':
      a = Math.floor(Math.random() * 50) + 1;
      b = Math.floor(Math.random() * 50) + 1;
      answer = a + b;
      break;
    case '-':
      a = Math.floor(Math.random() * 50) + 20;
      b = Math.floor(Math.random() * 20) + 1;
      answer = a - b;
      break;
    case '*':
      a = Math.floor(Math.random() * 12) + 1;
      b = Math.floor(Math.random() * 12) + 1;
      answer = a * b;
      break;
    default:
      a = 10; b = 5; answer = 15;
  }
  
  return { a, b, operator: op, answer };
}

// Quick Math game logic
function processQuickMath(room: GameRoom, playerIndex: number, action: any, io?: Server, roomCode?: string): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  
  // Initialize scores if not set
  if (Object.keys(state.scores).length === 0) {
    room.players.forEach(p => {
      state.scores[p.id] = 0;
    });
  }

  if (action.type === 'start-round' || action.type === 'next-round') {
    state.problem = generateMathProblem();
    state.answers = {};
    state.roundWinner = null;
    state.status = 'playing';
    
    return { valid: true, problem: state.problem };
  }

  if (action.type === 'answer') {
    if (state.answers[playerId] !== undefined) return { valid: false };
    
    state.answers[playerId] = action.answer;
    
    // Check if this is the correct answer
    if (action.answer === state.problem.answer && state.roundWinner === null) {
      state.roundWinner = playerId;
      state.scores[playerId]++;
      const winnerIdx = room.players.findIndex(p => p.id === playerId);
      room.players[winnerIdx].score = state.scores[playerId];
      state.round++;
      
      // Check if game over
      if (state.round >= state.maxRounds) {
        const p1Id = room.players[0].id;
        const p2Id = room.players[1].id;
        const finalWinner = state.scores[p1Id] > state.scores[p2Id] ? p1Id :
                           state.scores[p2Id] > state.scores[p1Id] ? p2Id : null;
        return { valid: true, gameOver: true, winner: finalWinner };
      }
      
      // Auto-advance to next round after delay
      if (io && roomCode) {
        setTimeout(() => {
          state.problem = generateMathProblem();
          state.answers = {};
          state.roundWinner = null;
          state.status = 'playing';
          io.to(roomCode).emit('game-updated', { room, result: { valid: true, newRound: true, problem: state.problem } });
        }, 2500);
      }
      
      return { valid: true, roundWinner: state.roundWinner };
    } else if (Object.keys(state.answers).length === 2 && state.roundWinner === null) {
      // Both answered wrong - auto advance
      state.roundWinner = 'tie';
      state.round++;
      
      if (io && roomCode && state.round < state.maxRounds) {
        setTimeout(() => {
          state.problem = generateMathProblem();
          state.answers = {};
          state.roundWinner = null;
          state.status = 'playing';
          io.to(roomCode).emit('game-updated', { room, result: { valid: true, newRound: true, problem: state.problem } });
        }, 2500);
      }
      
      return { valid: true, roundWinner: 'tie' };
    }
    
    return { valid: true };
  }

  return { valid: false };
}

// Connect Four game logic
function processConnectFour(room: GameRoom, playerIndex: number, action: any): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  
  // Initialize currentTurn if not set
  if (!state.currentTurn) {
    state.currentTurn = room.players[0].id;
  }

  if (action.type === 'drop') {
    const col = action.column;
    
    // Check if it's this player's turn
    if (state.currentTurn !== playerId) {
      return { valid: false, message: 'Not your turn' };
    }
    
    // Check if column is valid and not full
    if (col < 0 || col > 6 || state.board[0][col] !== null) {
      return { valid: false, message: 'Invalid column' };
    }
    
    // Find the lowest empty row in the column
    let row = -1;
    for (let r = 5; r >= 0; r--) {
      if (state.board[r][col] === null) {
        row = r;
        break;
      }
    }
    
    if (row === -1) return { valid: false };
    
    // Place the piece
    const color = playerIndex === 0 ? 'red' : 'yellow';
    state.board[row][col] = color;
    
    // Check for winner
    const winLine = checkConnectFourWinner(state.board, row, col, color);
    if (winLine) {
      state.winner = playerId;
      state.winLine = winLine;
      room.players[playerIndex].score++;
      return { valid: true, gameOver: true, winner: playerId, winLine };
    }
    
    // Check for draw
    const isDraw = state.board[0].every((cell: string | null) => cell !== null);
    if (isDraw) {
      state.winner = 'draw';
      return { valid: true, gameOver: true, winner: 'draw' };
    }
    
    // Switch turn
    const otherPlayer = room.players.find(p => p.id !== playerId);
    if (otherPlayer) {
      state.currentTurn = otherPlayer.id;
    }
    
    return { valid: true };
  }

  return { valid: false };
}

function checkConnectFourWinner(board: (string | null)[][], row: number, col: number, color: string): number[][] | null {
  const directions = [
    [0, 1],   // horizontal
    [1, 0],   // vertical
    [1, 1],   // diagonal down-right
    [1, -1],  // diagonal down-left
  ];
  
  for (const [dr, dc] of directions) {
    const line: number[][] = [[row, col]];
    
    // Check in positive direction
    for (let i = 1; i < 4; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === color) {
        line.push([r, c]);
      } else break;
    }
    
    // Check in negative direction
    for (let i = 1; i < 4; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < 6 && c >= 0 && c < 7 && board[r][c] === color) {
        line.push([r, c]);
      } else break;
    }
    
    if (line.length >= 4) {
      return line.slice(0, 4);
    }
  }
  
  return null;
}

// Emoji Race game logic
const ALL_EMOJIS = ['🎮', '🎯', '🎲', '🎪', '🎨', '🎭', '🎸', '🎺', '🎻', '🎹', '🏀', '⚽', '🏈', '🎾', '🏓', '🚀', '✈️', '🚁', '🛸', '🚂', '🌟', '⭐', '💫', '🌙', '☀️', '🍎', '🍊', '🍋', '🍇', '🍓', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯'];

// Helper to generate emoji round
function generateEmojiRound() {
  const shuffled = [...ALL_EMOJIS].sort(() => Math.random() - 0.5);
  const emojis = shuffled.slice(0, 25); // 5x5 grid
  const targetIndex = Math.floor(Math.random() * 25);
  return { emojis, targetEmoji: emojis[targetIndex] };
}

function processEmojiRace(room: GameRoom, playerIndex: number, action: any, io?: Server, roomCode?: string): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  
  // Initialize scores if not set
  if (Object.keys(state.scores).length === 0) {
    room.players.forEach(p => {
      state.scores[p.id] = 0;
    });
  }

  if (action.type === 'start-round' || action.type === 'next-round') {
    const { emojis, targetEmoji } = generateEmojiRound();
    state.targetEmoji = targetEmoji;
    state.emojis = emojis;
    state.roundWinner = null;
    state.clicked = {};
    
    return { valid: true, targetEmoji: state.targetEmoji, emojis: state.emojis };
  }

  if (action.type === 'click') {
    const index = action.index;
    
    // Prevent double clicks
    if (state.clicked && state.clicked[playerId]) return { valid: false };
    
    state.clicked = state.clicked || {};
    state.clicked[playerId] = true;
    
    // Check if correct emoji
    if (state.emojis[index] === state.targetEmoji && state.roundWinner === null) {
      state.roundWinner = playerId;
      state.scores[playerId]++;
      const winnerIdx = room.players.findIndex(p => p.id === playerId);
      room.players[winnerIdx].score = state.scores[playerId];
      state.round++;
      
      // Check if game over
      if (state.round >= state.maxRounds) {
        const p1Id = room.players[0].id;
        const p2Id = room.players[1].id;
        const finalWinner = state.scores[p1Id] > state.scores[p2Id] ? p1Id :
                           state.scores[p2Id] > state.scores[p1Id] ? p2Id : null;
        return { valid: true, gameOver: true, winner: finalWinner };
      }
      
      // Auto-advance to next round after delay
      if (io && roomCode) {
        setTimeout(() => {
          const { emojis, targetEmoji } = generateEmojiRound();
          state.targetEmoji = targetEmoji;
          state.emojis = emojis;
          state.roundWinner = null;
          state.clicked = {};
          io.to(roomCode).emit('game-updated', { room, result: { valid: true, newRound: true, targetEmoji, emojis } });
        }, 1500);
      }
      
      return { valid: true, roundWinner: state.roundWinner };
    } else if (state.emojis[index] !== state.targetEmoji) {
      // Wrong emoji
      if (state.roundWinner === null) {
        state.roundWinner = 'wrong';
      }
      return { valid: true, wrong: true };
    }
    
    return { valid: true };
  }

  return { valid: false };
}

// ================== CHESS GAME ==================

function initChessGame() {
  // Standard chess starting position
  const board = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ];
  
  return {
    board,
    currentTurn: '',
    winner: null,
    selectedPiece: null,
    validMoves: [],
    capturedWhite: [],
    capturedBlack: [],
    inCheck: null,
    lastMove: null,
    castlingRights: {
      whiteKingSide: true,
      whiteQueenSide: true,
      blackKingSide: true,
      blackQueenSide: true,
    },
    enPassantTarget: null,
  };
}

function processChess(room: GameRoom, playerIndex: number, action: any): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  const isWhite = playerIndex === 0;
  
  if (action.type === 'select') {
    const { from } = action;
    const piece = state.board[from.row]?.[from.col];
    
    if (!piece) return { valid: false };
    
    // Check if it's the player's piece
    const isPieceWhite = piece === piece.toUpperCase();
    if ((isWhite && !isPieceWhite) || (!isWhite && isPieceWhite)) {
      return { valid: false, message: 'Not your piece' };
    }
    
    // Get valid moves for this piece
    const validMoves = getValidChessMoves(state, from.row, from.col, isWhite);
    state.selectedPiece = from;
    state.validMoves = validMoves;
    
    return { valid: true, validMoves };
  }
  
  if (action.type === 'move') {
    const { from, to } = action;
    
    // Check if it's this player's turn
    if (state.currentTurn !== playerId) {
      return { valid: false, message: 'Not your turn' };
    }
    
    const piece = state.board[from.row]?.[from.col];
    if (!piece) return { valid: false };
    
    // Check if it's the player's piece
    const isPieceWhite = piece === piece.toUpperCase();
    if ((isWhite && !isPieceWhite) || (!isWhite && isPieceWhite)) {
      return { valid: false, message: 'Not your piece' };
    }
    
    // Verify the move is valid
    const validMoves = getValidChessMoves(state, from.row, from.col, isWhite);
    const isValidMove = validMoves.some(m => m.row === to.row && m.col === to.col);
    
    if (!isValidMove) {
      return { valid: false, message: 'Invalid move' };
    }
    
    // Capture piece if present
    const capturedPiece = state.board[to.row][to.col];
    if (capturedPiece) {
      if (capturedPiece === capturedPiece.toUpperCase()) {
        state.capturedWhite.push(capturedPiece);
      } else {
        state.capturedBlack.push(capturedPiece);
      }
    }
    
    // Handle pawn promotion
    let movedPiece = piece;
    if (piece.toLowerCase() === 'p') {
      if ((isWhite && to.row === 0) || (!isWhite && to.row === 7)) {
        movedPiece = isWhite ? 'Q' : 'q'; // Auto-promote to queen
      }
    }
    
    // Make the move
    state.board[to.row][to.col] = movedPiece;
    state.board[from.row][from.col] = null;
    state.lastMove = { from, to };
    state.selectedPiece = null;
    state.validMoves = [];
    
    // Switch turn
    const otherPlayer = room.players.find(p => p.id !== playerId);
    if (otherPlayer) {
      state.currentTurn = otherPlayer.id;
    }
    
    // Check for check/checkmate
    const opponentIsWhite = !isWhite;
    const opponentKingPos = findKing(state.board, opponentIsWhite);
    const isOpponentInCheck = opponentKingPos && isKingInCheck(state.board, opponentKingPos.row, opponentKingPos.col, opponentIsWhite);
    
    if (isOpponentInCheck) {
      state.inCheck = otherPlayer?.id || null;
      
      // Check for checkmate
      const hasValidMoves = hasAnyValidMoves(state, opponentIsWhite);
      if (!hasValidMoves) {
        state.winner = playerId;
        room.players[playerIndex].score++;
        return { valid: true, gameOver: true, winner: playerId, checkmate: true };
      }
    } else {
      state.inCheck = null;
      
      // Check for stalemate
      const hasValidMoves = hasAnyValidMoves(state, opponentIsWhite);
      if (!hasValidMoves) {
        state.winner = 'draw';
        return { valid: true, gameOver: true, winner: 'draw', stalemate: true };
      }
    }
    
    return { valid: true };
  }
  
  return { valid: false };
}

function getValidChessMoves(state: any, row: number, col: number, isWhite: boolean): { row: number; col: number }[] {
  const piece = state.board[row]?.[col];
  if (!piece) return [];
  
  const moves: { row: number; col: number }[] = [];
  const pieceType = piece.toLowerCase();
  
  const addMoveIfValid = (r: number, c: number, canCapture = true, mustCapture = false) => {
    if (r < 0 || r > 7 || c < 0 || c > 7) return false;
    const target = state.board[r][c];
    if (target) {
      const targetIsWhite = target === target.toUpperCase();
      if (canCapture && targetIsWhite !== isWhite) {
        moves.push({ row: r, col: c });
      }
      return false; // Blocked
    }
    if (!mustCapture) {
      moves.push({ row: r, col: c });
    }
    return true; // Can continue in this direction
  };
  
  switch (pieceType) {
    case 'p': // Pawn
      const direction = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      // Forward move
      if (!state.board[row + direction]?.[col]) {
        moves.push({ row: row + direction, col });
        // Double move from start
        if (row === startRow && !state.board[row + 2 * direction]?.[col]) {
          moves.push({ row: row + 2 * direction, col });
        }
      }
      // Captures
      [-1, 1].forEach(dc => {
        const target = state.board[row + direction]?.[col + dc];
        if (target) {
          const targetIsWhite = target === target.toUpperCase();
          if (targetIsWhite !== isWhite) {
            moves.push({ row: row + direction, col: col + dc });
          }
        }
      });
      break;
      
    case 'r': // Rook
      [[0, 1], [0, -1], [1, 0], [-1, 0]].forEach(([dr, dc]) => {
        for (let i = 1; i <= 7; i++) {
          if (!addMoveIfValid(row + dr * i, col + dc * i)) break;
        }
      });
      break;
      
    case 'n': // Knight
      [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([dr, dc]) => {
        addMoveIfValid(row + dr, col + dc);
      });
      break;
      
    case 'b': // Bishop
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        for (let i = 1; i <= 7; i++) {
          if (!addMoveIfValid(row + dr * i, col + dc * i)) break;
        }
      });
      break;
      
    case 'q': // Queen
      [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        for (let i = 1; i <= 7; i++) {
          if (!addMoveIfValid(row + dr * i, col + dc * i)) break;
        }
      });
      break;
      
    case 'k': // King
      [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([dr, dc]) => {
        addMoveIfValid(row + dr, col + dc);
      });
      break;
  }
  
  // Filter out moves that would put own king in check
  return moves.filter(move => {
    const testBoard = state.board.map((r: any) => [...r]);
    testBoard[move.row][move.col] = testBoard[row][col];
    testBoard[row][col] = null;
    const kingPos = piece.toLowerCase() === 'k' 
      ? { row: move.row, col: move.col }
      : findKing(testBoard, isWhite);
    return kingPos && !isKingInCheck(testBoard, kingPos.row, kingPos.col, isWhite);
  });
}

function findKing(board: any[][], isWhite: boolean): { row: number; col: number } | null {
  const king = isWhite ? 'K' : 'k';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c] === king) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function isKingInCheck(board: any[][], kingRow: number, kingCol: number, isWhite: boolean): boolean {
  // Check all opponent pieces to see if any can attack the king
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const pieceIsWhite = piece === piece.toUpperCase();
      if (pieceIsWhite === isWhite) continue; // Same color
      
      // Check if this piece can attack the king
      if (canPieceAttack(board, r, c, kingRow, kingCol, pieceIsWhite)) {
        return true;
      }
    }
  }
  return false;
}

function canPieceAttack(board: any[][], fromRow: number, fromCol: number, toRow: number, toCol: number, isWhite: boolean): boolean {
  const piece = board[fromRow][fromCol]?.toLowerCase();
  const dr = toRow - fromRow;
  const dc = toCol - fromCol;
  
  switch (piece) {
    case 'p':
      const direction = isWhite ? -1 : 1;
      return dr === direction && Math.abs(dc) === 1;
    case 'r':
      if (dr !== 0 && dc !== 0) return false;
      return isPathClear(board, fromRow, fromCol, toRow, toCol);
    case 'n':
      return (Math.abs(dr) === 2 && Math.abs(dc) === 1) || (Math.abs(dr) === 1 && Math.abs(dc) === 2);
    case 'b':
      if (Math.abs(dr) !== Math.abs(dc)) return false;
      return isPathClear(board, fromRow, fromCol, toRow, toCol);
    case 'q':
      if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return false;
      return isPathClear(board, fromRow, fromCol, toRow, toCol);
    case 'k':
      return Math.abs(dr) <= 1 && Math.abs(dc) <= 1;
    default:
      return false;
  }
}

function isPathClear(board: any[][], fromRow: number, fromCol: number, toRow: number, toCol: number): boolean {
  const dr = Math.sign(toRow - fromRow);
  const dc = Math.sign(toCol - fromCol);
  let r = fromRow + dr;
  let c = fromCol + dc;
  
  while (r !== toRow || c !== toCol) {
    if (board[r][c]) return false;
    r += dr;
    c += dc;
  }
  return true;
}

function hasAnyValidMoves(state: any, isWhite: boolean): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const pieceIsWhite = piece === piece.toUpperCase();
      if (pieceIsWhite !== isWhite) continue;
      
      const moves = getValidChessMoves(state, r, c, isWhite);
      if (moves.length > 0) return true;
    }
  }
  return false;
}

// ================== CHECKERS GAME ==================

function initCheckersGame() {
  // Standard checkers starting position
  const board: (string | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  
  // Place black pieces (top 3 rows)
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'b';
      }
    }
  }
  
  // Place red pieces (bottom 3 rows)
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        board[row][col] = 'r';
      }
    }
  }
  
  return {
    board,
    currentTurn: '',
    winner: null,
    selectedPiece: null,
    validMoves: [],
    capturedRed: 0,
    capturedBlack: 0,
    mustJump: false,
    jumpingPiece: null,
  };
}

function processCheckers(room: GameRoom, playerIndex: number, action: any): any {
  const state = room.state;
  const playerId = room.players[playerIndex].id;
  const isRed = playerIndex === 0;
  
  if (action.type === 'select') {
    const { from } = action;
    const piece = state.board[from.row]?.[from.col];
    
    if (!piece) return { valid: false };
    
    // Check if it's the player's piece
    const isPieceRed = piece.toLowerCase() === 'r';
    if ((isRed && !isPieceRed) || (!isRed && isPieceRed)) {
      return { valid: false, message: 'Not your piece' };
    }
    
    // If must continue jumping, only allow selecting the jumping piece
    if (state.mustJump && state.jumpingPiece) {
      if (from.row !== state.jumpingPiece.row || from.col !== state.jumpingPiece.col) {
        return { valid: false, message: 'Must continue jumping' };
      }
    }
    
    // Get valid moves for this piece
    const validMoves = getValidCheckersMoves(state, from.row, from.col, isRed, state.mustJump);
    state.selectedPiece = from;
    state.validMoves = validMoves;
    
    return { valid: true, validMoves };
  }
  
  if (action.type === 'move') {
    const { from, to } = action;
    
    // Check if it's this player's turn
    if (state.currentTurn !== playerId) {
      return { valid: false, message: 'Not your turn' };
    }
    
    const piece = state.board[from.row]?.[from.col];
    if (!piece) return { valid: false };
    
    // Check if it's the player's piece
    const isPieceRed = piece.toLowerCase() === 'r';
    if ((isRed && !isPieceRed) || (!isRed && isPieceRed)) {
      return { valid: false, message: 'Not your piece' };
    }
    
    // Verify the move is valid
    const validMoves = getValidCheckersMoves(state, from.row, from.col, isRed, state.mustJump);
    const moveInfo = validMoves.find(m => m.row === to.row && m.col === to.col);
    
    if (!moveInfo) {
      return { valid: false, message: 'Invalid move' };
    }
    
    // Check if this is a capture move
    const isCapture = Math.abs(to.row - from.row) === 2;
    
    if (isCapture) {
      const capturedRow = (from.row + to.row) / 2;
      const capturedCol = (from.col + to.col) / 2;
      const capturedPiece = state.board[capturedRow][capturedCol];
      
      // Remove captured piece
      state.board[capturedRow][capturedCol] = null;
      
      if (capturedPiece?.toLowerCase() === 'r') {
        state.capturedRed++;
      } else {
        state.capturedBlack++;
      }
    }
    
    // Make the move
    let movedPiece = piece;
    
    // Check for king promotion
    if (piece === 'r' && to.row === 0) {
      movedPiece = 'R'; // Red king
    } else if (piece === 'b' && to.row === 7) {
      movedPiece = 'B'; // Black king
    }
    
    state.board[to.row][to.col] = movedPiece;
    state.board[from.row][from.col] = null;
    state.selectedPiece = null;
    state.validMoves = [];
    
    // Check for additional jumps
    if (isCapture) {
      const additionalJumps = getValidCheckersMoves(state, to.row, to.col, isRed, true);
      if (additionalJumps.length > 0) {
        state.mustJump = true;
        state.jumpingPiece = { row: to.row, col: to.col };
        return { valid: true, mustContinueJump: true };
      }
    }
    
    state.mustJump = false;
    state.jumpingPiece = null;
    
    // Switch turn
    const otherPlayer = room.players.find(p => p.id !== playerId);
    if (otherPlayer) {
      state.currentTurn = otherPlayer.id;
    }
    
    // Check for winner
    const redPieces = countPieces(state.board, true);
    const blackPieces = countPieces(state.board, false);
    
    if (redPieces === 0) {
      state.winner = room.players[1].id; // Black wins
      room.players[1].score++;
      return { valid: true, gameOver: true, winner: room.players[1].id };
    }
    if (blackPieces === 0) {
      state.winner = room.players[0].id; // Red wins
      room.players[0].score++;
      return { valid: true, gameOver: true, winner: room.players[0].id };
    }
    
    // Check if opponent has any valid moves
    const opponentHasMoves = hasAnyCheckersMove(state, !isRed);
    if (!opponentHasMoves) {
      state.winner = playerId;
      room.players[playerIndex].score++;
      return { valid: true, gameOver: true, winner: playerId };
    }
    
    return { valid: true };
  }
  
  return { valid: false };
}

function getValidCheckersMoves(state: any, row: number, col: number, isRed: boolean, jumpsOnly: boolean): { row: number; col: number }[] {
  const piece = state.board[row]?.[col];
  if (!piece) return [];
  
  const isKing = piece === 'R' || piece === 'B';
  const moves: { row: number; col: number }[] = [];
  const jumps: { row: number; col: number }[] = [];
  
  // Directions: regular pieces move forward only, kings move both ways
  const directions: [number, number][] = [];
  if (isRed || isKing) {
    directions.push([-1, -1], [-1, 1]); // Up
  }
  if (!isRed || isKing) {
    directions.push([1, -1], [1, 1]); // Down
  }
  
  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;
    
    // Check bounds
    if (newRow < 0 || newRow > 7 || newCol < 0 || newCol > 7) continue;
    
    const target = state.board[newRow][newCol];
    
    if (!target) {
      // Empty square - regular move
      if (!jumpsOnly) {
        moves.push({ row: newRow, col: newCol });
      }
    } else {
      // Check if we can jump over opponent's piece
      const targetIsRed = target.toLowerCase() === 'r';
      if (targetIsRed !== isRed) {
        const jumpRow = newRow + dr;
        const jumpCol = newCol + dc;
        
        if (jumpRow >= 0 && jumpRow <= 7 && jumpCol >= 0 && jumpCol <= 7) {
          if (!state.board[jumpRow][jumpCol]) {
            jumps.push({ row: jumpRow, col: jumpCol });
          }
        }
      }
    }
  }
  
  // If there are jumps available, only return jumps (jumps are mandatory)
  if (jumps.length > 0) {
    return jumps;
  }
  
  return jumpsOnly ? [] : moves;
}

function countPieces(board: any[][], isRed: boolean): number {
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const pieceIsRed = piece.toLowerCase() === 'r';
        if (pieceIsRed === isRed) count++;
      }
    }
  }
  return count;
}

function hasAnyCheckersMove(state: any, isRed: boolean): boolean {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = state.board[r][c];
      if (!piece) continue;
      const pieceIsRed = piece.toLowerCase() === 'r';
      if (pieceIsRed !== isRed) continue;
      
      const moves = getValidCheckersMoves(state, r, c, isRed, false);
      if (moves.length > 0) return true;
    }
  }
  return false;
}

export { rooms };
