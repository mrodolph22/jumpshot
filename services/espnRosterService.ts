
export interface EspnRosterPlayer {
  displayName: string;
}

export interface EspnTeam {
  id: string;
  displayName: string;
  name: string;
  links: { href: string }[];
}

export interface PlayerRosterInfo {
  teamName: string;
  photoUrl?: string;
}

let rosterCache: Record<string, PlayerRosterInfo> | null = null;
let isFetching = false;

const normalizePlayerName = (name: string | undefined): string => {
  if (!name) return '';
  return name
    .normalize('NFD') // Decompose combined characters (accents)
    .replace(/[\u0300-\u036f]/g, '') // Remove accent marks
    .toLowerCase()
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/[.'\-]/g, '') // Remove periods, apostrophes, hyphens
    .replace(/[^a-z0-9 ]/g, '') // Remove other non-alphanumeric except spaces
    .trim()
    .replace(/\s+/g, ' '); // Collapse multiple spaces
};

export const fetchNbaRosters = async (): Promise<Record<string, PlayerRosterInfo>> => {
  if (rosterCache) return rosterCache;
  if (isFetching) {
    while (isFetching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return rosterCache || {};
  }

  isFetching = true;
  try {
    const teamsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams');
    const teamsData = await teamsResponse.json();
    const teams: EspnTeam[] = teamsData.sports[0].leagues[0].teams.map((t: any) => t.team);

    const map: Record<string, PlayerRosterInfo> = {};

    await Promise.all(teams.map(async (team) => {
      try {
        // ESPN Roster API: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/roster
        const rosterResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`);
        const rosterData = await rosterResponse.json();
        
        // Handle both grouped and flat structures safely
        const athletesRaw = rosterData.athletes || [];
        const athletes = athletesRaw.flatMap((group: any) => {
          if (Array.isArray(group.items)) {
            return group.items;
          }
          return group;
        });

        athletes.forEach((player: any) => {
          const name = player.displayName || player.fullName;
          if (name) {
            const normalized = normalizePlayerName(name);
            map[normalized] = {
              teamName: team.displayName,
              photoUrl: player.headshot?.href || `https://a.espncdn.com/i/headshots/nba/players/full/${player.id}.png`
            };
          }
        });
      } catch (err) {
        console.error(`Failed to fetch roster for ${team.displayName}:`, err);
      }
    }));

    console.log("Roster map size", Object.keys(map).length);
    rosterCache = map;
    return map;
  } catch (err) {
    console.error('Failed to fetch NBA teams:', err);
    return {};
  } finally {
    isFetching = false;
  }
};

export { normalizePlayerName };
