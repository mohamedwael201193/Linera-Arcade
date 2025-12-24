import { Link, useLocation } from 'react-router-dom';
import { DynamicWidget } from '@dynamic-labs/sdk-react-core';
import { motion } from 'framer-motion';
import { Gamepad2, Trophy, Home, User } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/games', label: 'Games', icon: Gamepad2 },
  { path: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { path: '/profile', label: 'Profile', icon: User },
];

export function Navbar() {
  const location = useLocation();

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-arcade-darker/80 border-b border-arcade-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              className="w-10 h-10 rounded-lg bg-gradient-to-br from-neon-pink to-neon-cyan flex items-center justify-center"
            >
              <Gamepad2 className="w-6 h-6 text-arcade-darker" />
            </motion.div>
            <span className="font-arcade text-xl font-bold">
              <span className="neon-text-pink">LINERA</span>
              <span className="neon-text-cyan"> ARCADE</span>
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
                        ? 'text-neon-cyan' 
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
                      className="absolute bottom-0 left-2 right-2 h-0.5 bg-neon-cyan"
                      style={{ boxShadow: '0 0 10px #00ffff' }}
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
        <div className="md:hidden flex justify-around py-2 border-t border-arcade-border">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path || 
              (path !== '/' && location.pathname.startsWith(path));
            
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 p-2 ${
                  isActive ? 'text-neon-cyan' : 'text-gray-400'
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
