import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NBA Stats Engine - Fetches/generates NBA player stats and runs predictions
// For Phase 3.5: Uses deterministic mock data with realistic distributions
// Future: Replace with real API calls (ball-dont-lie, sportradar, etc.)

interface NBAPlayer {
  player_id: string;
  player_name: string;
  team: string;
  position: string;
  stats: {
    pts: { last5: number; last10: number; season: number; std: number };
    reb: { last5: number; last10: number; season: number; std: number };
    ast: { last5: number; last10: number; season: number; std: number };
    threepm: { last5: number; last10: number; season: number; std: number };
    pra: { last5: number; last10: number; season: number; std: number };
    min: { last5: number; season: number };
  };
  injury_status: "active" | "questionable" | "out";
  usage_rate: number;
}

interface NBATeam {
  team_abbr: string;
  team_name: string;
  def_rank_overall: number;
  def_ranks: { pg: number; sg: number; sf: number; pf: number; c: number };
  pace_rating: number;
  pace_tier: "slow" | "avg" | "fast";
  pts_allowed_avg: number;
}

interface NBAGame {
  game_id: string;
  home_team: string;
  away_team: string;
  game_time: string;
  home_b2b: boolean;
  away_b2b: boolean;
}

// Generate realistic mock NBA data based on current date
// This creates deterministic but varied data
const generateMockNBAData = (dateString: string) => {
  const seed = dateString.split("-").reduce((a, b) => a + parseInt(b), 0);
  const rng = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // NBA Teams with defensive/pace profiles
  const teams: NBATeam[] = [
    { team_abbr: "BOS", team_name: "Boston Celtics", def_rank_overall: 3, def_ranks: { pg: 5, sg: 4, sf: 3, pf: 2, c: 4 }, pace_rating: 100.2, pace_tier: "avg", pts_allowed_avg: 108.5 },
    { team_abbr: "MIL", team_name: "Milwaukee Bucks", def_rank_overall: 8, def_ranks: { pg: 10, sg: 8, sf: 6, pf: 5, c: 3 }, pace_rating: 101.5, pace_tier: "fast", pts_allowed_avg: 112.3 },
    { team_abbr: "PHI", team_name: "Philadelphia 76ers", def_rank_overall: 12, def_ranks: { pg: 15, sg: 12, sf: 10, pf: 8, c: 5 }, pace_rating: 97.8, pace_tier: "slow", pts_allowed_avg: 110.8 },
    { team_abbr: "CLE", team_name: "Cleveland Cavaliers", def_rank_overall: 5, def_ranks: { pg: 6, sg: 5, sf: 4, pf: 6, c: 2 }, pace_rating: 98.5, pace_tier: "slow", pts_allowed_avg: 106.2 },
    { team_abbr: "NYK", team_name: "New York Knicks", def_rank_overall: 7, def_ranks: { pg: 8, sg: 6, sf: 7, pf: 4, c: 6 }, pace_rating: 99.2, pace_tier: "avg", pts_allowed_avg: 109.1 },
    { team_abbr: "MIA", team_name: "Miami Heat", def_rank_overall: 10, def_ranks: { pg: 12, sg: 9, sf: 8, pf: 10, c: 8 }, pace_rating: 96.5, pace_tier: "slow", pts_allowed_avg: 111.5 },
    { team_abbr: "ATL", team_name: "Atlanta Hawks", def_rank_overall: 22, def_ranks: { pg: 20, sg: 22, sf: 18, pf: 20, c: 15 }, pace_rating: 102.8, pace_tier: "fast", pts_allowed_avg: 118.2 },
    { team_abbr: "CHI", team_name: "Chicago Bulls", def_rank_overall: 18, def_ranks: { pg: 16, sg: 18, sf: 15, pf: 14, c: 12 }, pace_rating: 99.8, pace_tier: "avg", pts_allowed_avg: 114.5 },
    { team_abbr: "IND", team_name: "Indiana Pacers", def_rank_overall: 25, def_ranks: { pg: 24, sg: 25, sf: 20, pf: 22, c: 18 }, pace_rating: 105.2, pace_tier: "fast", pts_allowed_avg: 120.5 },
    { team_abbr: "DEN", team_name: "Denver Nuggets", def_rank_overall: 6, def_ranks: { pg: 7, sg: 6, sf: 5, pf: 3, c: 4 }, pace_rating: 100.5, pace_tier: "avg", pts_allowed_avg: 109.8 },
    { team_abbr: "OKC", team_name: "Oklahoma City Thunder", def_rank_overall: 4, def_ranks: { pg: 4, sg: 3, sf: 5, pf: 4, c: 6 }, pace_rating: 101.2, pace_tier: "avg", pts_allowed_avg: 107.5 },
    { team_abbr: "MIN", team_name: "Minnesota Timberwolves", def_rank_overall: 2, def_ranks: { pg: 3, sg: 2, sf: 2, pf: 1, c: 1 }, pace_rating: 99.5, pace_tier: "avg", pts_allowed_avg: 105.8 },
    { team_abbr: "LAL", team_name: "Los Angeles Lakers", def_rank_overall: 14, def_ranks: { pg: 14, sg: 15, sf: 12, pf: 10, c: 8 }, pace_rating: 100.8, pace_tier: "avg", pts_allowed_avg: 113.2 },
    { team_abbr: "PHX", team_name: "Phoenix Suns", def_rank_overall: 16, def_ranks: { pg: 18, sg: 14, sf: 16, pf: 12, c: 14 }, pace_rating: 101.0, pace_tier: "avg", pts_allowed_avg: 114.0 },
    { team_abbr: "SAC", team_name: "Sacramento Kings", def_rank_overall: 20, def_ranks: { pg: 22, sg: 20, sf: 18, pf: 16, c: 16 }, pace_rating: 103.5, pace_tier: "fast", pts_allowed_avg: 116.8 },
    { team_abbr: "GSW", team_name: "Golden State Warriors", def_rank_overall: 15, def_ranks: { pg: 16, sg: 14, sf: 14, pf: 14, c: 12 }, pace_rating: 101.8, pace_tier: "fast", pts_allowed_avg: 113.5 },
  ];

  // Generate mock players for each team
  const generateTeamPlayers = (team: string, offset: number): NBAPlayer[] => {
    const positions = ["PG", "SG", "SF", "PF", "C"];
    const playerTemplates = [
      { basePts: 28, baseReb: 5, baseAst: 8, base3pm: 3.5 }, // Star guard
      { basePts: 22, baseReb: 4, baseAst: 3, base3pm: 2.8 }, // Scoring wing
      { basePts: 18, baseReb: 6, baseAst: 4, base3pm: 1.5 }, // Wing
      { basePts: 16, baseReb: 8, baseAst: 3, base3pm: 0.8 }, // Big
      { basePts: 14, baseReb: 10, baseAst: 2, base3pm: 0.3 }, // Center
    ];

    return positions.map((pos, i) => {
      const template = playerTemplates[i];
      const variance = 0.15;
      const playerOffset = offset + i * 100;

      const pts = template.basePts * (1 + (rng(playerOffset + 1) - 0.5) * variance);
      const reb = template.baseReb * (1 + (rng(playerOffset + 2) - 0.5) * variance);
      const ast = template.baseAst * (1 + (rng(playerOffset + 3) - 0.5) * variance);
      const threepm = template.base3pm * (1 + (rng(playerOffset + 4) - 0.5) * variance);

      return {
        player_id: `${team}_${pos}_${playerOffset}`,
        player_name: `${team} ${pos} Player`,
        team,
        position: pos,
        stats: {
          pts: {
            last5: pts * (1 + (rng(playerOffset + 10) - 0.5) * 0.1),
            last10: pts * (1 + (rng(playerOffset + 11) - 0.5) * 0.05),
            season: pts,
            std: pts * 0.2 * (1 + rng(playerOffset + 12) * 0.3),
          },
          reb: {
            last5: reb * (1 + (rng(playerOffset + 20) - 0.5) * 0.15),
            last10: reb * (1 + (rng(playerOffset + 21) - 0.5) * 0.08),
            season: reb,
            std: reb * 0.25 * (1 + rng(playerOffset + 22) * 0.3),
          },
          ast: {
            last5: ast * (1 + (rng(playerOffset + 30) - 0.5) * 0.12),
            last10: ast * (1 + (rng(playerOffset + 31) - 0.5) * 0.06),
            season: ast,
            std: ast * 0.3 * (1 + rng(playerOffset + 32) * 0.3),
          },
          threepm: {
            last5: threepm * (1 + (rng(playerOffset + 40) - 0.5) * 0.2),
            last10: threepm * (1 + (rng(playerOffset + 41) - 0.5) * 0.1),
            season: threepm,
            std: threepm * 0.35 * (1 + rng(playerOffset + 42) * 0.3),
          },
          pra: {
            last5: pts + reb + ast + (rng(playerOffset + 50) - 0.5) * 5,
            last10: pts + reb + ast + (rng(playerOffset + 51) - 0.5) * 3,
            season: pts + reb + ast,
            std: (pts + reb + ast) * 0.15,
          },
          min: {
            last5: 32 + (rng(playerOffset + 60) - 0.5) * 8,
            season: 30 + rng(playerOffset + 61) * 6,
          },
        },
        injury_status: rng(playerOffset + 70) < 0.85 ? "active" : rng(playerOffset + 71) < 0.5 ? "questionable" : "out",
        usage_rate: 18 + rng(playerOffset + 80) * 15,
      } as NBAPlayer;
    });
  };

  // Generate today's games (3-6 games per day)
  const numGames = 3 + Math.floor(rng(1) * 4);
  const shuffledTeams = [...teams].sort(() => rng(2) - 0.5);
  const games: NBAGame[] = [];

  for (let i = 0; i < Math.min(numGames, Math.floor(shuffledTeams.length / 2)); i++) {
    const homeTeam = shuffledTeams[i * 2];
    const awayTeam = shuffledTeams[i * 2 + 1];
    const gameHour = 19 + Math.floor(rng(100 + i) * 4); // 7pm - 10pm

    games.push({
      game_id: `${dateString}_${homeTeam.team_abbr}_${awayTeam.team_abbr}`,
      home_team: homeTeam.team_abbr,
      away_team: awayTeam.team_abbr,
      game_time: `${dateString}T${gameHour}:00:00Z`,
      home_b2b: rng(200 + i) < 0.2,
      away_b2b: rng(300 + i) < 0.2,
    });
  }

  // Generate players for teams in today's games
  const players: NBAPlayer[] = [];
  const teamsInGames = new Set<string>();
  games.forEach((g) => {
    teamsInGames.add(g.home_team);
    teamsInGames.add(g.away_team);
  });

  let teamIdx = 0;
  teamsInGames.forEach((teamAbbr) => {
    players.push(...generateTeamPlayers(teamAbbr, teamIdx * 1000));
    teamIdx++;
  });

  return { teams, players, games };
};

// Calculate prop line from player stats (typical sportsbook line setting)
const calculatePropLine = (stat: number, std: number): number => {
  // Lines are typically set at projected value minus a small margin
  const line = stat - std * 0.1;
  // Round to standard increments
  return Math.round(line * 2) / 2; // Round to nearest 0.5
};

// Probability calculation using normal distribution approximation
const calculateProbability = (
  projectedValue: number,
  lineValue: number,
  std: number,
  overUnder: "over" | "under"
): number => {
  const zScore = (lineValue - projectedValue) / (std || 1);
  const probUnder = 1 / (1 + Math.exp(-1.7 * zScore));
  const rawProb = overUnder === "over" ? 1 - probUnder : probUnder;
  // Clamp to 0.35-0.65 as specified
  return Math.max(0.35, Math.min(0.65, rawProb));
};

// Get defense tier from rank
const getDefTier = (rank: number): "low" | "med" | "high" => {
  if (rank <= 10) return "high"; // Top 10 = strong defense = low for over
  if (rank >= 20) return "low"; // Bottom 10 = weak defense = high for over
  return "med";
};

// Get minutes trend
const getMinutesTrend = (last5Min: number, seasonMin: number): "up" | "flat" | "down" => {
  const diff = last5Min - seasonMin;
  if (diff > 2) return "up";
  if (diff < -2) return "down";
  return "flat";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json();
    const today = new Date().toISOString().split("T")[0];

    console.log(`NBA Stats Engine: action=${action}, date=${today}`);

    if (action === "refresh_stats") {
      // Create refresh log
      const { data: logEntry, error: logError } = await supabase
        .from("nba_stats_refresh_log")
        .insert({
          refresh_date: today,
          status: "running",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (logError) console.error("Log creation error:", logError);

      // Generate mock data for today
      const { teams, players, games } = generateMockNBAData(today);

      // Upsert teams
      for (const team of teams) {
        await supabase.from("nba_team_stats").upsert({
          team_abbr: team.team_abbr,
          team_name: team.team_name,
          def_rank_vs_pg: team.def_ranks.pg,
          def_rank_vs_sg: team.def_ranks.sg,
          def_rank_vs_sf: team.def_ranks.sf,
          def_rank_vs_pf: team.def_ranks.pf,
          def_rank_vs_c: team.def_ranks.c,
          def_rank_overall: team.def_rank_overall,
          pace_rating: team.pace_rating,
          pace_tier: team.pace_tier,
          pts_allowed_avg: team.pts_allowed_avg,
          last_updated: new Date().toISOString(),
        }, { onConflict: "team_abbr" });
      }

      // Upsert players
      for (const player of players) {
        await supabase.from("nba_player_stats").upsert({
          player_id: player.player_id,
          player_name: player.player_name,
          team: player.team,
          position: player.position,
          last_5_games_avg_pts: player.stats.pts.last5,
          last_5_games_avg_reb: player.stats.reb.last5,
          last_5_games_avg_ast: player.stats.ast.last5,
          last_5_games_avg_3pm: player.stats.threepm.last5,
          last_5_games_avg_pra: player.stats.pra.last5,
          last_10_games_avg_pts: player.stats.pts.last10,
          last_10_games_avg_reb: player.stats.reb.last10,
          last_10_games_avg_ast: player.stats.ast.last10,
          last_10_games_avg_3pm: player.stats.threepm.last10,
          last_10_games_avg_pra: player.stats.pra.last10,
          season_avg_pts: player.stats.pts.season,
          season_avg_reb: player.stats.reb.season,
          season_avg_ast: player.stats.ast.season,
          season_avg_3pm: player.stats.threepm.season,
          season_avg_pra: player.stats.pra.season,
          season_avg_min: player.stats.min.season,
          std_pts: player.stats.pts.std,
          std_reb: player.stats.reb.std,
          std_ast: player.stats.ast.std,
          std_3pm: player.stats.threepm.std,
          std_pra: player.stats.pra.std,
          minutes_last_5_avg: player.stats.min.last5,
          usage_rate: player.usage_rate,
          injury_status: player.injury_status,
          last_updated: new Date().toISOString(),
        }, { onConflict: "player_id" });
      }

      // Insert today's games (delete old first)
      await supabase.from("nba_games_today").delete().eq("game_date", today);
      for (const game of games) {
        await supabase.from("nba_games_today").insert({
          game_id: game.game_id,
          home_team: game.home_team,
          away_team: game.away_team,
          game_time: game.game_time,
          home_team_back_to_back: game.home_b2b,
          away_team_back_to_back: game.away_b2b,
          game_date: today,
          status: "scheduled",
        });
      }

      // Update log
      if (logEntry) {
        await supabase.from("nba_stats_refresh_log").update({
          games_fetched: games.length,
          players_updated: players.length,
          teams_updated: teams.length,
          status: "complete",
          completed_at: new Date().toISOString(),
        }).eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({
          success: true,
          games_fetched: games.length,
          players_updated: players.length,
          teams_updated: teams.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
      games.forEach((g) => {
        teamsToday.add(g.home_team);
        teamsToday.add(g.away_team);
      });

      const { data: players } = await supabase
        .from("nba_player_stats")
        .select("*")
        .in("team", Array.from(teamsToday))
        .eq("injury_status", "active");

      // Fetch team stats
      const { data: teamStats } = await supabase.from("nba_team_stats").select("*");
      const teamMap = new Map(teamStats?.map((t) => [t.team_abbr, t]) || []);

      // Delete old props for today
      await supabase.from("nba_props_generated").delete().eq("game_date", today);

      const propsGenerated: any[] = [];
      const statTypes = [
        { key: "pts", name: "PTS" },
        { key: "reb", name: "REB" },
        { key: "ast", name: "AST" },
        { key: "threepm", name: "3PM" },
        { key: "pra", name: "PRA" },
      ];

      for (const player of players || []) {
        // Find the game this player is in
        const game = games.find(
          (g) => g.home_team === player.team || g.away_team === player.team
        );
        if (!game) continue;

        const isHome = game.home_team === player.team;
        const opponent = isHome ? game.away_team : game.home_team;
        const oppTeam = teamMap.get(opponent);
        const isB2B = isHome ? game.home_team_back_to_back : game.away_team_back_to_back;

        // Get opponent defense tier based on player position
        const positionKey = player.position?.toLowerCase() as "pg" | "sg" | "sf" | "pf" | "c";
        const defRankField = `def_rank_vs_${positionKey}` as keyof typeof oppTeam;
        const oppDefRank = oppTeam?.[defRankField] as number || 15;
        const oppDefTier = getDefTier(oppDefRank);

        const paceTier = oppTeam?.pace_tier || "avg";
        const minutesTrend = getMinutesTrend(
          player.minutes_last_5_avg || 30,
          player.season_avg_min || 30
        );

        for (const stat of statTypes) {
          const last5Key = `last_5_games_avg_${stat.key}` as keyof typeof player;
          const last10Key = `last_10_games_avg_${stat.key}` as keyof typeof player;
          const seasonKey = `season_avg_${stat.key}` as keyof typeof player;
          const stdKey = `std_${stat.key}` as keyof typeof player;

          const last5 = player[last5Key] as number | null;
          const last10 = player[last10Key] as number | null;
          const season = player[seasonKey] as number | null;
          const std = player[stdKey] as number | null;

          if (!last5 || !season) continue;
          if (stat.key === "threepm" && season < 0.5) continue; // Skip low 3PT shooters

          // Blend averages (70% recent, 30% season)
          const blendedAvg = last5 * 0.7 + season * 0.3;
          const lineValue = calculatePropLine(blendedAvg, std || blendedAvg * 0.2);

          if (lineValue < 0.5) continue; // Skip very low lines

          // Generate both over and under props
          for (const overUnder of ["over", "under"] as const) {
            const projectedValue = blendedAvg;
            const probability = calculateProbability(projectedValue, lineValue, std || blendedAvg * 0.2, overUnder);

            // Apply contextual adjustments
            let adjustedProb = probability;
            const factors: any[] = [];

            // Home/away
            const homeAdj = isHome ? 0.02 : -0.02;
            adjustedProb += overUnder === "over" ? homeAdj : -homeAdj;
            factors.push({ factor: isHome ? "Home Game" : "Away Game", adjustment: Math.round(homeAdj * 100), direction: homeAdj > 0 ? "up" : "down" });

            // Defense tier
            const defAdj = oppDefTier === "low" ? 0.02 : oppDefTier === "high" ? -0.02 : 0;
            adjustedProb += overUnder === "over" ? defAdj : -defAdj;
            if (defAdj !== 0) {
              factors.push({ factor: `${oppDefTier === "low" ? "Weak" : "Strong"} Defense`, adjustment: Math.round(defAdj * 100), direction: defAdj > 0 ? "up" : "down" });
            }

            // Pace
            const paceAdj = paceTier === "fast" ? 0.02 : paceTier === "slow" ? -0.02 : 0;
            adjustedProb += overUnder === "over" ? paceAdj : -paceAdj;
            if (paceAdj !== 0) {
              factors.push({ factor: `${paceTier === "fast" ? "Fast" : "Slow"} Pace`, adjustment: Math.round(paceAdj * 100), direction: paceAdj > 0 ? "up" : "down" });
            }

            // Minutes trend
            const minAdj = minutesTrend === "up" ? 0.02 : minutesTrend === "down" ? -0.02 : 0;
            adjustedProb += overUnder === "over" ? minAdj : -minAdj;
            if (minAdj !== 0) {
              factors.push({ factor: `Minutes ${minutesTrend === "up" ? "Up" : "Down"}`, adjustment: Math.round(minAdj * 100), direction: minAdj > 0 ? "up" : "down" });
            }

            // B2B penalty
            if (isB2B) {
              const b2bAdj = overUnder === "over" ? -0.02 : 0.02;
              adjustedProb += b2bAdj;
              factors.push({ factor: "Back-to-Back", adjustment: -2, direction: "down" });
            }

            // Clamp final probability
            adjustedProb = Math.max(0.35, Math.min(0.65, adjustedProb));

            // Calculate edge and ROI
            const breakEven = 0.50; // Pick'em standard
            const edge = (adjustedProb - breakEven) * 100;
            const simulatedRoi = adjustedProb * 1.9 - 1; // ~1.9x payout

            // Data completeness
            const dataCompleteness = 85; // Mock data has good completeness

            // Confidence with edge-based caps
            const absEdge = Math.abs(edge) / 100;
            let rawConfidence = Math.round(20 + Math.abs(edge) * 3 + dataCompleteness * 0.4);
            let confidence: number;
            if (absEdge < 0.01) confidence = Math.min(55, rawConfidence);
            else if (absEdge < 0.02) confidence = Math.min(70, rawConfidence);
            else if (absEdge < 0.03) confidence = Math.min(85, rawConfidence);
            else confidence = Math.min(99, rawConfidence);

            // Volatility
            const cv = (std || blendedAvg * 0.2) / blendedAvg;
            const volatility = cv < 0.15 ? "low" : cv > 0.30 ? "high" : "medium";

            // Recommendation
            let recommendation: string;
            if (edge >= 5 && confidence >= 70) recommendation = "strong_play";
            else if (edge >= 2 && confidence >= 50) recommendation = "lean";
            else if (edge >= 0) recommendation = "pass";
            else recommendation = "avoid";

            // Reasoning
            const reasoning = [
              `Projected ${projectedValue.toFixed(1)} vs line ${lineValue}`,
              isHome ? "Home game (+2%)" : "Away game (-2%)",
              `Defense: ${oppDefTier} (rank ${oppDefRank})`,
              `Pace: ${paceTier}`,
              `Minutes: ${minutesTrend}`,
            ];
            if (isB2B) reasoning.push("Back-to-back game (-2%)");

            propsGenerated.push({
              game_id: game.game_id,
              player_id: player.player_id,
              player_name: player.player_name,
              team: player.team,
              opponent,
              stat_type: stat.name,
              line_value: lineValue,
              over_under: overUnder,
              projected_value: projectedValue,
              estimated_probability: adjustedProb,
              break_even_probability: breakEven,
              edge: Math.round(edge * 10) / 10,
              confidence_score: confidence,
              simulated_roi: Math.round(simulatedRoi * 1000) / 1000,
              volatility_score: volatility,
              calibration_factors: factors,
              data_completeness: dataCompleteness,
              home_game: isHome,
              opponent_def_tier: oppDefTier,
              pace_tier: paceTier,
              minutes_trend: minutesTrend,
              back_to_back: isB2B,
              reasoning,
              recommendation,
              source: "ai_model_nba",
              game_date: today,
            });
          }
        }
      }

      // Insert props in batches
      const batchSize = 100;
      for (let i = 0; i < propsGenerated.length; i += batchSize) {
        const batch = propsGenerated.slice(i, i + batchSize);
        const { error } = await supabase.from("nba_props_generated").insert(batch);
        if (error) console.error("Batch insert error:", error);
      }

      // Update refresh log with props count
      await supabase.from("nba_stats_refresh_log")
        .update({ props_generated: propsGenerated.length })
        .eq("refresh_date", today)
        .eq("status", "complete");

      return new Response(
        JSON.stringify({
          success: true,
          props_generated: propsGenerated.length,
          games_processed: games.length,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'refresh_stats' or 'generate_props'." }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  } catch (error) {
    console.error("NBA Stats Engine error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});