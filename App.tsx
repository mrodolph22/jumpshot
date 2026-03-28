
import React, { useState } from 'react';
import { ApiKeyProvider, useApiKey } from './context/ApiKeyContext';
import { ViewState, Game } from './types';
import ApiKeySetup from './pages/ApiKeySetup';
import Games from './pages/Games';
import GameDetail from './pages/GameDetail';
import PlayerDetail from './pages/PlayerDetail';

interface PlayerContext {
  playerName: string;
  teamName: string;
  teamLogo?: string;
  opponentTeamName: string;
  opponentLogo?: string;
  playerPhoto?: string;
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

const App: React.FC = () => {
  return (
    <ApiKeyProvider>
      <div className="container">
        <Router />
      </div>
    </ApiKeyProvider>
  );
};

export default App;
