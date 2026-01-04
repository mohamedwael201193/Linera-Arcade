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
import { useToast } from '../components/Toast';
import { formatCoins, formatPrice, getAssetColor } from '../types';
import { CryptoRoundEntry, WorldEventEntry } from '../lib/api/backendApi';
import { TradingViewTicker } from '../components/TradingViewChart';

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
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<TabType>('crypto');
  const [selectedRound, setSelectedRound] = useState<CryptoRoundEntry | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<WorldEventEntry | null>(null);
  const [predictionAmount, setPredictionAmount] = useState(25);
  const [isPlacingPrediction, setIsPlacingPrediction] = useState(false);
  const [eventCategory, setEventCategory] = useState<string>('All');

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

  // Don't auto-select events - let user click to open modal
  // Events are shown in a card grid, clicking opens the prediction modal

  // Handle placing crypto prediction
  const handleCryptoPrediction = async (direction: 'UP' | 'DOWN') => {
    if (!selectedRound || !walletAddress || isPlacingPrediction) return;
    
    setIsPlacingPrediction(true);
    try {
      const success = await predictions.placeCryptoPrediction(selectedRound.id, direction, predictionAmount);
      if (success) {
        if (direction === 'UP') {
          toast.predictionYes(
            '🎯 Prediction Placed!',
            `You bet ${predictionAmount} coins that ${selectedRound.asset} will go UP`
          );
        } else {
          toast.predictionNo(
            '🎯 Prediction Placed!',
            `You bet ${predictionAmount} coins that ${selectedRound.asset} will go DOWN`
          );
        }
        // Refresh user data to show the prediction
        predictions.refreshUserData();
        predictions.refreshCryptoRounds();
      } else {
        toast.error('Prediction Failed', 'Please check your balance and try again.');
      }
    } catch (error) {
      console.error('Failed to place prediction:', error);
      toast.error('Prediction Failed', 'An error occurred. Please try again.');
    } finally {
      setIsPlacingPrediction(false);
    }
  };

  // Handle placing event prediction
  const handleEventPrediction = async (outcome: string) => {
    if (!selectedEvent || !walletAddress || isPlacingPrediction) return;
    
    const eventTitle = selectedEvent.title;
    setIsPlacingPrediction(true);
    try {
      const success = await predictions.placeEventPrediction(selectedEvent.id, outcome, predictionAmount);
      if (success) {
        // Refresh data first
        await predictions.refreshUserData();
        await predictions.refreshWorldEvents();
        // Close modal and show success
        setSelectedEvent(null);
        if (outcome === 'YES') {
          toast.predictionYes(
            '🎯 Prediction Placed!',
            `You bet ${predictionAmount} coins on YES for "${eventTitle.substring(0, 40)}${eventTitle.length > 40 ? '...' : ''}"`
          );
        } else {
          toast.predictionNo(
            '🎯 Prediction Placed!',
            `You bet ${predictionAmount} coins on NO for "${eventTitle.substring(0, 40)}${eventTitle.length > 40 ? '...' : ''}"`
          );
        }
      } else {
        toast.error('Prediction Failed', 'Check your coin balance and try again.');
      }
    } catch (error) {
      console.error('Failed to place prediction:', error);
      toast.error('Prediction Failed', 'An error occurred. Please try again.');
    } finally {
      setIsPlacingPrediction(false);
    }
  };

  // Handle claiming daily bonus
  const handleClaimBonus = async () => {
    if (!walletAddress) {
      toast.warning('Wallet Required', 'Please connect your wallet first!');
      return;
    }
    try {
      const result = await predictions.claimDailyBonus();
      if (result?.success) {
        toast.success(
          '🎉 Daily Bonus Claimed!',
          `You received ${result.coins} coins! Your balance has been updated.`
        );
        predictions.refreshUserData();
      } else {
        toast.warning('Already Claimed', 'You have already claimed your daily bonus today.');
      }
    } catch (error) {
      console.error('Failed to claim bonus:', error);
      toast.error('Claim Failed', 'Failed to claim bonus. Please try again.');
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
                  {predictions.coinBalance?.balance !== null && predictions.coinBalance?.balance !== undefined 
                    ? formatCoins(predictions.coinBalance.balance) 
                    : '0'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Daily Bonus Button - Only visible if registered */}
          <button
            onClick={handleClaimBonus}
            disabled={!predictions.coinBalance?.isRegistered || !predictions.coinBalance?.canClaimDaily}
            className={`px-4 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg ${
              predictions.coinBalance?.isRegistered && predictions.coinBalance?.canClaimDaily
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white hover:shadow-green-500/25 animate-pulse'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            🎁 {predictions.coinBalance?.isRegistered && predictions.coinBalance?.canClaimDaily ? 'Claim Daily Bonus (+100)' : predictions.coinBalance?.isRegistered ? 'Bonus Claimed Today' : 'Register to Claim'}
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

  // Render crypto prediction interface
  const renderCryptoTab = () => (
    <div className="space-y-6">
      {/* Price Ticker */}
      <TradingViewTicker 
        btcPrice={predictions.prices.btc?.formatted || 'Loading...'}
        ethPrice={predictions.prices.eth?.formatted || 'Loading...'}
      />
      
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
                <div className="flex gap-2 flex-wrap items-center">
                  {PREDICTION_AMOUNTS.map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setPredictionAmount(amount)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        predictionAmount === amount && !document.activeElement?.classList.contains('custom-stake')
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      🪙 {amount}
                    </button>
                  ))}
                  <div className="flex items-center gap-1 bg-gray-700 rounded-lg px-2">
                    <span className="text-gray-400">🪙</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      placeholder="Custom"
                      className="custom-stake w-20 bg-transparent text-white py-2 outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0) setPredictionAmount(val);
                      }}
                      onFocus={(e) => {
                        if (e.target.value === '') {
                          setPredictionAmount(0);
                        }
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">Your balance: 🪙 {predictions.coinBalance?.balance || 0}</p>
              </div>
              
              {/* UP/DOWN Buttons */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <button
                  onClick={() => handleCryptoPrediction('UP')}
                  disabled={isPlacingPrediction || predictionAmount < 1 || (predictions.coinBalance?.balance || 0) < predictionAmount}
                  className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>📈</span> UP
                </button>
                <button
                  onClick={() => handleCryptoPrediction('DOWN')}
                  disabled={isPlacingPrediction || predictionAmount < 1 || (predictions.coinBalance?.balance || 0) < predictionAmount}
                  className="py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all duration-200 flex items-center justify-center gap-2"
                >
                  <span>📉</span> DOWN
                </button>
              </div>
              
              {predictionAmount < 1 && (
                <p className="text-center text-sm text-yellow-400">
                  Enter a valid stake amount (minimum 1 coin)
                </p>
              )}
              
              {predictionAmount >= 1 && (predictions.coinBalance?.balance || 0) < predictionAmount && (
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

  // Calculate YES odds percentage for an event
  const getYesOdds = (event: WorldEventEntry) => {
    const total = (event.total_yes || 0) + (event.total_no || 0);
    if (total === 0) return null; // Return null when no bets
    return Math.round((event.total_yes || 0) / total * 100);
  };
  
  // Check if event has any bets
  const hasAnyBets = (event: WorldEventEntry) => {
    return ((event.total_yes || 0) + (event.total_no || 0)) > 0;
  };

  // Get category icon (SVG components)
  const CategoryIcon = ({ category, size = 24 }: { category: string; size?: number }) => {
    const iconProps = { width: size, height: size, className: "flex-shrink-0" };
    
    switch (category) {
      case 'Crypto':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-orange-400">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        );
      case 'Tech':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-cyan-400">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
            <line x1="8" y1="21" x2="16" y2="21"/>
            <line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
        );
      case 'Politics':
      case 'Geopolitics':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-400">
            <circle cx="12" cy="12" r="10"/>
            <line x1="2" y1="12" x2="22" y2="12"/>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
          </svg>
        );
      case 'Finance':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
            <line x1="12" y1="1" x2="12" y2="23"/>
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        );
      case 'Sports':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 0 0 20 10 10 0 0 0 0-20"/>
            <path d="M2 12h20M12 2c2.5 2.5 4 6 4 10s-1.5 7.5-4 10c-2.5-2.5-4-6-4-10s1.5-7.5 4-10"/>
          </svg>
        );
      case 'Culture':
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-400">
            <path d="M4 11a9 9 0 0 1 9 9"/>
            <path d="M4 4a16 16 0 0 1 16 16"/>
            <circle cx="5" cy="19" r="1"/>
          </svg>
        );
      default:
        return (
          <svg {...iconProps} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        );
    }
  };

  // Get days remaining
  const getDaysRemaining = (endTime: string) => {
    const end = new Date(endTime).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

  // Filter events by category
  const filteredEvents = eventCategory === 'All' 
    ? predictions.activeWorldEvents 
    : predictions.activeWorldEvents.filter(e => e.category === eventCategory);

  // Render Polymarket-style events tab
  const renderEventsTab = () => (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['All', 'Crypto', 'Tech', 'Geopolitics', 'Finance', 'Sports', 'Culture', 'World'].map((cat) => (
          <button
            key={cat}
            onClick={() => setEventCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
              eventCategory === cat 
                ? 'bg-cyan-500 text-white' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Events Grid - Polymarket Style */}
      {filteredEvents.length === 0 ? (
        <div className="bg-gray-800/50 rounded-xl p-12 text-center">
          <CategoryIcon category="World" size={64} />
          <p className="text-xl text-gray-400 mt-4">No events in this category</p>
          <p className="text-sm text-gray-500 mt-2">Try selecting a different category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const yesOdds = getYesOdds(event);
            const noOdds = yesOdds !== null ? 100 - yesOdds : null;
            const hasBets = hasAnyBets(event);
            const isSelected = selectedEvent?.id === event.id;
            
            return (
              <div
                key={event.id}
                onClick={() => setSelectedEvent(event)}
                className={`group bg-gray-800/70 rounded-xl border cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 hover:-translate-y-1 ${
                  isSelected ? 'border-cyan-500 ring-2 ring-cyan-500/20' : 'border-gray-700'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CategoryIcon category={event.category} size={28} />
                    {hasBets ? (
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        yesOdds !== null && yesOdds >= 60 ? 'bg-green-500/20 text-green-400' :
                        yesOdds !== null && yesOdds <= 40 ? 'bg-red-500/20 text-red-400' :
                        'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {yesOdds}%
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded text-xs font-medium bg-cyan-500/20 text-cyan-400 animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2 group-hover:text-cyan-400 transition-colors">
                    {event.title}
                  </h3>
                  <p className="text-xs text-gray-500 mt-2">
                    {event.category} • {getDaysRemaining(event.end_time)}
                  </p>
                </div>

                {/* Odds Bar */}
                <div className="px-4 pb-3">
                  {hasBets ? (
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${yesOdds}%` }}
                      />
                      <div 
                        className="bg-gradient-to-r from-red-500 to-rose-400"
                        style={{ width: `${noOdds}%` }}
                      />
                    </div>
                  ) : (
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-cyan-500/30 to-purple-500/30 animate-pulse" style={{ width: '100%' }} />
                    </div>
                  )}
                </div>

                {/* Yes/No Buttons */}
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                    }}
                    disabled={!walletAddress || isPlacingPrediction}
                    className="flex-1 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 hover:border-green-500/50 rounded-lg text-green-400 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasBets ? `Yes ${yesOdds}¢` : 'Yes'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEvent(event);
                    }}
                    disabled={!walletAddress || isPlacingPrediction}
                    className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 hover:border-red-500/50 rounded-lg text-red-400 font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {hasBets ? `No ${noOdds}¢` : 'No'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Event Detail Panel */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedEvent(null)}>
          <div 
            className="bg-gray-900 rounded-2xl max-w-lg w-full border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <CategoryIcon category={selectedEvent.category} size={32} />
                  {hasAnyBets(selectedEvent) ? (
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      (getYesOdds(selectedEvent) ?? 50) >= 50 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {getYesOdds(selectedEvent)}% chance
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-sm font-bold bg-cyan-500/20 text-cyan-400 animate-pulse">
                      Be first to predict!
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-400 hover:text-white text-2xl leading-none p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  ×
                </button>
              </div>
              <h2 className="text-xl font-bold text-white mt-4">{selectedEvent.title}</h2>
              <p className="text-gray-400 text-sm mt-2">{selectedEvent.description}</p>
              <div className="flex gap-2 mt-3">
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                  {selectedEvent.category}
                </span>
                <span className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                  Ends: {getDaysRemaining(selectedEvent.end_time)}
                </span>
              </div>
            </div>

            {/* Prediction Section */}
            <div className="p-6">
              {!walletAddress ? (
                <div className="text-center py-6">
                  <p className="text-gray-400 mb-4">Connect wallet to make predictions</p>
                </div>
              ) : (
                <>
                  {/* Total Volume or "Be First" message */}
                  {hasAnyBets(selectedEvent) ? (
                    <div className="bg-gray-800/50 rounded-xl p-3 mb-4 text-center">
                      <p className="text-xs text-gray-500">Total Volume</p>
                      <p className="text-lg font-bold text-cyan-400">
                        🪙 {((selectedEvent.total_yes || 0) + (selectedEvent.total_no || 0)).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-xl p-4 mb-4 text-center">
                      <p className="text-cyan-400 font-semibold">🎯 No predictions yet!</p>
                      <p className="text-xs text-gray-400 mt-1">Be the first to predict and set the odds</p>
                    </div>
                  )}
                  
                  {/* Pool Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
                      <p className="text-green-400 text-2xl font-bold">{hasAnyBets(selectedEvent) ? `${getYesOdds(selectedEvent)}%` : '-'}</p>
                      <p className="text-green-400/70 text-sm">Yes odds</p>
                      <p className="text-xs text-gray-500 mt-1">🪙 {(selectedEvent.total_yes || 0).toLocaleString()} staked</p>
                    </div>
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-center">
                      <p className="text-red-400 text-2xl font-bold">{hasAnyBets(selectedEvent) ? `${100 - (getYesOdds(selectedEvent) ?? 0)}%` : '-'}</p>
                      <p className="text-red-400/70 text-sm">No odds</p>
                      <p className="text-xs text-gray-500 mt-1">🪙 {(selectedEvent.total_no || 0).toLocaleString()} staked</p>
                    </div>
                  </div>

                  {/* Amount Selection */}
                  <div className="mb-4">
                    <label className="text-sm text-gray-400 block mb-2">Stake Amount</label>
                    <div className="flex gap-2 flex-wrap mb-3">
                      {PREDICTION_AMOUNTS.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => setPredictionAmount(amount)}
                          className={`px-4 py-2 rounded-lg font-medium transition-all ${
                            predictionAmount === amount
                              ? 'bg-cyan-500 text-white'
                              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                          }`}
                        >
                          🪙 {amount}
                        </button>
                      ))}
                    </div>
                    {/* Custom Amount Input */}
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">🪙</span>
                      <input
                        type="number"
                        min="1"
                        max={predictions.coinBalance?.balance || 1000}
                        value={predictionAmount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setPredictionAmount(Math.min(Math.max(1, val), predictions.coinBalance?.balance || 1000));
                        }}
                        className="w-24 px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                        placeholder="Custom"
                      />
                      <span className="text-xs text-gray-500">Custom amount</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Your balance: 🪙 {predictions.coinBalance?.balance || 0}
                    </p>
                  </div>

                  {/* Yes/No Buttons */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => handleEventPrediction('YES')}
                      disabled={isPlacingPrediction || (predictions.coinBalance?.balance || 0) < predictionAmount}
                      className="py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all shadow-lg shadow-green-500/20 hover:shadow-green-500/40 disabled:shadow-none"
                    >
                      {isPlacingPrediction ? '⏳ Signing...' : '✓ Yes'}
                    </button>
                    <button
                      onClick={() => handleEventPrediction('NO')}
                      disabled={isPlacingPrediction || (predictions.coinBalance?.balance || 0) < predictionAmount}
                      className="py-4 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-400 hover:to-rose-500 disabled:from-gray-600 disabled:to-gray-700 rounded-xl text-white font-bold text-lg transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40 disabled:shadow-none"
                    >
                      {isPlacingPrediction ? '⏳ Signing...' : '✗ No'}
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 text-center mt-4">
                    🔒 Requires wallet signature • Win up to {getYesOdds(selectedEvent) ? Math.round(predictionAmount * 100 / getYesOdds(selectedEvent)!) : '∞'} coins
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resolved Events Section */}
      {predictions.resolvedWorldEvents && predictions.resolvedWorldEvents.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
            Recently Resolved
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {predictions.resolvedWorldEvents.slice(0, 6).map((event) => (
              <div key={event.id} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <CategoryIcon category={event.category} size={24} />
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    event.outcome ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {event.outcome ? '✓ YES' : '✗ NO'}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-gray-300 line-clamp-2">{event.title}</h4>
              </div>
            ))}
          </div>
        </div>
      )}
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
