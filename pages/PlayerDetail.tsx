
import React, { useState, useEffect } from 'react';
import { fetchPlayerStats, fetchOpponentContext, fetchEspnTeams, PlayerStats, OpponentContext, EspnTeamInfo, normalizeTeamName } from '../services/espnService';
import { analyzePlayerPerformance, PlayerAnalysis } from '../services/geminiService';

interface PlayerDetailProps {
  playerName: string;
  teamName: string;
  teamLogo?: string;
  opponentTeamName: string;
  opponentLogo?: string;
  playerPhoto?: string;
  onBack: () => void;
}

const PlayerDetail: React.FC<PlayerDetailProps> = ({ 
  playerName, 
  teamName, 
  teamLogo, 
  playerPhoto,
  opponentTeamName: initialOpponentTeamName, 
  opponentLogo: initialOpponentLogo, 
  onBack 
}) => {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [opponent, setOpponent] = useState<OpponentContext | null>(null);
  const [allTeams, setAllTeams] = useState<EspnTeamInfo[]>([]);
  const [selectedOpponent, setSelectedOpponent] = useState({
    name: initialOpponentTeamName,
    logo: initialOpponentLogo
  });
  const [loading, setLoading] = useState(true);
  
  const [statType, setStatType] = useState('Points');
  const [line, setLine] = useState<number>(20.5);
  const [analysis, setAnalysis] = useState<PlayerAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    const loadTeams = async () => {
      const teams = await fetchEspnTeams();
      const sortedTeams = teams.sort((a, b) => a.displayName.localeCompare(b.displayName));
      setAllTeams(sortedTeams);
      
      // Ensure initial name matches one of the ESPN display names
      const initialMatch = sortedTeams.find(t => 
        normalizeTeamName(t.displayName) === normalizeTeamName(selectedOpponent.name) ||
        normalizeTeamName(t.name) === normalizeTeamName(selectedOpponent.name) ||
        normalizeTeamName(t.abbreviation) === normalizeTeamName(selectedOpponent.name)
      );
      
      if (initialMatch) {
        setSelectedOpponent({
          name: initialMatch.displayName,
          logo: initialMatch.logo
        });
      }
    };
    loadTeams();
  }, []); // Only run on mount

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [statsData, opponentData] = await Promise.all([
          fetchPlayerStats(playerName),
          fetchOpponentContext(selectedOpponent.name)
        ]);
        setStats(statsData);
        setOpponent(opponentData);
      } catch (err) {
        console.error("Error loading player data:", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [playerName, selectedOpponent.name]);

  const handleOpponentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const team = allTeams.find(t => t.displayName === e.target.value);
    if (team) {
      setSelectedOpponent({
        name: team.displayName,
        logo: team.logo
      });
      setAnalysis(null); // Reset analysis when opponent changes
    }
  };

  const handleAnalyze = async () => {
    if (!stats || !opponent) return;
    setAnalyzing(true);
    try {
      const result = await analyzePlayerPerformance(playerName, statType, line, stats, opponent);
      setAnalysis(result);
    } catch (err) {
      console.error("Analysis error:", err);
    } finally {
      setAnalyzing(false);
    }
  };

  if (loading && !stats) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div className="label-tiny">Loading Player Profile...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px', background: '#f8f9fa', minHeight: '100vh' }}>
      <div style={{ padding: '16px 16px 0' }}>
        <button 
          onClick={onBack} 
          style={{ 
            fontWeight: '900', 
            marginBottom: '12px'
          }}
        >
          BACK
        </button>
        
        <div style={{ 
          background: '#fff', 
          borderRadius: '12px', 
          boxShadow: 'var(--shadow)', 
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}>
          <div className="player-header" style={{ 
            height: '52px',
            display: 'flex', 
            flexDirection: 'column',
            padding: '8px 12px',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
            flexShrink: 0,
            background: 'rgba(0,0,0,0.01)',
            gap: '2px'
          }}>
            {/* Row 1: Team (Left) */}
            <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                {teamLogo && (
                  <img 
                    src={teamLogo} 
                    alt="" 
                    style={{ width: '18px', height: '18px', objectFit: 'contain', opacity: 0.9, flexShrink: 0 }} 
                    referrerPolicy="no-referrer" 
                  />
                )}
                <span style={{ fontSize: '10px', fontWeight: '600', textTransform: 'uppercase', opacity: 0.6, whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                  {teamName}
                </span>
              </div>
            </div>

            {/* Row 2: Player Photo and Name (Centered) */}
            <div style={{ textAlign: 'center', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {playerPhoto && (
                <img 
                  src={playerPhoto} 
                  alt="" 
                  style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', background: '#f0f0f0' }} 
                  referrerPolicy="no-referrer"
                />
              )}
              <span style={{ 
                fontSize: '14px', 
                fontWeight: '900', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {playerName}
              </span>
            </div>
          </div>

          {/* Subtext Row */}
          <div style={{ padding: '8px 12px', textAlign: 'center', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <span style={{ 
              fontSize: '10px', 
              fontWeight: '700', 
              color: '#9ca3af', 
              textTransform: 'uppercase', 
              letterSpacing: '0.5px' 
            }}>
              SG • Starter
            </span>
          </div>

          {/* Stats Row */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(3, 1fr)', 
            gap: '1px', 
            background: 'rgba(0,0,0,0.06)',
            borderBottom: '1px solid rgba(0,0,0,0.06)'
          }}>
            {stats && Object.entries(stats).map(([key, value]) => (
              <div key={key} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '8px 4px', 
                background: '#fff'
              }}>
                <span style={{ fontSize: '13px', fontWeight: '900', color: '#111', lineHeight: '1' }}>
                  {(value as number).toFixed(1)}
                </span>
                <span style={{ fontSize: '7px', fontWeight: '800', textTransform: 'uppercase', color: '#9ca3af', marginTop: '2px' }}>
                  {key}
                </span>
              </div>
            ))}
          </div>

          {/* Stats Footer */}
          <div style={{ padding: '4px 12px', background: 'rgba(0,0,0,0.01)', textAlign: 'center' }}>
            <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', color: '#9ca3af', letterSpacing: '1px' }}>
              2025-26 Regular Season
            </span>
          </div>
        </div>
      </div>

      <main style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* OPPONENT CONTEXT */}
        <section>
          <div style={{ 
            background: '#fff', 
            borderRadius: '12px', 
            boxShadow: 'var(--shadow)', 
            display: 'flex',
            flexDirection: 'column',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ 
              height: '52px',
              display: 'flex', 
              alignItems: 'center',
              padding: '0 16px',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
              flexShrink: 0,
              background: 'rgba(0,0,0,0.01)',
              gap: '12px'
            }}>
              {selectedOpponent.logo && (
                <img 
                  src={selectedOpponent.logo} 
                  alt="" 
                  style={{ width: '24px', height: '24px', objectFit: 'contain', opacity: 0.9, flexShrink: 0 }} 
                  referrerPolicy="no-referrer" 
                />
              )}
              <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
                <select 
                  value={selectedOpponent.name}
                  onChange={handleOpponentChange}
                  style={{
                    fontSize: '14px',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    outline: 'none',
                    color: '#111',
                    padding: '0',
                    width: '100%',
                    appearance: 'none'
                  }}
                >
                  {allTeams.map(team => (
                    <option key={team.id} value={team.displayName}>
                      {team.displayName}
                    </option>
                  ))}
                </select>
                <div style={{ position: 'absolute', right: 0, pointerEvents: 'none', opacity: 0.4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Subtext Row */}
            <div style={{ padding: '8px 12px', textAlign: 'center', background: '#fff', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <span style={{ 
                fontSize: '10px', 
                fontWeight: '700', 
                color: '#9ca3af', 
                textTransform: 'uppercase', 
                letterSpacing: '0.5px' 
              }}>
                Defensive Efficiency • Pace
              </span>
            </div>

            {/* Stats Row */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(2, 1fr)', 
              gap: '1px', 
              background: 'rgba(0,0,0,0.06)',
              borderBottom: '1px solid rgba(0,0,0,0.06)'
            }}>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '12px 4px', 
                background: '#fff'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '900', color: '#111', lineHeight: '1' }}>
                  {opponent?.pace}
                </span>
                <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', color: '#9ca3af', marginTop: '4px' }}>
                  Game Pace
                </span>
              </div>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '12px 4px', 
                background: '#fff'
              }}>
                <span style={{ fontSize: '16px', fontWeight: '900', color: '#111', lineHeight: '1' }}>
                  {opponent?.defense}
                </span>
                <span style={{ fontSize: '8px', fontWeight: '800', textTransform: 'uppercase', color: '#9ca3af', marginTop: '4px' }}>
                  Perimeter Def
                </span>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '4px 12px', background: 'rgba(0,0,0,0.01)', textAlign: 'center', minHeight: '16px' }}>
            </div>
          </div>
        </section>

        {/* ANALYSIS FORM */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.5 }}>Stat Type</label>
              <select 
                value={statType} 
                onChange={(e) => setStatType(e.target.value)}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              >
                <option>Points</option>
                <option>Rebounds</option>
                <option>Assists</option>
                <option>Blocks</option>
                <option>Steals</option>
                <option>Threes</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px', opacity: 0.5 }}>Line</label>
              <input 
                type="number" 
                step="0.5"
                value={line} 
                onChange={(e) => setLine(parseFloat(e.target.value))}
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ddd' }}
              />
            </div>
          </div>
          <button 
            onClick={handleAnalyze} 
            disabled={analyzing}
            className={analyzing ? "" : "btn-primary-gradient"}
            style={{ width: '100%', padding: '12px', fontWeight: '900', textTransform: 'uppercase' }}
          >
            {analyzing ? 'Analyzing Matchup...' : 'Analyze'}
          </button>
        </section>

        {/* AI OUTPUT */}
        {analysis && (
          <section style={{ padding: '16px', background: '#111', color: '#fff', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', color: analysis.lean === 'MORE' ? '#4ade80' : '#f87171' }}>Lean: {analysis.lean}</span>
            </div>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: '500', lineHeight: '1.4', opacity: 0.9 }}>
              {analysis.reason}
            </p>
          </section>
        )}
      </main>
    </div>
  );
};

export default PlayerDetail;
