/**
 * Multiplayer Games Index
 * 
 * Turn-based games (On-Chain via Linera):
 * - TicTacToe, ConnectFour, Chess, Checkers, QuickMath
 * 
 * REMOVED (Speed-based, incompatible with on-chain):
 * - ReactionDuel, EmojiRace, WordDuel, RockPaperScissors
 */

// Legacy WebSocket versions (deprecated)
export { TicTacToeGame } from './TicTacToe';
export { WordDuelGame } from './WordDuel';
export { ReactionDuelGame } from './ReactionDuel';
export { default as RockPaperScissors } from './RockPaperScissors';
export { default as QuickMath } from './QuickMath';
export { default as ConnectFour } from './ConnectFour';
export { default as EmojiRace } from './EmojiRace';
export { default as Chess } from './Chess';
export { default as Checkers } from './Checkers';

// On-Chain versions (new - fully decentralized)
export { TicTacToeOnChain } from './TicTacToeOnChain';
export { ConnectFourOnChain } from './ConnectFourOnChain';
export { QuickMathOnChain } from './QuickMathOnChain';
export { ChessOnChain } from './ChessOnChain';
export { CheckersOnChain } from './CheckersOnChain';

// Game types that support on-chain multiplayer
export const ONCHAIN_MULTIPLAYER_GAMES = [
  'TicTacToe',
  'ConnectFour', 
  'Chess',
  'Checkers',
  'QuickMath',
] as const;

export type OnChainMultiplayerGameType = typeof ONCHAIN_MULTIPLAYER_GAMES[number];

// Helper to check if a game type is on-chain compatible
export function isOnChainGame(gameType: string): boolean {
  return ONCHAIN_MULTIPLAYER_GAMES.includes(gameType as OnChainMultiplayerGameType);
}
