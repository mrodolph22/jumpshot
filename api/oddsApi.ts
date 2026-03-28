
import { Game, OddsResponse, EventMarket } from '../types';

const BASE_URL = 'https://api.the-odds-api.com/v4/sports/basketball_nba';
const ALLOWED_REGION = 'us';

export const fetchNbaEvents = async (apiKey: string, signal?: AbortSignal): Promise<Game[]> => {
  const url = `${BASE_URL}/events?apiKey=${apiKey}`;
  console.log(`[API CALL] Fetching Events: ${url.replace(`apiKey=${apiKey}`, 'apiKey=REDACTED')}`);
  
  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'No error body');
    throw new Error(`Events Fetch Failed: ${response.status} - ${errorBody}`);
  }
  return response.json();
};

/**
 * Discovery: Fetch which markets are actually available for this game.
 * Cost: Low (doesn't include odds data)
 * NOTE: Removed 'regions' parameter as it is not supported on this endpoint.
 */
export const fetchAvailableMarkets = async (apiKey: string, eventId: string, signal?: AbortSignal): Promise<EventMarket[]> => {
  const url = `${BASE_URL}/events/${eventId}/markets?apiKey=${apiKey}`;
  console.log(`[API CALL] Discovery Markets: ${url.replace(`apiKey=${apiKey}`, 'apiKey=REDACTED')}`);

  const response = await fetch(url, { signal });
  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'No error body');
    throw new Error(`Market Discovery Failed: ${response.status} - ${errorBody}`);
  }
  const data = await response.json();
  // Ensure we return an array
  return Array.isArray(data) ? data : [];
};

/**
 * Quota-Safe: Fetch odds for EXACTLY ONE market.
 * Cost: 1 unit per call.
 */
export const fetchOddsForMarket = async (
  apiKey: string,
  eventId: string,
  market: string,
  signal?: AbortSignal
): Promise<OddsResponse> => {
  // Strict enforcement: Only one market allowed per request.
  if (market.includes(',')) {
    throw new Error('Quota Safety Violation: Multiple markets requested in a single call.');
  }

  const url = `${BASE_URL}/events/${eventId}/odds?apiKey=${apiKey}&regions=${ALLOWED_REGION}&markets=${market}&oddsFormat=american`;
  console.log(`[API CALL] Fetching Market Odds [${market}]: ${url.replace(`apiKey=${apiKey}`, 'apiKey=REDACTED')}`);
  
  const response = await fetch(url, { signal });
  
  if (!response.ok) {
    if (response.status === 401) throw new Error('Invalid API Key');
    if (response.status === 429) throw new Error('Rate limit exceeded');
    const errorBody = await response.text().catch(() => 'No error body');
    throw new Error(`Odds Fetch Failed: ${response.status} - ${errorBody}`);
  }
  
  return response.json();
};
