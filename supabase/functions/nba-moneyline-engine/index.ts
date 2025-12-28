import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// SportsDataIO NBA API
const SPORTSDATAIO_BASE = "https://api.sportsdata.io/v3/nba";

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

// Calculate team strength from standings
function calculateTeamStrength(team: any): { netRating: number; offRating: number; defRating: number } {
  const wins = team.Wins || 0;
  const losses = team.Losses || 0;
  const totalGames = wins + losses || 1;
  const winPct = wins / totalGames;
  
  // Use point differential as proxy for net rating
  const ppg = team.PointsPerGameFor || 110;
  const oppPpg = team.PointsPerGameAgainst || 110;
  const netRating = (ppg - oppPpg) * 2; // Scale to approximate net rating
  
  return {
    netRating: netRating,
    offRating: ppg,
    defRating: oppPpg
  };
}

// Get rest days (simplified - assumes 1 day rest unless back-to-back)
function getRestDays(backToBack: boolean): number {
  return backToBack ? 0 : 1;
}

// Calculate home court advantage adjustment (typically 2-3 points)
const HOME_COURT_ADVANTAGE = 2.5;

// Calculate win probability with guardrail (max 70%)
function calculateWinProbability(
  teamNetRating: number,
  oppNetRating: number,
  isHome: boolean,
  teamBackToBack: boolean,
  oppBackToBack: boolean,
  teamInjuryImpact: number,
  oppInjuryImpact: number
): number {
  // Base differential
  let differential = teamNetRating - oppNetRating;
  
  // Home court advantage
  if (isHome) {
    differential += HOME_COURT_ADVANTAGE;
  } else {
    differential -= HOME_COURT_ADVANTAGE;
  }
  
  // Back-to-back penalty (-1.5 points impact)
  if (teamBackToBack) differential -= 1.5;
  if (oppBackToBack) differential += 1.5;
  
  // Injury adjustments
  differential -= teamInjuryImpact;
  differential += oppInjuryImpact;
  
  // Convert to probability using logistic function
  // Scale factor of 0.15 gives reasonable spread
  const rawProb = 1 / (1 + Math.exp(-0.15 * differential));
  
  // Apply guardrail: max 70% (min 30%)
  const guardedProb = Math.max(0.30, Math.min(0.70, rawProb));
  
  return guardedProb;
}

// Determine recommendation based on probability and edge
function getRecommendation(
  winProb: number,
  impliedOdds: number | null,
  edge: number | null
): { recommendation: string; reasoning: string } {
  // Strong lean: 60-70% with positive edge
  if (winProb >= 0.60 && edge !== null && edge >= 0.05) {
    return {
      recommendation: "strong_lean",
      reasoning: `High probability (${(winProb * 100).toFixed(1)}%) with ${(edge * 100).toFixed(1)}% edge vs market`
    };
  }
  
  // Lean: 55-60% or positive edge
  if (winProb >= 0.55 || (edge !== null && edge >= 0.03)) {
    return {
      recommendation: "lean",
      reasoning: `Moderate advantage (${(winProb * 100).toFixed(1)}%)${edge ? ` with ${(edge * 100).toFixed(1)}% edge` : ''}`
    };
  }
  
  // Slight lean: 52-55%
  if (winProb >= 0.52) {
    return {
      recommendation: "slight_lean",
      reasoning: `Slight edge detected (${(winProb * 100).toFixed(1)}%)`
    };
  }
  
  // No edge: 48-52%
  if (winProb >= 0.48) {
    return {
      recommendation: "no_edge",
      reasoning: `No significant edge - essentially a coin flip (${(winProb * 100).toFixed(1)}%)`
    };
  }
  
  // Avoid: <48%
  return {
    recommendation: "avoid",
    reasoning: `Unfavorable probability (${(winProb * 100).toFixed(1)}%)`
  };
}

// Calculate confidence score (0-100)
function calculateConfidence(
  dataQuality: number,
  sampleSize: number,
  hasInjuryData: boolean
): number {
  let confidence = 50; // Base confidence
  
  // Data quality factor (0-1 scale)
  confidence += dataQuality * 20;
  
  // Sample size factor (more games = more confidence)
  if (sampleSize >= 30) confidence += 15;
  else if (sampleSize >= 20) confidence += 10;
  else if (sampleSize >= 10) confidence += 5;
  
  // Injury data factor
  if (hasInjuryData) confidence += 10;
  
  return Math.min(100, Math.max(0, confidence));
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("SPORTSDATAIO_API_KEY")!;

    if (!apiKey) {
      throw new Error("SPORTSDATAIO_API_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("=== NBA Moneyline Engine Started ===");

    // Step 1: Fetch today's games
    const today = new Date().toISOString().split('T')[0];
    console.log(`Processing games for: ${today}`);

    const { data: gamesToday, error: gamesError } = await supabase
      .from('nba_games_today')
      .select('*')
      .eq('game_date', today);

    if (gamesError) {
      throw new Error(`Error fetching games: ${gamesError.message}`);
    }

    if (!gamesToday || gamesToday.length === 0) {
      console.log("No games scheduled for today");
      return new Response(
        JSON.stringify({ success: true, message: "No games today", predictions: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${gamesToday.length} games today`);

    // Step 2: Fetch team standings/stats
    const standings = await fetchSportsDataIO("/scores/json/Standings/2025", apiKey);
    console.log(`Fetched standings for ${standings?.length || 0} teams`);

    // Build team lookup map
    const teamStatsMap = new Map<string, any>();
    for (const team of standings || []) {
      teamStatsMap.set(team.Key, team);
    }

    // Step 3: Fetch team defense stats from our table
    const { data: teamDefenseStats } = await supabase
      .from('nba_team_stats')
      .select('*');

    const defenseMap = new Map<string, any>();
    for (const stat of teamDefenseStats || []) {
      defenseMap.set(stat.team_abbr, stat);
    }

    // Step 4: Generate predictions for each game
    const predictions: any[] = [];

    for (const game of gamesToday) {
      const homeTeamKey = game.home_team;
      const awayTeamKey = game.away_team;

      console.log(`Processing: ${awayTeamKey} @ ${homeTeamKey}`);

      const homeStandings = teamStatsMap.get(homeTeamKey);
      const awayStandings = teamStatsMap.get(awayTeamKey);

      if (!homeStandings || !awayStandings) {
        console.log(`Missing standings for ${homeTeamKey} or ${awayTeamKey}, skipping`);
        continue;
      }

      // Calculate team strengths
      const homeStrength = calculateTeamStrength(homeStandings);
      const awayStrength = calculateTeamStrength(awayStandings);

      // Get defense stats
      const homeDefense = defenseMap.get(homeTeamKey);
      const awayDefense = defenseMap.get(awayTeamKey);

      // Calculate pace
      const homePace = homeDefense?.pace_rating || 100;
      const awayPace = awayDefense?.pace_rating || 100;

      // Calculate win probabilities
      const homeWinProb = calculateWinProbability(
        homeStrength.netRating,
        awayStrength.netRating,
        true, // home team
        game.home_team_back_to_back || false,
        game.away_team_back_to_back || false,
        0, // TODO: Calculate injury impact
        0
      );

      const awayWinProb = 1 - homeWinProb;
      // Apply guardrail to away prob too
      const guardedAwayProb = Math.max(0.30, Math.min(0.70, awayWinProb));

      // Determine winner prediction
      const predictedWinner = homeWinProb >= 0.50 ? homeTeamKey : awayTeamKey;
      const winnerProb = homeWinProb >= 0.50 ? homeWinProb : guardedAwayProb;

      // Get recommendation
      const { recommendation, reasoning } = getRecommendation(winnerProb, null, null);

      // Calculate confidence
      const homeGames = (homeStandings.Wins || 0) + (homeStandings.Losses || 0);
      const awayGames = (awayStandings.Wins || 0) + (awayStandings.Losses || 0);
      const dataQuality = (homeDefense && awayDefense) ? 0.8 : 0.6;
      const confidence = calculateConfidence(
        dataQuality,
        Math.min(homeGames, awayGames),
        false // TODO: Add injury tracking
      );

      const prediction = {
        game_id: game.game_id,
        game_date: today,
        home_team: homeTeamKey,
        away_team: awayTeamKey,
        game_time: game.game_time,
        
        // Team ratings
        home_net_rating: homeStrength.netRating,
        away_net_rating: awayStrength.netRating,
        home_off_rating: homeStrength.offRating,
        away_off_rating: awayStrength.offRating,
        home_def_rating: homeStrength.defRating,
        away_def_rating: awayStrength.defRating,
        
        // Context
        home_pace: homePace,
        away_pace: awayPace,
        home_rest_days: getRestDays(game.home_team_back_to_back || false),
        away_rest_days: getRestDays(game.away_team_back_to_back || false),
        home_back_to_back: game.home_team_back_to_back || false,
        away_back_to_back: game.away_team_back_to_back || false,
        home_injury_impact: 0,
        away_injury_impact: 0,
        
        // Predictions (capped at 70%)
        home_win_probability: Math.min(0.70, homeWinProb),
        away_win_probability: Math.min(0.70, guardedAwayProb),
        predicted_winner: predictedWinner,
        confidence_score: confidence,
        
        // Market comparison (null for now - can add odds API later)
        home_implied_odds: null,
        away_implied_odds: null,
        edge_vs_market: null,
        
        // Recommendation
        recommendation,
        reasoning,
        calibration_factors: {
          home_net_rating: homeStrength.netRating,
          away_net_rating: awayStrength.netRating,
          home_games_played: homeGames,
          away_games_played: awayGames,
          home_back_to_back: game.home_team_back_to_back,
          away_back_to_back: game.away_team_back_to_back,
          data_quality: dataQuality
        },
        
        generated_at: new Date().toISOString()
      };

      predictions.push(prediction);
      console.log(`${awayTeamKey} @ ${homeTeamKey}: ${predictedWinner} (${(winnerProb * 100).toFixed(1)}%) - ${recommendation}`);
    }

    // Step 5: Upsert predictions to database
    if (predictions.length > 0) {
      const { error: upsertError } = await supabase
        .from('nba_moneyline_predictions')
        .upsert(predictions, { onConflict: 'game_id,game_date' });

      if (upsertError) {
        throw new Error(`Error upserting predictions: ${upsertError.message}`);
      }
    }

    console.log(`=== Moneyline Engine Complete: ${predictions.length} predictions ===`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions: predictions.length,
        games_processed: gamesToday.length,
        date: today
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Moneyline engine error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
