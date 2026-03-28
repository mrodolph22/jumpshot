
import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types';
import { fetchNbaEvents } from '../api/oddsApi';
import { useApiKey } from '../context/ApiKeyContext';
import { fetchEspnTeams, normalizeTeamName } from '../services/espnService';

const CACHE_TTL = 30000; // 30 seconds
const COOLDOWN_TIME = 30000; // 30 seconds

export const useEvents = () => {
  const { apiKey, clearKey } = useApiKey();
  const [events, setEvents] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timestamps for cache and cooldown
  const lastFetchRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [remainingCooldown, setRemainingCooldown] = useState<number>(0);
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState<string>('');
  const [showJustUpdated, setShowJustUpdated] = useState(false);

  // Timer for cooldown and "time ago" label
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      
      // Update cooldown
      if (lastRefreshTime > 0) {
        const diff = now - lastRefreshTime;
        const remaining = Math.max(0, Math.ceil((COOLDOWN_TIME - diff) / 1000));
        setRemainingCooldown(remaining);
      }

      // Update "time ago" label
      if (lastFetchRef.current > 0) {
        if (showJustUpdated) {
          setLastUpdatedLabel('Updated just now');
        } else {
          const secondsAgo = Math.floor((now - lastFetchRef.current) / 1000);
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
  }, [lastRefreshTime, showJustUpdated]);

  // Temporary "just updated" feedback
  useEffect(() => {
    if (showJustUpdated) {
      const timer = setTimeout(() => setShowJustUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showJustUpdated]);

  const loadEvents = useCallback(async (isManualRefresh = false, signal?: AbortSignal) => {
    if (!apiKey) return;

    const now = Date.now();

    // 1. UI Guard: Prevent concurrent requests
    if (isRefreshing || (loading && !isManualRefresh)) return;

    // 2. Cooldown Throttle (only for manual refresh)
    if (isManualRefresh) {
      const diff = now - lastRefreshRef.current;
      if (diff < COOLDOWN_TIME) {
        return; 
      }
    }

    // 3. Data Cache (only for automatic/initial load)
    if (!isManualRefresh && events.length > 0) {
      const cacheAge = now - lastFetchRef.current;
      if (cacheAge < CACHE_TTL) {
        return;
      }
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    
    setError(null);
    
    try {
      const [data, teamsArray] = await Promise.all([
        fetchNbaEvents(apiKey, signal),
        fetchEspnTeams()
      ]);

      const espnMap: Record<string, any> = {};
      teamsArray.forEach(t => {
        // Map by full name (e.g., "Denver Nuggets")
        espnMap[normalizeTeamName(t.displayName)] = t;
        // Map by mascot (e.g., "Nuggets")
        espnMap[normalizeTeamName(t.name)] = t;
        // Map by abbreviation (e.g., "DEN")
        espnMap[normalizeTeamName(t.abbreviation)] = t;
      });

      const enhancedData = data.map((game: Game) => {
        const homeData = espnMap[normalizeTeamName(game.home_team)];
        const awayData = espnMap[normalizeTeamName(game.away_team)];
        
        return {
          ...game,
          homeTeamData: homeData ? { logo: homeData.logo, abbreviation: homeData.abbreviation } : undefined,
          awayTeamData: awayData ? { logo: awayData.logo, abbreviation: awayData.abbreviation } : undefined
        };
      });

      setEvents(enhancedData);
      const fetchTime = Date.now();
      lastFetchRef.current = fetchTime;
      if (isManualRefresh) {
        lastRefreshRef.current = fetchTime;
        setLastRefreshTime(fetchTime);
        setRemainingCooldown(Math.ceil(COOLDOWN_TIME / 1000));
        setShowJustUpdated(true);
      } else if (lastFetchRef.current === fetchTime) {
        // Initial load also counts as a fetch for the label
        setLastUpdatedLabel('Updated just now');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const message = err.message || 'Failed to fetch events';
        setError(message);
        if (message.includes('Invalid API Key')) {
          clearKey();
        }
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [apiKey, clearKey, events.length, loading, isRefreshing]);

  useEffect(() => {
    const controller = new AbortController();
    loadEvents(false, controller.signal);
    return () => controller.abort();
  }, [apiKey]); // Only run when API key changes or on mount

  return { 
    events, 
    loading, 
    isRefreshing, 
    error, 
    remainingCooldown,
    lastUpdatedLabel,
    refresh: () => loadEvents(true) 
  };
};
