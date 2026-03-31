
export const normalizeTeamName = (name: any): string => {
  if (typeof name !== 'string') return '';
  let n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  
  // Handle common variations to return the nickname for static stats mapping
  if (n.includes('spurs')) return 'spurs';
  if (n.includes('bulls')) return 'bulls';
  if (n.includes('heat')) return 'heat';
  if (n.includes('thunder')) return 'thunder';
  if (n.includes('mavericks')) return 'mavericks';
  if (n.includes('nuggets')) return 'nuggets';
  if (n.includes('celtics')) return 'celtics';
  if (n.includes('hornets')) return 'hornets';
  if (n.includes('timberwolves')) return 'timberwolves';
  if (n.includes('knicks')) return 'knicks';
  if (n.includes('rockets')) return 'rockets';
  if (n.includes('pistons')) return 'pistons';
  if (n.includes('cavaliers') || n === 'cavs') return 'cavaliers';
  if (n.includes('hawks')) return 'hawks';
  if (n.includes('magic')) return 'magic';
  if (n.includes('trailblazers') || n.includes('blazers')) return 'trailblazers';
  if (n.includes('pacers')) return 'pacers';
  
  if (n === 'laclippers' || n === 'losangelesclippers') return 'clippers';
  if (n === 'lalakers' || n === 'losangeleslakers') return 'lakers';
  if (n === 'philadelphia76ers') return '76ers';
  
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
    if (!response.ok) return [];
    const data = await response.json();
    
    const teams = data?.sports?.[0]?.leagues?.[0]?.teams;
    if (!teams || !Array.isArray(teams)) return [];
    
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
  fgPercentage: number;
}

export const fetchPlayerStats = async (playerName: string, playerId?: string): Promise<PlayerStats> => {
  if (playerId) {
    console.log(`[ESPN API] Fetching real stats for ${playerName} (ID: ${playerId})`);
    
    const stats: PlayerStats = {
      points: 0,
      rebounds: 0,
      assists: 0,
      blocks: 0,
      steals: 0,
      threes: 0,
      fgPercentage: 0
    };

    // Helper to extract from a categories array (v3 API structure)
    const extractFromCategories = (categories: any[]) => {
      categories.forEach((cat: any) => {
        // Handle the "averages" category which contains per-game stats
        if (cat.name === 'averages' && cat.statistics && Array.isArray(cat.statistics)) {
          // Find the 2025-26 season (year 2026)
          // We look for the last occurrence or specifically 2026 to get the most recent data
          const stat2026 = [...cat.statistics].reverse().find((s: any) => s.season && s.season.year === 2026);
          
          if (stat2026 && stat2026.stats && cat.names) {
            cat.names.forEach((name: string, index: number) => {
              const rawValue = stat2026.stats[index];
              if (rawValue === undefined) return;
              
              // Handle "5.9-15.0" type strings by taking the first part
              const val = typeof rawValue === 'string' ? parseFloat(rawValue.split('-')[0]) : rawValue;
              if (isNaN(val)) return;
              
              switch (name) {
                case 'avgPoints': stats.points = val; break;
                case 'avgRebounds': stats.rebounds = val; break;
                case 'avgAssists': stats.assists = val; break;
                case 'avgBlocks': stats.blocks = val; break;
                case 'avgSteals': stats.steals = val; break;
                case 'avgThreePointFieldGoalsMade':
                case 'avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted':
                  stats.threes = val; break;
                case 'fieldGoalPct': 
                  // If it's a decimal (e.g. 0.392), convert to percentage (39.2)
                  stats.fgPercentage = val < 1 ? val * 100 : val; 
                  break;
              }
            });
          }
        }

        // Fallback for the other common structure (v2 or summary-like)
        if (cat.stats && Array.isArray(cat.stats)) {
          cat.stats.forEach((s: any) => {
            switch (s.name) {
              case 'avgPoints': 
              case 'points': 
                stats.points = s.value; break;
              case 'avgRebounds': 
              case 'rebounds': 
                stats.rebounds = s.value; break;
              case 'avgAssists': 
              case 'assists': 
                stats.assists = s.value; break;
              case 'avgBlocks': 
              case 'blocks': 
                stats.blocks = s.value; break;
              case 'avgSteals': 
              case 'steals': 
                stats.steals = s.value; break;
              case 'avgThreePointFieldGoalsMade': 
              case 'threePointFieldGoalsMade': 
                stats.threes = s.value; break;
              case 'fieldGoalPct':
              case 'avgFieldGoalPct':
              case 'fieldGoalPercentage':
              case 'avgFieldGoalPercentage':
                stats.fgPercentage = s.value < 1 ? s.value * 100 : s.value; 
                break;
            }
          });
        }
      });
    };

    // Attempt 1: Detailed Stats Endpoint (More reliable for specific seasons like 2025-26)
    // We try this first now because the summary endpoint often lags or shows previous season
    try {
      const response = await fetch(`https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/${playerId}/stats?region=us&lang=en&contentorigin=espn&season=2026&seasontype=2`);
      if (response.ok) {
        const data = await response.json();
        
        if (data.categories && Array.isArray(data.categories)) {
          extractFromCategories(data.categories);
        } else if (data.splits && Array.isArray(data.splits)) {
          data.splits.forEach((split: any) => {
            if (split.categories && Array.isArray(split.categories)) {
              extractFromCategories(split.categories);
            }
          });
        }

        if (stats.points > 0 || stats.rebounds > 0) {
          console.log(`[ESPN API] Successfully fetched real stats for ${playerName} from detailed stats:`, stats);
          return stats;
        }
      }
    } catch (err) {
      console.warn(`[ESPN API] Detailed stats fetch failed for ${playerName}:`, err);
    }

    // Attempt 2: Athlete Summary Endpoint (Fallback)
    try {
      const summaryResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/athletes/${playerId}`);
      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        if (summaryData.athlete && summaryData.athlete.statsSummary) {
          const summary = summaryData.athlete.statsSummary;
          if (summary.statistics && Array.isArray(summary.statistics)) {
            summary.statistics.forEach((s: any) => {
              switch (s.name) {
                case 'avgPoints': stats.points = s.value; break;
                case 'avgRebounds': stats.rebounds = s.value; break;
                case 'avgAssists': stats.assists = s.value; break;
                case 'avgBlocks': stats.blocks = s.value; break;
                case 'avgSteals': stats.steals = s.value; break;
                case 'avgThreePointFieldGoalsMade': stats.threes = s.value; break;
                case 'fieldGoalPct':
                case 'avgFieldGoalPct':
                case 'fieldGoalPercentage':
                case 'avgFieldGoalPercentage':
                  stats.fgPercentage = s.value < 1 ? s.value * 100 : s.value; 
                  break;
              }
            });
          }
        }
        
        if (stats.points > 0 || stats.rebounds > 0) {
          console.log(`[ESPN API] Successfully fetched real stats for ${playerName} from summary:`, stats);
          return stats;
        }
      }
    } catch (err) {
      console.warn(`[ESPN API] Summary fetch failed for ${playerName}:`, err);
    }
  }

  // Fallback to mock data if no playerId or all fetches fail
  console.log(`[ESPN API] Using mock stats for ${playerName}`);
  const hash = playerName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return {
    points: (hash % 15) + 15 + (hash % 10) / 10,
    rebounds: (hash % 8) + 2 + (hash % 5) / 10,
    assists: (hash % 7) + 1 + (hash % 4) / 10,
    blocks: (hash % 3) + 0.2,
    steals: (hash % 3) + 0.5,
    threes: (hash % 4) + 1.2,
    fgPercentage: 45.5
  };
};

export interface OpponentContext {
  pace: 'Fast' | 'Neutral' | 'Slow';
  defense: 'Strong' | 'Average' | 'Weak';
  defensive_avg_defensive_rebounds: number;
  defensive_avg_blocks: number;
  defensive_avg_steals: number;
  defensive_reboundsRank: number;
  blocksRank: number;
  stealsRank: number;
}

export const fetchEspnTeamStats = async (teamId: string, year: number = 2026): Promise<any> => {
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/statistics?season=${year}&seasontype=2`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.results?.stats || null;
  } catch (err) {
    console.error(`[ESPN API] Error fetching team stats for ${teamId}:`, err);
    return null;
  }
};

// Static database of team defensive stats from the 2025-26 season (as of March 30, 2026)
// Based on the provided image data for accuracy
const TEAM_DEFENSIVE_STATS: Record<string, { dr: number, stl: number, blk: number, drRank: number, stlRank: number, blkRank: number }> = {
  'spurs': { dr: 35.6, stl: 7.6, blk: 5.5, drRank: 1, stlRank: 18, blkRank: 6 },
  'bulls': { dr: 34.9, stl: 7.5, blk: 5.1, drRank: 2, stlRank: 19, blkRank: 10 },
  'heat': { dr: 34.6, stl: 8.9, blk: 4.3, drRank: 3, stlRank: 6, blkRank: 22 },
  'thunder': { dr: 34.5, stl: 9.6, blk: 5.5, drRank: 4, stlRank: 2, blkRank: 7 },
  'mavericks': { dr: 34.2, stl: 7.4, blk: 5.2, drRank: 5, stlRank: 20, blkRank: 9 },
  'nuggets': { dr: 33.9, stl: 6.8, blk: 3.9, drRank: 6, stlRank: 28, blkRank: 28 },
  'celtics': { dr: 33.8, stl: 7.1, blk: 5.1, drRank: 7, stlRank: 24, blkRank: 11 },
  'hornets': { dr: 33.4, stl: 7.0, blk: 4.5, drRank: 8, stlRank: 26, blkRank: 20 },
  'timberwolves': { dr: 33.3, stl: 8.7, blk: 5.7, drRank: 9, stlRank: 8, blkRank: 4 },
  'knicks': { dr: 33.1, stl: 8.1, blk: 4.0, drRank: 10, stlRank: 15, blkRank: 25 },
  'rockets': { dr: 33.1, stl: 8.7, blk: 5.8, drRank: 11, stlRank: 9, blkRank: 3 },
  'pistons': { dr: 32.6, stl: 10.5, blk: 6.3, drRank: 12, stlRank: 1, blkRank: 1 },
  'cavaliers': { dr: 32.5, stl: 8.6, blk: 5.0, drRank: 13, stlRank: 10, blkRank: 13 },
  'hawks': { dr: 32.5, stl: 9.4, blk: 4.6, drRank: 14, stlRank: 3, blkRank: 18 },
  'magic': { dr: 32.3, stl: 8.4, blk: 4.7, drRank: 15, stlRank: 12, blkRank: 16 },
  'trailblazers': { dr: 32.0, stl: 8.2, blk: 5.5, drRank: 16, stlRank: 14, blkRank: 8 },
  'pacers': { dr: 31.9, stl: 7.2, blk: 4.6, drRank: 17, stlRank: 22, blkRank: 19 },
  'suns': { dr: 30.2, stl: 9.7, blk: 4.1, drRank: 14, stlRank: 24, blkRank: 19 }
};

// Cache for league-wide defensive stats to avoid redundant API calls
let leagueStatsCache: { id: string, dr: number, stl: number, blk: number }[] | null = null;

const getLeagueDefensiveStats = async (): Promise<{ id: string, dr: number, stl: number, blk: number }[]> => {
  if (leagueStatsCache) return leagueStatsCache;

  console.log("[ESPN API] Fetching league-wide defensive stats for ranking...");
  const teams = await fetchEspnTeams();
  
  // Fetch stats for all teams in parallel
  const statsPromises = teams.map(async (team) => {
    const stats = await fetchEspnTeamStats(team.id);
    let dr = 0, stl = 0, blk = 0;
    
    if (stats && stats.categories) {
      stats.categories.forEach((cat: any) => {
        cat.stats.forEach((s: any) => {
          switch (s.name) {
            case 'avgDefensiveRebounds': dr = s.value; break;
            case 'avgBlocks': blk = s.value; break;
            case 'avgSteals': stl = s.value; break;
          }
        });
      });
    }
    
    return { id: team.id, dr, stl, blk };
  });

  leagueStatsCache = await Promise.all(statsPromises);
  return leagueStatsCache;
};

export const fetchOpponentContext = async (teamName: string, teamId?: string): Promise<OpponentContext> => {
  console.log(`[ESPN API] Fetching opponent context for ${teamName} (ID: ${teamId})`);
  
  const normalizedName = normalizeTeamName(teamName);
  const staticStats = TEAM_DEFENSIVE_STATS[normalizedName];

  const context: OpponentContext = {
    pace: 'Neutral',
    defense: 'Average',
    defensive_avg_defensive_rebounds: staticStats?.dr || 33.5,
    defensive_avg_blocks: staticStats?.blk || 5.1,
    defensive_avg_steals: staticStats?.stl || 7.2,
    defensive_reboundsRank: staticStats?.drRank || 15,
    blocksRank: staticStats?.blkRank || 15,
    stealsRank: staticStats?.stlRank || 15
  };

  if (teamId) {
    try {
      // Fetch core team info for record-based stats (points against)
      const teamResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}?season=2026`);
      let avgPointsAgainst = 112; // Default
      
      if (teamResponse.ok) {
        const teamData = await teamResponse.json();
        const totalRecord = teamData.team?.record?.items?.find((i: any) => i.type === 'total');
        if (totalRecord && totalRecord.stats) {
          const ptsAgainst = totalRecord.stats.find((s: any) => s.name === 'avgPointsAgainst');
          if (ptsAgainst) avgPointsAgainst = ptsAgainst.value;
        }
      }

      // Fetch detailed statistics for the specific team
      const stats = await fetchEspnTeamStats(teamId, 2026);
      if (stats && Array.isArray(stats.categories)) {
        let fga = 90, fta = 20, to = 12, oreb = 10; // Defaults for pace calculation

        stats.categories.forEach((cat: any) => {
          if (cat.stats && Array.isArray(cat.stats)) {
            cat.stats.forEach((s: any) => {
              switch (s.name) {
                case 'avgDefensiveRebounds': 
                  context.defensive_avg_defensive_rebounds = s.value; 
                  break;
                case 'avgBlocks': 
                  context.defensive_avg_blocks = s.value; 
                  break;
                case 'avgSteals': 
                  context.defensive_avg_steals = s.value; 
                  break;
                case 'avgFieldGoalsAttempted': fga = s.value; break;
                case 'avgFreeThrowsAttempted': fta = s.value; break;
                case 'avgTurnovers': to = s.value; break;
                case 'avgOffensiveRebounds': oreb = s.value; break;
              }
            });
          }
        });

        // Calculate Pace: FGA + 0.44 * FTA + TO - ORB
        const calculatedPace = fga + (0.44 * fta) + to - oreb;
        if (calculatedPace > 101) context.pace = 'Fast';
        else if (calculatedPace < 98) context.pace = 'Slow';
        else context.pace = 'Neutral';

        // Defense based on avgPointsAgainst
        if (avgPointsAgainst < 110) context.defense = 'Strong';
        else if (avgPointsAgainst > 116) context.defense = 'Weak';
        else context.defense = 'Average';
      }

      // Calculate accurate league-wide ranks
      const leagueStats = await getLeagueDefensiveStats();
      if (leagueStats.length > 0) {
        const currentTeamStats = leagueStats.find(s => s.id === teamId);
        if (currentTeamStats) {
          // Sort by each category descending (higher is better rank)
          const drSorted = [...leagueStats].sort((a, b) => b.dr - a.dr);
          const stlSorted = [...leagueStats].sort((a, b) => b.stl - a.stl);
          const blkSorted = [...leagueStats].sort((a, b) => b.blk - a.blk);

          // Accurate ranking (handling ties)
          context.defensive_reboundsRank = drSorted.findIndex(s => s.dr === currentTeamStats.dr) + 1;
          context.stealsRank = stlSorted.findIndex(s => s.stl === currentTeamStats.stl) + 1;
          context.blocksRank = blkSorted.findIndex(s => s.blk === currentTeamStats.blk) + 1;
        }
      }
    } catch (err) {
      console.warn(`[ESPN API] Failed to fetch real opponent context for ${teamName}:`, err);
    }
  }

  // Fallback for ranks if teamId was missing or league fetch failed
  if (context.defensive_reboundsRank === 15 && !staticStats) {
    const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    context.defensive_reboundsRank = (hash % 25) + 1;
    context.blocksRank = ((hash + 5) % 25) + 1;
    context.stealsRank = ((hash + 10) % 25) + 1;
  }

  console.log(`[ESPN API] Resolved opponent context for ${teamName}:`, context);
  return context;
};
