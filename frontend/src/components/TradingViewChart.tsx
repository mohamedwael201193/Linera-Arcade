/**
 * TradingView Chart Component
 * 
 * Embeds real TradingView charts for BTC/ETH price visualization
 * Uses the TradingView Widget for live market data
 */

import { useEffect, useRef, memo } from 'react';
import { CryptoAsset } from '../types';

interface TradingViewChartProps {
  asset: CryptoAsset;
  height?: number;
  theme?: 'dark' | 'light';
  interval?: string;
}

// TradingView widget script URL
const TRADINGVIEW_SCRIPT = 'https://s3.tradingview.com/tv.js';

// Symbol mapping for TradingView
const SYMBOL_MAP: Record<CryptoAsset, string> = {
  BTC: 'BINANCE:BTCUSDT',
  ETH: 'BINANCE:ETHUSDT',
};

export const TradingViewChart = memo(function TradingViewChart({
  asset,
  height = 400,
  theme = 'dark',
  interval = '5',
}: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Load TradingView script if not already loaded
    const loadScript = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).TradingView) {
          resolve();
          return;
        }

        if (scriptLoadedRef.current) {
          // Script is loading, wait for it
          const checkInterval = setInterval(() => {
            if ((window as any).TradingView) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          return;
        }

        scriptLoadedRef.current = true;
        const script = document.createElement('script');
        script.src = TRADINGVIEW_SCRIPT;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load TradingView script'));
        document.head.appendChild(script);
      });
    };

    const initWidget = async () => {
      try {
        await loadScript();
        
        if (!containerRef.current) return;
        
        // Clear previous widget
        containerRef.current.innerHTML = '';
        
        // Create widget
        new (window as any).TradingView.widget({
          container_id: containerRef.current.id,
          symbol: SYMBOL_MAP[asset],
          interval: interval,
          timezone: 'Etc/UTC',
          theme: theme,
          style: '1', // Candlestick
          locale: 'en',
          toolbar_bg: '#1a1a2e',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          height: height,
          width: '100%',
          hide_volume: false,
          backgroundColor: theme === 'dark' ? 'rgba(26, 26, 46, 1)' : 'rgba(255, 255, 255, 1)',
          gridColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
          studies: [
            'MASimple@tv-basicstudies',
            'RSI@tv-basicstudies',
          ],
          overrides: {
            'mainSeriesProperties.candleStyle.upColor': '#00ff00',
            'mainSeriesProperties.candleStyle.downColor': '#ff0000',
            'mainSeriesProperties.candleStyle.borderUpColor': '#00ff00',
            'mainSeriesProperties.candleStyle.borderDownColor': '#ff0000',
            'mainSeriesProperties.candleStyle.wickUpColor': '#00ff00',
            'mainSeriesProperties.candleStyle.wickDownColor': '#ff0000',
          },
        });
      } catch (error) {
        console.error('Failed to initialize TradingView widget:', error);
      }
    };

    initWidget();
  }, [asset, height, theme, interval]);

  const containerId = `tradingview_${asset.toLowerCase()}_${Date.now()}`;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700">
      <div
        id={containerId}
        ref={containerRef}
        style={{ height: `${height}px` }}
        className="bg-gray-900"
      />
    </div>
  );
});

// Mini chart for prediction cards
export const TradingViewMiniChart = memo(function TradingViewMiniChart({
  asset,
  height = 200,
}: {
  asset: CryptoAsset;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Use mini widget embed
    const symbol = asset === 'BTC' ? 'BTCUSD' : 'ETHUSD';
    containerRef.current.innerHTML = `
      <iframe
        scrolling="no"
        allowtransparency="true"
        frameborder="0"
        src="https://s.tradingview.com/embed-widget/mini-symbol-overview/?locale=en#%7B%22symbol%22%3A%22BINANCE%3A${symbol}T%22%2C%22width%22%3A%22100%25%22%2C%22height%22%3A${height}%2C%22dateRange%22%3A%221D%22%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22autosize%22%3Atrue%2C%22largeChartUrl%22%3A%22%22%7D"
        style="box-sizing: border-box; height: ${height}px; width: 100%;"
      ></iframe>
    `;
  }, [asset, height]);

  return (
    <div
      ref={containerRef}
      className="rounded-lg overflow-hidden"
      style={{ height: `${height}px` }}
    />
  );
});

// Ticker tape widget showing multiple crypto prices
export const TradingViewTicker = memo(function TradingViewTicker() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = `
      <iframe
        scrolling="no"
        allowtransparency="true"
        frameborder="0"
        src="https://s.tradingview.com/embed-widget/ticker-tape/?locale=en#%7B%22symbols%22%3A%5B%7B%22proName%22%3A%22BINANCE%3ABTCUSDT%22%2C%22title%22%3A%22Bitcoin%22%7D%2C%7B%22proName%22%3A%22BINANCE%3AETHUSDT%22%2C%22title%22%3A%22Ethereum%22%7D%2C%7B%22proName%22%3A%22BINANCE%3ASOLUSDT%22%2C%22title%22%3A%22Solana%22%7D%2C%7B%22proName%22%3A%22BINANCE%3ALINAUSDT%22%2C%22title%22%3A%22LINA%22%7D%5D%2C%22showSymbolLogo%22%3Atrue%2C%22colorTheme%22%3A%22dark%22%2C%22isTransparent%22%3Atrue%2C%22displayMode%22%3A%22adaptive%22%2C%22locale%22%3A%22en%22%7D"
        style="box-sizing: border-box; height: 46px; width: 100%;"
      ></iframe>
    `;
  }, []);

  return (
    <div
      ref={containerRef}
      className="border-b border-gray-700"
      style={{ height: '46px' }}
    />
  );
});

export default TradingViewChart;
