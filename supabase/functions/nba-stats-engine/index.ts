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

// Validate player identity - CRITICAL: No placeholder players allowed
function getPlayerFullName(player: any): string {
  const name =
    player?.Name ??
    player?.FullName ??
    [player?.FirstName, player?.LastName].filter(Boolean).join(" ");
  return typeof name === "string" ? name.trim() : "";
}

function isValidPlayer(player: any): boolean {
  // Must have a numeric PlayerID from SportsDataIO
  const playerId = player?.PlayerID;
  if (typeof playerId !== "number" || !Number.isFinite(playerId)) {
    console.log(`Invalid player: missing/invalid PlayerID`, player);
    return false;
  }

  // Must have real name (not position-based placeholders)
  const name = getPlayerFullName(player);
  const invalidNames = [
    "PG Player",
    "SG Player",
    "SF Player",
    "PF Player",
    "C Player",
    "Unknown Player",
    "Unknown",
    "TBD",
  ];
  if (!name || invalidNames.some((invalid) => name.includes(invalid))) {
    console.log(`Invalid player name: ${name || "(empty)"}`);
    return false;
  }

  return true;
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

// Fetch recent box scores (last N days) for game logs
async function fetchRecentBoxScores(apiKey: string, days: number = 7): Promise<any[]> {
  const allPlayerGames: any[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i - 1); // Start from yesterday
    const dateStr = date.toISOString().split("T")[0];
    
    try {
      const boxScores = await fetchSportsDataIO(`/stats/json/BoxScoresFinal/${dateStr}`, apiKey);
      if (boxScores && Array.isArray(boxScores)) {
        for (const game of boxScores) {
          if (game.PlayerGames && Array.isArray(game.PlayerGames)) {
            allPlayerGames.push(...game.PlayerGames);
          }
        }
      }
    } catch (error) {
      // Some days may not have games, skip
      console.log(`No box scores for ${dateStr}`);
    }
  }
  
  console.log(`Fetched ${allPlayerGames.length} player game logs from last ${days} days`);
  return allPlayerGames;
}

// Fetch active NBA players
async function fetchActivePlayers(apiKey: string) {
  try {
    const players = await fetchSportsDataIO(`/scores/json/Players`, apiKey);
    return players || [];
  } catch (error) {
    console.error("Error fetching active players:", error);
    return [];
  }
}

// Process player game logs into stats - ONLY for validated real players
function processPlayerFromLogs(
  player: any,
  gameLogs: any[]
): any | null {
  // CRITICAL: Validate player identity first
  if (!isValidPlayer(player)) return null;

  // Must have real team code after merge
  if (!player?.Team || typeof player.Team !== "string" || player.Team.length !== 3) {
    console.log(`Invalid player team after merge: ${player?.Team}`);
    return null;
  }

  const playerLogs = gameLogs
    .filter((log: any) => log.PlayerID === player.PlayerID)
    .sort((a: any, b: any) => new Date(b.Day).getTime() - new Date(a.Day).getTime());

  if (playerLogs.length === 0) {
    console.log(`No game logs for player ${getPlayerFullName(player)}`);
    return null;
  }

  const last5 = playerLogs.slice(0, 5);
  const last10 = playerLogs.slice(0, 10);
  const season = playerLogs;

  // Calculate stats
  const pts = {
    last5: calculateAvg(last5.map((g: any) => g.Points || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Points || 0)),
    season: calculateAvg(season.map((g: any) => g.Points || 0)),
    std: calculateStd(last5.map((g: any) => g.Points || 0)),
  };

  const reb = {
    last5: calculateAvg(last5.map((g: any) => g.Rebounds || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Rebounds || 0)),
    season: calculateAvg(season.map((g: any) => g.Rebounds || 0)),
    std: calculateStd(last5.map((g: any) => g.Rebounds || 0)),
  };

  const ast = {
    last5: calculateAvg(last5.map((g: any) => g.Assists || 0)),
    last10: calculateAvg(last10.map((g: any) => g.Assists || 0)),
    season: calculateAvg(season.map((g: any) => g.Assists || 0)),
    std: calculateStd(last5.map((g: any) => g.Assists || 0)),
  };

  const threepm = {
    last5: calculateAvg(last5.map((g: any) => g.ThreePointersMade || 0)),
    last10: calculateAvg(last10.map((g: any) => g.ThreePointersMade || 0)),
    season: calculateAvg(season.map((g: any) => g.ThreePointersMade || 0)),
    std: calculateStd(last5.map((g: any) => g.ThreePointersMade || 0)),
  };

  const pra = {
    last5: pts.last5 + reb.last5 + ast.last5,
    last10: pts.last10 + reb.last10 + ast.last10,
    season: pts.season + reb.season + ast.season,
    std: calculateStd(
      last5.map((g: any) => (g.Points || 0) + (g.Rebounds || 0) + (g.Assists || 0))
    ),
  };

  const mins = {
    last5: calculateAvg(last5.map((g: any) => g.Minutes || 0)),
    season: calculateAvg(season.map((g: any) => g.Minutes || 0)),
  };

  // Require minimum usable data - lowered threshold for early season
  const dataCompleteness = Math.min(100, Math.round((season.length / 40) * 100));
  if (season.length < 3) {
    console.log(
      `Insufficient data for player ${getPlayerFullName(player)}: only ${season.length} games`
    );
    return null;
  }

  const playerName = getPlayerFullName(player);
  if (!playerName) return null;

  const injuryRaw = String(player?.InjuryStatus ?? "Active").toLowerCase();
  const injury_status =
    injuryRaw === "out" || injuryRaw === "injured"
      ? "out"
      : injuryRaw === "questionable"
        ? "questionable"
        : "active";

  return {
    player_id: player.PlayerID.toString(),
    player_name: playerName,
    team: player.Team,
    position: player.Position || "",

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
    usage_rate: player.UsageRatePercentage || player.UsageRate || 20,
    injury_status,
    last_updated: new Date().toISOString(),
  };
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

    // CRITICAL: Require API key - no mock data allowed
    if (!sportsDataIOKey) {
      console.error("SPORTSDATAIO_API_KEY not configured");
      return new Response(JSON.stringify({
        success: false,
        error: "NBA data source not configured. Please add SPORTSDATAIO_API_KEY in project secrets.",
        requires_api_key: true
      }), { 
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (action === "refresh_stats") {
      // Create refresh log
      const { data: logEntry, error: logError } = await supabase
        .from("nba_stats_refresh_log")
        .insert({
          refresh_date: today,
          status: "running",
          started_at: new Date().toISOString(),
          source: "SportsDataIO"
        })
        .select()
        .single();

      if (logError) console.error("Log creation error:", logError);

      const source = "SportsDataIO";
      
      try {
        console.log("=== NBA STATS ENGINE: REFRESH_STATS START ===");
        console.log("Fetching real data from SportsDataIO...");
        
        // CRITICAL: Clear any existing mock/placeholder data first
        const { data: existingMock } = await supabase
          .from("nba_player_stats")
          .select("player_id")
          .or("player_id.like.%_PG_%,player_id.like.%_SG_%,player_id.like.%_SF_%,player_id.like.%_PF_%,player_id.like.%_C_%,player_id.like.mock_%");
        
        if (existingMock && existingMock.length > 0) {
          console.log(`Deleting ${existingMock.length} mock/placeholder players from database`);
          await supabase.from("nba_player_stats")
            .delete()
            .or("player_id.like.%_PG_%,player_id.like.%_SG_%,player_id.like.%_SF_%,player_id.like.%_PF_%,player_id.like.%_C_%,player_id.like.mock_%");
        }
        
        // Get current season
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth();
        const season = currentMonth >= 9 ? currentYear + 1 : currentYear;
        console.log(`Current NBA season: ${season}`);
        
        // Fetch today's games FIRST - this determines everything
        const apiGames = await fetchTodaysGames(sportsDataIOKey, today);
        console.log(`RAW API RESPONSE - Games today: ${JSON.stringify(apiGames.slice(0, 2))}`);
        console.log(`Found ${apiGames.length} games today from SportsDataIO`);
        
        if (apiGames.length === 0) {
          // No games today - this is valid, just update log
          if (logEntry) {
            await supabase.from("nba_stats_refresh_log").update({
              games_fetched: 0,
              players_updated: 0,
              teams_updated: 0,
              status: "complete",
              completed_at: new Date().toISOString(),
              error_message: "No NBA games scheduled today"
            }).eq("id", logEntry.id);
          }
          
          return new Response(JSON.stringify({
            success: true,
            message: "No NBA games scheduled today",
            games_fetched: 0,
            players_updated: 0,
            teams_updated: 0,
            source
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        // Get teams playing today
        const teamsPlaying = new Set<string>();
        apiGames.forEach((g: any) => {
          if (g.HomeTeam) teamsPlaying.add(g.HomeTeam);
          if (g.AwayTeam) teamsPlaying.add(g.AwayTeam);
        });
        console.log(`Teams playing today: ${Array.from(teamsPlaying).join(', ')}`);
        
        // Process games - ONLY real games from API
        // IMPORTANT: Normalize tipoff to a single internal UTC ISO format (ending in "Z")
        const normalizeGameTimeUtcIso = (g: any): string | null => {
          const raw = g?.DateTimeUTC ?? g?.GameTimeUTC ?? g?.StartTimeUTC ?? g?.DateTime;
          if (!raw) return null;

          let s = String(raw).trim();
          // Normalize common non-ISO forms
          s = s.replace(' ', 'T');
          s = s.replace(/([+-]\d{2})$/, '$1:00');

          // If timestamp has no timezone suffix, force UTC interpretation
          if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
            s = `${s}Z`;
          }

          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return null;
          return d.toISOString();
        };

        const gamesData = apiGames.map((g: any) => ({
          game_id: g.GameID?.toString() || `${today}_${g.HomeTeam}_${g.AwayTeam}`,
          home_team: g.HomeTeam,
          away_team: g.AwayTeam,
          // Prefer explicit UTC field when present, otherwise force UTC interpretation
          game_time: normalizeGameTimeUtcIso(g),
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
        
        const teamsData = sortedByDefense.map((t: any, i: number) => ({
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
        
        // Fetch official NBA player list (identity resolution)
        const activePlayers = await fetchActivePlayers(sportsDataIOKey);
        console.log(`RAW API RESPONSE - Active players sample: ${JSON.stringify((activePlayers || []).slice(0, 2))}`);
        
        const playersById = new Map<number, any>();
        for (const p of activePlayers || []) {
          if (typeof p?.PlayerID === "number") playersById.set(p.PlayerID, p);
        }
        console.log(`Fetched ${playersById.size} official players for identity resolution`);

        // Fetch player season stats and recent game logs from box scores
        const playerSeasonStats = await fetchPlayerSeasonStats(sportsDataIOKey, season.toString());
        console.log(`RAW API RESPONSE - Season stats sample: ${JSON.stringify((playerSeasonStats || []).slice(0, 2))}`);
        
        // Fetch recent box scores for game-by-game data
        const gameLogs = await fetchRecentBoxScores(sportsDataIOKey, 14); // Last 14 days
        console.log(`RAW API RESPONSE - Game logs sample: ${JSON.stringify((gameLogs || []).slice(0, 2))}`);

        console.log(`Fetched ${playerSeasonStats.length} player season stats, ${gameLogs.length} game logs`);

        // Filter to players on teams playing today with significant minutes AND resolvable PlayerID
        const relevantSeasonRows = (playerSeasonStats || []).filter((row: any) => {
          const playerId = row?.PlayerID;
          if (typeof playerId !== "number") return false;
          if (!teamsPlaying.has(row?.Team)) return false;
          if (!row?.Team || String(row.Team).length !== 3) return false;
          if (!row?.Minutes || row.Minutes <= 15) return false;

          const official = playersById.get(playerId);
          if (!official) return false;
          if (!isValidPlayer(official)) return false;

          return true;
        });

        console.log(`Processing ${relevantSeasonRows.length} resolvable players on today's slate`);

        const playersData: any[] = [];
        let skippedCount = 0;
        for (const row of relevantSeasonRows.slice(0, 150)) {
          const official = playersById.get(row.PlayerID);
          // Merge: keep Team from season row (current team), keep identity from official list
          const merged = {
            ...row,
            ...official,
            PlayerID: row.PlayerID,
            Team: row.Team,
            Name: getPlayerFullName(official),
            InjuryStatus: official?.InjuryStatus ?? "Active",
          };

          const processed = processPlayerFromLogs(merged, gameLogs);
          if (processed && processed.season_avg_min > 15) {
            playersData.push(processed);
            // Log first few players for verification
            if (playersData.length <= 3) {
              console.log(`VERIFIED PLAYER: ${processed.player_name} (ID: ${processed.player_id}, Team: ${processed.team})`);
            }
          } else {
            skippedCount++;
          }
        }

        console.log(`Successfully processed ${playersData.length} players with complete stats (skipped ${skippedCount})`);
        
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
            completed_at: new Date().toISOString()
          }).eq("id", logEntry.id);
        }

        return new Response(JSON.stringify({
          success: true,
          games_fetched: gamesData.length,
          players_updated: playersData.length,
          teams_updated: teamsData.length,
          source
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
      } catch (apiError) {
        console.error("SportsDataIO API error:", apiError);
        
        // Update log with error
        if (logEntry) {
          await supabase.from("nba_stats_refresh_log").update({
            status: "error",
            error_message: apiError instanceof Error ? apiError.message : "API error",
            completed_at: new Date().toISOString()
          }).eq("id", logEntry.id);
        }
        
        return new Response(JSON.stringify({
          success: false,
          error: "Failed to fetch NBA data from SportsDataIO",
          details: apiError instanceof Error ? apiError.message : "Unknown API error"
        }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

    // Update game scores and winners for settlement + store player box scores
    if (action === "update_scores") {
      console.log("=== NBA STATS ENGINE: UPDATE_SCORES START ===");
      
      // Get the date to check (defaults to today, can also check yesterday)
      const { date: requestDate } = await req.json().catch(() => ({}));
      const checkDate = requestDate || today;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      
      // Fetch games from both today and yesterday
      const datesToCheck = [checkDate];
      if (checkDate === today) {
        datesToCheck.push(yesterdayStr);
      }
      
      let totalUpdated = 0;
      let boxScoresStored = 0;
      const updatedGames: any[] = [];
      
      for (const dateStr of datesToCheck) {
        try {
          // Fetch final box scores from SportsDataIO
          const boxScores = await fetchSportsDataIO(`/stats/json/BoxScoresFinal/${dateStr}`, sportsDataIOKey);
          
          if (!boxScores || !Array.isArray(boxScores)) {
            console.log(`No final box scores for ${dateStr}`);
            continue;
          }
          
          console.log(`Found ${boxScores.length} final games for ${dateStr}`);
          
          for (const game of boxScores) {
            if (!game.Game) continue;
            
            const gameData = game.Game;
            const gameId = gameData.GameID?.toString();
            const homeTeam = gameData.HomeTeam;
            const awayTeam = gameData.AwayTeam;
            const homeScore = gameData.HomeTeamScore;
            const awayScore = gameData.AwayTeamScore;
            const status = gameData.Status || "Final";
            
            if (status !== "Final" || homeScore === null || awayScore === null) {
              continue;
            }
            
            const winner = homeScore > awayScore ? homeTeam : awayTeam;
            
            // Update the game in nba_games_today
            const { error: updateError } = await supabase
              .from("nba_games_today")
              .update({
                home_score: homeScore,
                away_score: awayScore,
                winner: winner,
                status: "Final"
              })
              .eq("game_id", gameId);
            
            if (updateError) {
              console.error(`Error updating game ${gameId}:`, updateError);
              
              // Try to match by teams instead
              const { error: teamUpdateError } = await supabase
                .from("nba_games_today")
                .update({
                  home_score: homeScore,
                  away_score: awayScore,
                  winner: winner,
                  status: "Final"
                })
                .eq("home_team", homeTeam)
                .eq("away_team", awayTeam)
                .eq("game_date", dateStr);
              
              if (teamUpdateError) {
                console.error(`Also failed team-based update:`, teamUpdateError);
              } else {
                totalUpdated++;
                updatedGames.push({ home_team: homeTeam, away_team: awayTeam, winner, home_score: homeScore, away_score: awayScore });
              }
            } else {
              totalUpdated++;
              updatedGames.push({ game_id: gameId, home_team: homeTeam, away_team: awayTeam, winner, home_score: homeScore, away_score: awayScore });
            }

            // CRITICAL: Store individual player box scores for prop settlement
            if (game.PlayerGames && Array.isArray(game.PlayerGames)) {
              const playerBoxScores = game.PlayerGames.map((pg: any) => {
                const playerTeam = pg.Team || "";
                const opponent = playerTeam === homeTeam ? awayTeam : homeTeam;
                const minutes = pg.Minutes || 0;
                const isDNP = minutes === 0;

                return {
                  game_id: gameId,
                  game_date: dateStr,
                  player_id: pg.PlayerID?.toString() || "",
                  player_name: pg.Name || "",
                  team: playerTeam,
                  opponent: opponent,
                  // FINAL BOX SCORE STATS - these are the ONLY source for prop settlement
                  points: pg.Points || 0,
                  rebounds: pg.Rebounds || 0,
                  assists: pg.Assists || 0,
                  three_pointers_made: pg.ThreePointersMade || 0,
                  steals: pg.Steals || 0,
                  blocks: pg.BlockedShots || 0,
                  turnovers: pg.Turnovers || 0,
                  minutes: minutes,
                  dnp: isDNP,
                  updated_at: new Date().toISOString(),
                };
              }).filter((ps: any) => ps.player_id && ps.player_name);

              if (playerBoxScores.length > 0) {
                // Upsert player box scores
                const { error: boxScoreError } = await supabase
                  .from("nba_player_box_scores")
                  .upsert(playerBoxScores, { 
                    onConflict: "game_id,player_id",
                    ignoreDuplicates: false 
                  });

                if (boxScoreError) {
                  console.error(`Error storing box scores for game ${gameId}:`, boxScoreError);
                } else {
                  boxScoresStored += playerBoxScores.length;
                  console.log(`Stored ${playerBoxScores.length} player box scores for game ${gameId}`);
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching scores for ${dateStr}:`, error);
        }
      }
      
      console.log(`=== NBA STATS ENGINE: UPDATE_SCORES COMPLETE - Updated ${totalUpdated} games, stored ${boxScoresStored} player box scores ===`);
      
      return new Response(JSON.stringify({
        success: true,
        games_updated: totalUpdated,
        box_scores_stored: boxScoresStored,
        updated_games: updatedGames,
        dates_checked: datesToCheck
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========== SETTLE RESULTS ACTION ==========
    // Automatically settles games by deriving winners from final scores
    // and populating confirmed_game_winners with confirmation_source = 'automatic'
    if (action === "settle_results") {
      console.log("=== NBA STATS ENGINE: SETTLE_RESULTS START ===");
      
      try {
        // 1. Get all final games from the last 7 days
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];
        
        const { data: finalGames, error: gamesError } = await supabase
          .from('nba_games_today')
          .select('*')
          .eq('status', 'Final')
          .gte('game_date', sevenDaysAgoStr)
          .not('winner', 'is', null);
        
        if (gamesError) {
          console.error('Error fetching final games:', gamesError);
          throw gamesError;
        }
        
        console.log(`Found ${finalGames?.length || 0} final games to potentially settle`);
        
        if (!finalGames || finalGames.length === 0) {
          return new Response(JSON.stringify({
            success: true,
            message: 'No final games to settle',
            settled: 0
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        // 2. Get existing confirmations to avoid duplicates
        const gameIds = finalGames.map(g => g.game_id);
        const { data: existingConfirmations } = await supabase
          .from('confirmed_game_winners')
          .select('game_id, confirmation_revoked')
          .in('game_id', gameIds);
        
        const confirmedGameIds = new Set(
          (existingConfirmations || [])
            .filter(c => !c.confirmation_revoked)
            .map(c => c.game_id)
        );
        
        console.log(`Already confirmed: ${confirmedGameIds.size} games`);
        
        // 3. Process unconfirmed final games
        let settledCount = 0;
        const errors: string[] = [];
        
        for (const game of finalGames) {
          if (confirmedGameIds.has(game.game_id)) {
            continue; // Skip already confirmed
          }
          
          // Derive winner from scores
          const winner = game.winner || (
            game.home_score > game.away_score ? game.home_team : game.away_team
          );
          
          if (!winner) {
            console.log(`Cannot determine winner for game ${game.game_id}`);
            continue;
          }
          
          try {
            // Upsert into confirmed_game_winners with automatic source
            const { error: upsertError } = await supabase
              .from('confirmed_game_winners')
              .upsert({
                game_id: game.game_id,
                game_date: game.game_date,
                sport: 'NBA',
                home_team: game.home_team,
                away_team: game.away_team,
                home_score: game.home_score,
                away_score: game.away_score,
                confirmed_winner: winner,
                confirmation_source: 'automatic',
                confirmed_at: new Date().toISOString(),
                confirmation_revoked: false,
              }, { 
                onConflict: 'game_id,sport',
                ignoreDuplicates: false
              });
            
            if (upsertError) {
              console.error(`Error settling game ${game.game_id}:`, upsertError);
              errors.push(`${game.game_id}: ${upsertError.message}`);
              continue;
            }
            
            settledCount++;
            console.log(`Settled: ${game.away_team} @ ${game.home_team} -> Winner: ${winner}`);
          } catch (err) {
            console.error(`Exception settling game ${game.game_id}:`, err);
            errors.push(`${game.game_id}: ${err}`);
          }
        }
        
        console.log(`=== NBA STATS ENGINE: SETTLE_RESULTS COMPLETE - Settled ${settledCount} games ===`);
        
        return new Response(JSON.stringify({
          success: true,
          settled: settledCount,
          already_confirmed: confirmedGameIds.size,
          total_final_games: finalGames.length,
          errors: errors.length > 0 ? errors : undefined
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        
      } catch (error) {
        console.error('Settle results error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }), { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }
    }

    if (action === "generate_props") {
      console.log("=== NBA STATS ENGINE: GENERATE_PROPS START ===");
      
      // Fetch today's games
      const { data: games, error: gamesError } = await supabase
        .from("nba_games_today")
        .select("*")
        .eq("game_date", today);

      console.log(`Games for today: ${games?.length || 0}, error: ${gamesError?.message || 'none'}`);

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
      console.log(`Teams today: ${Array.from(teamsToday).join(', ')}`);

      const { data: players, error: playersError } = await supabase
        .from("nba_player_stats")
        .select("*")
        .in("team", Array.from(teamsToday))
        .neq("injury_status", "out");

      console.log(`Players fetched: ${players?.length || 0}, error: ${playersError?.message || 'none'}`);

      // CRITICAL: Filter out any invalid players that might have been stored
       const validPlayers = (players || []).filter((p: any) => {
         // Must have numeric-ish player_id (not mock_*)
         if (!p.player_id || String(p.player_id).startsWith("mock_")) {
           console.log(`Skipping mock player: ${p.player_name}`);
           return false;
         }
         // Must have real name
         const invalidNames = [
           "PG Player",
           "SG Player",
           "SF Player",
           "PF Player",
           "C Player",
           "Unknown Player",
           "Unknown",
         ];
         if (!p.player_name || invalidNames.some((invalid) => p.player_name?.includes(invalid))) {
           console.log(`Skipping placeholder player: ${p.player_name}`);
           return false;
         }
         // Must have valid team code
         if (!p.team || String(p.team).length !== 3) {
           console.log(`Skipping invalid team player: ${p.player_name} (${p.team})`);
           return false;
         }
         return true;
       });

      console.log(`Generating props for ${validPlayers.length} validated players`);

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

      for (const player of validPlayers) {
        const game = games.find(
          (g: any) => g.home_team === player.team || g.away_team === player.team
        );
        if (!game) continue;

        const isHome = game.home_team === player.team;
        const opponent = isHome ? game.away_team : game.home_team;
         const oppTeam = teamMap.get(opponent);
         if (!oppTeam) {
           console.log(`Skipping ${player.player_name}: missing opponent team stats for ${opponent}`);
           continue;
         }

         const isB2B = isHome ? game.home_team_back_to_back : game.away_team_back_to_back;

         const oppDefRank = oppTeam?.def_rank_overall;
         const oppDefTier = typeof oppDefRank === "number" ? getDefTier(oppDefRank) : null;
         const paceTier = oppTeam?.pace_tier ?? null;

         // CRITICAL: No silent fallbacks — require matchup context + minutes data
         if (!oppDefTier || !paceTier) {
           console.log(`Skipping ${player.player_name}: missing def/pace tiers`);
           continue;
         }
         if (!player.minutes_last_5_avg || !player.season_avg_min) {
           console.log(`Skipping ${player.player_name}: missing minutes trends`);
           continue;
         }

          const minutesTrend = getMinutesTrend(
            player.minutes_last_5_avg,
            player.season_avg_min
          );

        for (const stat of statTypes) {
          // Get stat-specific values - FIXED: Use correct column names from nba_player_stats table
          let last5 = 0, season = 0, std = 0;
          switch (stat.key) {
            case "pts":
              last5 = player.last_5_games_avg_pts || 0;
              season = player.season_avg_pts || 0;
              std = player.std_pts || season * 0.2;
              break;
            case "reb":
              last5 = player.last_5_games_avg_reb || 0;
              season = player.season_avg_reb || 0;
              std = player.std_reb || season * 0.25;
              break;
            case "ast":
              last5 = player.last_5_games_avg_ast || 0;
              season = player.season_avg_ast || 0;
              std = player.std_ast || season * 0.3;
              break;
            case "3pm":
              last5 = player.last_5_games_avg_3pm || 0;
              season = player.season_avg_3pm || 0;
              std = player.std_3pm || season * 0.4;
              break;
            case "pra":
              last5 = (player.last_5_games_avg_pts || 0) + (player.last_5_games_avg_reb || 0) + (player.last_5_games_avg_ast || 0);
              season = (player.season_avg_pts || 0) + (player.season_avg_reb || 0) + (player.season_avg_ast || 0);
              std = (player.std_pts || 0) + (player.std_reb || 0) + (player.std_ast || 0);
              break;
          }

          // Skip if insufficient stats - log for debugging
          if (last5 <= 0 && season <= 0) {
            console.log(`Skipping ${player.player_name} ${stat.name}: no stats (last5=${last5}, season=${season})`);
            continue;
          }

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

          // Calculate confidence - REDUCE for missing data
          let confidence = 50 + edge * 2;
          if (player.data_completeness) confidence += (player.data_completeness - 50) * 0.2;
          if (player.injury_status === "questionable") confidence -= 10;
          if (isB2B) confidence -= 5;
          
          // Additional confidence reduction for incomplete stats
          let missingStats = 0;
          if (!player.minutes_last_5_avg) missingStats++;
          if (!oppTeam) missingStats++;
          confidence -= missingStats * 5;
          
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

          // Determine volatility tier
          const volatilityTier = volatility > 0.4 ? "high" : volatility < 0.2 ? "low" : "medium";

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
            opponent_def_tier: oppDefTier,
            pace_tier: paceTier,
            minutes_trend: minutesTrend,
            data_completeness: player.data_completeness || 50,
            source: "SportsDataIO",
            volatility_score: volatilityTier,
            projected_value: projected,
            back_to_back: isB2B,
            home_game: isHome,
            // CRITICAL: Store all stats used in probability calculation (must be visible in UI)
            calibration_factors: {
              player_id: player.player_id,
              player_name: player.player_name,
              team: player.team,
              opponent,
              game_date: today,

              last_5_avg: last5,
              season_avg: season,
              std: std,
              minutes_l5: player.minutes_last_5_avg,
              minutes_season: player.season_avg_min,
              def_rank: oppDefRank,
              pace_rating: oppTeam?.pace_rating,
              injury_status: player.injury_status,
              data_completeness: player.data_completeness || 50,
              stats_source: "SportsDataIO",
            },
          });
        }
      }

      // Insert props with verification
      console.log(`Prepared ${propsGenerated.length} props for insertion`);
      
      if (propsGenerated.length > 0) {
        // Log sample prop for verification
        console.log(`SAMPLE PROP: ${JSON.stringify(propsGenerated[0])}`);
        
        const { error: insertError } = await supabase.from("nba_props_generated").insert(propsGenerated);
        if (insertError) {
          console.error(`PROP INSERT ERROR: ${insertError.message}`);
          throw new Error(`Failed to insert props: ${insertError.message}`);
        }
        
        // VERIFICATION: Query back to confirm write
        const { data: verifyProps, error: verifyError } = await supabase
          .from("nba_props_generated")
          .select("id, player_name, stat_type")
          .eq("game_date", today)
          .limit(5);
        
        console.log(`VERIFICATION: Found ${verifyProps?.length || 0} props in DB after insert`);
        if (verifyError) console.error(`VERIFY ERROR: ${verifyError.message}`);
      } else {
        console.log("WARNING: No props generated - check player validation and team stats");
      }

      // Update log
      await supabase.from("nba_stats_refresh_log")
        .update({ props_generated: propsGenerated.length })
        .eq("status", "complete")
        .order("completed_at", { ascending: false })
        .limit(1);

      console.log("=== NBA STATS ENGINE: GENERATE_PROPS COMPLETE ===");

      return new Response(JSON.stringify({
        success: true,
        props_generated: propsGenerated.length,
        validated_players: validPlayers.length,
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
