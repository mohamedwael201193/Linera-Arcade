/**
 * useLineraConnection Hook
 * 
 * Manages Linera connection state with Dynamic wallet integration.
 * Handles auto-connect when wallet becomes available and auto-disconnect on logout.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';
import { lineraAdapter, type LineraConnection } from '../lib/linera';

// Environment configuration
const FAUCET_URL = import.meta.env.VITE_LINERA_FAUCET_URL || 'https://faucet.testnet-conway.linera.net';
const APPLICATION_ID = import.meta.env.VITE_APPLICATION_ID;

/**
 * Connection state returned by the hook
 */
export interface LineraConnectionState {
  // Connection flags
  isConnecting: boolean;
  isConnected: boolean;
  isAppConnected: boolean;
  
  // Error state
  error: string | null;
  
  // Connection data
  connection: LineraConnection | null;
  walletAddress: string | null;
  chainId: string | null;
  
  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
}

/**
 * Hook for managing Linera blockchain connection
 */
export function useLineraConnection(): LineraConnectionState {
  // Dynamic wallet context
  const { primaryWallet } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();
  
  // Local state
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isAppConnected, setIsAppConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<LineraConnection | null>(null);
  
  // Track if we've attempted auto-connect
  const autoConnectAttempted = useRef(false);
  
  /**
   * Sync state from adapter
   */
  const syncState = useCallback(() => {
    setIsConnected(lineraAdapter.isConnected());
    setIsAppConnected(lineraAdapter.isApplicationConnected());
    setConnection(lineraAdapter.getConnection());
  }, []);
  
  /**
   * Connect to Linera
   */
  const connect = useCallback(async () => {
    // Validate prerequisites
    if (!primaryWallet) {
      setError('No wallet connected. Please connect your wallet first.');
      return;
    }
    
    if (!APPLICATION_ID) {
      setError('Application ID is not configured. Check VITE_APPLICATION_ID.');
      return;
    }
    
    // Start connection
    setIsConnecting(true);
    setError(null);
    
    try {
      console.log('🔗 Connecting to Linera...');
      
      // Step 1: Connect wallet to Linera network
      await lineraAdapter.connect(primaryWallet, FAUCET_URL);
      
      // Step 2: Connect to Arcade Hub application
      await lineraAdapter.connectApplication(APPLICATION_ID);
      
      // Update state
      syncState();
      console.log('✅ Connected to Linera Arcade Hub!');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      console.error('❌ Connection failed:', message);
      setError(message);
    } finally {
      setIsConnecting(false);
    }
  }, [primaryWallet, syncState]);
  
  /**
   * Disconnect from Linera
   */
  const disconnect = useCallback(() => {
    lineraAdapter.disconnect();
    setError(null);
    syncState();
    autoConnectAttempted.current = false;
  }, [syncState]);
  
  /**
   * Retry connection after error
   */
  const retry = useCallback(async () => {
    setError(null);
    await connect();
  }, [connect]);
  
  // Subscribe to adapter state changes
  useEffect(() => {
    const unsubscribe = lineraAdapter.subscribe(syncState);
    
    // Initial sync
    syncState();
    
    return unsubscribe;
  }, [syncState]);
  
  // Auto-connect when wallet becomes available
  useEffect(() => {
    if (
      isLoggedIn &&
      primaryWallet &&
      !isConnected &&
      !isConnecting &&
      !autoConnectAttempted.current
    ) {
      autoConnectAttempted.current = true;
      console.log('🔄 Auto-connecting to Linera...');
      connect();
    }
  }, [isLoggedIn, primaryWallet, isConnected, isConnecting, connect]);
  
  // Auto-disconnect when user logs out
  useEffect(() => {
    if (!isLoggedIn && isConnected) {
      console.log('👋 User logged out, disconnecting from Linera...');
      disconnect();
    }
  }, [isLoggedIn, isConnected, disconnect]);
  
  // Reset auto-connect flag when wallet changes
  useEffect(() => {
    autoConnectAttempted.current = false;
  }, [primaryWallet?.address]);
  
  return {
    isConnecting,
    isConnected,
    isAppConnected,
    error,
    connection,
    walletAddress: connection?.address ?? primaryWallet?.address?.toLowerCase() ?? null,
    chainId: connection?.chainId ?? null,
    connect,
    disconnect,
    retry,
  };
}
