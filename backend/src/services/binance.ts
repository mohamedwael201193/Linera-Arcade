/**
 * Crypto Price Service
 * 
 * Fetches real-time BTC and ETH prices from multiple APIs with fallback.
 * Primary: CryptoCompare (reliable, no rate limits, no geo restrictions)
 * Fallback: Binance US API
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

// API URLs - using APIs that work globally
const CRYPTOCOMPARE_API_URL = 'https://min-api.cryptocompare.com/data';
const BINANCE_US_API_URL = 'https://api.binance.us/api/v3';

// Cache to avoid rate limiting
let priceCache: { btc: number; eth: number; timestamp: number } | null = null;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Fetch prices from CryptoCompare (most reliable, no geo restrictions)
 */
async function fetchFromCryptoCompare(): Promise<{ btc: number; eth: number }> {
  const response = await fetch(
    `${CRYPTOCOMPARE_API_URL}/pricemulti?fsyms=BTC,ETH&tsyms=USD`
  );
  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`);
  }
  const data = await response.json() as { BTC?: { USD: number }; ETH?: { USD: number } };
  
  if (!data.BTC?.USD || !data.ETH?.USD) {
    throw new Error('Invalid CryptoCompare response');
  }
  
  return {
    btc: Math.round(data.BTC.USD * 100),
    eth: Math.round(data.ETH.USD * 100),
  };
}

/**
 * Fetch prices from Binance US (fallback)
 */
async function fetchFromBinanceUS(): Promise<{ btc: number; eth: number }> {
  const [btcRes, ethRes] = await Promise.all([
    fetch(`${BINANCE_US_API_URL}/ticker/price?symbol=BTCUSD`),
    fetch(`${BINANCE_US_API_URL}/ticker/price?symbol=ETHUSD`),
  ]);
  
  if (!btcRes.ok || !ethRes.ok) {
    throw new Error(`Binance US API error`);
  }
  
  const btcData = await btcRes.json() as { price: string };
  const ethData = await ethRes.json() as { price: string };
  
  return {
    btc: Math.round(parseFloat(btcData.price) * 100),
    eth: Math.round(parseFloat(ethData.price) * 100),
  };
}

/**
 * Fetch all prices with caching and fallback
 */
async function fetchAllPrices(): Promise<{ btc: number; eth: number }> {
  // Check cache first
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return { btc: priceCache.btc, eth: priceCache.eth };
  }
  
  // Try CryptoCompare first (most reliable)
  try {
    const prices = await fetchFromCryptoCompare();
    priceCache = { ...prices, timestamp: Date.now() };
    return prices;
  } catch (ccError) {
    console.warn('CryptoCompare failed, trying Binance US:', ccError);
  }
  
  // Fallback to Binance US
  try {
    const prices = await fetchFromBinanceUS();
    priceCache = { ...prices, timestamp: Date.now() };
    return prices;
  } catch (binanceError) {
    console.error('Binance US also failed:', binanceError);
    
    // Return cached price if available (even if stale)
    if (priceCache) {
      console.warn('Using stale cached prices');
      return { btc: priceCache.btc, eth: priceCache.eth };
    }
    
    throw new Error('All price APIs failed and no cache available');
  }
}

/**
 * Get current BTC price in USD cents
 */
export async function getBTCPrice(): Promise<PriceData> {
  const prices = await fetchAllPrices();
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
  const prices = await fetchAllPrices();
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
  const prices = await fetchAllPrices();
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
 * Crypto Price Service singleton
 */
export const binanceService = {
  getBTCPrice,
  getETHPrice,
  getAllPrices,
  formatPrice,
  
  /**
   * Get price for a specific asset
   */
  async getPrice(asset: 'BTC' | 'ETH'): Promise<PriceData> {
    return asset === 'BTC' ? getBTCPrice() : getETHPrice();
  },
};

export default binanceService;
