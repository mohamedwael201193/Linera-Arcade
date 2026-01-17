/**
 * Crypto Price Service
 * 
 * Near real-time BTC and ETH prices via Coinbase REST API (polling)
 * ✅ Very reliable API
 * ✅ 100% free (no API key required)
 * ✅ Works globally (no geo restrictions)
 * ✅ Very generous rate limits for low-frequency polling
 * ✅ Works 24/7
 */

export interface PriceData {
  symbol: string;
  price: number; // Price in USD cents (e.g., 9500000 = $95,000.00)
  timestamp: Date;
}

export interface CryptoPrice {
  btc: PriceData;
  eth: PriceData;
}

// Coinbase API (free, reliable, global, no rate limits)
const COINBASE_BTC_API = 'https://api.coinbase.com/v2/prices/BTC-USD/spot';
const COINBASE_ETH_API = 'https://api.coinbase.com/v2/prices/ETH-USD/spot';

// Price cache (updated by polling)
let priceCache: { btc: number; eth: number; lastUpdate: number } = {
  btc: 0,
  eth: 0,
  lastUpdate: 0,
};

// Polling interval (3 seconds for near real-time)
const POLL_INTERVAL = 3000;
let pollTimer: NodeJS.Timeout | null = null;

/**
 * Fetch prices from Coinbase
 */
async function fetchPrices(): Promise<{ btc: number; eth: number }> {
  try {
    const [btcRes, ethRes] = await Promise.all([
      fetch(COINBASE_BTC_API),
      fetch(COINBASE_ETH_API),
    ]);

    if (!btcRes.ok || !ethRes.ok) {
      console.warn(`⚠️ Coinbase API error: BTC=${btcRes.status}, ETH=${ethRes.status}`);
      return { btc: priceCache.btc, eth: priceCache.eth };
    }

    const btcData = await btcRes.json() as { data?: { amount: string } };
    const ethData = await ethRes.json() as { data?: { amount: string } };

    if (btcData.data?.amount && ethData.data?.amount) {
      return {
        btc: Math.round(parseFloat(btcData.data.amount) * 100),
        eth: Math.round(parseFloat(ethData.data.amount) * 100),
      };
    }

    console.warn('⚠️ Coinbase returned invalid data');
    return { btc: priceCache.btc, eth: priceCache.eth };
  } catch (error) {
    console.warn('⚠️ Coinbase fetch failed:', (error as Error).message);
    return { btc: priceCache.btc, eth: priceCache.eth };
  }
}

/**
 * Update price cache
 */
async function updatePrices(): Promise<void> {
  const prices = await fetchPrices();
  
  if (prices.btc > 0 || prices.eth > 0) {
    const btcChanged = prices.btc !== priceCache.btc;
    const ethChanged = prices.eth !== priceCache.eth;
    
    priceCache = { ...prices, lastUpdate: Date.now() };
    
    // Only log when prices actually change
    if (btcChanged || ethChanged) {
      const btcStr = (prices.btc / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
      const ethStr = (prices.eth / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
      console.log(`💰 Prices: BTC=$${btcStr}, ETH=$${ethStr}`);
    }
  }
}

/**
 * Start price polling
 */
function startPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  
  console.log(`🔄 Starting Coinbase price polling every ${POLL_INTERVAL / 1000}s...`);
  
  // Poll every POLL_INTERVAL
  pollTimer = setInterval(updatePrices, POLL_INTERVAL);
}

/**
 * Initialize the price service
 */
async function initialize(): Promise<void> {
  console.log('📊 Initializing Coinbase price service...');
  
  // Fetch initial prices
  await updatePrices();
  
  if (priceCache.btc > 0 && priceCache.eth > 0) {
    const btc = (priceCache.btc / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    const eth = (priceCache.eth / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
    console.log(`✅ Initial prices: BTC=$${btc}, ETH=$${eth}`);
  } else {
    console.warn('⚠️ Initial prices unavailable, will retry...');
  }
  
  // Start polling for updates
  startPolling();
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
 * Crypto Price Service singleton (Coinbase-powered)
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
