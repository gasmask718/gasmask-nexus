import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SportsDataIO NBA API integration
const SPORTSDATAIO_BASE = "https://api.sportsdata.io/v3/nba";

// Fetch from SportsDataIO
async function fetchSportsDataIO(endpoint: string, apiKey: string): Promise<any> {
  const url = `${SPORTSDATAIO_BASE}${endpoint}?key=${apiKey}`;
  console.log(`Fetching SportsDataIO: ${endpoint}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    console.error(`SportsDataIO API error: ${response.status} - ${response.statusText}`);
    throw new Error(`SportsDataIO API error: ${response.status}`);
  }
  return response.json();
}

// Calculate standard deviation
function calculateStd(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
}

// Calculate average
function calculateAvg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// Get defense tier from rank
function getDefTier(rank: number): "low" | "med" | "high" {
  if (rank <= 10) return "high";
  if (rank >= 20) return "low";
  return "med";
}

// Get minutes trend
function getMinutesTrend(last5Min: number, seasonMin: number): "up" | "flat" | "down" {
  const diff = last5Min - seasonMin;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "flat";
}

// Calculate prop line from player stats
function calculatePropLine(stat: number, std: number): number {
  const line = stat - std * 0.1;
  return Math.round(line * 2) / 2;
}

// Probability calculation with context factors
function calculateProbability(
  projectedValue: number,
  lineValue: number,
  std: number,
  defTier: string,
  paceTier: string,
  minutesTrend: string,
  overUnder: "over" | "under"
): number {
  const zScore = (lineValue - projectedValue) / (std || 1);
  const probUnder = 1 / (1 + Math.exp(-1.7 * zScore));
  let rawProb = overUnder === "over" ? 1 - probUnder : probUnder;
  
  // Apply context adjustments
  let adjustment = 0;
  if (defTier === "low") adjustment += 0.03;
  if (defTier === "high") adjustment -= 0.03;
  if (paceTier === "fast") adjustment += 0.02;
  if (paceTier === "slow") adjustment -= 0.02;
  if (minutesTrend === "up") adjustment += 0.02;
  if (minutesTrend === "down") adjustment -= 0.02;
  
  if (overUnder === "over") rawProb += adjustment;
  else rawProb -= adjustment;
  
  return Math.max(0.35, Math.min(0.65, rawProb));
}

// Fetch today's games from SportsDataIO
async function fetchTodaysGames(apiKey: string, dateStr: string) {
  try {
    const games = await fetchSportsDataIO(`/scores/json/GamesByDate/${dateStr}`, apiKey);
    return games || [];
  } catch (error) {
    console.error("Error fetching games:", error);
    return [];
  }
}

// Fetch player stats for a season
async function fetchPlayerSeasonStats(apiKey: string, season: string) {
  try {
    const stats = await fetchSportsDataIO(`/stats/json/PlayerSeasonStats/${season}`, apiKey);
    return stats || [];
  } catch (error) {
    console.error("Error fetching player season stats:", error);
    return [];
  }
}

// Fetch team season stats
async function fetchTeamSeasonStats(apiKey: string, season: string) {
  try {
    const stats = await fetchSportsDataIO(`/scores/json/TeamSeasonStats/${season}`, apiKey);
    return stats || [];
  } catch (error) {
    console.error("Error fetching team stats:", error);
    return [];
  }
}

// Fetch player game logs
async function fetchPlayerGameLogs(apiKey: string, season: string) {
  try {
    const logs = await fetchSportsDataIO(`/stats/json/PlayerGameStatsBySeason/${season}/all`, apiKey);
    return logs || [];
  } catch (error) {
    console.error("Error fetching game logs:", error);
    return [];
  }
}

// Process player game logs into stats
function processPlayerFromLogs(
  player: any, 
  gameLogs: any[], 
  source: string
): any | null {
  const playerLogs = gameLogs
    .filter((log: any) => log.PlayerID === player.PlayerID)
    .sort((a: any, b: any) => new Date(b.Day).getTime() - new Date(a.Day).getTime());
  
  if (playerLogs.length === 0) return null;
  
  const last5 = playerLogs.slice(0, 5);
  const last10 = playerLogs.slice(0, 10);
  const season = playerLogs;
  
  // Calculate stats
  const pts = {
    last5: calculateAvg(last5.map((g: any) => g.Points || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Points || 0)),
    season: calculateAvg(season.map((g: any) => g.Points || 0)),
    std: calculateStd(last5.map((g: any) => g.Points || 0))
  };
  
  const reb = {
    last5: calculateAvg(last5.map((g: any) => g.Rebounds || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Rebounds || 0)),
    season: calculateAvg(season.map((g: any) => g.Rebounds || 0)),
    std: calculateStd(last5.map((g: any) => g.Rebounds || 0))
  };
  
  const ast = {
    last5: calculateAvg(last5.map((g: any) => g.Assists || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Assists || 0)),
    season: calculateAvg(season.map((g: any) => g.Assists || 0)),
    std: calculateStd(last5.map((g: any) => g.Assists || 0))
  };
  
  const threepm = {
    last5: calculateAvg(last5.map((g: any) => g.ThreePointersMade || 0)),
    last10: calculateAvg(last10.map((g: any) => g.ThreePointersMade || 0)),
    season: calculateAvg(season.map((g: any) => g.ThreePointersMade || 0)),
    std: calculateStd(last5.map((g: any) => g.ThreePointersMade || 0))
  };
  
  const pra = {
    last5: pts.last5 + reb.last5 + ast.last5,
    last10: pts.last10 + reb.last10 + ast.last10,
    season: pts.season + reb.season + ast.season,
    std: calculateStd(last5.map((g: any) => (g.Points || 0) + (g.Rebounds || 0) + (g.Assists || 0)))
  };
  
  const mins = {
    last5: calculateAvg(last5.map((g: any) => g.Minutes || 0)),
    season: calculateAvg(season.map((g: any) => g.Minutes || 0))
  };
  
  const dataCompleteness = Math.min(100, Math.round((season.length / 40) * 100));
  
  return {
    player_id: player.PlayerID?.toString() || '',
    player_name: player.Name || `${player.FirstName} ${player.LastName}`,
    team: player.Team || '',
    position: player.Position || '',
    last_5_games_avg_pts: pts.last5,
    last_5_games_avg_reb: reb.last5,
    last_5_games_avg_ast: ast.last5,
    last_5_games_avg_3pm: threepm.last5,
    last_5_games_avg_pra: pra.last5,
    last_10_games_avg_pts: pts.last10,
    last_10_games_avg_reb: reb.last10,
    last_10_games_avg_ast: ast.last10,
    last_10_games_avg_3pm: threepm.last10,
    last_10_games_avg_pra: pra.last10,
    season_avg_pts: pts.season,
    season_avg_reb: reb.season,
    season_avg_ast: ast.season,
    season_avg_3pm: threepm.season,
    season_avg_pra: pra.season,
    season_avg_min: mins.season,
    std_pts: pts.std,
    std_reb: reb.std,
    std_ast: ast.std,
    std_3pm: threepm.std,
    std_pra: pra.std,
    minutes_last_5_avg: mins.last5,
    usage_rate: player.UsageRatePercentage || 20,
    injury_status: player.InjuryStatus === 'Out' ? 'out' : 
                   player.InjuryStatus === 'Questionable' ? 'questionable' : 'active',
    stats_source: source,
    data_completeness: dataCompleteness,
    last_updated: new Date().toISOString()
  };
}

// Fallback mock data generator for when API is unavailable
function generateMockNBAData(dateString: string) {
  const seed = dateString.split("-").reduce((a, b) => a + parseInt(b), 0);
  const rng = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  const teams = [
    { abbr: "BOS", name: "Boston Celtics", defRank: 3, pace: 100.2 },
    { abbr: "MIL", name: "Milwaukee Bucks", defRank: 8, pace: 101.5 },
    { abbr: "PHI", name: "Philadelphia 76ers", defRank: 12, pace: 97.8 },
    { abbr: "CLE", name: "Cleveland Cavaliers", defRank: 5, pace: 98.5 },
    { abbr: "NYK", name: "New York Knicks", defRank: 7, pace: 99.2 },
    { abbr: "MIA", name: "Miami Heat", defRank: 10, pace: 96.5 },
    { abbr: "LAL", name: "Los Angeles Lakers", defRank: 14, pace: 100.8 },
    { abbr: "DEN", name: "Denver Nuggets", defRank: 6, pace: 100.5 },
    { abbr: "PHX", name: "Phoenix Suns", defRank: 16, pace: 101.0 },
    { abbr: "GSW", name: "Golden State Warriors", defRank: 15, pace: 101.8 },
  ];

  const numGames = 3 + Math.floor(rng(1) * 3);
  const shuffledTeams = [...teams].sort(() => rng(2) - 0.5);
  const games = [];

  for (let i = 0; i < Math.min(numGames, Math.floor(shuffledTeams.length / 2)); i++) {
    games.push({
      home_team: shuffledTeams[i * 2].abbr,
      away_team: shuffledTeams[i * 2 + 1].abbr,
      game_time: `${dateString}T${19 + i}:00:00Z`,
    });
  }

  // Generate mock players
  const mockPlayers = [
    { name: "LeBron James", team: "LAL", pts: 25.5, reb: 7.2, ast: 8.1, pos: "SF" },
    { name: "Stephen Curry", team: "GSW", pts: 29.2, reb: 4.5, ast: 6.3, pos: "PG" },
    { name: "Jayson Tatum", team: "BOS", pts: 27.1, reb: 8.1, ast: 4.8, pos: "SF" },
    { name: "Giannis Antetokounmpo", team: "MIL", pts: 31.2, reb: 11.5, ast: 5.9, pos: "PF" },
    { name: "Nikola Jokic", team: "DEN", pts: 26.4, reb: 12.1, ast: 9.2, pos: "C" },
    { name: "Kevin Durant", team: "PHX", pts: 28.5, reb: 6.8, ast: 5.2, pos: "SF" },
    { name: "Joel Embiid", team: "PHI", pts: 33.1, reb: 10.2, ast: 4.1, pos: "C" },
    { name: "Donovan Mitchell", team: "CLE", pts: 28.3, reb: 4.1, ast: 5.2, pos: "SG" },
    { name: "Jalen Brunson", team: "NYK", pts: 26.1, reb: 3.5, ast: 6.5, pos: "PG" },
    { name: "Jimmy Butler", team: "MIA", pts: 21.5, reb: 5.9, ast: 5.2, pos: "SF" },
  ];

  const teamsInGames = new Set<string>();
  games.forEach(g => {
    teamsInGames.add(g.home_team);
    teamsInGames.add(g.away_team);
  });

  const players = mockPlayers
    .filter(p => teamsInGames.has(p.team))
    .map((p, i) => ({
      player_id: `mock_${p.name.replace(/\s/g, '_')}`,
      player_name: p.name,
      team: p.team,
      position: p.pos,
      last_5_games_avg_pts: p.pts * (1 + (rng(i * 10 + 1) - 0.5) * 0.15),
      last_5_games_avg_reb: p.reb * (1 + (rng(i * 10 + 2) - 0.5) * 0.15),
      last_5_games_avg_ast: p.ast * (1 + (rng(i * 10 + 3) - 0.5) * 0.15),
      last_5_games_avg_3pm: p.pts * 0.1,
      last_5_games_avg_pra: p.pts + p.reb + p.ast,
      last_10_games_avg_pts: p.pts,
      last_10_games_avg_reb: p.reb,
      last_10_games_avg_ast: p.ast,
      last_10_games_avg_3pm: p.pts * 0.1,
      last_10_games_avg_pra: p.pts + p.reb + p.ast,
      season_avg_pts: p.pts,
      season_avg_reb: p.reb,
      season_avg_ast: p.ast,
      season_avg_3pm: p.pts * 0.1,
      season_avg_pra: p.pts + p.reb + p.ast,
      season_avg_min: 34,
      std_pts: p.pts * 0.2,
      std_reb: p.reb * 0.25,
      std_ast: p.ast * 0.3,
      std_3pm: 1.2,
      std_pra: (p.pts + p.reb + p.ast) * 0.15,
      minutes_last_5_avg: 34 + (rng(i * 10 + 4) - 0.5) * 4,
      usage_rate: 20 + rng(i * 10 + 5) * 10,
      injury_status: rng(i * 10 + 6) < 0.9 ? "active" : "questionable",
      stats_source: "Mock Data",
      data_completeness: 75,
      last_updated: new Date().toISOString()
    }));

  return { teams, games, players };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sportsDataIOKey = Deno.env.get("SPORTSDATAIO_API_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { action } = await req.json();
    const today = new Date().toISOString().split("T")[0];
    
    console.log(`NBA Stats Engine: action=${action}, date=${today}, hasApiKey=${!!sportsDataIOKey}`);

    if (action === "refresh_stats") {
      // Create refresh log
      const { data: logEntry, error: logError } = await supabase
        .from("nba_stats_refresh_log")
        .insert({
          refresh_date: today,
          status: "running",
          started_at: new Date().toISOString(),
          source: sportsDataIOKey ? "SportsDataIO" : "Mock Data"
        })
        .select()
        .single();

      if (logError) console.error("Log creation error:", logError);

      let gamesData: any[] = [];
      let playersData: any[] = [];
      let teamsData: any[] = [];
      let source = "Mock Data";

      // Try to use SportsDataIO if API key is available
      if (sportsDataIOKey) {
        try {
          console.log("Fetching real data from SportsDataIO...");
          source = "SportsDataIO";
          
          // Get current season
          const currentYear = new Date().getFullYear();
          const currentMonth = new Date().getMonth();
          const season = currentMonth >= 9 ? currentYear + 1 : currentYear;
          
          // Fetch today's games
          const apiGames = await fetchTodaysGames(sportsDataIOKey, today);
          console.log(`Found ${apiGames.length} games today from SportsDataIO`);
          
          if (apiGames.length === 0) {
            // No games today, still update with real team stats
            const teamStats = await fetchTeamSeasonStats(sportsDataIOKey, season.toString());
            teamsData = teamStats.map((t: any, i: number) => ({
              team_abbr: t.Team,
              team_name: t.Name,
              def_rank_overall: i + 1,
              pace_rating: t.Possessions / t.Games || 100,
              pace_tier: (t.Possessions / t.Games || 100) > 101 ? "fast" : (t.Possessions / t.Games || 100) < 98 ? "slow" : "avg",
              pts_allowed_avg: t.OpponentScore / t.Games || 110,
              last_updated: new Date().toISOString()
            }));
            
            // Update log
            if (logEntry) {
              await supabase.from("nba_stats_refresh_log").update({
                games_fetched: 0,
                players_updated: 0,
                teams_updated: teamsData.length,
                status: "complete",
                completed_at: new Date().toISOString(),
                notes: "No games scheduled today",
                source
              }).eq("id", logEntry.id);
            }
            
            return new Response(JSON.stringify({
              success: true,
              message: "No games scheduled today",
              games_fetched: 0,
              players_updated: 0,
              teams_updated: teamsData.length,
              source
            }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          
          // Process games
          gamesData = apiGames.map((g: any) => ({
            game_id: g.GameID?.toString() || `${today}_${g.HomeTeam}_${g.AwayTeam}`,
            home_team: g.HomeTeam,
            away_team: g.AwayTeam,
            game_time: g.DateTime,
            home_team_back_to_back: false,
            away_team_back_to_back: false,
            game_date: today,
            status: g.Status || "Scheduled"
          }));
          
          // Fetch team stats
          const teamStats = await fetchTeamSeasonStats(sportsDataIOKey, season.toString());
          const sortedByDefense = [...teamStats].sort((a: any, b: any) => 
            (a.OpponentScore / a.Games || 110) - (b.OpponentScore / b.Games || 110)
          );
          
          teamsData = sortedByDefense.map((t: any, i: number) => ({
            team_abbr: t.Team,
            team_name: t.Name,
            def_rank_vs_pg: i + 1,
            def_rank_vs_sg: i + 1,
            def_rank_vs_sf: i + 1,
            def_rank_vs_pf: i + 1,
            def_rank_vs_c: i + 1,
            def_rank_overall: i + 1,
            pace_rating: t.Possessions / t.Games || 100,
            pace_tier: (t.Possessions / t.Games || 100) > 101 ? "fast" : (t.Possessions / t.Games || 100) < 98 ? "slow" : "avg",
            pts_allowed_avg: t.OpponentScore / t.Games || 110,
            last_updated: new Date().toISOString()
          }));
          
          // Get teams playing today
          const teamsPlaying = new Set<string>();
          gamesData.forEach(g => {
            teamsPlaying.add(g.home_team);
            teamsPlaying.add(g.away_team);
          });
          
          // Fetch player season stats and game logs
          const playerSeasonStats = await fetchPlayerSeasonStats(sportsDataIOKey, season.toString());
          const gameLogs = await fetchPlayerGameLogs(sportsDataIOKey, season.toString());
          
          // Filter to players on teams playing today with significant minutes
          const relevantPlayers = playerSeasonStats.filter((p: any) => 
            teamsPlaying.has(p.Team) && p.Minutes > 15
          );
          
          console.log(`Processing ${relevantPlayers.length} relevant players`);
          
          for (const player of relevantPlayers.slice(0, 100)) { // Limit for performance
            const processed = processPlayerFromLogs(player, gameLogs, source);
            if (processed && processed.season_avg_min > 15) {
              playersData.push(processed);
            }
          }
          
        } catch (apiError) {
          console.error("SportsDataIO API error, falling back to mock data:", apiError);
          source = "Mock Data (API Error)";
          const mockData = generateMockNBAData(today);
          gamesData = mockData.games.map((g, i) => ({
            game_id: `${today}_${g.home_team}_${g.away_team}`,
            home_team: g.home_team,
            away_team: g.away_team,
            game_time: g.game_time,
            home_team_back_to_back: false,
            away_team_back_to_back: false,
            game_date: today,
            status: "scheduled"
          }));
          playersData = mockData.players;
          teamsData = mockData.teams.map((t, i) => ({
            team_abbr: t.abbr,
            team_name: t.name,
            def_rank_overall: t.defRank,
            pace_rating: t.pace,
            pace_tier: t.pace > 101 ? "fast" : t.pace < 98 ? "slow" : "avg",
            last_updated: new Date().toISOString()
          }));
        }
      } else {
        // Use mock data
        console.log("No API key, using mock data");
        const mockData = generateMockNBAData(today);
        gamesData = mockData.games.map((g, i) => ({
          game_id: `${today}_${g.home_team}_${g.away_team}`,
          home_team: g.home_team,
          away_team: g.away_team,
          game_time: g.game_time,
          home_team_back_to_back: false,
          away_team_back_to_back: false,
          game_date: today,
          status: "scheduled"
        }));
        playersData = mockData.players;
        teamsData = mockData.teams.map((t, i) => ({
          team_abbr: t.abbr,
          team_name: t.name,
          def_rank_overall: t.defRank,
          pace_rating: t.pace,
          pace_tier: t.pace > 101 ? "fast" : t.pace < 98 ? "slow" : "avg",
          last_updated: new Date().toISOString()
        }));
      }

      // Upsert teams
      for (const team of teamsData) {
        await supabase.from("nba_team_stats").upsert(team, { onConflict: "team_abbr" });
      }

      // Upsert players
      for (const player of playersData) {
        await supabase.from("nba_player_stats").upsert(player, { onConflict: "player_id" });
      }

      // Insert today's games
      await supabase.from("nba_games_today").delete().eq("game_date", today);
      for (const game of gamesData) {
        await supabase.from("nba_games_today").insert(game);
      }

      // Update log
      if (logEntry) {
        await supabase.from("nba_stats_refresh_log").update({
          games_fetched: gamesData.length,
          players_updated: playersData.length,
          teams_updated: teamsData.length,
          status: "complete",
          completed_at: new Date().toISOString(),
          source
        }).eq("id", logEntry.id);
      }

      return new Response(JSON.stringify({
        success: true,
        games_fetched: gamesData.length,
        players_updated: playersData.length,
        teams_updated: teamsData.length,
        source
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate_props") {
      // Fetch today's games
      const { data: games } = await supabase
        .from("nba_games_today")
        .select("*")
        .eq("game_date", today);

      if (!games || games.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "No games found for today. Run refresh_stats first." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      // Fetch all players for today's teams
      const teamsToday = new Set<string>();
      games.forEach((g: any) => {
        teamsToday.add(g.home_team);
        teamsToday.add(g.away_team);
      });

      const { data: players } = await supabase
        .from("nba_player_stats")
        .select("*")
        .in("team", Array.from(teamsToday))
        .neq("injury_status", "out");

      // Fetch team stats
      const { data: teamStats } = await supabase.from("nba_team_stats").select("*");
      const teamMap = new Map(teamStats?.map((t: any) => [t.team_abbr, t]) || []);

      // Delete old props for today
      await supabase.from("nba_props_generated").delete().eq("game_date", today);

      const propsGenerated: any[] = [];
      const statTypes = [
        { key: "pts", name: "PTS" },
        { key: "reb", name: "REB" },
        { key: "ast", name: "AST" },
        { key: "3pm", name: "3PM" },
        { key: "pra", name: "PRA" },
      ];

      for (const player of players || []) {
        const game = games.find(
          (g: any) => g.home_team === player.team || g.away_team === player.team
        );
        if (!game) continue;

        const isHome = game.home_team === player.team;
        const opponent = isHome ? game.away_team : game.home_team;
        const oppTeam = teamMap.get(opponent);
        const isB2B = isHome ? game.home_team_back_to_back : game.away_team_back_to_back;

        const oppDefRank = oppTeam?.def_rank_overall || 15;
        const oppDefTier = getDefTier(oppDefRank);
        const paceTier = oppTeam?.pace_tier || "avg";
        const minutesTrend = getMinutesTrend(
          player.minutes_last_5_avg || 30,
          player.season_avg_min || 30
        );

        for (const stat of statTypes) {
          const last5Key = `last_5_games_avg_${stat.key}`;
          const seasonKey = `season_avg_${stat.key}`;
          const stdKey = `std_${stat.key}`;

          const last5 = player[last5Key] as number | null;
          const season = player[seasonKey] as number | null;
          const std = player[stdKey] as number | null;

          if (!last5 || !season || last5 < 1) continue;

          // Weighted projection
          const projected = last5 * 0.6 + season * 0.4;
          const lineValue = calculatePropLine(projected, std || projected * 0.2);

          // Calculate probabilities
          const overProb = calculateProbability(projected, lineValue, std || 1, oppDefTier, paceTier, minutesTrend, "over");
          const underProb = calculateProbability(projected, lineValue, std || 1, oppDefTier, paceTier, minutesTrend, "under");

          // Determine recommendation
          const isOver = overProb > underProb;
          const probability = isOver ? overProb : underProb;
          const overUnder = isOver ? "over" : "under";

          // Calculate edge and ROI
          const breakEven = 0.524;
          const edge = (probability - breakEven) * 100;
          const simulatedROI = edge / 100;

          // Calculate confidence
          let confidence = 50 + edge * 2;
          if (player.data_completeness) confidence += (player.data_completeness - 50) * 0.2;
          if (player.injury_status === "questionable") confidence -= 10;
          if (isB2B) confidence -= 5;
          confidence = Math.max(30, Math.min(70, confidence));

          // Generate reasoning
          const reasoning = [];
          if (last5 > season * 1.1) reasoning.push(`Hot streak: L5 avg ${last5.toFixed(1)} vs season ${season.toFixed(1)}`);
          if (last5 < season * 0.9) reasoning.push(`Cold streak: L5 avg ${last5.toFixed(1)} vs season ${season.toFixed(1)}`);
          if (oppDefTier === "low") reasoning.push(`Weak opponent defense (rank ${oppDefRank})`);
          if (oppDefTier === "high") reasoning.push(`Strong opponent defense (rank ${oppDefRank})`);
          if (paceTier === "fast") reasoning.push("Fast-paced matchup");
          if (paceTier === "slow") reasoning.push("Slow-paced matchup");
          if (minutesTrend === "up") reasoning.push("Minutes trending up");
          if (minutesTrend === "down") reasoning.push("Minutes trending down");
          if (player.injury_status === "questionable") reasoning.push("Questionable injury status");
          if (isB2B) reasoning.push("Back-to-back game");

          // Determine if should avoid
          const volatility = (std || 1) / (projected || 1);
          const shouldAvoid = edge < -2 || volatility > 0.4 || player.injury_status === "questionable";

          // Determine parlay eligibility
          const parlayEligible = !shouldAvoid && confidence >= 55 && volatility < 0.3;

          // Determine recommendation type
          let recommendation = "pass";
          if (edge >= 5 && confidence >= 60) recommendation = "strong_play";
          else if (edge >= 2 && confidence >= 55) recommendation = "lean";
          else if (shouldAvoid) recommendation = "avoid";

          propsGenerated.push({
            game_id: game.game_id,
            game_date: today,
            player_id: player.player_id,
            player_name: player.player_name,
            team: player.team,
            opponent,
            stat_type: stat.name,
            line_value: lineValue,
            over_under: overUnder,
            estimated_probability: probability,
            break_even_probability: breakEven,
            edge: edge / 100,
            confidence_score: Math.round(confidence),
            simulated_roi: simulatedROI,
            recommendation,
            reasoning,
            player_recent_avg: last5,
            player_season_avg: season,
            opponent_def_tier: oppDefTier,
            pace_tier: paceTier,
            minutes_trend: minutesTrend,
            data_completeness: player.data_completeness || 50,
            stats_source: player.stats_source || "Unknown",
            parlay_eligible: parlayEligible,
            should_avoid: shouldAvoid,
            generated_at: new Date().toISOString(),
          });
        }
      }

      // Insert props
      if (propsGenerated.length > 0) {
        await supabase.from("nba_props_generated").insert(propsGenerated);
      }

      // Update log
      await supabase.from("nba_stats_refresh_log")
        .update({ props_generated: propsGenerated.length })
        .eq("status", "complete")
        .order("completed_at", { ascending: false })
        .limit(1);

      return new Response(JSON.stringify({
        success: true,
        props_generated: propsGenerated.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );

  } catch (error) {
    console.error("NBA Stats Engine Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: "Check edge function logs for more details"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
