/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Neon arcade palette
        'neon-pink': '#ff00ff',
        'neon-cyan': '#00ffff',
        'neon-green': '#00ff00',
        'neon-yellow': '#ffff00',
        'neon-orange': '#ff8800',
        'neon-purple': '#aa00ff',
        'neon-blue': '#0088ff',
        // Dark backgrounds
        'arcade-dark': '#0a0a12',
        'arcade-darker': '#050508',
        'arcade-card': '#12121a',
        'arcade-border': '#1e1e2e',
      },
      fontFamily: {
        arcade: ['Orbitron', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'neon-flicker': 'neon-flicker 0.15s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'slide-up': 'slide-up 0.5s ease-out',
        'slide-down': 'slide-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 5px currentColor, 0 0 10px currentColor, 0 0 20px currentColor',
            opacity: '1'
          },
          '50%': { 
            boxShadow: '0 0 10px currentColor, 0 0 20px currentColor, 0 0 40px currentColor',
            opacity: '0.8'
          },
        },
        'neon-flicker': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'slide-down': {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'scale-in': {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      boxShadow: {
        'neon-pink': '0 0 5px #ff00ff, 0 0 10px #ff00ff, 0 0 20px #ff00ff',
        'neon-cyan': '0 0 5px #00ffff, 0 0 10px #00ffff, 0 0 20px #00ffff',
        'neon-green': '0 0 5px #00ff00, 0 0 10px #00ff00, 0 0 20px #00ff00',
        'neon-purple': '0 0 5px #aa00ff, 0 0 10px #aa00ff, 0 0 20px #aa00ff',
      },
      backgroundImage: {
        'grid-pattern': `linear-gradient(rgba(30, 30, 46, 0.3) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(30, 30, 46, 0.3) 1px, transparent 1px)`,
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
};
