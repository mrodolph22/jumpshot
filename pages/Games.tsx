
import React from 'react';
import { useEvents } from '../hooks/useEvents';
import { useApiKey } from '../context/ApiKeyContext';
import { Game } from '../types';

interface GamesProps {
  onSelectGame: (game: Game) => void;
}

const Games: React.FC<GamesProps> = ({ onSelectGame }) => {
  const { events, loading, isRefreshing, error, remainingCooldown, lastUpdatedLabel, refresh } = useEvents();
  const { clearKey } = useApiKey();

  if (loading && !isRefreshing) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <div className="label-tiny">Scanning NBA Schedule...</div>
    </div>
  );
  
  if (error && !isRefreshing) {
    const isInvalidKey = error.toLowerCase().includes('api key');
    return (
      <div style={{ padding: '40px'}}>
        <div className="card" style={{ padding: '24px', borderLeft: '4px solid #dc2626', maxWidth: '100%' }}>
          <div style={{ color: '#dc2626', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', marginBottom: '16px' }}>
            Data Request Failed
          </div>
          <p style={{ fontSize: '13px', marginBottom: '16px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '12px' }}>
             <button onClick={() => refresh()}>Retry</button>
            {isInvalidKey && (
              <button 
                onClick={clearKey}
                style={{ backgroundColor: '#000', color: '#fff' }}
              >
                Reset API Key
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isCoolingDown = remainingCooldown > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <header>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '-0.5px' }}>NBA Game Schedule</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <button 
              onClick={() => refresh()} 
              disabled={isRefreshing || isCoolingDown}
              style={{ 
                minWidth: '80px',
                opacity: isCoolingDown ? 0.5 : 1,
                cursor: isCoolingDown ? 'not-allowed' : 'pointer',
                transition: 'opacity 0.2s ease',
                fontWeight: '900'
              }}
              title={isCoolingDown ? "Refresh limited to prevent excessive API usage" : ""}
            >
              {isRefreshing ? 'REFRESHING...' : isCoolingDown ? `${remainingCooldown}S` : 'REFRESH'}
            </button>
            {lastUpdatedLabel && (
              <span style={{ fontSize: '8px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>
                {lastUpdatedLabel}
              </span>
            )}
          </div>
          <button onClick={clearKey} style={{ color: '#9ca3af', border: 'none', boxShadow: 'none' }}>Logout</button>
        </div>
      </header>
      <main style={{ paddingBottom: '40px', marginTop: '20px' }}>
        {events.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', textTransform: 'uppercase', fontSize: '11px', fontWeight: 800 }}>No upcoming games.</div>
        ) : (
          events.map((game) => (
            <div
              key={game.id}
              onClick={() => onSelectGame(game)}
              className="list-card"
              style={{ padding: '14px 16px' }}
            >
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: '8px'
              }}>
                {/* Left side: Away Team */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  flex: 1,
                  opacity: 0.85, // Slightly fade away team
                  overflow: 'hidden'
                }}>
                  {game.awayTeamData?.logo ? (
                    <img 
                      src={game.awayTeamData.logo} 
                      alt="" 
                      style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }} 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: '50%' }}>
                      {game.awayTeamData?.abbreviation || '??'}
                    </div>
                  )}
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '900', 
                    textTransform: 'uppercase', 
                    letterSpacing: '-0.3px',
                    color: '#000',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {game.away_team}
                  </span>
                </div>

                {/* Center: @ symbol */}
                <div style={{ 
                  fontSize: '12px', 
                  color: '#9ca3af', 
                  fontWeight: '400',
                  padding: '0 8px',
                  flexShrink: 0
                }}>
                  @
                </div>

                {/* Right side: Home Team */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px', 
                  flex: 1,
                  justifyContent: 'flex-end',
                  overflow: 'hidden'
                }}>
                  <span style={{ 
                    fontSize: '13px', 
                    fontWeight: '900', 
                    textTransform: 'uppercase', 
                    letterSpacing: '-0.3px',
                    color: '#000',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textAlign: 'right'
                  }}>
                    {game.home_team}
                  </span>
                  {game.homeTeamData?.logo ? (
                    <img 
                      src={game.homeTeamData.logo} 
                      alt="" 
                      style={{ width: '36px', height: '36px', objectFit: 'contain', flexShrink: 0 }} 
                      referrerPolicy="no-referrer" 
                    />
                  ) : (
                    <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#9ca3af', border: '1px dashed #e5e7eb', borderRadius: '50%' }}>
                      {game.homeTeamData?.abbreviation || '??'}
                    </div>
                  )}
                </div>
              </div>

              {/* Centered Date/Time */}
              <div style={{ 
                fontSize: '10px', 
                color: '#9ca3af', 
                marginTop: '6px', 
                fontWeight: '800', 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                textAlign: 'center',
                width: '100%'
              }}>
                {new Date(game.commence_time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }).toUpperCase()}
              </div>
            </div>
          ))
        )}
      </main>
    </div>
  );
};

export default Games;
