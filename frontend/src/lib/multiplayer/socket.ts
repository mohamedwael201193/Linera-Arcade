/**
 * Socket.IO client for multiplayer games
 */

import { io, Socket } from 'socket.io-client';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class MultiplayerService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    this.socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('🎮 Connected to multiplayer server');
    });

    this.socket.on('disconnect', () => {
      console.log('👋 Disconnected from multiplayer server');
    });

    // Forward all events to registered listeners
    const events = [
      'room-created',
      'player-joined',
      'player-left',
      'room-updated',
      'game-start',
      'game-updated',
      'game-over',
      'error',
    ];

    events.forEach(event => {
      this.socket!.on(event, (data: any) => {
        this.emit(event, data);
      });
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  // Event emitter pattern
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data));
  }

  // Room actions
  createRoom(gameType: string, playerName: string, wallet?: string) {
    this.socket?.emit('create-room', { gameType, playerName, wallet });
  }

  joinRoom(roomCode: string, playerName: string, wallet?: string) {
    this.socket?.emit('join-room', { roomCode, playerName, wallet });
  }

  leaveRoom(roomCode: string) {
    this.socket?.emit('leave-room', { roomCode });
  }

  setReady(roomCode: string) {
    this.socket?.emit('player-ready', { roomCode });
  }

  // Game actions
  sendAction(roomCode: string, action: any) {
    this.socket?.emit('game-action', { roomCode, action });
  }

  requestRematch(roomCode: string) {
    this.socket?.emit('rematch', { roomCode });
  }

  get isConnected() {
    return this.socket?.connected ?? false;
  }

  get socketId() {
    return this.socket?.id;
  }

  getSocketId() {
    return this.socket?.id;
  }
}

export const multiplayerService = new MultiplayerService();
