import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { HomePage } from './pages/HomePage';
import { GamesPage } from './pages/GamesPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { ProfilePage } from './pages/ProfilePage';
import { GamePlayPage } from './pages/GamePlayPage';
import { useLineraConnection } from './hooks/useLineraConnection';

function App() {
  // Initialize Linera connection - this will auto-connect when wallet is available
  const { isConnecting, error } = useLineraConnection();

  return (
    <>
      {/* Connection status banner */}
      {isConnecting && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-arcade-card border-b border-arcade-border p-2 text-center">
          <span className="text-neon-cyan text-sm animate-pulse">
            🔄 Connecting to Linera blockchain...
          </span>
        </div>
      )}
      
      {error && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-red-900/80 border-b border-red-500 p-2 text-center">
          <span className="text-red-200 text-sm">
            ⚠️ {error}
          </span>
        </div>
      )}

      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="games/:gameId" element={<GamePlayPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
