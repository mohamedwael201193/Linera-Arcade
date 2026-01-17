/**
 * Crypto Price Service
 * 
 * Real-time BTC and ETH prices via Binance WebSocket
 * ✅ True real-time (tick-by-tick)
 * ✅ 100% free
 * ✅ No API key required
 * ✅ Works 24/7
 */

import WebSocket from 'ws';

export interface PriceData {
  symbol: string;
  price: number; // Price in USD cents (e.g., 9500000 = $95,000.00)
  timestamp: Date;
}

export interface CryptoPrice {
  btc: PriceData;
  eth: PriceData;
}

// Binance WebSocket endpoint
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws/btcusdt@trade/ethusdt@trade';

// Fallback REST API (for initial prices before WebSocket connects)
const BINANCE_REST_URL = 'https://api.binance.com/api/v3';

// Real-time price cache (updated by WebSocket)
let liveCache: { btc: number; eth: number; lastUpdate: number } = {
  btc: 0,
  eth: 0,
  lastUpdate: 0,
};

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;

/**
 * Connect to Binance WebSocket for real-time prices
 */
function connectWebSocket(): void {
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  console.log('🔌 Connecting to Binance WebSocket...');

  ws = new WebSocket(BINANCE_WS_URL);

  ws.on('open', () => {
    isConnecting = false;
    console.log('✅ Binance WebSocket connected - Real-time prices active');
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const trade = JSON.parse(data.toString()) as { s: string; p: string };
      const price = Math.round(parseFloat(trade.p) * 100); // Convert to cents
      
      if (trade.s === 'BTCUSDT') {
        liveCache.btc = price;
      } else if (trade.s === 'ETHUSDT') {
        liveCache.eth = price;
      }
      liveCache.lastUpdate = Date.now();
    } catch (err) {
      // Ignore parse errors (heartbeats, etc.)
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Binance WebSocket error:', error.message);
  });

  ws.on('close', () => {
    isConnecting = false;
    console.log('🔌 Binance WebSocket disconnected, reconnecting in 3s...');
    
    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    // Reconnect after 3 seconds
    reconnectTimeout = setTimeout(() => {
      connectWebSocket();
    }, 3000);
  });
}

/**
 * Fetch initial prices from Binance REST API (one-time, before WebSocket)
 */
async function fetchInitialPrices(): Promise<{ btc: number; eth: number }> {
  try {
    const [btcRes, ethRes] = await Promise.all([
      fetch(`${BINANCE_REST_URL}/ticker/price?symbol=BTCUSDT`),
      fetch(`${BINANCE_REST_URL}/ticker/price?symbol=ETHUSDT`),
    ]);

    if (!btcRes.ok || !ethRes.ok) {
      throw new Error('Binance REST API error');
    }

    const btcData = await btcRes.json() as { price: string };
    const ethData = await ethRes.json() as { price: string };

    return {
      btc: Math.round(parseFloat(btcData.price) * 100),
      eth: Math.round(parseFloat(ethData.price) * 100),
    };
  } catch (error) {
    console.error('Failed to fetch initial prices:', error);
    // Return zeros if initial fetch fails - WebSocket will update soon
    return { btc: 0, eth: 0 };
  }
}

/**
 * Initialize the price service
 */
async function initialize(): Promise<void> {
  // Fetch initial prices via REST API
  const initialPrices = await fetchInitialPrices();
  liveCache = { ...initialPrices, lastUpdate: Date.now() };
  console.log(`📊 Initial prices: BTC=$${(initialPrices.btc / 100).toFixed(2)}, ETH=$${(initialPrices.eth / 100).toFixed(2)}`);
  
  // Start WebSocket connection for real-time updates
  connectWebSocket();
}

/**
 * Get current prices from live cache
 */
function getLivePrices(): { btc: number; eth: number } {
  return { btc: liveCache.btc, eth: liveCache.eth };
}

/**
 * Get current BTC price in USD cents
 */
export async function getBTCPrice(): Promise<PriceData> {
  const prices = getLivePrices();
  return {
    symbol: 'BTC',
    price: prices.btc,
    timestamp: new Date(),
  };
}

/**
 * Get current ETH price in USD cents
 */
export async function getETHPrice(): Promise<PriceData> {
  const prices = getLivePrices();
  return {
    symbol: 'ETH',
    price: prices.eth,
    timestamp: new Date(),
  };
}

/**
 * Get both BTC and ETH prices
 */
export async function getAllPrices(): Promise<CryptoPrice> {
  const prices = getLivePrices();
  return {
    btc: { symbol: 'BTC', price: prices.btc, timestamp: new Date() },
    eth: { symbol: 'ETH', price: prices.eth, timestamp: new Date() },
  };
}

/**
 * Format price in cents to display string
 */
export function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Check if WebSocket is connected
 */
export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

/**
 * Get time since last price update (ms)
 */
export function getLastUpdateAge(): number {
  return Date.now() - liveCache.lastUpdate;
}

/**
 * Crypto Price Service singleton
 */
export const binanceService = {
  getBTCPrice,
  getETHPrice,
  getAllPrices,
  formatPrice,
  isConnected,
  getLastUpdateAge,
  initialize,
  
  /**
   * Get price for a specific asset
   */
  async getPrice(asset: 'BTC' | 'ETH'): Promise<PriceData> {
    return asset === 'BTC' ? getBTCPrice() : getETHPrice();
  },
};

// Auto-initialize when module loads
initialize().catch(console.error);

export default binanceService;
