/**
 * On-Chain Multiplayer Service (CROSS-CHAIN PATTERN)
 * 
 * Uses lineraAdapter to execute GraphQL queries/mutations against the Linera blockchain.
 * Each player's chain stores their own game room state.
 * Room is created on HOST's chain, synced to JOINER via cross-chain messages.
 * 
 * ARCHITECTURE: Cross-chain messaging 
 * - Host creates room on their chain -> gets hostChainId
 * - Joiner sends JoinRequest to hostChainId via cross-chain message
 * - Host receives join, sends GameStateSync back to joiner
 * - Both players query their OWN chain for room state
 * - Moves are synced via cross-chain messages
 */

import { lineraAdapter } from '../linera';

// =============================================================================
// TYPES
// =============================================================================

// UI-friendly game type names
export type MultiplayerGameType = 'TicTacToe' | 'ConnectFour' | 'Chess' | 'Checkers' | 'QuickMath';

// GraphQL enum values (async_graphql converts to SCREAMING_SNAKE_CASE)
type GraphQLGameType = 'TIC_TAC_TOE' | 'CONNECT_FOUR' | 'CHESS' | 'CHECKERS' | 'QUICK_MATH';

// Map UI types to GraphQL types
const GAME_TYPE_TO_GRAPHQL: Record<MultiplayerGameType, GraphQLGameType> = {
  'TicTacToe': 'TIC_TAC_TOE',
  'ConnectFour': 'CONNECT_FOUR',
  'Chess': 'CHESS',
  'Checkers': 'CHECKERS',
  'QuickMath': 'QUICK_MATH',
};

// Map GraphQL types back to UI types (for normalizing responses)
const GRAPHQL_TO_GAME_TYPE: Record<GraphQLGameType | MultiplayerGameType, MultiplayerGameType> = {
  'TIC_TAC_TOE': 'TicTacToe',
  'CONNECT_FOUR': 'ConnectFour',
  'CHESS': 'Chess',
  'CHECKERS': 'Checkers',
  'QUICK_MATH': 'QuickMath',
  // Also handle already-normalized values
  'TicTacToe': 'TicTacToe',
  'ConnectFour': 'ConnectFour',
  'Chess': 'Chess',
  'Checkers': 'Checkers',
  'QuickMath': 'QuickMath',
};

/**
 * Normalize game type from GraphQL format to UI format
 * e.g., "CONNECT_FOUR" -> "ConnectFour"
 */
export function normalizeGameType(gameType: string | null | undefined): MultiplayerGameType {
  if (!gameType) return 'TicTacToe';
  return GRAPHQL_TO_GAME_TYPE[gameType as keyof typeof GRAPHQL_TO_GAME_TYPE] || 'TicTacToe';
}

export type MultiplayerGameStatus = 
  | 'WaitingForPlayer' 
  | 'WAITING_FOR_PLAYER'  // GraphQL enum format
  | 'InProgress' 
  | 'IN_PROGRESS'         // GraphQL enum format
  | 'Finished' 
  | 'FINISHED'            // GraphQL enum format
  | 'Draw' 
  | 'DRAW'                // GraphQL enum format
  | 'Forfeited' 
  | 'FORFEITED'           // GraphQL enum format
  | 'Abandoned'
  | 'ABANDONED';          // GraphQL enum format

export type MultiplayerPlayer = 'One' | 'Two' | 'ONE' | 'TWO';

export interface QuickMathState {
  round: number;
  totalRounds: number;
  currentProblem: string;
  correctAnswer: number;
  scores: [number, number];
  roundWinner: MultiplayerPlayer | null;
}

export interface TicTacToeBoard {
  cells: Array<{ player: MultiplayerPlayer | null }>;
}

export interface ConnectFourBoard {
  cells: Array<{ player: MultiplayerPlayer | null }>;
}

export interface ChessBoard {
  fen: string;
  moves: string[];
  board?: string[];  // 64 squares
  whiteTurn?: boolean;
  castling?: [boolean, boolean, boolean, boolean];
  enPassant?: number;
  halfmove?: number;
  fullmove?: number;
}

export interface CheckersBoard {
  squares: number[];  // 32 squares: 0=empty, 1=p1, 2=p2, 3=p1king, 4=p2king
  moves: string[];
}

export interface MultiplayerGameRoom {
  hostChainId: string;  // The HOST's chain ID (share this to join)
  gameType: MultiplayerGameType;
  playerChainIds: [string, string];  // [host_chain, joiner_chain]
  players: [string, string];
  usernames: [string, string];
  currentTurn: MultiplayerPlayer;
  status: MultiplayerGameStatus;
  winner: MultiplayerPlayer | null;
  createdAt: number;
  lastMoveAt: number;
  moveTimeoutSecs: number;
  // Board states (only one will be populated based on gameType)
  ticTacToeBoard: TicTacToeBoard | null;
  connectFourBoard: ConnectFourBoard | null;
  quickMathState: QuickMathState | null;
  chessBoard: ChessBoard | null;
  checkersBoard: CheckersBoard | null;
}

// =============================================================================
// GRAPHQL QUERIES (CROSS-CHAIN PATTERN)
// Each player queries their OWN chain's multiplayer_room state
// =============================================================================

// Get the multiplayer room on THIS chain (no parameters needed)
const GET_ROOM = `
  query Room {
    room {
      hostChainId
      gameType
      playerChainIds
      players
      usernames
      currentTurn
      status
      winner
      createdAt
      lastMoveAt
      moveTimeoutSecs
      ticTacToeBoard {
        cells {
          player
        }
      }
      connectFourBoard {
        cells {
          player
        }
      }
      quickMathState {
        round
        totalRounds
        currentProblem
        correctAnswer
        scores
        roundWinner
        seed
      }
      chessBoard {
        fen
        moves
        board
        whiteTurn
        castling
        enPassant
        halfmove
        fullmove
      }
      checkersBoard {
        squares
        moves
      }
    }
  }
`;

const GET_TIC_TAC_TOE_BOARD = `
  query TicTacToeBoard {
    ticTacToeBoard
  }
`;

const GET_CONNECT_FOUR_BOARD = `
  query ConnectFourBoard {
    connectFourBoard
  }
`;

const GET_QUICK_MATH_STATE = `
  query QuickMathState {
    room {
      quickMathState {
        round
        totalRounds
        currentProblem
        correctAnswer
        scores
        roundWinner
      }
    }
  }
`;

const IS_MY_TURN = `
  query IsMyTurn($wallet: String!) {
    isMyTurn(wallet: $wallet)
  }
`;

const ROOM_WAITING_FOR_PLAYER = `
  query {
    roomWaitingForPlayer
  }
`;

const MULTIPLAYER_GAME_STATUS = `
  query {
    multiplayerGameStatus
  }
`;

const HOST_CHAIN_ID = `
  query {
    hostChainId
  }
`;

// =============================================================================
// GRAPHQL MUTATIONS (CROSS-CHAIN PATTERN)
// =============================================================================

// Create a new room on THIS chain (becomes the host)
const CREATE_MULTIPLAYER_ROOM = `
  mutation CreateRoom($gameType: MultiplayerGameType!) {
    createMultiplayerRoom(gameType: $gameType)
  }
`;

// Join a room by host's chain ID (sends cross-chain message)
const JOIN_MULTIPLAYER_ROOM = `
  mutation JoinRoom($hostChainId: String!) {
    joinMultiplayerRoom(hostChainId: $hostChainId)
  }
`;

// Make moves (no roomId needed - operates on local room)
// Linera converts Operation::MakeMove { move_data } to mutation makeMove(moveData)
const MAKE_MOVE = `
  mutation MakeMove($moveData: MoveDataInput!) {
    makeMove(moveData: $moveData)
  }
`;

const FORFEIT_GAME = `
  mutation ForfeitGame {
    forfeitGame
  }
`;

const CLAIM_VICTORY_TIMEOUT = `
  mutation ClaimVictoryTimeout {
    claimVictoryTimeout
  }
`;

const LEAVE_ROOM = `
  mutation LeaveRoom {
    leaveRoom
  }
`;

const CLEAR_ROOM = `
  mutation ClearRoom {
    clearRoom
  }
`;

// =============================================================================
// QUERY FUNCTIONS (CROSS-CHAIN PATTERN)
// =============================================================================

/**
 * Normalize room data from GraphQL response
 * Converts SCREAMING_SNAKE_CASE enum values to PascalCase
 */
function normalizeRoom(room: MultiplayerGameRoom | null): MultiplayerGameRoom | null {
  if (!room) return null;
  return {
    ...room,
    gameType: normalizeGameType(room.gameType),
  };
}

/**
 * Get the current multiplayer game room state from THIS chain.
 * Both host and joiner call this on their own chain.
 * The room state is synced via cross-chain messages.
 */
export async function getMultiplayerRoom(): Promise<MultiplayerGameRoom | null> {
  try {
    console.log(`🔍 Querying local chain for room state...`);
    
    const result = await lineraAdapter.query<{ room: MultiplayerGameRoom | null }>(
      GET_ROOM
    );
    
    const normalizedRoom = normalizeRoom(result.room);
    
    if (normalizedRoom) {
      console.log(`✅ Got room state:`, normalizedRoom.status, `gameType: ${normalizedRoom.gameType}`, `host: ${normalizedRoom.hostChainId?.slice(0, 8)}...`);
    } else {
      console.log(`⚠️ No room on this chain`);
    }
    
    return normalizedRoom;
  } catch (error) {
    console.error('Failed to get multiplayer room:', error);
    return null;
  }
}

/**
 * Get the current multiplayer game room state WITH chain sync.
 * This syncs from validators first to ensure we have received any
 * cross-chain messages (like GameStateSync from host).
 * 
 * Use this when polling for room state after sending a cross-chain request.
 */
export async function getMultiplayerRoomSynced(): Promise<MultiplayerGameRoom | null> {
  try {
    console.log(`🔄 Syncing + querying local chain for room state...`);
    
    const result = await lineraAdapter.queryWithSync<{ room: MultiplayerGameRoom | null }>(
      GET_ROOM
    );
    
    const normalizedRoom = normalizeRoom(result.room);
    
    if (normalizedRoom) {
      console.log(`✅ Got synced room state:`, normalizedRoom.status, `gameType: ${normalizedRoom.gameType}`, `host: ${normalizedRoom.hostChainId?.slice(0, 8)}...`);
    } else {
      console.log(`⚠️ No room on this chain after sync`);
    }
    
    return normalizedRoom;
  } catch (error) {
    console.error('Failed to get multiplayer room (synced):', error);
    return null;
  }
}

/**
 * Legacy function - no longer needed in cross-chain pattern
 * @deprecated Use getMultiplayerRoom() instead
 */
export async function getWaitingRooms(_limit: number = 20): Promise<MultiplayerGameRoom[]> {
  console.warn('getWaitingRooms is deprecated in cross-chain pattern - share hostChainId directly');
  // In cross-chain pattern, there's no centralized room list
  // Players share their hostChainId directly with opponents
  return [];
}

/**
 * Legacy function - no longer needed
 * @deprecated
 */
export async function getPlayerRoomIds(_walletAddress: string): Promise<number[]> {
  console.warn('getPlayerRoomIds is deprecated in cross-chain pattern');
  return [];
}

/**
 * Legacy function - use joinMultiplayerRoom(hostChainId) instead
 * @deprecated
 */
export async function attemptDirectJoin(_roomChainId: string): Promise<{
  success: boolean;
  gameType?: MultiplayerGameType;
  opponentUsername?: string;
  error?: string;
}> {
  console.warn('attemptDirectJoin is deprecated - use joinMultiplayerRoom(hostChainId) instead');
  return { success: false, error: 'Deprecated - use hostChainId pattern' };
}

/**
 * Get simplified board state for TicTacToe (0=empty, 1=player1, 2=player2)
 */
export async function getTicTacToeBoard(): Promise<number[] | null> {
  try {
    const result = await lineraAdapter.query<{ ticTacToeBoard: number[] | null }>(
      GET_TIC_TAC_TOE_BOARD
    );
    return result.ticTacToeBoard || null;
  } catch (error) {
    console.error('Failed to get TicTacToe board:', error);
    return null;
  }
}

/**
 * Get simplified board state for ConnectFour
 */
export async function getConnectFourBoard(): Promise<number[] | null> {
  try {
    const result = await lineraAdapter.query<{ connectFourBoard: number[] | null }>(
      GET_CONNECT_FOUR_BOARD
    );
    return result.connectFourBoard || null;
  } catch (error) {
    console.error('Failed to get ConnectFour board:', error);
    return null;
  }
}

/**
 * Get Quick Math game state
 */
export async function getQuickMathState(): Promise<QuickMathState | null> {
  try {
    const result = await lineraAdapter.query<{ room: { quickMathState: QuickMathState | null } | null }>(
      GET_QUICK_MATH_STATE
    );
    return result.room?.quickMathState || null;
  } catch (error) {
    console.error('Failed to get QuickMath state:', error);
    return null;
  }
}

/**
 * Check if it's the player's turn
 */
export async function isMyTurn(walletAddress: string): Promise<boolean> {
  try {
    const result = await lineraAdapter.query<{ isMyTurn: boolean }>(
      IS_MY_TURN,
      { wallet: walletAddress }
    );
    return result.isMyTurn;
  } catch (error) {
    console.error('Failed to check turn:', error);
    return false;
  }
}

/**
 * Check if room is waiting for a player to join
 */
export async function isRoomWaitingForPlayer(): Promise<boolean> {
  try {
    const result = await lineraAdapter.query<{ roomWaitingForPlayer: boolean }>(
      ROOM_WAITING_FOR_PLAYER
    );
    return result.roomWaitingForPlayer;
  } catch (error) {
    console.error('Failed to check room status:', error);
    return false;
  }
}

/**
 * Get game status
 */
export async function getGameStatus(): Promise<MultiplayerGameStatus | null> {
  try {
    const result = await lineraAdapter.query<{ multiplayerGameStatus: MultiplayerGameStatus | null }>(
      MULTIPLAYER_GAME_STATUS
    );
    return result.multiplayerGameStatus;
  } catch (error) {
    console.error('Failed to get game status:', error);
    return null;
  }
}

/**
 * Get the host chain ID of the current room
 */
export async function getHostChainId(): Promise<string | null> {
  try {
    const result = await lineraAdapter.query<{ hostChainId: string | null }>(
      HOST_CHAIN_ID
    );
    return result.hostChainId;
  } catch (error) {
    console.error('Failed to get host chain ID:', error);
    return null;
  }
}

/**
 * Legacy function
 * @deprecated
 */
export async function getPlayerRooms(_hubChainId: string, _walletAddress: string): Promise<string[]> {
  console.warn('getPlayerRooms is deprecated in cross-chain pattern');
  return [];
}

/**
 * Legacy function
 * @deprecated
 */
export async function getTotalMultiplayerGames(_hubChainId?: string): Promise<number> {
  return 0;
}

// =============================================================================
// MUTATION FUNCTIONS (CROSS-CHAIN PATTERN)
// =============================================================================

/**
 * Create a new multiplayer room on THIS chain.
 * Returns the hostChainId (your chain ID) to share with opponents.
 */
export async function createMultiplayerRoom(
  gameType: MultiplayerGameType
): Promise<{ hostChainId: string }> {
  try {
    console.log(`🎮 Creating multiplayer room for ${gameType} on local chain...`);
    
    const walletAddress = lineraAdapter.getAddress();
    if (!walletAddress) {
      throw new Error('Wallet not connected');
    }
    
    // Check if there's an existing room that needs to be handled
    const existingRoom = await getMultiplayerRoom();
    if (existingRoom) {
      const existingStatus = normalizeStatus(existingRoom.status);
      const existingGameType = normalizeGameType(existingRoom.gameType);
      
      if (existingStatus === 'InProgress') {
        throw new Error(`You have an active ${existingGameType} game in progress. Please finish or forfeit it before creating a new room.`);
      }
      
      // Auto-clear finished/abandoned rooms
      if (existingStatus === 'Finished' || existingStatus === 'Draw' || 
          existingStatus === 'Forfeited' || existingStatus === 'Abandoned') {
        console.log(`🧹 Auto-clearing ${existingStatus} ${existingGameType} room...`);
        await clearRoom();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // Convert UI type to GraphQL enum (SCREAMING_SNAKE_CASE)
    const graphqlGameType = GAME_TYPE_TO_GRAPHQL[gameType];
    
    console.log(`📤 Sending mutation with gameType: ${graphqlGameType}`);
    
    // Create room on local chain
    await lineraAdapter.mutate(
      CREATE_MULTIPLAYER_ROOM,
      { gameType: graphqlGameType }
    );
    
    console.log('✅ Room creation mutation sent');
    
    // Poll until we get a room with the correct game type
    // This handles the case where a FINISHED room from a different game is being overwritten
    const maxAttempts = 10;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const room = await getMultiplayerRoom();
      
      if (room) {
        const roomGameType = normalizeGameType(room.gameType);
        const roomStatus = normalizeStatus(room.status);
        const isCorrectGameType = roomGameType === gameType;
        const isWaiting = isStatusWaitingForPlayer(room.status);
        
        console.log(`📊 Room check attempt ${attempt + 1}: gameType=${roomGameType}, status=${roomStatus}, expected=${gameType}`);
        
        // Room must have correct game type AND be in waiting status (not finished from old game)
        if (isCorrectGameType && isWaiting) {
          console.log(`✅ Created room for ${gameType}. Share this hostChainId: ${room.hostChainId}`);
          return { hostChainId: room.hostChainId };
        }
        
        // If we got a room with wrong game type or still finished, the chain hasn't processed yet
        if (!isCorrectGameType) {
          console.log(`⏳ Room has gameType=${roomGameType}, waiting for ${gameType}...`);
        }
        if (!isWaiting) {
          console.log(`⏳ Room status=${roomStatus}, waiting for WaitingForPlayer...`);
        }
      } else {
        console.log(`⏳ No room yet, attempt ${attempt + 1}/${maxAttempts}...`);
      }
    }
    
    throw new Error(`Room creation timed out. Expected game type: ${gameType}`);
  } catch (error) {
    console.error('Failed to create multiplayer room:', error);
    throw error;
  }
}

/**
 * Join a multiplayer room by host's chain ID.
 * Sends a cross-chain JoinRequest message to the host.
 */
export async function joinMultiplayerRoom(
  hostChainId: string
): Promise<void> {
  try {
    console.log(`🎮 Joining room at hostChainId: ${hostChainId}...`);
    
    await lineraAdapter.mutate(
      JOIN_MULTIPLAYER_ROOM,
      { hostChainId }
    );
    
    console.log('✅ Join request sent via cross-chain message');
    
    // Wait for cross-chain message to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Query local chain for the synced room state
    const room = await getMultiplayerRoom();
    if (room) {
      console.log(`✅ Room synced to local chain, status: ${room.status}`);
    } else {
      console.log('⏳ Waiting for room state to sync...');
    }
  } catch (error) {
    console.error('Failed to join room:', error);
    throw error;
  }
}

/**
 * Make a move in the game.
 * Operates on local chain's room, syncs to opponent via cross-chain message.
 * @param moveData - The move data specific to the game type
 */
export async function makeMove(
  moveData: {
    position?: number;        // For TicTacToe (0-8)
    column?: number;          // For ConnectFour (0-6)
    answer?: number;          // For QuickMath
    chess_move?: string;      // For Chess (algebraic notation)
    from_pos?: number;        // For Checkers
    to_pos?: number;          // For Checkers
  }
): Promise<void> {
  try {
    console.log(`🎮 Making move (input):`, moveData);
    
    // Build MoveDataInput for the contract
    // Contract expects: { primary: i32, secondary: Option<String> }
    let primary: number;
    let secondary: string | null = null;
    
    if (moveData.position !== undefined) {
      // TicTacToe: position 0-8
      primary = moveData.position;
    } else if (moveData.column !== undefined) {
      // ConnectFour: column 0-6
      primary = moveData.column;
    } else if (moveData.answer !== undefined) {
      // QuickMath: the answer
      primary = moveData.answer;
    } else if (moveData.chess_move !== undefined) {
      // Chess: primary can be 0, secondary is the move string
      primary = 0;
      secondary = moveData.chess_move;
    } else if (moveData.from_pos !== undefined && moveData.to_pos !== undefined) {
      // Checkers: from_pos as primary, to_pos encoded in secondary
      primary = moveData.from_pos;
      secondary = `${moveData.from_pos}-${moveData.to_pos}`;
    } else {
      throw new Error('Invalid move data');
    }
    
    // Send to contract
    const contractMoveData: { primary: number; secondary?: string | null } = { primary };
    if (secondary !== null) {
      contractMoveData.secondary = secondary;
    }
    
    console.log(`🎮 Sending to contract:`, contractMoveData);
    await lineraAdapter.mutate(MAKE_MOVE, { moveData: contractMoveData });
    
    console.log('✅ Move made successfully');
  } catch (error) {
    console.error('Failed to make move:', error);
    throw error;
  }
}

/**
 * Forfeit the current game.
 */
export async function forfeitGame(): Promise<void> {
  try {
    await lineraAdapter.mutate(FORFEIT_GAME, {});
    console.log('✅ Game forfeited');
  } catch (error) {
    console.error('Failed to forfeit game:', error);
    throw error;
  }
}

/**
 * Claim victory if opponent has timed out.
 */
export async function claimVictoryTimeout(): Promise<void> {
  try {
    await lineraAdapter.mutate(CLAIM_VICTORY_TIMEOUT, {});
    console.log('✅ Victory claimed due to timeout');
  } catch (error) {
    console.error('Failed to claim victory:', error);
    throw error;
  }
}

/**
 * Leave the current room.
 */
export async function leaveRoom(): Promise<void> {
  try {
    await lineraAdapter.mutate(LEAVE_ROOM, {});
    console.log('✅ Left room');
  } catch (error) {
    console.error('Failed to leave room:', error);
    throw error;
  }
}

/**
 * Force clear/reset stuck room state.
 * Use this when a room gets stuck (e.g., browser closed without leaving).
 */
export async function clearRoom(): Promise<void> {
  try {
    await lineraAdapter.mutate(CLEAR_ROOM, {});
    console.log('✅ Room cleared');
  } catch (error) {
    console.error('Failed to clear room:', error);
    throw error;
  }
}

/**
 * Claim rewards after game ends by syncing the chain to process RewardSync messages.
 * This triggers the chain to process any pending cross-chain messages including rewards.
 * Also syncs player data to backend for leaderboard/activity updates.
 * 
 * @param isWinner - Whether the player won
 * @param isDraw - Whether the game was a draw
 * @param gameType - The type of game played
 * @param opponentUsername - The opponent's username
 * @param hostChainId - The host chain ID (used as room code)
 * @returns Object with claimed XP and coins (based on game outcome)
 */
export async function claimMultiplayerRewards(
  isWinner: boolean, 
  isDraw: boolean, 
  gameType: MultiplayerGameType,
  opponentUsername?: string,
  hostChainId?: string
): Promise<{ xp: number; coins: number }> {
  try {
    console.log('🎁 Claiming multiplayer rewards...');
    
    // Sync the chain multiple times to ensure cross-chain messages are processed
    const chainId = lineraAdapter.getChainId();
    const walletAddress = lineraAdapter.getAddress();
    
    if (chainId) {
      // Sync 3 times with delays to ensure inbox is processed
      for (let i = 0; i < 3; i++) {
        await lineraAdapter.syncChain(chainId, 2);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Calculate expected rewards based on game outcome
    const gameRewards: Record<MultiplayerGameType, { winXp: number; winCoins: number; loseXp: number; loseCoins: number; drawXp: number }> = {
      'TicTacToe': { winXp: 50, winCoins: 25, loseXp: 25, loseCoins: 5, drawXp: 30 },
      'ConnectFour': { winXp: 75, winCoins: 40, loseXp: 30, loseCoins: 8, drawXp: 45 },
      'Chess': { winXp: 150, winCoins: 100, loseXp: 50, loseCoins: 15, drawXp: 100 },
      'Checkers': { winXp: 100, winCoins: 60, loseXp: 40, loseCoins: 12, drawXp: 70 },
      'QuickMath': { winXp: 60, winCoins: 30, loseXp: 25, loseCoins: 5, drawXp: 40 },
    };
    
    const rewards = gameRewards[gameType] || gameRewards['TicTacToe'];
    
    let xp: number;
    let coins: number;
    
    if (isDraw) {
      xp = rewards.drawXp;
      coins = Math.floor(rewards.drawXp / 5);
    } else if (isWinner) {
      xp = rewards.winXp;
      coins = rewards.winCoins;
    } else {
      xp = rewards.loseXp;
      coins = rewards.loseCoins;
    }
    
    console.log(`✅ Rewards claimed: ${xp} XP, ${coins} Coins`);
    
    // Sync to backend for leaderboard/activity updates
    if (walletAddress && opponentUsername && hostChainId) {
      try {
        console.log('📡 Syncing multiplayer result to backend...');
        const { backendApi } = await import('../api/backendApi');
        await backendApi.submitMultiplayerResult(
          walletAddress,
          gameType,
          hostChainId.slice(0, 16), // Use shortened hostChainId as room code
          isWinner,
          opponentUsername,
          xp,
          coins,
          chainId || undefined
        );
        console.log('✅ Multiplayer result synced to backend!');
      } catch (syncError) {
        console.warn('⚠️ Failed to sync to backend (rewards still on-chain):', syncError);
      }
    }
    
    return { xp, coins };
  } catch (error) {
    console.error('Failed to claim rewards:', error);
    throw error;
  }
}

// =============================================================================
// POLLING SERVICE
// =============================================================================

export interface GameStateCallback {
  (room: MultiplayerGameRoom | null, error?: Error): void;
}

/**
 * Polling-based game state subscription.
 * Queries THIS chain's multiplayer_room periodically.
 */
export class MultiplayerPollingService {
  private pollingInterval: number | null = null;
  private callback: GameStateCallback | null = null;
  private intervalMs: number = 500;
  private pollCount: number = 0;

  /**
   * Start polling for game state updates on local chain
   */
  startPolling(callback: GameStateCallback, intervalMs: number = 500) {
    this.stopPolling();
    
    this.callback = callback;
    this.intervalMs = intervalMs;
    this.pollCount = 0;

    // Immediately fetch once (with sync to get latest cross-chain state)
    this.poll(true);

    // Start interval polling
    this.pollingInterval = window.setInterval(() => {
      this.poll();
    }, this.intervalMs);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.callback = null;
    this.pollCount = 0;
  }

  /**
   * Perform a single poll
   * @param forceSync - If true, sync from validators before querying
   */
  private async poll(forceSync: boolean = false) {
    if (!this.callback) return;

    try {
      this.pollCount++;
      
      // Use synced query every 5th poll or when forced
      // This balances responsiveness with ensuring we get cross-chain messages
      const shouldSync = forceSync || (this.pollCount % 5 === 0);
      
      const room = shouldSync 
        ? await getMultiplayerRoomSynced() 
        : await getMultiplayerRoom();
      
      // Double-check callback still exists (might have been cleared during async operation)
      if (this.callback) {
        this.callback(room);
      }
    } catch (error) {
      // Only call callback if it still exists
      if (this.callback) {
        this.callback(null, error as Error);
      }
    }
  }

  /**
   * Change polling interval
   */
  setInterval(intervalMs: number) {
    if (this.pollingInterval !== null && this.callback) {
      clearInterval(this.pollingInterval);
      this.intervalMs = intervalMs;
      this.pollingInterval = window.setInterval(() => {
        this.poll();
      }, this.intervalMs);
    }
  }

  get isPolling(): boolean {
    return this.pollingInterval !== null;
  }
}

// Singleton instance
export const multiplayerPolling = new MultiplayerPollingService();

// =============================================================================
// CHAIN SYNC FUNCTIONS
// =============================================================================

/**
 * Sync the local chain to receive cross-chain messages (like rewards).
 * Call this after game ends to ensure rewards are received.
 */
export async function syncLocalChainForRewards(): Promise<void> {
  try {
    const chainId = lineraAdapter.getChainId();
    if (!chainId) {
      console.warn('Cannot sync - no chain connected');
      return;
    }
    
    console.log(`🔄 Syncing local chain ${chainId.slice(0, 8)} to receive rewards...`);
    
    // Sync multiple times to ensure all cross-chain messages are received
    for (let i = 0; i < 3; i++) {
      await lineraAdapter.syncChain(chainId, 2);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Chain synced for rewards');
  } catch (error) {
    console.error('Failed to sync chain for rewards:', error);
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert MultiplayerPlayer to player index (0 or 1)
 */
export function playerToIndex(player: MultiplayerPlayer): number {
  return player === 'One' || player === 'ONE' ? 0 : 1;
}

/**
 * Convert player index to MultiplayerPlayer
 */
export function indexToPlayer(index: number): MultiplayerPlayer {
  return index === 0 ? 'One' : 'Two';
}

/**
 * Format game type for display
 */
export function formatGameType(gameType: MultiplayerGameType): string {
  switch (gameType) {
    case 'TicTacToe': return 'Tic Tac Toe';
    case 'ConnectFour': return 'Connect Four';
    case 'Chess': return 'Chess';
    case 'Checkers': return 'Checkers';
    case 'QuickMath': return 'Quick Math';
    default: return gameType;
  }
}

/**
 * Format game status for display
 */
export function formatGameStatus(status: MultiplayerGameStatus): string {
  switch (status) {
    case 'WaitingForPlayer':
    case 'WAITING_FOR_PLAYER': 
      return 'Waiting for opponent...';
    case 'InProgress':
    case 'IN_PROGRESS':
      return 'Game in progress';
    case 'Finished':
    case 'FINISHED':
      return 'Game finished';
    case 'Draw':
    case 'DRAW':
      return 'Game ended in a draw';
    case 'Forfeited':
    case 'FORFEITED':
      return 'Game forfeited';
    case 'Abandoned':
    case 'ABANDONED':
      return 'Game abandoned';
    default: return status;
  }
}

/**
 * Check if room is waiting for a player (handles both camelCase and SCREAMING_SNAKE_CASE)
 */
export function isStatusWaitingForPlayer(status: MultiplayerGameStatus): boolean {
  return status === 'WaitingForPlayer' || status === 'WAITING_FOR_PLAYER';
}

/**
 * Check if lineraAdapter is connected
 */
export function isMultiplayerAvailable(): boolean {
  return lineraAdapter.isConnected() && lineraAdapter.isApplicationConnected();
}

/**
 * Normalize player enum (handles both camelCase and SCREAMING_SNAKE_CASE)
 */
export function normalizePlayer(player: MultiplayerPlayer | null): MultiplayerPlayer | null {
  if (!player) return null;
  if (player === 'ONE') return 'One';
  if (player === 'TWO') return 'Two';
  return player;
}

/**
 * Normalize status enum
 */
export function normalizeStatus(status: MultiplayerGameStatus): MultiplayerGameStatus {
  switch (status) {
    case 'WAITING_FOR_PLAYER': return 'WaitingForPlayer';
    case 'IN_PROGRESS': return 'InProgress';
    case 'FINISHED': return 'Finished';
    case 'DRAW': return 'Draw';
    case 'FORFEITED': return 'Forfeited';
    case 'ABANDONED': return 'Abandoned';
    default: return status;
  }
}
