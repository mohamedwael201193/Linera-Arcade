/**
 * Predictions Page
 * 
 * Main predictions hub with:
 * - Real-time crypto price predictions (BTC/ETH)
 * - World events predictions
 * - User's prediction history
 * - Coin balance display with daily bonus
 * - TradingView charts for price visualization
 */

import { useState, useEffect } from 'react';
import { usePredictions } from '../hooks/usePredictions';
import { useArcade } from '../hooks/useArcade';
import { formatCoins, formatPrice, getAssetColor, CryptoAsset } from '../types';
import { CryptoRoundEntry, WorldEventEntry } from '../lib/api/backendApi';
import { TradingViewMiniChart, TradingViewTicker } from '../components/TradingViewChart';

// Tab types
type TabType = 'crypto' | 'events' | 'my-predictions';

// Prediction amount options
const PREDICTION_AMOUNTS = [10, 25, 50, 100, 250];

// Countdown hook for real-time updates
function useCountdown(endTimeStr: string | undefined) {
  const [timeLeft, setTimeLeft] = useState({ minutes: 0, seconds: 0, total: 0, expired: false });

  useEffect(() => {
    if (!endTimeStr) {
      setTimeLeft({ minutes: 5, seconds: 0, total: 300000, expired: false });
      return;
    }

    const endTime = new Date(endTimeStr).getTime();
    if (isNaN(endTime)) {
      setTimeLeft({ minutes: 5, seconds: 0, total: 300000, expired: false });
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const diff = endTime - now;
      
      if (diff <= 0) {
        setTimeLeft({ minutes: 0, seconds: 0, total: 0, expired: true });
        return;
      }
      
      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft({ minutes, seconds, total: diff, expired: false });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [endTimeStr]);

  return timeLeft;
}

// Countdown display component
function CountdownDisplay({ endTime, size = 'normal' }: { endTime: string | undefined; size?: 'normal' | 'large' }) {
  const { minutes, seconds, expired } = useCountdown(endTime);
  
  if (expired) {
    return <span className="text-red-400 animate-pulse">ENDED</span>;
  }
  
  const textClass = size === 'large' ? 'text-2xl font-bold' : 'text-sm';
  const colorClass = minutes < 1 ? 'text-red-400 animate-pulse' : minutes < 3 ? 'text-yellow-400' : 'text-cyan-400';
  
  return (
    <span className={`${textClass} ${colorClass}`}>
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}

export function PredictionsPage() {
  const { walletAddress, isRegistered } = useArcade();
  const predictions = usePredictions(walletAddress);
  
  const [activeTab, setActiveTab] = useState<TabType>('crypto');
  const [selectedRound, setSelectedRound] = useState<CryptoRoundEntry | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WorldEventEntry | null>(null);
  const [predictionAmount, setPredictionAmount] = useState(25);
  const [isPlacingPrediction, setIsPlacingPrediction] = useState(false);
  const [chartAsset, setChartAsset] = useState<CryptoAsset>('BTC');

  // Auto-refresh rounds AND user predictions every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      predictions.refreshCryptoRounds();
      predictions.refreshWorldEvents();
      predictions.refreshUserData(); // Also refresh user predictions to get updated statuses
    }, 15000);
    return () => clearInterval(interval);
  }, [predictions.refreshCryptoRounds, predictions.refreshWorldEvents, predictions.refreshUserData]);

  // Auto-select first active round/event
  useEffect(() => {
    if (predictions.activeCryptoRounds.length > 0 && !selectedRound) {
      const firstRound = predictions.activeCryptoRounds[0];
      if (firstRound) {
        setSelectedRound(firstRound);
      }
    }
  }, [predictions.activeCryptoRounds, selectedRound]);

  useEffect(() => {
    if (predictions.activeWorldEvents.length > 0 && !selectedEvent) {
      const firstEvent = predictions.activeWorldEvents[0];
      if (firstEvent) {
        setSelectedEvent(firstEvent);
      }
    }
  }, [predictions.activeWorldEvents, selectedEvent]);

  // Update chart asset when selecting a round
  useEffect(() => {
    if (selectedRound) {
      setChartAsset(selectedRound.asset as CryptoAsset);
    }
  }, [selectedRound]);

  // Handle placing crypto prediction
  const handleCryptoPrediction = async (direction: 'UP' | 'DOWN') => {
    if (!selectedRound || !walletAddress || isPlacingPrediction) return;
    
    setIsPlacingPrediction(true);
    try {
      const success = await predictions.placeCryptoPrediction(selectedRound.id, direction, predictionAmount);
      if (success) {
        alert(`🎯 Prediction placed! You bet ${predictionAmount} coins on ${direction}`);
        // Refresh user data to show the prediction
        predictions.refreshUserData();
        predictions.refreshCryptoRounds();
      } else {
        alert('Failed to place prediction. Please try again.');
      }
    } catch (error) {
      console.error('Failed to place prediction:', error);
      alert('Failed to place prediction. Please try again.');
    } finally {
      setIsPlacingPrediction(false);
    }
  };

  // Handle placing event prediction
  const handleEventPrediction = async (outcome: string) => {
    if (!selectedEvent || !walletAddress || isPlacingPrediction) return;
    
    setIsPlacingPrediction(true);
    try {
      const success = await predictions.placeEventPrediction(selectedEvent.id, outcome, predictionAmount);
      if (success) {
        alert(`🎯 Prediction placed! You bet ${predictionAmount} coins on "${outcome}"`);
        predictions.refreshUserData();
        predictions.refreshWorldEvents();
      } else {
        alert('Failed to place prediction. Please try again.');
      }
    } catch (error) {
      console.error('Failed to place prediction:', error);
      alert('Failed to place prediction. Please try again.');
    } finally {
      setIsPlacingPrediction(false);
    }
  };

  // Handle claiming daily bonus
  const handleClaimBonus = async () => {
    if (!walletAddress) {
      alert('Please connect your wallet first!');
      return;
    }
    try {
      const result = await predictions.claimDailyBonus();
      if (result?.success) {
        alert(`🎉 Claimed ${result.coins} coins! Your balance has been updated.`);
        predictions.refreshUserData();
      } else {
        alert('Failed to claim bonus. You may have already claimed today.');
      }
    } catch (error) {
      console.error('Failed to claim bonus:', error);
      alert('Failed to claim bonus. Please try again.');
    }
  };

  // Render header with coin balance
  const renderHeader = () => (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
      <div>
        <h1 className="text-4xl font-bold text-white mb-2">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">
            Predictions
          </span>
        </h1>
        <p className="text-gray-400">Predict crypto prices and world events to earn coins</p>
      </div>
      
      {walletAddress && (
        <div className="flex items-center gap-4">
          {/* Coin Balance */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-yellow-500/30">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🪙</span>
              <div>
                <p className="text-xs text-gray-400">Balance</p>
                <p className="text-xl font-bold text-yellow-400">
                  {predictions.coinBalance ? formatCoins(predictions.coinBalance.balance) : '0'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Daily Bonus Button - Always visible */}
          <button
            onClick={handleClaimBonus}
            disabled={predictions.coinBalance !== null && !predictions.coinBalance.canClaimDaily}
            className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg ${
              predictions.coinBalance === null || predictions.coinBalance.canClaimDaily
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-green-500/25 animate-pulse'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            🎁 {predictions.coinBalance === null || predictions.coinBalance.canClaimDaily ? 'Claim Daily Bonus (+100)' : 'Bonus Claimed Today'}
          </button>
        </div>
      )}
    </div>
  );

  // Render tabs
  const renderTabs = () => (
    <div className="flex gap-2 mb-6 border-b border-gray-700">
      {[
        { id: 'crypto' as TabType, label: '₿ Crypto', icon: '📈' },
        { id: 'events' as TabType, label: 'Events', icon: '🌍' },
        { id: 'my-predictions' as TabType, label: 'My Predictions', icon: '📋' },
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`px-6 py-3 font-medium transition-all duration-200 border-b-2 -mb-[2px] ${
            activeTab === tab.id
              ? 'text-white border-cyan-400'
              : 'text-gray-400 border-transparent hover:text-gray-200 hover:border-gray-600'
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );

  // Render real-time prices
  const renderPrices = () => (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {/* BTC Price */}
      <div className="bg-gradient-to-br from-orange-900/30 to-orange-800/20 rounded-xl p-4 border border-orange-500/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl">₿</span>
          <div>
            <p className="text-xs text-gray-400">Bitcoin</p>
            <p className="text-2xl font-bold text-orange-400">
              {predictions.prices.btc ? predictions.prices.btc.formatted : 'Loading...'}
            </p>
          </div>
        </div>
      </div>
      
      {/* ETH Price */}
      <div className="bg-gradient-to-br from-blue-900/30 to-blue-800/20 rounded-xl p-4 border border-blue-500/30">
        <div className="flex items-center gap-3">
          <span className="text-3xl">Ξ</span>
          <div>
            <p className="text-xs text-gray-400">Ethereum</p>
            <p className="text-2xl font-bold text-blue-400">
              {predictions.prices.eth ? predictions.prices.eth.formatted : 'Loading...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render crypto prediction interface
  const renderCryptoTab = () => (
    <div className="space-y-6">
      {/* TradingView Ticker */}
      <TradingViewTicker />
      
      {renderPrices()}
      
      {/* Chart Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setChartAsset('BTC')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            chartAsset === 'BTC'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          ₿ BTC Chart
        </button>
        <button
          onClick={() => setChartAsset('ETH')}
          className={`px-4 py-2 rounded-lg font-medium transition-all ${
            chartAsset === 'ETH'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Ξ ETH Chart
        </button>
      </div>
      
      {/* TradingView Mini Chart */}
      <TradingViewMiniChart asset={chartAsset} height={250} />
      
      {/* Active Rounds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Round Selection */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Active Rounds</h3>
          
          {predictions.activeCryptoRounds.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center">
              <p className="text-gray-400">No active rounds</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.activeCryptoRounds.map((round) => {
                const isSelected = selectedRound?.id === round.id;
                
                return (
                  <button
                    key={round.id}
                    onClick={() => setSelectedRound(round)}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      isSelected
                        ? 'bg-gray-700/50 border-cyan-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span style={{ color: getAssetColor(round.asset as 'BTC' | 'ETH') }}>
                          {round.asset === 'BTC' ? '₿' : 'Ξ'}
                        </span>
                        <span className="font-medium text-white">{round.asset}/USD</span>
                      </div>
                      {/* Real-time countdown */}
                      <CountdownDisplay endTime={round.end_time} />
                    </div>
                    <div className="mt-2 text-sm text-gray-400">
                      Start: {formatPrice(round.start_price)}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                        UP: {formatCoins(round.total_up || 0)}
                      </span>
                      <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">
                        DOWN: {formatCoins(round.total_down || 0)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Prediction Panel */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Make Prediction</h3>
          
          {!walletAddress ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Connect wallet to predict</p>
            </div>
          ) : !isRegistered ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Register to start predicting</p>
            </div>
          ) : !selectedRound ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Select a round to predict</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected Round Info */}
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Asset</span>
                  <span className="text-white font-medium">{selectedRound.asset}/USD</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Start Price</span>
                  <span className="text-white font-medium">{formatPrice(selectedRound.start_price)}</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Current</span>
                  <span className="text-cyan-400 font-medium">
                    {selectedRound.asset === 'BTC' 
                      ? predictions.prices.btc?.formatted || 'Loading...'
                      : predictions.prices.eth?.formatted || 'Loading...'
                    }
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-gray-400">Time Left</span>
                  <CountdownDisplay endTime={selectedRound.end_time} size="large" />
                </div>
              </div>
              
              {/* Amount Selection */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Stake Amount</label>
                <div className="flex gap-2 flex-wrap">
                  {PREDICTION_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPredictionAmount(amount)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        predictionAmount === amount
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      🪙 {amount}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* UP/DOWN Buttons */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button
                  onClick={() => handleCryptoPrediction('UP')}
                  disabled={isPlacingPrediction || (predictions.coinBalance?.balance || 0) < predictionAmount}
                  className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>📈</span> UP
                </button>
                <button
                  onClick={() => handleCryptoPrediction('DOWN')}
                  disabled={isPlacingPrediction || (predictions.coinBalance?.balance || 0) < predictionAmount}
                  className="py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>📉</span> DOWN
                </button>
              </div>
              
              {(predictions.coinBalance?.balance || 0) < predictionAmount && (
                <p className="text-center text-sm text-red-400">
                  Insufficient balance. Play games to earn more coins!
                </p>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Recent Results Section */}
      {predictions.resolvedCryptoRounds && predictions.resolvedCryptoRounds.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-400 rounded-full"></span>
            Recent Round Results
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictions.resolvedCryptoRounds.slice(0, 6).map((round) => {
              const resultDir = round.result === 'UP' ? 'UP' : 'DOWN';
              const priceChange = round.end_price != null && round.start_price 
                ? ((round.end_price - round.start_price) / round.start_price * 100)
                : 0;
              
              return (
                <div 
                  key={round.id}
                  className={`p-4 rounded-xl border ${
                    resultDir === 'UP' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: getAssetColor(round.asset as 'BTC' | 'ETH') }}>
                        {round.asset === 'BTC' ? '₿' : 'Ξ'}
                      </span>
                      <span className="text-white font-medium">{round.asset}/USD</span>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm font-bold ${
                      resultDir === 'UP' 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {resultDir === 'UP' ? '📈 UP' : '📉 DOWN'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Start</span>
                      <span className="text-gray-300">{formatPrice(round.start_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">End</span>
                      <span className="text-gray-300">{round.end_price != null ? formatPrice(round.end_price) : '--'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Change</span>
                      <span className={priceChange >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between text-xs text-gray-500">
                    <span>Round #{round.id}</span>
                    <span>{new Date(round.end_time).toLocaleTimeString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  // Render events tab
  const renderEventsTab = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Event List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Active Events</h3>
          
          {predictions.activeWorldEvents.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center">
              <p className="text-gray-400">No active events</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon for new predictions!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {predictions.activeWorldEvents.map((event) => {
                const isSelected = selectedEvent?.id === event.id;
                
                return (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`w-full p-4 rounded-xl border transition-all duration-200 text-left ${
                      isSelected
                        ? 'bg-gray-700/50 border-purple-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-white">{event.title}</span>
                      {/* Real-time countdown */}
                      <CountdownDisplay endTime={event.end_time} />
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">{event.description}</p>
                    <div className="mt-2 flex gap-2 flex-wrap">
                      {(event.outcomes || []).map((outcome, idx) => (
                        <span key={idx} className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                          {outcome}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Event Prediction Panel */}
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Predict Outcome</h3>
          
          {!walletAddress ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Connect wallet to predict</p>
            </div>
          ) : !selectedEvent ? (
            <div className="text-center py-8">
              <p className="text-gray-400">Select an event to predict</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Selected Event Info */}
              <div className="p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-medium text-white">{selectedEvent.title}</h4>
                <p className="text-sm text-gray-400 mt-1">{selectedEvent.description}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
                  {selectedEvent.category}
                </span>
              </div>
              
              {/* Amount Selection */}
              <div>
                <label className="text-sm text-gray-400 block mb-2">Stake Amount</label>
                <div className="flex gap-2 flex-wrap">
                  {PREDICTION_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPredictionAmount(amount)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        predictionAmount === amount
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      🪙 {amount}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Outcome Buttons */}
              <div className="space-y-2 mt-4">
                <label className="text-sm text-gray-400 block">Choose Outcome</label>
                {(selectedEvent.outcomes || []).map((outcome, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleEventPrediction(outcome)}
                    disabled={isPlacingPrediction || (predictions.coinBalance?.balance || 0) < predictionAmount}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-medium transition-all duration-200"
                  >
                    {outcome}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Helper to find round/event info for a prediction
  const getRoundInfoForPrediction = (pred: any) => {
    if (pred.prediction_type === 'CRYPTO') {
      // Look in both active and resolved rounds
      const allRounds = [...predictions.activeCryptoRounds, ...(predictions.resolvedCryptoRounds || [])];
      return allRounds.find(r => r.id === pred.reference_id);
    }
    return null;
  };
  
  const getEventInfoForPrediction = (pred: any) => {
    if (pred.prediction_type === 'EVENT') {
      const allEvents = [...predictions.activeWorldEvents, ...(predictions.resolvedWorldEvents || [])];
      return allEvents.find(e => e.id === pred.reference_id);
    }
    return null;
  };

  // Get direction display - now backend sends 'UP'/'DOWN' as strings
  const getDirectionDisplay = (directionOrOutcome: number | string, type: string) => {
    // If already a string like 'UP', 'DOWN', 'YES', 'NO', return it
    if (typeof directionOrOutcome === 'string') {
      return directionOrOutcome;
    }
    // If number (legacy), convert
    if (type === 'CRYPTO') {
      return directionOrOutcome === 1 ? 'UP' : 'DOWN';
    }
    return directionOrOutcome === 1 ? 'YES' : 'NO';
  };

  // Render user's predictions
  const renderMyPredictions = () => {
    // Split predictions into pending and resolved
    const pendingPredictions = predictions.userPredictions.filter(p => p.status === 'PENDING');
    const resolvedPredictions = predictions.userPredictions.filter(p => p.status !== 'PENDING');
    
    return (
      <div className="space-y-6">
        {/* Stats Summary */}
        {walletAddress && predictions.userPredictions.length > 0 && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-gray-700">
              <p className="text-2xl font-bold text-white">{predictions.userPredictions.length}</p>
              <p className="text-sm text-gray-400">Total Bets</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-green-500/30">
              <p className="text-2xl font-bold text-green-400">
                {predictions.userPredictions.filter(p => p.status === 'WON').length}
              </p>
              <p className="text-sm text-gray-400">Won</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-red-500/30">
              <p className="text-2xl font-bold text-red-400">
                {predictions.userPredictions.filter(p => p.status === 'LOST').length}
              </p>
              <p className="text-sm text-gray-400">Lost</p>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 text-center border border-yellow-500/30">
              <p className="text-2xl font-bold text-yellow-400">{pendingPredictions.length}</p>
              <p className="text-sm text-gray-400">Pending</p>
            </div>
          </div>
        )}
        
        {/* Active/Pending Predictions */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            Active Predictions ({pendingPredictions.length})
          </h3>
          
          {!walletAddress ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center border border-gray-700">
              <p className="text-gray-400">Connect wallet to view your predictions</p>
            </div>
          ) : pendingPredictions.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center border border-gray-700">
              <p className="text-gray-400">No active predictions</p>
              <p className="text-sm text-gray-500 mt-2">Make a prediction to see it here!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingPredictions.map((prediction) => {
                const round = getRoundInfoForPrediction(prediction);
                const event = getEventInfoForPrediction(prediction);
                const direction = getDirectionDisplay(prediction.direction_or_outcome, prediction.prediction_type);
                const isUp = direction === 'UP' || direction === 'YES';
                
                return (
                  <div
                    key={prediction.id}
                    className={`bg-gray-800/50 rounded-xl p-4 border-l-4 ${
                      isUp ? 'border-l-green-500' : 'border-l-red-500'
                    } border border-gray-700`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {/* Asset/Event icon */}
                        {prediction.prediction_type === 'CRYPTO' ? (
                          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center text-lg">
                            {round?.asset === 'BTC' ? '₿' : 'Ξ'}
                          </div>
                        ) : (
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center text-lg">
                            🌍
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">
                            {prediction.prediction_type === 'CRYPTO' 
                              ? `${round?.asset || 'Crypto'}/USDT` 
                              : event?.title || 'Event'}
                          </p>
                          <p className="text-sm text-gray-400">Round #{prediction.reference_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400 animate-pulse">
                          ⏳ PENDING
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Your Bet</p>
                        <p className={`text-lg font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          {isUp ? '📈' : '📉'} {direction}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Staked</p>
                        <p className="text-lg font-bold text-white">🪙 {formatCoins(prediction.coins_staked || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Time Left</p>
                        <p className="text-lg font-bold">
                          {round?.end_time ? (
                            <CountdownDisplay endTime={round.end_time} />
                          ) : (
                            <span className="text-gray-400">--:--</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Resolved Predictions */}
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            Prediction History ({resolvedPredictions.length})
          </h3>
          
          {resolvedPredictions.length === 0 ? (
            <div className="bg-gray-800/50 rounded-xl p-6 text-center border border-gray-700">
              <p className="text-gray-400">No resolved predictions yet</p>
              <p className="text-sm text-gray-500 mt-2">Your completed predictions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedPredictions.map((prediction) => {
                const round = getRoundInfoForPrediction(prediction);
                const event = getEventInfoForPrediction(prediction);
                const direction = getDirectionDisplay(prediction.direction_or_outcome, prediction.prediction_type);
                const isUp = direction === 'UP' || direction === 'YES';
                const won = prediction.status === 'WON';
                const staked = prediction.coins_staked || 0;
                // For won predictions, coins_won is the payout minus stake; for lost, it's 0 or null
                const coinsWon = prediction.coins_won || 0;
                const profit = won ? coinsWon : -staked;
                
                return (
                  <div
                    key={prediction.id}
                    className={`bg-gray-800/50 rounded-xl p-4 border ${
                      won ? 'border-green-500/50' : 'border-red-500/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        {/* Asset/Event icon */}
                        {prediction.prediction_type === 'CRYPTO' ? (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                            won ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            {round?.asset === 'BTC' ? '₿' : 'Ξ'}
                          </div>
                        ) : (
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
                            won ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            🌍
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white">
                            {prediction.prediction_type === 'CRYPTO' 
                              ? `${round?.asset || 'Crypto'}/USDT` 
                              : event?.title || 'Event'}
                          </p>
                          <p className="text-sm text-gray-400">
                            {new Date(prediction.created_at).toLocaleDateString()} at {new Date(prediction.created_at).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                          won 
                            ? 'bg-green-500/20 text-green-400' 
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {won ? '✓ WON' : '✗ LOST'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 mt-3 pt-3 border-t border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Your Bet</p>
                        <p className={`text-lg font-bold ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          {isUp ? '📈' : '📉'} {direction}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Result</p>
                        <p className="text-lg font-bold text-white">
                          {round?.result ? (round.result === 'UP' ? '📈 UP' : '📉 DOWN') : '--'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Staked</p>
                        <p className="text-lg font-bold text-gray-300">🪙 {formatCoins(staked)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase">{won ? 'Profit' : 'Loss'}</p>
                        <p className={`text-lg font-bold ${won ? 'text-green-400' : 'text-red-400'}`}>
                          {won ? '+' : ''}{formatCoins(profit)} 🪙
                        </p>
                      </div>
                    </div>
                    
                    {/* Price info for crypto rounds */}
                    {round && round.start_price && (
                      <div className="mt-3 pt-3 border-t border-gray-700/50 flex justify-between text-sm">
                        <span className="text-gray-500">
                          Start: {formatPrice(round.start_price)}
                        </span>
                        {round.end_price != null && (
                          <span className="text-gray-500">
                            End: {formatPrice(round.end_price)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {renderHeader()}
        {renderTabs()}
        
        {activeTab === 'crypto' && renderCryptoTab()}
        {activeTab === 'events' && renderEventsTab()}
        {activeTab === 'my-predictions' && renderMyPredictions()}
      </div>
    </div>
  );
}

export default PredictionsPage;
