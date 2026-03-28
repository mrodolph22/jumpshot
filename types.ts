
export interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  homeTeamData?: {
    logo: string;
    abbreviation: string;
  };
  awayTeamData?: {
    logo: string;
    abbreviation: string;
  };
}

export interface EventMarket {
  key: string;
  group: string;
}

export interface Outcome {
  name: string;
  description?: string; // Player name often lives here
  price: number;
  point?: number;
  team?: string; // Added to support team grouping
}

export interface Market {
  key: string;
  last_update: string;
  outcomes: Outcome[];
}

export interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

export interface OddsResponse {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
}

export interface PlayerOffer {
  bookmaker: string;
  bookmakerTitle: string;
  overPrice?: number;
  underPrice?: number;
}

export interface PrimaryPlayerProp {
  playerName: string;
  marketKey: string;
  line: number;
  team?: string; // Added to support team grouping
  teamLogo?: string; // Added for ESPN logo support
  offers: PlayerOffer[];
  consensusStrength: 'Low' | 'Medium' | 'High';
  parlayRole: 'Anchor' | 'Support' | 'Volatile';
  marketLean?: 'MORE' | 'LESS'; // If undefined, state is neutral/unavailable
  isNotable?: boolean; // Flag for structural relevance highlight
  lineType?: 'Volume Line' | 'Efficiency Line'; // Structural classification
  fuzzyMatch?: string; // Added for debugging team resolution
  playerPhoto?: string; // Added for PlayerDetail header
}

export enum ViewState {
  API_setup = 'api_setup',
  GAMES_LIST = 'games_list',
  GAME_DETAIL = 'game_detail',
  PLAYER_DETAIL = 'player_detail'
}
