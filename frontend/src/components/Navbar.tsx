import { Link, useLocation } from 'react-router-dom';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { motion } from 'framer-motion';
import { Trophy, Home, User, TrendingUp, Activity, Gamepad2, Users, Zap } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/games', label: 'Games', icon: Gamepad2 },
  { path: '/multiplayer', label: 'Multiplayer', icon: Users },
  { path: '/tournament', label: 'Tournament', icon: Zap },
  { path: '/predictions', label: 'Predictions', icon: TrendingUp },
  { path: '/activity', label: 'Activity', icon: Activity },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Navbar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-dark-bg/90 border-b border-dark-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="relative"
            >
              <div className="absolute inset-0 bg-accent-orange/30 rounded-full blur-xl scale-75" />
              <img 
                src="/logo.png" 
                alt="Linera Arcade" 
                className="relative w-10 h-10 object-contain drop-shadow-[0_0_15px_rgba(255,107,0,0.5)]"
              />
            </motion.div>
            <span className="font-arcade text-xl font-bold">
              <span className="text-accent-orange">LINERA</span>
              <span className="text-white"> ARCADE</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map(({ path, label, icon: Icon }) => {
              const isActive = location.pathname === path || 
                (path !== '/' && location.pathname.startsWith(path));
              
              return (
                <Link
                  key={path}
                  to={path}
                  className="relative px-4 py-2 group"
                >
                  <motion.div
                    className={`flex items-center gap-2 transition-colors ${
                      isActive 
                        ? 'text-accent-orange' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-arcade text-sm">{label}</span>
                  </motion.div>
                  
                  {isActive && (
                    <motion.div
                      layoutId="navbar-indicator"
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent-orange"
                      style={{ boxShadow: '0 0 10px #ff6b00' }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Dynamic Wallet Widget */}
          <div className="flex items-center gap-4">
            <div className="dynamic-widget-wrapper">
              <DynamicWidget />
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex justify-around py-2 border-t border-dark-border">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path || 
              (path !== '/' && location.pathname.startsWith(path));
            
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 p-2 ${
                  isActive ? 'text-accent-orange' : 'text-gray-400'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-arcade">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
