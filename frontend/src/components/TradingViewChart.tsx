/**
 * TradingView Chart Components
 * 
 * Embeds TradingView charts for BTC and ETH price visualization.
 */

import { memo } from 'react';

interface TradingViewMiniChartProps {
  asset: 'BTC' | 'ETH';
  height?: number;
}

/**
 * TradingView Mini Chart using iframe embed
 */
export const TradingViewMiniChart = memo(function TradingViewMiniChart({ 
  asset, 
  height = 300 
}: TradingViewMiniChartProps) {
  // TradingView symbol mapping
  const symbol = asset === 'BTC' ? 'BINANCE:BTCUSDT' : 'BINANCE:ETHUSDT';
  
  // TradingView widget URL with dark theme
  const widgetUrl = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${symbol}&interval=5&hidesidetoolbar=1&symboledit=0&saveimage=0&toolbarbg=1a1a2e&studies=[]&theme=dark&style=1&timezone=exchange&withdateranges=1&showpopupbutton=0&studies_overrides={}&overrides={}&enabled_features=[]&disabled_features=[]&showpopupbutton=0&locale=en&utm_source=&utm_medium=widget&utm_campaign=chart`;
  
  return (
    <div 
      className="w-full rounded-xl overflow-hidden border border-gray-700"
      style={{ height: `${height}px`, background: '#131722' }}
    >
      <iframe
        src={widgetUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        title={`${asset} Chart`}
      />
    </div>
  );
});

/**
 * Simple price ticker display (alternative to TradingView)
 */
interface TradingViewTickerProps {
  btcPrice: string;
  ethPrice: string;
}

export const TradingViewTicker = memo(function TradingViewTicker({ 
  btcPrice, 
  ethPrice 
}: TradingViewTickerProps) {
  return (
    <div className="flex gap-4">
      <div className="flex-1 bg-gradient-to-r from-orange-900/30 to-orange-800/20 rounded-xl p-4 border border-orange-500/30">
        <div className="flex items-center gap-2">
          <span className="text-orange-500 text-xl">₿</span>
          <div>
            <p className="text-xs text-gray-400">Bitcoin</p>
            <p className="text-xl font-bold text-orange-400">{btcPrice}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-gradient-to-r from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/30">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 text-xl">Ξ</span>
          <div>
            <p className="text-xs text-gray-400">Ethereum</p>
            <p className="text-xl font-bold text-blue-400">{ethPrice}</p>
          </div>
        </div>
      </div>
    </div>
  );
});

export default TradingViewMiniChart;
