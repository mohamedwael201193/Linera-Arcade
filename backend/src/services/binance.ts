/**
 * Binance Price Service
 * 
 * Fetches real-time BTC and ETH prices from Binance API.
 * Used for crypto prediction round creation and resolution.
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

const BINANCE_API_URL = 'https://api.binance.com/api/v3';

/**
 * Fetch current price for a symbol from Binance
 */
async function fetchPrice(symbol: string): Promise<number> {
  try {
    const response = await fetch(`${BINANCE_API_URL}/ticker/price?symbol=${symbol}USDT`);
    if (!response.ok) {
      throw new Error(`Binance API error: ${response.status}`);
    }
    const data = await response.json() as { price: string };
    // Convert to cents (multiply by 100)
    return Math.round(parseFloat(data.price) * 100);
  } catch (error) {
    console.error(`Error fetching ${symbol} price:`, error);
    throw error;
  }
}

/**
 * Get current BTC price in USD cents
 */
export async function getBTCPrice(): Promise<PriceData> {
  const price = await fetchPrice('BTC');
  return {
    symbol: 'BTC',
    price,
    timestamp: new Date(),
  };
}

/**
 * Get current ETH price in USD cents
 */
export async function getETHPrice(): Promise<PriceData> {
  const price = await fetchPrice('ETH');
  return {
    symbol: 'ETH',
    price,
    timestamp: new Date(),
  };
}

/**
 * Get both BTC and ETH prices
 */
export async function getAllPrices(): Promise<CryptoPrice> {
  const [btc, eth] = await Promise.all([getBTCPrice(), getETHPrice()]);
  return { btc, eth };
}

/**
 * Format price in cents to display string
 */
export function formatPrice(priceInCents: number): string {
  return `$${(priceInCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Binance Price Service singleton
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
