
export const normalizeTeamName = (name: any): string => {
  if (typeof name !== 'string') return '';
  let n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Handle common variations
  if (n === 'laclippers' || n === 'losangelesclippers') return 'clippers';
  if (n === 'lalakers' || n === 'losangeleslakers') return 'lakers';
  if (n === 'philadelphia76ers') return '76ers';
  if (n === 'portlandtrailblazers') return 'trailblazers';
  
  return n;
};

export interface EspnTeamInfo {
  id: string;
  displayName: string;
  name: string;
  logo: string;
  abbreviation: string;
}

export const fetchEspnTeams = async (): Promise<EspnTeamInfo[]> => {
  try {
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams');
    const data = await response.json();
    const teams = data.sports[0].leagues[0].teams;
    
    return teams.map((t: any) => {
      const team = t.team;
      return {
        id: team.id,
        displayName: team.displayName,
        name: team.name,
        logo: team.logos && team.logos.length > 0 ? team.logos[0].href : '',
        abbreviation: team.abbreviation
      };
    });
  } catch (err) {
    console.error("ESPN Teams Fetch Error:", err);
    return [];
  }
};

export interface PlayerStats {
  points: number;
  rebounds: number;
  assists: number;
  blocks: number;
  steals: number;
  threes: number;
}

export const fetchPlayerStats = async (playerName: string): Promise<PlayerStats> => {
  // Mocking ESPN data fetching for now as there's no direct public "search player by name" API without a key
  // In a real app, we'd search for the player ID first then fetch stats.
  console.log(`[ESPN API] Fetching stats for ${playerName}`);
  
  // Generating "realistic" stats based on player name hash for demo consistency
  const hash = playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return {
    points: (hash % 15) + 15 + (hash % 10) / 10,
    rebounds: (hash % 8) + 2 + (hash % 5) / 10,
    assists: (hash % 7) + 1 + (hash % 4) / 10,
    blocks: (hash % 3) + 0.2,
    steals: (hash % 3) + 0.5,
    threes: (hash % 4) + 1.2
  };
};

export interface OpponentContext {
  pace: 'Fast' | 'Neutral' | 'Slow';
  defense: 'Strong' | 'Average' | 'Weak';
}

export const fetchOpponentContext = async (teamName: string): Promise<OpponentContext> => {
  console.log(`[ESPN API] Fetching opponent context for ${teamName}`);
  const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const paces: ('Fast' | 'Neutral' | 'Slow')[] = ['Fast', 'Neutral', 'Slow'];
  const defenses: ('Strong' | 'Average' | 'Weak')[] = ['Strong', 'Average', 'Weak'];
  
  return {
    pace: paces[hash % 3],
    defense: defenses[(hash + 1) % 3]
  };
};
