/**
 * usePredictions Hook
 * 
 * Manages prediction market state including:
 * - Real-time crypto prices from Binance
 * - Crypto prediction rounds
 * - World events
 * - User predictions and coin balance
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { backendApi, CryptoPrice, CryptoRoundEntry, WorldEventEntry, PredictionEntry, CoinBalanceEntry, ActivityLogEntry } from '../lib/api/backendApi';
import { arcadeApi } from '../lib/arcade/arcadeApi';

/**
 * Get username from Dynamic Wallet user profile
 */
function getDynamicUsername(user: Record<string, unknown> | null): string | undefined {
  if (!user) return undefined;
  
  if (user.alias && typeof user.alias === 'string') {
    return user.alias;
  }
  
  const metadata = user.metadata as Record<string, unknown> | undefined;
  if (metadata?.username && typeof metadata.username === 'string') {
    return metadata.username;
  }
  
  if (user.firstName && typeof user.firstName === 'string') {
    return user.firstName;
  }
  
  return undefined;
}

// =============================================================================
// TYPES
// =============================================================================

export interface PredictionState {
  // Prices
  prices: {
    btc: CryptoPrice | null;
    eth: CryptoPrice | null;
  };
  pricesLoading: boolean;
  pricesError: string | null;

  // Crypto Rounds
  cryptoRounds: CryptoRoundEntry[];
  activeCryptoRounds: CryptoRoundEntry[];
  resolvedCryptoRounds: CryptoRoundEntry[];
  cryptoRoundsLoading: boolean;
  cryptoRoundsError: string | null;

  // World Events
  worldEvents: WorldEventEntry[];
  activeWorldEvents: WorldEventEntry[];
  resolvedWorldEvents: WorldEventEntry[];
  eventsLoading: boolean;
  eventsError: string | null;

  // User Data
  userPredictions: PredictionEntry[];
  coinBalance: CoinBalanceEntry | null;
  userLoading: boolean;
  userError: string | null;

  // Activity Feed
  activityFeed: ActivityLogEntry[];
  activityLoading: boolean;
  activityError: string | null;
}

export interface PredictionActions {
  // Price actions
  refreshPrices: () => Promise<void>;

  // Crypto round actions
  refreshCryptoRounds: () => Promise<void>;
  createCryptoRound: (asset: 'BTC' | 'ETH', durationSecs?: number) => Promise<CryptoRoundEntry | null>;
  placeCryptoPrediction: (roundId: number, direction: 'UP' | 'DOWN', coinsStaked: number) => Promise<boolean>;
  resolveCryptoRound: (roundId: number) => Promise<CryptoRoundEntry | null>;

  // World event actions
  refreshWorldEvents: () => Promise<void>;
  createWorldEvent: (title: string, description: string, category: string, outcomes: string[], durationSecs?: number) => Promise<WorldEventEntry | null>;
  placeEventPrediction: (eventId: number, outcome: string, coinsStaked: number) => Promise<boolean>;
  resolveWorldEvent: (eventId: number, correctOutcome: string) => Promise<WorldEventEntry | null>;

  // User actions
  refreshUserData: () => Promise<void>;
  claimDailyBonus: () => Promise<{ success: boolean; coins: number } | null>;

  // Activity actions
  refreshActivity: () => Promise<void>;

  // Full refresh
  refreshAll: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function usePredictions(walletAddress: string | null): PredictionState & PredictionActions {
  // Get Dynamic user for username
  const { user } = useDynamicContext();
  
  // =============================================================================
  // STATE
  // =============================================================================

  // Prices
  const [prices, setPrices] = useState<{ btc: CryptoPrice | null; eth: CryptoPrice | null }>({
    btc: null,
    eth: null,
  });
  const [pricesLoading, setPricesLoading] = useState(false);
  const [pricesError, setPricesError] = useState<string | null>(null);

  // Crypto Rounds
  const [cryptoRounds, setCryptoRounds] = useState<CryptoRoundEntry[]>([]);
  const [cryptoRoundsLoading, setCryptoRoundsLoading] = useState(false);
  const [cryptoRoundsError, setCryptoRoundsError] = useState<string | null>(null);

  // World Events
  const [worldEvents, setWorldEvents] = useState<WorldEventEntry[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  // User Data
  const [userPredictions, setUserPredictions] = useState<PredictionEntry[]>([]);
  const [coinBalance, setCoinBalance] = useState<CoinBalanceEntry | null>(null);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);

  // Activity Feed
  const [activityFeed, setActivityFeed] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  // Refs for intervals
  const priceIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // COMPUTED VALUES
  // =============================================================================

  const activeCryptoRounds = cryptoRounds.filter(r => r.status === 'ACTIVE');
  const resolvedCryptoRounds = cryptoRounds.filter(r => r.status === 'RESOLVED');
  const activeWorldEvents = worldEvents.filter(e => e.status === 'ACTIVE');
  const resolvedWorldEvents = worldEvents.filter(e => e.status === 'RESOLVED');

  // =============================================================================
  // PRICE ACTIONS
  // =============================================================================

  const refreshPrices = useCallback(async () => {
    setPricesLoading(true);
    setPricesError(null);
    try {
      const data = await backendApi.getPrices();
      setPrices({
        btc: data.btc,
        eth: data.eth,
      });
    } catch (err) {
      setPricesError(err instanceof Error ? err.message : 'Failed to fetch prices');
    } finally {
      setPricesLoading(false);
    }
  }, []);

  // =============================================================================
  // CRYPTO ROUND ACTIONS
  // =============================================================================

  const refreshCryptoRounds = useCallback(async () => {
    setCryptoRoundsLoading(true);
    setCryptoRoundsError(null);
    try {
      const rounds = await backendApi.getCryptoRounds();
      setCryptoRounds(rounds);
    } catch (err) {
      setCryptoRoundsError(err instanceof Error ? err.message : 'Failed to fetch rounds');
    } finally {
      setCryptoRoundsLoading(false);
    }
  }, []);

  const createCryptoRound = useCallback(async (asset: 'BTC' | 'ETH', durationSecs: number = 300): Promise<CryptoRoundEntry | null> => {
    try {
      const result = await backendApi.createCryptoRound(asset, durationSecs);
      await refreshCryptoRounds();
      return result.round;
    } catch (err) {
      console.error('Failed to create crypto round:', err);
      return null;
    }
  }, [refreshCryptoRounds]);

  const placeCryptoPrediction = useCallback(async (
    roundId: number,
    direction: 'UP' | 'DOWN',
    coinsStaked: number
  ): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      // Get Dynamic username for auto-registration if needed
      const dynamicUsername = getDynamicUsername(user as unknown as Record<string, unknown> | null);
      
      // Find the backend round data to pass to arcadeApi
      // This allows arcadeApi to create an on-chain round if needed
      const backendRound = cryptoRounds.find(r => r.id === roundId);
      
      // Calculate duration from start_time and end_time
      let durationSecs = 300; // default 5 minutes
      if (backendRound) {
        const startTime = new Date(backendRound.start_time).getTime();
        const endTime = new Date(backendRound.end_time).getTime();
        durationSecs = Math.floor((endTime - startTime) / 1000);
      }
      
      const backendRoundData = backendRound ? {
        asset: backendRound.asset,
        start_price: backendRound.start_price,
        duration_secs: durationSecs
      } : undefined;
      
      console.log(`🎰 Placing prediction on round ${roundId}, backend data:`, backendRoundData);
      
      // Use arcadeApi for on-chain signing - now with backend round data
      const success = await arcadeApi.placeCryptoPrediction(
        roundId, 
        direction, 
        coinsStaked, 
        dynamicUsername,
        backendRoundData
      );
      if (success) {
        // Refresh user data and rounds after placing prediction
        await Promise.all([refreshCryptoRounds(), refreshUserData()]);
      }
      return success;
    } catch (err) {
      console.error('Failed to place crypto prediction:', err);
      return false;
    }
  }, [walletAddress, user, cryptoRounds]);

  const resolveCryptoRound = useCallback(async (roundId: number): Promise<CryptoRoundEntry | null> => {
    try {
      const result = await backendApi.resolveCryptoRound(roundId);
      await Promise.all([refreshCryptoRounds(), refreshUserData(), refreshActivity()]);
      return result.round;
    } catch (err) {
      console.error('Failed to resolve crypto round:', err);
      return null;
    }
  }, []);

  // =============================================================================
  // WORLD EVENT ACTIONS
  // =============================================================================

  const refreshWorldEvents = useCallback(async () => {
    setEventsLoading(true);
    setEventsError(null);
    try {
      const events = await backendApi.getWorldEvents();
      setWorldEvents(events);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : 'Failed to fetch events');
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const createWorldEvent = useCallback(async (
    title: string,
    description: string,
    category: string,
    outcomes: string[],
    durationSecs: number = 86400
  ): Promise<WorldEventEntry | null> => {
    try {
      const result = await backendApi.createWorldEvent(title, description, category, outcomes, durationSecs);
      await refreshWorldEvents();
      return result.event;
    } catch (err) {
      console.error('Failed to create world event:', err);
      return null;
    }
  }, [refreshWorldEvents]);

  const placeEventPrediction = useCallback(async (
    eventId: number,
    outcome: string,
    coinsStaked: number
  ): Promise<boolean> => {
    if (!walletAddress) return false;
    try {
      // Find the backend event data to pass to arcadeApi
      // This allows arcadeApi to create an on-chain event if needed
      const backendEvent = worldEvents.find(e => e.id === eventId);
      
      const backendEventData = backendEvent ? {
        title: backendEvent.title,
        description: backendEvent.description,
        category: backendEvent.category,
        end_time: backendEvent.end_time
      } : undefined;
      
      console.log(`🌍 Placing prediction on event ${eventId}, backend data:`, backendEventData);
      
      // Use arcadeApi for on-chain signing - now with Dynamic username and backend event data
      const success = await arcadeApi.placeEventPrediction(eventId, outcome, coinsStaked, getDynamicUsername(user as unknown as Record<string, unknown> | null), backendEventData);
      if (success) {
        await Promise.all([refreshWorldEvents(), refreshUserData()]);
      }
      return success;
    } catch (err) {
      console.error('Failed to place event prediction:', err);
      return false;
    }
  }, [walletAddress, worldEvents, user]);

  const resolveWorldEvent = useCallback(async (eventId: number, correctOutcome: string): Promise<WorldEventEntry | null> => {
    try {
      const result = await backendApi.resolveWorldEvent(eventId, correctOutcome);
      await Promise.all([refreshWorldEvents(), refreshUserData(), refreshActivity()]);
      return result.event;
    } catch (err) {
      console.error('Failed to resolve world event:', err);
      return null;
    }
  }, []);

  // =============================================================================
  // USER ACTIONS
  // =============================================================================

  const refreshUserData = useCallback(async () => {
    if (!walletAddress) return;
    setUserLoading(true);
    setUserError(null);
    try {
      const [predictions, balance] = await Promise.all([
        backendApi.getUserPredictions(walletAddress),
        backendApi.getCoinBalance(walletAddress),
      ]);
      setUserPredictions(predictions);
      setCoinBalance(balance);
    } catch (err) {
      setUserError(err instanceof Error ? err.message : 'Failed to fetch user data');
    } finally {
      setUserLoading(false);
    }
  }, [walletAddress]);

  const claimDailyBonus = useCallback(async (): Promise<{ success: boolean; coins: number } | null> => {
    if (!walletAddress) return null;
    try {
      // Call on-chain claim first (requires wallet signature)
      const success = await arcadeApi.claimDailyBonus();
      if (success) {
        await refreshUserData();
        return { success: true, coins: 100 };
      }
      return { success: false, coins: 0 };
    } catch (err) {
      console.error('Failed to claim daily bonus:', err);
      return null;
    }
  }, [walletAddress, refreshUserData]);

  // =============================================================================
  // ACTIVITY ACTIONS
  // =============================================================================

  const refreshActivity = useCallback(async () => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const activities = await backendApi.getActivityFeed(50);
      setActivityFeed(activities);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : 'Failed to fetch activity');
    } finally {
      setActivityLoading(false);
    }
  }, []);

  // =============================================================================
  // FULL REFRESH
  // =============================================================================

  const refreshAll = useCallback(async () => {
    await Promise.all([
      refreshPrices(),
      refreshCryptoRounds(),
      refreshWorldEvents(),
      refreshActivity(),
      walletAddress ? refreshUserData() : Promise.resolve(),
    ]);
  }, [refreshPrices, refreshCryptoRounds, refreshWorldEvents, refreshActivity, refreshUserData, walletAddress]);

  // =============================================================================
  // EFFECTS
  // =============================================================================

  // Initial load
  useEffect(() => {
    refreshAll();
  }, []);

  // Refresh user data when wallet changes
  useEffect(() => {
    if (walletAddress) {
      refreshUserData();
    } else {
      setUserPredictions([]);
      setCoinBalance(null);
    }
  }, [walletAddress, refreshUserData]);

  // Auto-refresh prices every 10 seconds
  useEffect(() => {
    priceIntervalRef.current = setInterval(() => {
      refreshPrices();
    }, 10000);

    return () => {
      if (priceIntervalRef.current) {
        clearInterval(priceIntervalRef.current);
      }
    };
  }, [refreshPrices]);

  // =============================================================================
  // RETURN
  // =============================================================================

  return {
    // State
    prices,
    pricesLoading,
    pricesError,
    cryptoRounds,
    activeCryptoRounds,
    resolvedCryptoRounds,
    cryptoRoundsLoading,
    cryptoRoundsError,
    worldEvents,
    activeWorldEvents,
    resolvedWorldEvents,
    eventsLoading,
    eventsError,
    userPredictions,
    coinBalance,
    userLoading,
    userError,
    activityFeed,
    activityLoading,
    activityError,

    // Actions
    refreshPrices,
    refreshCryptoRounds,
    createCryptoRound,
    placeCryptoPrediction,
    resolveCryptoRound,
    refreshWorldEvents,
    createWorldEvent,
    placeEventPrediction,
    resolveWorldEvent,
    refreshUserData,
    claimDailyBonus,
    refreshActivity,
    refreshAll,
  };
}
