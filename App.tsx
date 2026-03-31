
import React, { useState } from 'react';
import { ApiKeyProvider, useApiKey } from './context/ApiKeyContext';
import { ViewState, Game } from './types';
import ApiKeySetup from './pages/ApiKeySetup';
import Games from './pages/Games';
import GameDetail from './pages/GameDetail';
import PlayerDetail from './pages/PlayerDetail';
import ErrorBoundary from './components/ErrorBoundary';

interface PlayerContext {
  playerName: string;
  teamName: string;
  teamLogo?: string;
  opponentTeamName: string;
  opponentLogo?: string;
  playerPhoto?: string;
  playerId?: string;
  statType?: string;
  line?: number;
  bookmakerName?: string;
  bookmakerKey?: string;
  gameId?: string;
}

const Router: React.FC = () => {
  const { apiKey } = useApiKey();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerContext | null>(null);

  if (!apiKey) {
    return <ApiKeySetup />;
  }

  if (selectedPlayer) {
    return (
      <PlayerDetail 
        {...selectedPlayer} 
        onBack={() => setSelectedPlayer(null)} 
      />
    );
  }

  if (selectedGame) {
    return (
      <GameDetail 
        game={selectedGame} 
        onBack={() => setSelectedGame(null)} 
        onSelectPlayer={(player) => setSelectedPlayer(player)}
      />
    );
  }

  return <Games onSelectGame={(game) => setSelectedGame(game)} />;
};

const Footer: React.FC = () => {
  return (
    <footer style={{ 
      padding: '40px 16px 60px', 
      textAlign: 'center', 
      color: '#9ca3af', 
      fontSize: '12px',
      lineHeight: '1.6',
      borderTop: '1px solid #e5e7eb',
      marginTop: '40px'
    }}>
      <div style={{ marginBottom: '8px', fontWeight: '600' }}>
        © 2026 JumpShot AI. All rights reserved.
      </div>
      <div style={{ maxWidth: '440px', margin: '0 auto', opacity: 0.8 }}>
        This application is for educational and informational purposes only. 
        It does not constitute financial or betting advice. 
        Always conduct your own research before making any decisions.
      </div>
    </footer>
  );
};

const App: React.FC = () => {
  return (
    <ApiKeyProvider>
      <ErrorBoundary>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <div style={{ flex: 1 }}>
            <Router />
          </div>
          <Footer />
        </div>
      </ErrorBoundary>
    </ApiKeyProvider>
  );
};

export default App;
