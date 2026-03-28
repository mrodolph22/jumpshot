
import { useState, useEffect } from 'react';
import { fetchOddsForMarket } from '../api/oddsApi';
import { OddsResponse } from '../types';

const marketCache: Record<string, {
  data: OddsResponse;
  timestamp: number;
}> = {};

const pendingRequests: Record<string, Promise<OddsResponse>> = {};

const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

const getCacheKey = (gameId: string, market: string) =>
  `${gameId}_${market}`;

export const fetchMarketWithCache = async (apiKey: string, gameId: string, market: string, forceRefresh = false) => {
  const key = getCacheKey(gameId, market);

  const cached = marketCache[key];

  // ✅ Return valid cached data (unless forced)
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // ✅ Deduplicate requests
  if (pendingRequests[key]) {
    return pendingRequests[key];
  }

  // 🔄 Fetch new data
  const request = fetchOddsForMarket(apiKey, gameId, market)
    .then((data) => {
      marketCache[key] = {
        data,
        timestamp: Date.now(),
      };
      delete pendingRequests[key];
      return data;
    })
    .catch((err) => {
      delete pendingRequests[key];
      throw err;
    });

  pendingRequests[key] = request;

  return request;
};

export const useMarketData = (apiKey: string | null, gameId: string, market: string) => {
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);

  const loadData = async (force = false) => {
    if (!apiKey) return;
    
    const key = getCacheKey(gameId, market);
    const cached = marketCache[key];

    // Only show loading if we don't have valid cached data
    if (force || !cached || Date.now() - cached.timestamp >= CACHE_TTL) {
      setLoading(true);
    } else {
      setData(cached.data);
      setLastFetchTime(cached.timestamp);
    }

    setError(null);

    try {
      const res = await fetchMarketWithCache(apiKey, gameId, market, force);
      setData(res);
      setLastFetchTime(Date.now());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, [apiKey, gameId, market]);

  return { data, loading, error, refresh: () => loadData(true), lastFetchTime };
};
