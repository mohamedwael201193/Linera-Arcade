/**
 * Crypto Price Service
 * 
 * Real-time BTC and ETH prices via Coinbase WebSocket
 * ✅ True real-time prices (sub-second updates)
 * ✅ 100% free (no API key required)
 * ✅ Works globally (no geo restrictions like Binance)
 * ✅ Professional-grade exchange feed
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

// Coinbase WebSocket (works globally, no geo restrictions)
const COINBASE_WS_URL = 'wss://ws-feed.exchange.coinbase.com';

// Coinbase REST API for initial prices (fallback)
const COINBASE_BTC_API = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const COINBASE_ETH_API = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';

// Price cache (updated by WebSocket)
let priceCache: { btc: number; eth: number; lastUpdate: number } = {
  btc: 0,
  eth: 0,
  lastUpdate: 0,
};

// WebSocket state
let ws: WebSocket | null = null;
let reconnectTimeout: NodeJS.Timeout | null = null;
let isConnecting = false;
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Connect to Coinbase WebSocket for real-time prices
 */
function connectWebSocket(): void {
  if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
    return;
  }

  isConnecting = true;
  console.log('🔌 Connecting to Coinbase WebSocket...');

  ws = new WebSocket(COINBASE_WS_URL);

  ws.on('open', () => {
    isConnecting = false;
    console.log('✅ Coinbase WebSocket connected');

    // Subscribe to BTC-USD and ETH-USD ticker channel
    const subscribeMsg = {
      type: 'subscribe',
      product_ids: ['BTC-USD', 'ETH-USD'],
      channels: ['ticker'],
    };
    ws?.send(JSON.stringify(subscribeMsg));
    console.log('📡 Subscribed to BTC-USD & ETH-USD ticker');

    // Start heartbeat to keep connection alive
    startHeartbeat();
  });

  ws.on('message', (data: WebSocket.Data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'ticker' && msg.price) {
        const price = Math.round(parseFloat(msg.price) * 100);
        const prevPrice = msg.product_id === 'BTC-USD' ? priceCache.btc : priceCache.eth;
        
        if (msg.product_id === 'BTC-USD') {
          priceCache.btc = price;
        } else if (msg.product_id === 'ETH-USD') {
          priceCache.eth = price;
        }
        priceCache.lastUpdate = Date.now();

        // Log significant price changes (> $1)
        if (Math.abs(price - prevPrice) > 100) {
          const symbol = msg.product_id === 'BTC-USD' ? 'BTC' : 'ETH';
          const formatted = (price / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
          console.log('💰 ' + symbol + ': $' + formatted);
        }
      } else if (msg.type === 'subscriptions') {
        const channels = msg.channels?.map((c: { name: string }) => c.name).join(', ') || '';
        console.log('✅ Subscription confirmed: ' + channels);
      } else if (msg.type === 'error') {
        console.error('❌ Coinbase WS error:', msg.message);
      }
    } catch {
      // Ignore parse errors
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Coinbase WebSocket error:', error.message);
  });

  ws.on('close', (code, reason) => {
    isConnecting = false;
    stopHeartbeat();
    console.log('🔌 Coinbase WebSocket closed (' + code + '): ' + (reason || 'No reason'));
    
    // Clear any existing reconnect timeout
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
    }
    
    // Reconnect after 3 seconds
    reconnectTimeout = setTimeout(() => {
      console.log('🔄 Reconnecting to Coinbase WebSocket...');
      connectWebSocket();
    }, 3000);
  });
}

/**
 * Start heartbeat to keep WebSocket alive
 */
function startHeartbeat(): void {
  stopHeartbeat();
  
  // Check connection health every 30s
  heartbeatInterval = setInterval(() => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Check if we've received updates recently
      const age = Date.now() - priceCache.lastUpdate;
      if (age > 60000) {
        console.warn('⚠️ No price updates for 60s, reconnecting...');
        ws.close();
      }
    }
  }, 30000);
}

/**
 * Stop heartbeat
 */
function stopHeartbeat(): void {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

/**
 * Fetch initial prices from Coinbase REST API
 */
async function fetchInitialPrices(): Promise<{ btc: number; eth: number }> {
  try {
    const [btcRes, ethRes] = await Promise.all([
      fetch(COINBASE_BTC_API),
      fetch(COINBASE_ETH_API),
    ]);

    if (!btcRes.ok || !ethRes.ok) {
      throw new Error('Coinbase API error: BTC=' + btcRes.status + ', ETH=' + ethRes.status);
    }

    const btcData = await btcRes.json() as { data?: { amount: string } };
    const ethData = await ethRes.json() as { data?: { amount: string } };

    if (btcData.data?.amount && ethData.data?.amount) {
      return {
        btc: Math.round(parseFloat(btcData.data.amount) * 100),
        eth: Math.round(parseFloat(ethData.data.amount) * 100),
      };
    }

    throw new Error('Invalid response format');
  } catch (error) {
    console.warn('⚠️ Failed to fetch initial prices:', (error as Error).message);
    return { btc: 0, eth: 0 };
  }
}

/**
 * Initialize the price service
 */
async function initialize(): Promise<void> {
  console.log('📊 Initializing Coinbase real-time price service...');
  
  // Fetch initial prices via REST API (fast startup)
  const initialPrices = await fetchInitialPrices();
  if (initialPrices.btc > 0 && initialPrices.eth > 0) {
    priceCache = { ...initialPrices, lastUpdate: Date.now() };
    const btc = (initialPrices.btc / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const eth = (initialPrices.eth / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    console.log('✅ Initial prices: BTC=$' + btc + ', ETH=$' + eth);
  }
  
  // Connect WebSocket for real-time updates
  connectWebSocket();
}

/**
 * Get current prices from cache
 */
function getLivePrices(): { btc: number; eth: number } {
  return { btc: priceCache.btc, eth: priceCache.eth };
}

/**
 * Get current BTC price in USD cents
 */
export async function getBTCPrice(): Promise<PriceData> {
  const prices = getLivePrices();
  return {
    symbol: 'BTC',
    price: prices.btc,
    timestamp: new Date(priceCache.lastUpdate),
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
    timestamp: new Date(priceCache.lastUpdate),
  };
}

/**
 * Get both BTC and ETH prices
 */
export async function getAllPrices(): Promise<CryptoPrice> {
  const prices = getLivePrices();
  const timestamp = new Date(priceCache.lastUpdate);
  return {
    btc: { symbol: 'BTC', price: prices.btc, timestamp },
    eth: { symbol: 'ETH', price: prices.eth, timestamp },
  };
}

/**
 * Format price in cents to display string
 */
export function formatPrice(priceInCents: number): string {
  return '$' + (priceInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Check if prices are fresh (updated within last 30 seconds)
 */
export function isConnected(): boolean {
  return (Date.now() - priceCache.lastUpdate) < 30000;
}

/**
 * Get time since last price update (ms)
 */
export function getLastUpdateAge(): number {
  return Date.now() - priceCache.lastUpdate;
}

/**
 * Crypto Price Service singleton (Coinbase WebSocket-powered)
 */
export const coinbaseService = {
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

// Keep binanceService as alias for backward compatibility
export const binanceService = coinbaseService;

export default coinbaseService;
