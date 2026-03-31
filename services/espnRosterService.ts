
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
  playerId: string;
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
  if (rosterCache) return { ...rosterCache };
  if (isFetching) {
    while (isFetching) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return rosterCache ? { ...rosterCache } : {};
  }

  isFetching = true;
  console.log("[Roster Service] Starting NBA roster fetch...");
  try {
    const teamsResponse = await fetch('https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams?limit=100');
    if (!teamsResponse.ok) throw new Error(`Failed to fetch teams: ${teamsResponse.status}`);
    const teamsData = await teamsResponse.json();
    const teams: EspnTeam[] = teamsData.sports[0].leagues[0].teams.map((t: any) => t.team);

    console.log(`[Roster Service] Found ${teams.length} teams. Fetching individual rosters...`);
    const map: Record<string, PlayerRosterInfo> = {};

    const celtics = teams.find(t => t.displayName.includes('Celtics'));
    if (celtics) {
      console.log(`[Roster Service] Celtics found in teams list with ID: ${celtics.id}`);
    } else {
      console.warn("[Roster Service] Celtics NOT found in teams list!");
    }

    await Promise.all(teams.map(async (team) => {
      try {
        // ESPN Roster API: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/roster
        const rosterResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`);
        if (!rosterResponse.ok) {
          console.warn(`[Roster Service] Failed to fetch roster for ${team.displayName} (ID: ${team.id}): ${rosterResponse.status}`);
          return;
        }
        const rosterData = await rosterResponse.json();
        
        // Handle both grouped and flat structures safely
        const athletesRaw = rosterData.athletes || [];
        let athletes: any[] = [];
        if (Array.isArray(athletesRaw)) {
          athletesRaw.forEach((item: any) => {
            if (item.items && Array.isArray(item.items)) {
              athletes.push(...item.items);
            } else {
              athletes.push(item);
            }
          });
        } else if (athletesRaw && typeof athletesRaw === 'object') {
          // Some versions of the API might return an object with position keys
          Object.values(athletesRaw).forEach((group: any) => {
            if (Array.isArray(group)) {
              athletes.push(...group);
            }
          });
        }

        let teamPlayerCount = 0;
        athletes.forEach((player: any) => {
          const name = player.displayName || player.fullName || player.shortName;
          if (name) {
            const normalized = normalizePlayerName(name);
            map[normalized] = {
              teamName: team.displayName,
              photoUrl: player.headshot?.href || `https://a.espncdn.com/i/headshots/nba/players/full/${player.id}.png`,
              playerId: player.id
            };
            teamPlayerCount++;
            
            // Special debug for common players if needed
            if (normalized.includes('derrick white')) {
              console.log(`[Roster Service] Found Derrick White on ${team.displayName} (ID: ${player.id})`);
            }
          }
        });
        // console.log(`[Roster Service] Processed ${teamPlayerCount} players for ${team.displayName}`);
      } catch (err) {
        console.error(`[Roster Service] Error processing roster for ${team.displayName}:`, err);
      }
    }));

    console.log("[Roster Service] Roster map population complete. Total players:", Object.keys(map).length);
    rosterCache = map;
    return { ...map };
  } catch (err) {
    console.error('[Roster Service] Critical failure fetching NBA rosters:', err);
    return {};
  } finally {
    isFetching = false;
  }
};

export { normalizePlayerName };
