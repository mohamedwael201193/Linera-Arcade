/**
 * useArcade Hook
 * 
 * Manages player data and score submission for the Arcade Hub.
 * Uses useLineraConnection for blockchain connectivity.
 */

import { useState, useEffect, useCallback } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { useLineraConnection } from './useLineraConnection';
import { arcadeApi, type Player, type GameType } from '../lib/arcade';

/**
 * Arcade state returned by the hook
 */
export interface ArcadeState {
  // Player data
  player: Player | null;
  isRegistered: boolean;
  
  // Loading/error states
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  
  // Connection info (from useLineraConnection)
  isConnected: boolean;
  isAppConnected: boolean;
  walletAddress: string | null;
  
  // Derived flags
  canSubmitScore: boolean;
  
  // Actions
  loadPlayer: () => Promise<void>;
  registerPlayer: (username: string) => Promise<boolean>;
  submitScore: (gameType: GameType | string, score: number, bonusData?: number) => Promise<boolean>;
  refreshPlayer: () => Promise<void>;
}

/**
 * Get username from Dynamic Wallet user profile
 * Checks alias first, then metadata.username, then firstName
 */
function getDynamicUsername(user: Record<string, unknown> | null): string | undefined {
  if (!user) return undefined;
  
  // Check alias first (most common)
  if (user.alias && typeof user.alias === 'string') {
    return user.alias;
  }
  
  // Check metadata.username (custom field from Dynamic Dashboard)
  const metadata = user.metadata as Record<string, unknown> | undefined;
  if (metadata?.username && typeof metadata.username === 'string') {
    return metadata.username;
  }
  
  // Fallback to firstName if available
  if (user.firstName && typeof user.firstName === 'string') {
    return user.firstName;
  }
  
  return undefined;
}

/**
 * Hook for player and score operations
 */
export function useArcade(): ArcadeState {
  // Get Dynamic user for username
  const { user } = useDynamicContext();
  
  // Get connection state
  const { 
    isConnected, 
    isAppConnected, 
    walletAddress,
    error: connectionError 
  } = useLineraConnection();
  
  // Local state
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  /**
   * Load player data from blockchain
   * If player not found but Dynamic username exists, auto-register
   */
  const loadPlayer = useCallback(async () => {
    if (!isAppConnected || !walletAddress) {
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const playerData = await arcadeApi.getPlayer(walletAddress);
      
      // If player not found, check if we have a Dynamic username to auto-register
      if (!playerData) {
        const dynamicUsername = getDynamicUsername(user as Record<string, unknown> | null);
        if (dynamicUsername) {
          console.log(`🔄 Player not found, auto-registering with Dynamic username: ${dynamicUsername}`);
          try {
            await arcadeApi.registerPlayer(dynamicUsername);
            console.log('✅ Auto-registered with Dynamic username!');
            // Fetch the newly registered player
            const newPlayerData = await arcadeApi.getPlayer(walletAddress);
            setPlayer(newPlayerData);
            return;
          } catch (regErr) {
            console.warn('⚠️ Auto-registration failed:', regErr);
            // Fall through to set player as null
          }
        }
      }
      
      setPlayer(playerData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load player';
      console.error('Failed to load player:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [isAppConnected, walletAddress, user]);
  
  /**
   * Register a new player
   */
  const registerPlayer = useCallback(async (
    username: string
  ): Promise<boolean> => {
    if (!isAppConnected) {
      setError('Not connected to application');
      return false;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`📝 Registering player: ${username}`);
      await arcadeApi.registerPlayer(username);
      // Reload player data after registration
      await loadPlayer();
      console.log('✅ Player registered successfully!');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to register';
      console.error('Registration failed:', message);
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isAppConnected, loadPlayer]);
  
  /**
   * Submit a game score (works for single-player and multiplayer games)
   */
  const submitScore = useCallback(async (
    gameType: GameType | string,
    score: number,
    bonusData?: number
  ): Promise<boolean> => {
    if (!isAppConnected) {
      setError('Not connected to application');
      return false;
    }
    
    if (!player) {
      setError('Please register before submitting scores');
      return false;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Get Dynamic username for auto-registration if needed
      const dynamicUsername = getDynamicUsername(user as Record<string, unknown> | null);
      console.log(`🎮 Submitting score: ${score} for ${gameType} (Dynamic username: ${dynamicUsername || 'none'})`);
      await arcadeApi.submitScore(gameType as GameType, score, bonusData, dynamicUsername);
      
      // Refresh player data to get updated XP
      await loadPlayer();
      
      console.log(`✅ Score submitted!`);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit score';
      console.error('Score submission failed:', message);
      setError(message);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [isAppConnected, player, loadPlayer, user]);
  
  /**
   * Refresh player data
   */
  const refreshPlayer = useCallback(async () => {
    await loadPlayer();
  }, [loadPlayer]);
  
  // Auto-load player when app connects (only once)
  useEffect(() => {
    if (isAppConnected && walletAddress && !hasLoaded && !isLoading) {
      setHasLoaded(true);
      loadPlayer();
    }
  }, [isAppConnected, walletAddress, hasLoaded, isLoading, loadPlayer]);
  
  // Clear player when disconnected
  useEffect(() => {
    if (!isConnected) {
      setPlayer(null);
      setError(null);
      setHasLoaded(false);
    }
  }, [isConnected]);
  
  // Combine errors
  const combinedError = error || connectionError;
  
  return {
    // Player data
    player,
    isRegistered: player !== null,
    
    // Loading states
    isLoading,
    isSubmitting,
    error: combinedError,
    
    // Connection info
    isConnected,
    isAppConnected,
    walletAddress,
    
    // Derived flags
    canSubmitScore: isAppConnected && player !== null && !isSubmitting,
    
    // Actions
    loadPlayer,
    registerPlayer,
    submitScore,
    refreshPlayer,
  };
}
