/**
 * DEPRECATED: Socket.IO multiplayer service
 * 
 * This file is deprecated. Multiplayer is now fully on-chain via Linera.
 * See onchain.ts for the new implementation.
 * 
 * This stub exists only to prevent build errors in legacy components.
 */

console.warn('[DEPRECATED] Socket.IO multiplayer is deprecated. Use on-chain multiplayer instead.');

class DeprecatedMultiplayerService {
  connect() {
    console.warn('[DEPRECATED] Socket.IO multiplayer is deprecated');
  }

  disconnect() {}

  on(_event: string, _callback: Function) {}
  off(_event: string, _callback: Function) {}

  createRoom(_gameType: string, _playerName: string, _wallet?: string) {
    console.warn('[DEPRECATED] Use on-chain createMultiplayerRoom instead');
  }

  joinRoom(_roomCode: string, _playerName: string, _wallet?: string) {
    console.warn('[DEPRECATED] Use on-chain joinMultiplayerRoom instead');
  }

  leaveRoom(_roomCode: string) {}
  setReady(_roomCode: string) {}
  sendAction(_roomCode: string, _action: any) {}
  requestRematch(_roomCode: string) {}

  get isConnected() {
    return false;
  }

  get socketId() {
    return 'deprecated';
  }

  getSocketId() {
    return 'deprecated';
  }
}

export const multiplayerService = new DeprecatedMultiplayerService();
