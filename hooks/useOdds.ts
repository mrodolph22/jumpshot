
import { useState, useEffect, useCallback } from 'react';
import { OddsResponse } from '../types';
// Fix: fetchOddsForGame does not exist in api/oddsApi.ts, corrected to use fetchOddsForMarket.
import { fetchOddsForMarket } from '../api/oddsApi';
import { useApiKey } from '../context/ApiKeyContext';

export const useOdds = (eventId: string | null, markets: string) => {
  const { apiKey, clearKey } = useApiKey();
  const [data, setData] = useState<OddsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOdds = useCallback(async (signal?: AbortSignal) => {
    if (!apiKey || !eventId) return;
    setLoading(true);
    setError(null);
    try {
      // Fix: Calling fetchOddsForMarket as defined in the API service.
      const response = await fetchOddsForMarket(apiKey, eventId, markets, signal);
      setData(response);
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const message = err.message || 'Failed to fetch odds';
        setError(message);
        // If the API says the key is invalid, clear it to trigger the setup screen
        if (message.includes('Invalid API Key')) {
          console.warn('Invalid API Key detected during odds fetch, clearing...');
          clearKey();
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiKey, eventId, markets, clearKey]);

  useEffect(() => {
    const controller = new AbortController();
    loadOdds(controller.signal);
    return () => controller.abort();
  }, [loadOdds]);

  return { data, loading, error, refresh: loadOdds };
};
