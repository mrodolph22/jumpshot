
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Game, OddsResponse, Bookmaker, Market, Outcome, PrimaryPlayerProp, PlayerOffer, EventMarket, PLAYER_MARKETS } from '../types';
import { fetchAvailableMarkets } from '../api/oddsApi';
import { useApiKey } from '../context/ApiKeyContext';
import { useMarketData, fetchMarketWithCache } from '../hooks/useMarketData';
import { generateInsightsWithGemini, PlayerInsight } from '../services/geminiService';
import { calculateEMR } from '../utils/emrCalculator';
import { evaluateParlayRole } from '../utils/parlayFit';
import { determineLineType } from '../utils/lineTypeCalculator';
import { fetchNbaRosters, normalizePlayerName, PlayerRosterInfo } from '../services/espnRosterService';
import { normalizeTeamName } from '../services/espnService';
import { renderMarketLabelClean } from '../utils/marketUtils';

interface GameDetailProps {
  game: Game;
  onBack: () => void;
  onSelectPlayer: (player: { 
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
  }) => void;
}

const GameDetail: React.FC<GameDetailProps> = ({ game, onBack, onSelectPlayer }) => {
  const { apiKey } = useApiKey();
  const [selectedMarket, setSelectedMarket] = useState<string>('player_points');
  const [rosterMap, setRosterMap] = useState<Record<string, PlayerRosterInfo>>({});
  const [isRosterLoading, setIsRosterLoading] = useState(true);
  
  const [availableMarkets, setAvailableMarkets] = useState<string[]>([]);
  const { data: currentMarketData, loading: marketLoading, error: marketError, refresh: refreshMarket, lastFetchTime } = useMarketData(apiKey, game.id, selectedMarket);
  const [selectedBookmaker, setSelectedBookmaker] = useState<string>('draftkings');
  
  const [availableMarketsLoading, setAvailableMarketsLoading] = useState(false);
  const [insights, setInsights] = useState<PlayerInsight[] | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const hasPrefetchedRef = useRef(false);

  const lastRefreshRef = useRef<number>(0);
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('');
  const [showJustUpdated, setShowJustUpdated] = useState(false);

  useEffect(() => {
    setIsRosterLoading(true);
    fetchNbaRosters().then(map => {
      setRosterMap(map);
      setIsRosterLoading(false);
      const keys = Object.keys(map);
      console.log(`[GameDetail] Roster map loaded with ${keys.length} players.`);
      if (keys.length > 0) {
        console.log("[GameDetail] Sample roster keys:", keys.slice(0, 10));
      }
    }).catch(err => {
      console.error("[GameDetail] Failed to load rosters:", err);
      setIsRosterLoading(false);
    });
  }, []);

  // Cooldown and "time ago" timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Cooldown
      if (lastRefreshRef.current > 0) {
        const diff = now - lastRefreshRef.current;
        const remaining = Math.max(0, Math.ceil((30000 - diff) / 1000));
        setRemainingCooldown(remaining);
      }

      // Time ago label
      if (lastFetchTime > 0) {
        if (showJustUpdated) {
          setLastUpdatedLabel('Updated just now');
        } else {
          const secondsAgo = Math.floor((now - lastFetchTime) / 1000);
          if (secondsAgo < 60) {
            setLastUpdatedLabel(`Updated ${secondsAgo}s ago`);
          } else {
            const minutesAgo = Math.floor(secondsAgo / 60);
            setLastUpdatedLabel(`Updated ${minutesAgo}m ago`);
          }
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastFetchTime, showJustUpdated]);

  useEffect(() => {
    if (showJustUpdated) {
      const timer = setTimeout(() => setShowJustUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showJustUpdated]);

  const handleRefresh = () => {
    const now = Date.now();
    if (now - lastRefreshRef.current < 30000) return;
    
    refreshMarket();
    lastRefreshRef.current = now;
    setShowJustUpdated(true);
  };

  // Reset prefetch guard on game change
  useEffect(() => {
    hasPrefetchedRef.current = false;
  }, [game.id]);

  useEffect(() => {
    if (!apiKey) return;
    const controller = new AbortController();
    setAvailableMarketsLoading(true);
    fetchAvailableMarkets(apiKey, game.id, controller.signal)
      .then(markets => {
        const playerKeys = markets.map(m => m.key).filter(k => k.startsWith('player_'));
        setAvailableMarkets(playerKeys);
        setAvailableMarketsLoading(false);
        if (playerKeys.length === 0) setAvailableMarkets(PLAYER_MARKETS);
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          setAvailableMarkets(PLAYER_MARKETS);
          setAvailableMarketsLoading(false);
        }
      });
    return () => controller.abort();
  }, [game.id, apiKey]);

  // Prefetch remaining markets in background with staggering to avoid rate limits
  useEffect(() => {
    if (!apiKey || availableMarkets.length === 0 || !currentMarketData || hasPrefetchedRef.current) return;
    
    hasPrefetchedRef.current = true;

    const timers: number[] = [];
    const startDelay = 800; // Wait 800ms before starting prefetch
    const staggerDelay = 500; // 500ms between each prefetch

    const PRIORITY_MARKETS = [
      'player_assists',
      'player_rebounds',
      'player_threes'
    ];

    // Filter valid + exclude current tab + limit to 2
    const marketsToPrefetch = PRIORITY_MARKETS
      .filter(m => availableMarkets.includes(m) && m !== selectedMarket)
      .slice(0, 2);

    marketsToPrefetch.forEach((market, index) => {
      const timer = window.setTimeout(() => {
        fetchMarketWithCache(apiKey, game.id, market).catch(() => {});
      }, startDelay + index * staggerDelay);
      timers.push(timer);
    });

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [apiKey, game.id, availableMarkets, currentMarketData]);

  useEffect(() => {
    setInsights(null);
  }, [selectedMarket, selectedBookmaker]);

  const primaryProps = useMemo<PrimaryPlayerProp[]>(() => {
    const data = currentMarketData;
    if (!data) return [];

    const rawDataMap: Record<string, { team?: string; fuzzyMatch?: string; lines: Record<number, PlayerOffer[]> }> = {};

    // Build rawDataMap
    data.bookmakers.forEach((bookie) => {
      bookie.markets.forEach((market) => {
        market.outcomes.forEach((outcome) => {
          const playerName = outcome.description || 'Unknown';
          const line = outcome.point ?? 0;
          const key = `${playerName}|${market.key}`;
          
          if (!rawDataMap[key]) {
            const normalizedName = normalizePlayerName(playerName);
            
            // STEP 1: ESPN ROSTER MATCH (Exact)
            let resolvedTeam: string | undefined = undefined;
            const rosterInfo = rosterMap[normalizedName];
            if (rosterInfo) {
              resolvedTeam = rosterInfo.teamName;
            }
            let fuzzyMatchKey: string | undefined = undefined;

            // STEP 2: FUZZY MATCH
            if (!resolvedTeam) {
              fuzzyMatchKey = Object.keys(rosterMap).find(name => 
                name.includes(normalizedName) || normalizedName.includes(name)
              );
              if (fuzzyMatchKey) {
                resolvedTeam = rosterMap[fuzzyMatchKey].teamName;
              }
            }

            // STEP 3: ODDS API FALLBACK
            if (!resolvedTeam && outcome.team) {
              resolvedTeam = outcome.team;
            }
            
            rawDataMap[key] = { 
              team: resolvedTeam, 
              fuzzyMatch: fuzzyMatchKey,
              lines: {} 
            };
          }
          if (!rawDataMap[key].lines[line]) {
            rawDataMap[key].lines[line] = [];
          }
          
          const existing = rawDataMap[key].lines[line].find(o => o.bookmaker === bookie.key);
          if (existing) {
            if (outcome.name === 'Over') existing.overPrice = outcome.price;
            if (outcome.name === 'Under') existing.underPrice = outcome.price;
          } else {
            rawDataMap[key].lines[line].push({
              bookmaker: bookie.key,
              bookmakerTitle: bookie.title,
              overPrice: outcome.name === 'Over' ? outcome.price : undefined,
              underPrice: outcome.name === 'Under' ? outcome.price : undefined,
            });
          }
        });
      });
    });

    const results: PrimaryPlayerProp[] = [];
    Object.keys(rawDataMap).forEach(key => {
      const { team, lines: linesMap } = rawDataMap[key];
      const lines = Object.keys(linesMap).map(Number);
      
      // Prioritize selected bookmaker's line
      let primaryLine = lines[0];
      const lineWithSelectedBookie = lines.find(line => 
        linesMap[line].some(o => o.bookmaker === selectedBookmaker && o.overPrice !== undefined && o.underPrice !== undefined)
      );
      
      if (lineWithSelectedBookie !== undefined) {
        primaryLine = lineWithSelectedBookie;
      } else {
        // Fallback to consensus line
        let maxCount = -1;
        lines.forEach(line => {
          const count = linesMap[line].filter(o => o.overPrice && o.underPrice).length;
          if (count > maxCount) { maxCount = count; primaryLine = line; }
        });
      }
      
      const [playerName, marketKey] = key.split('|');
      
      const offersAtPrimary = linesMap[primaryLine];
      
      let consensusStrength: 'Low' | 'Medium' | 'High' = 'Low';
      const bookCount = offersAtPrimary.length;
      let avgOverPrice = -110;
      let avgUnderPrice = -110;
      let marketLean: 'MORE' | 'LESS' | undefined = undefined;
      
      if (bookCount >= 1) {
        const overPrices = offersAtPrimary.map(o => o.overPrice).filter((p): p is number => p !== undefined);
        const underPrices = offersAtPrimary.map(o => o.underPrice).filter((p): p is number => p !== undefined);
        
        if (overPrices.length > 0 && underPrices.length > 0) {
          avgOverPrice = overPrices.reduce((a, b) => a + b, 0) / overPrices.length;
          avgUnderPrice = underPrices.reduce((a, b) => a + b, 0) / underPrices.length;
          marketLean = avgOverPrice < avgUnderPrice ? 'MORE' : 'LESS';
        }

        if (bookCount >= 2) {
          const overFavoredCount = overPrices.filter(p => p < 0).length;
          const underFavoredCount = underPrices.filter(p => p < 0).length;
          const juiceAligned = overFavoredCount === overPrices.length || underFavoredCount === overPrices.length;

          if (bookCount >= 3) {
            consensusStrength = juiceAligned ? 'High' : 'Medium';
          } else {
            consensusStrength = 'Medium';
          }
        }
      }

      const parlayRole = evaluateParlayRole(primaryLine, marketKey, consensusStrength, avgOverPrice);
      const lineType = determineLineType(primaryLine, marketKey, consensusStrength);

      results.push({ 
        playerName, 
        marketKey, 
        line: primaryLine, 
        team,
        offers: offersAtPrimary,
        consensusStrength,
        parlayRole,
        marketLean,
        lineType,
        fuzzyMatch: rawDataMap[key].fuzzyMatch
      });
    });

    // --- STRUCTURAL NOTABLE SELECTION LOGIC ---
    const eligible = results.filter(p => {
      const offer = p.offers.find(o => o.bookmaker === selectedBookmaker);
      const pricingAvailable = offer && offer.overPrice !== undefined && offer.underPrice !== undefined;
      return p.marketLean !== undefined && pricingAvailable;
    });

    const getStabilityScore = (p: PrimaryPlayerProp) => {
      const emr = calculateEMR(p, selectedBookmaker).value;
      const isHook = p.line % 1 !== 0;
      return emr + (isHook ? 5 : 0);
    };

    const sortedAnchors = eligible.filter(p => p.parlayRole === 'Anchor').sort((a, b) => getStabilityScore(a) - getStabilityScore(b)).slice(0, 2);
    const sortedSupport = eligible.filter(p => p.parlayRole === 'Support').sort((a, b) => getStabilityScore(a) - getStabilityScore(b)).slice(0, 2);
    const sortedVolatile = eligible.filter(p => p.parlayRole === 'Volatile').sort((a, b) => getStabilityScore(a) - getStabilityScore(b)).slice(0, 2);

    const notablePlayers = new Set([...sortedAnchors, ...sortedSupport, ...sortedVolatile].map(p => p.playerName));

    results.forEach(p => {
      if (notablePlayers.has(p.playerName)) {
        p.isNotable = true;
      }
    });

    return results.sort((a, b) => a.playerName.localeCompare(b.playerName));
  }, [currentMarketData, selectedBookmaker, rosterMap]);

  const { awayPlayers, homePlayers } = useMemo(() => {
    const away: PrimaryPlayerProp[] = [];
    const home: PrimaryPlayerProp[] = [];

    const nHome = normalizeTeamName(game.home_team);
    const nAway = normalizeTeamName(game.away_team);

    primaryProps.forEach(prop => {
      let resolvedTeam = prop.team;
      const normalizedName = normalizePlayerName(prop.playerName);

      // STEP 4: FINAL FALLBACK (CONTROLLED)
      if (!resolvedTeam) {
        // Try to see if the player name contains either team name (unlikely but possible for some reason)
        const nPlayer = prop.playerName.toLowerCase();
        const nHomeTeam = game.home_team.toLowerCase();
        const nAwayTeam = game.away_team.toLowerCase();
        
        if (nPlayer.includes(nHomeTeam) || nHomeTeam.includes(nPlayer)) {
          resolvedTeam = game.home_team;
        } else if (nPlayer.includes(nAwayTeam) || nAwayTeam.includes(nPlayer)) {
          resolvedTeam = game.away_team;
        } else {
          // Balance fallback
          resolvedTeam = away.length <= home.length ? game.away_team : game.home_team;
        }
        
        console.warn("Fallback team assignment used", {
          playerName: prop.playerName,
          assignedTeam: resolvedTeam,
          reason: "No match in roster map or odds API"
        });
      }

      // ENHANCED DEBUG LOGGING
      console.warn("Player team resolution debug", {
        playerName: prop.playerName,
        normalizedName,
        espnMatch: !!rosterMap[normalizedName],
        fuzzyMatched: !!prop.fuzzyMatch,
        oddsTeam: prop.team || null, // Original resolved team before step 4
        finalResolvedTeam: resolvedTeam,
        home: game.home_team,
        away: game.away_team
      });

      const nPropTeam = normalizeTeamName(resolvedTeam);
      if (nPropTeam === nHome) {
        home.push({ ...prop, team: resolvedTeam });
      } else if (nPropTeam === nAway) {
        away.push({ ...prop, team: resolvedTeam });
      } else {
        // This should technically not happen anymore with Step 4, 
        // but we keep it for safety in case nPropTeam doesn't match either game team
        if (away.length <= home.length) {
          away.push({ ...prop, team: resolvedTeam });
        } else {
          home.push({ ...prop, team: resolvedTeam });
        }
      }
    });

    return { awayPlayers: away, homePlayers: home };
  }, [primaryProps, game, rosterMap]);

  const currentBookmakers = useMemo(() => {
    const data = currentMarketData;
    return data ? data.bookmakers.map(b => ({ key: b.key, title: b.title })) : [];
  }, [currentMarketData]);

  useEffect(() => {
    if (currentBookmakers.length > 0) {
      const exists = currentBookmakers.some(b => b.key === selectedBookmaker);
      if (!exists) {
        setSelectedBookmaker(currentBookmakers[0].key);
      }
    }
  }, [currentBookmakers, selectedBookmaker]);

  const handleGenerateInsights = useCallback(async () => {
    const currentData = currentMarketData;
    if (!currentData) return;
    setAnalyzing(true);
    
    // Only include players with valid odds and a market lean
    const context = primaryProps
      .filter(p => {
        const offer = p.offers.find(o => o.bookmaker === selectedBookmaker);
        return offer && offer.overPrice !== undefined && offer.underPrice !== undefined && p.marketLean;
      })
      .map(p => ({
        name: p.playerName,
        team: p.team,
        line: p.line,
        lean: p.marketLean || 'NEUTRAL',
        consensus: p.consensusStrength,
        role: p.parlayRole,
        offers: p.offers.map(o => ({ b: o.bookmaker, o: o.overPrice, u: o.underPrice }))
      }));

    if (context.length === 0) {
      setAnalyzing(false);
      return;
    }

    const result = await generateInsightsWithGemini(selectedMarket, context);
    setInsights(result);
    setAnalyzing(false);
  }, [currentMarketData, selectedMarket, primaryProps, selectedBookmaker]);

  const renderMarketLabel = (key: string) => key.replace('player_', '').replace('_', ' ').toUpperCase();

  const formatRiskLevel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  };

  const renderPlayerCard = (prop: PrimaryPlayerProp, teamLogo?: string, col?: number, row?: number) => {
    const offer = prop.offers.find(o => o.bookmaker === selectedBookmaker);
    const playerInsight = insights?.find(i => i.playerName === prop.playerName);
    const emr = calculateEMR(prop, selectedBookmaker);
    
    const favoredPrice = prop.marketLean === 'MORE' ? offer?.overPrice : offer?.underPrice;
    const showAdvancedData = !!insights;
    const marketAvailable = !!(offer && offer.overPrice !== undefined && offer.underPrice !== undefined);

    // Pre-AI state is when insights are null.
    // Post-AI use the full structure (255px).
    // Market Unavailable in Pre-AI state now uses compact structure (140px).
    const isFullStructure = showAdvancedData;

    // Logic for PRE-AI stronger side selection
    const getStrongerSide = () => {
      if (!marketAvailable) return null;
      if (offer!.overPrice! <= offer!.underPrice!) {
        return { side: 'OVER', price: offer!.overPrice };
      } else {
        return { side: 'UNDER', price: offer!.underPrice };
      }
    };

    const strongerSide = getStrongerSide();

    // 1. INPUTS
    const consensus = prop.consensusStrength; // 'Low' | 'Medium' | 'High'
    const insightText = playerInsight?.insight || "";
    const lineTypeRaw = prop.lineType; // 'Volume Line' | 'Efficiency Line' | undefined
    const lineType = lineTypeRaw === 'Volume Line' ? 'volume' : lineTypeRaw === 'Efficiency Line' ? 'efficiency' : 'standard';

    // 2. BASE SCORE
    let baseScore = 40; // Default for LOW
    if (consensus === 'High') baseScore = 75;
    else if (consensus === 'Medium') baseScore = 60;

    // Adjust based on insight text if available
    const isStrong = insightText.toLowerCase().includes("strong");
    if (isStrong && consensus !== 'High') {
      baseScore = 75; // Upgrade to High if insight says strong
    }

    // 3. APPLY LINE TYPE ADJUSTMENT
    let finalScore = baseScore;
    if (lineType === "volume") finalScore += 10;
    else if (lineType === "efficiency") finalScore -= 10;

    // 4. FINAL COLOR
    let finalColor = '#ef4444'; // RED (default)
    let finalBg = 'rgba(239, 68, 68, 0.1)';
    if (finalScore >= 70) {
      finalColor = '#22c55e'; // GREEN
      finalBg = 'rgba(34, 197, 94, 0.1)';
    } else if (finalScore >= 50) {
      finalColor = '#eab308'; // YELLOW
      finalBg = 'rgba(234, 179, 8, 0.1)';
    }

    return (
      <div 
        key={prop.playerName} 
        className={`card player-group ${col === 1 ? 'card-away' : 'card-home'}`} 
        onClick={() => {
          const teamName = prop.team;
          const isHome = teamName === game.home_team;
          const opponentTeamName = isHome ? game.away_team : game.home_team;
          const opponentLogo = isHome ? game.awayTeamData?.logo : game.homeTeamData?.logo;
          
          const rosterInfo = rosterMap[normalizePlayerName(prop.playerName)] || 
                             (prop.fuzzyMatch ? rosterMap[prop.fuzzyMatch] : null);
          const playerPhoto = rosterInfo?.photoUrl;
          
          onSelectPlayer({
            playerName: prop.playerName,
            teamName,
            teamLogo,
            opponentTeamName,
            opponentLogo,
            playerPhoto,
            playerId: rosterInfo?.playerId,
            statType: renderMarketLabelClean(selectedMarket),
            line: prop.line,
            bookmakerName: offer?.bookmakerTitle,
            bookmakerKey: selectedBookmaker,
            gameId: game.id
          });
        }}
        style={{ 
          display: 'flex', 
          flexDirection: 'column',
          padding: '0',
          minHeight: isFullStructure ? '255px' : '140px',
          height: '100%',
          gridRow: row,
          gap: '0',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.08)',
          cursor: 'pointer'
        }}
      >
        {/* 1. HEADER */}
        <div className="player-header" style={{ 
          display: 'flex', 
          flexDirection: 'column',
          padding: '10px 12px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0,
          background: 'rgba(0,0,0,0.01)',
          gap: '8px',
          alignItems: 'center'
        }}>
          {/* Row 1: Team (Left) */}
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
              {teamLogo && (
                <img 
                  src={teamLogo} 
                  alt="" 
                  style={{ width: '14px', height: '14px', objectFit: 'contain', opacity: 0.8, flexShrink: 0 }} 
                  referrerPolicy="no-referrer" 
                />
              )}
              <span style={{ fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', opacity: 0.5, whiteSpace: 'nowrap', letterSpacing: '0.5px' }}>
                {prop.team}
              </span>
            </div>
          </div>

          {/* Row 2: Player Photo and Name (Stacked) */}
          <div style={{ textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            {(() => {
              const rosterInfo = rosterMap[normalizePlayerName(prop.playerName)] || 
                                 (prop.fuzzyMatch ? rosterMap[prop.fuzzyMatch] : null);
              return rosterInfo?.photoUrl ? (
                <img 
                  src={rosterInfo.photoUrl} 
                  alt="" 
                  style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', background: '#f0f0f0', border: '2px solid #fff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#9ca3af', fontWeight: 'bold' }}>
                  {prop.playerName.split(' ').map(n => n[0]).join('')}
                </div>
              );
            })()}
            <span style={{ 
              fontSize: '13px', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '0.3px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              width: '100%'
            }}>
              {prop.playerName}
            </span>
          </div>
        </div>

        {/* 2. BODY (FIXED SECTIONS) */}
        <div className="player-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0' }}>
          
          {/* SECTION A — LINE (FIXED HEIGHT) */}
          <div style={{ height: isFullStructure ? '38px' : '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
            <span style={{ fontSize: isFullStructure ? '18px' : '16px', fontWeight: '900', lineHeight: '1' }}>{prop.line}</span>
            <span style={{ fontSize: '8px', fontWeight: '700', textTransform: 'uppercase', opacity: 0.5 }}>{renderMarketLabel(prop.marketKey)}</span>
          </div>

          {/* SECTION B — ODDS (FIXED HEIGHT) */}
          <div style={{ height: isFullStructure ? '52px' : '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 10px' }}>
            {!marketAvailable ? (
              <span style={{ fontSize: '10px', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Market unavailable</span>
            ) : showAdvancedData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="prediction-badge" style={{ width: '38px', textAlign: 'center', padding: '1px 0', fontSize: '8px', fontWeight: '900', background: finalBg, color: finalColor }}>
                    {prop.marketLean}
                  </span>
                  <span style={{ fontWeight: '900', fontSize: '13px', color: finalColor }}>
                    {favoredPrice}
                  </span>
                </div>
                <div style={{ fontSize: '8px', fontWeight: '700', color: '#4b5563', opacity: 0.7 }}>
                  {favoredPrice !== undefined && (favoredPrice < 0 ? `risk $${Math.abs(favoredPrice)} to win $100` : `win $${Math.abs(favoredPrice)} on $100`)}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1px' }}>
                {strongerSide && (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '9px', fontWeight: '800', color: '#4b5563' }}>{strongerSide.side}</span>
                      <span style={{ fontSize: '11px', fontWeight: '900', color: '#111827' }}>{strongerSide.price}</span>
                    </div>
                    <div style={{ fontSize: '8px', fontWeight: 'bold', color: '#9ca3af', textTransform: 'lowercase' }}>
                      {strongerSide.price < 0 ? `risk $${Math.abs(strongerSide.price)} to win $100` : `win $${Math.abs(strongerSide.price)} on $100`}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SECTION C — META (FIXED HEIGHT) */}
          {isFullStructure && (
            <div style={{ height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', borderTop: '1px solid rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
              {showAdvancedData && marketAvailable && (
                <>
                  <span style={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Consensus: {prop.consensusStrength}</span>
                  <span style={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Role: {prop.parlayRole}</span>
                  <span style={{ fontSize: '7px', fontWeight: 800, textTransform: 'uppercase', opacity: 0.6 }}>Risk: {emr.value}%</span>
                </>
              )}
            </div>
          )}

          {/* SECTION D — INSIGHT (FIXED HEIGHT) */}
          {isFullStructure && (
            <div style={{ height: '58px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 14px', overflow: 'hidden' }}>
              {!marketAvailable ? (
                <div style={{ fontSize: '9px', color: '#9ca3af', fontWeight: 600, textAlign: 'center', lineHeight: '1.3' }}>
                  No betting lines available for this market<br />
                  Check another category or sportsbook
                </div>
              ) : showAdvancedData ? (
                <div style={{ 
                  fontSize: '9px', 
                  color: '#4b5563', 
                  lineHeight: '1.3', 
                  fontWeight: 600, 
                  width: '100%', 
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {playerInsight ? (
                    <div style={{ whiteSpace: 'pre-line' }}>{playerInsight.insight}</div>
                  ) : (() => {
                    const strength = prop.consensusStrength === 'High' ? 'strong' : prop.consensusStrength === 'Medium' ? 'moderate' : 'speculative';
                    const outcome = prop.marketLean === 'MORE' ? 'higher scoring' : 'lower scoring';
                    const roleAction = prop.parlayRole === 'Support' 
                      ? (prop.marketLean === 'MORE' ? 'increases scoring volume' : 'reduces offensive volume')
                      : (prop.marketLean === 'MORE' ? 'drives more shots' : 'limits opponent efficiency');
                    
                    return (
                      <>
                        {prop.marketLean} is {strength}<br />
                        Market expects {outcome}<br />
                        {prop.parlayRole} role {roleAction}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* 3. FOOTER (FIXED POSITION) */}
        <div className="player-footer" style={{ 
          height: '33px',
          padding: '0 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(0,0,0,0.01)',
          borderTop: '1px solid rgba(0,0,0,0.06)',
          flexShrink: 0
        }}>
          <div className="footer-left">
            {marketAvailable && (
              <span style={{ 
                fontSize: '8px', 
                padding: '2px 6px', 
                background: '#f3f4f6', 
                color: '#4b5563',
                borderRadius: '3px',
                fontWeight: 800,
                textTransform: 'uppercase'
              }}>
                {prop.lineType || 'Standard Line'}
              </span>
            )}
          </div>
          <div className="footer-right">
            {marketAvailable && prop.isNotable && (
              <span style={{ fontSize: '9px', fontWeight: '500', color: '#4b5563', opacity: 0.85, whiteSpace: 'nowrap' }}>
                ⭐ Consistent role and usage
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const isCoolingDown = remainingCooldown > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', paddingBottom: '32px' }}>
      <header>
        <button onClick={onBack} style={{ fontWeight: '900' }}>BACK</button>
        <h1 style={{ 
          margin: 0, 
          fontSize: '11px', 
          fontWeight: '900', 
          textTransform: 'uppercase', 
          flex: 1, 
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px'
        }}>
          {game.awayTeamData?.logo && (
            <img src={game.awayTeamData.logo} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
          )}
          <span>{game.away_team} <span style={{ color: '#9ca3af' }}>@</span> {game.home_team}</span>
          {game.homeTeamData?.logo && (
            <img src={game.homeTeamData.logo} alt="" style={{ width: '20px', height: '20px', objectFit: 'contain' }} referrerPolicy="no-referrer" />
          )}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <button 
              onClick={handleRefresh} 
              disabled={marketLoading || isCoolingDown}
              style={{ 
                fontWeight: '900',
                opacity: isCoolingDown ? 0.5 : 1,
                cursor: isCoolingDown ? 'not-allowed' : 'pointer'
              }}
              title={isCoolingDown ? "Refresh limited to prevent excessive API usage" : ""}
            >
              {marketLoading ? '...' : isCoolingDown ? `${remainingCooldown}S` : 'REFRESH'}
            </button>
            {lastUpdatedLabel && (
              <span style={{ fontSize: '7px', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase' }}>
                {lastUpdatedLabel}
              </span>
            )}
          </div>
        </div>
      </header>

      <main>
        <div className="tab-container">
          {availableMarkets.map(m => (
            <button 
              key={m} 
              onClick={() => setSelectedMarket(m)}
              className={`tab-item ${selectedMarket === m ? 'active' : ''}`}
            >
              {renderMarketLabelClean(m)}
            </button>
          ))}
        </div>

        {!marketLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="label-tiny">Sportsbook</span>
                <select value={selectedBookmaker} onChange={(e) => setSelectedBookmaker(e.target.value)}>
                  {currentBookmakers.map(b => <option key={b.key} value={b.key}>{b.title}</option>)}
                </select>
              </div>
              <button 
                onClick={handleGenerateInsights} 
                disabled={analyzing} 
                className={analyzing ? "" : "btn-primary-gradient"}
                style={{ fontSize: '9px', padding: '8px 16px' }}
              >
                {analyzing ? 'Analyzing Structure...' : 'ANALYZE'}
              </button>
            </div>

            {marketLoading && <div className="label-tiny" style={{ textAlign: 'center' }}>Updating Feed...</div>}
            {marketError && <div className="label-tiny" style={{ color: '#dc2626', textAlign: 'center' }}>{marketError}</div>}

            <div className="team-group-grid">
              <div className="team-column">
                {awayPlayers.length === 0 && !marketLoading && (
                   <div className="label-tiny" style={{ textAlign: 'center', padding: '10px', gridColumn: 1, gridRow: 1 }}>No lines</div>
                )}
                {awayPlayers.map((p, index) => renderPlayerCard(p, game.awayTeamData?.logo, 1, index + 1))}
              </div>

              <div className="team-column">
                {homePlayers.length === 0 && !marketLoading && (
                   <div className="label-tiny" style={{ textAlign: 'center', padding: '10px', gridColumn: 2, gridRow: 1 }}>No lines</div>
                )}
                {homePlayers.map((p, index) => renderPlayerCard(p, game.homeTeamData?.logo, 2, index + 1))}
              </div>
            </div>
          </div>
        )}
        {marketLoading && !currentMarketData && (
          <div className="label-tiny" style={{ textAlign: 'center', padding: '40px' }}>Loading Market Data...</div>
        )}

        {/* Glossary Section */}
        <div style={{ 
          marginTop: '40px', 
          padding: '0', 
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: '8px',
          background: '#fff',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{ padding: '20px 16px 0' }}>
            <h3 style={{ 
              fontSize: '10px', 
              fontWeight: '900', 
              textTransform: 'uppercase', 
              letterSpacing: '1px', 
              color: '#9ca3af',
              marginBottom: '8px'
            }}>
              Glossary
            </h3>
            <div style={{ height: '1px', background: '#f3f4f6', marginBottom: '20px' }}></div>
          </div>
          
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
            gap: '24px',
            padding: '0 16px 24px'
          }}>
            {[
              { term: 'STANDARD LINE', def: 'Baseline projection based on historical averages and market consensus.' },
              { term: 'VOLUME LINE', def: 'Projection driven by high usage or shot attempts, indicating high activity levels.' },
              { term: 'EFFICIENCY LINE', def: 'Relies on high conversion rates or performance quality rather than raw volume.' },
              { term: 'CONSENSUS', def: 'The level of agreement across multiple sportsbooks regarding the line and odds.' },
              { term: 'ANCHOR ROLE', def: 'Primary offensive or defensive driver with high, stable usage.' },
              { term: 'SUPPORT ROLE', def: 'Contributes based on team flow, often filling gaps left by stars.' },
              { term: 'VOLATILE ROLE', def: 'High-variance performance, often dependent on specific matchups or hot streaks.' },
              { term: 'RISK', def: 'Calculated Expected Margin of Risk (EMR) based on line volatility and juice.' },
              { term: 'LINE VOLATILITY', def: 'The degree to which a betting line fluctuates based on market action or news.' },
              { term: 'JUICE', def: 'The commission charged by the sportsbook (vig), reflected in the odds.' },
              { term: 'CONSISTENT ROLE & USAGE', def: 'Indicates a player whose minutes and shot attempts remain stable over time.' }
            ].map((item, idx) => (
              <div key={idx} style={{ 
                display: 'flex', 
                flexDirection: 'column',
                gap: '4px'
              }}>
                <div style={{ 
                  fontSize: '9px', 
                  fontWeight: '900', 
                  color: '#111827',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {item.term}
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280', lineHeight: '1.5', fontWeight: '500' }}>
                  {item.def}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default GameDetail;
