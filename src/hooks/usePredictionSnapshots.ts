import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface PredictionSnapshot {
  id: string;
  snapshot_date: string;
  sport: string;
  game_id: string;
  home_team: string;
  away_team: string;
  predicted_winner: string;
  predicted_win_probability: number | null;
  confidence_score: number | null;
  model_version: string | null;
  is_backfilled: boolean;
  actual_winner: string | null;
  home_score: number | null;
  away_score: number | null;
  game_status: string | null;
  success: boolean | null;
  result_linked_at: string | null;
  created_at: string;
}

// Fetch canonical prediction from ai_game_predictions table
// This is the SINGLE SOURCE OF TRUTH for all AI predictions
async function getCanonicalPrediction(gameId: string) {
  const { data } = await supabase
    .from('ai_game_predictions')
    .select('ai_predicted_winner, ai_predicted_probability, ai_confidence_score, model_version')
    .eq('game_id', gameId)
    .maybeSingle();
  
  if (data) {
    return {
      predicted_winner: data.ai_predicted_winner,
      predicted_win_probability: data.ai_predicted_probability,
      confidence_score: data.ai_confidence_score,
      model_version: data.model_version,
    };
  }
  return null;
}

// Simple prediction logic - ONLY used when no canonical prediction exists
// This generates a prediction and stores it in ai_game_predictions first
async function generateAndStorePrediction(homeTeam: string, awayTeam: string, gameId: string, gameDate: string) {
  const teamStrengths: Record<string, number> = {
    "Boston Celtics": 0.72,
    "Oklahoma City Thunder": 0.70,
    "Cleveland Cavaliers": 0.68,
    "Denver Nuggets": 0.65,
    "Minnesota Timberwolves": 0.63,
    "Phoenix Suns": 0.62,
    "Dallas Mavericks": 0.61,
    "New York Knicks": 0.60,
    "Milwaukee Bucks": 0.59,
    "LA Clippers": 0.58,
    "Los Angeles Lakers": 0.57,
    "Sacramento Kings": 0.56,
    "Miami Heat": 0.55,
    "Indiana Pacers": 0.54,
    "Philadelphia 76ers": 0.53,
    "New Orleans Pelicans": 0.52,
    "Golden State Warriors": 0.51,
    "Orlando Magic": 0.50,
    "Houston Rockets": 0.49,
    "Atlanta Hawks": 0.48,
    "Chicago Bulls": 0.47,
    "Brooklyn Nets": 0.46,
    "Memphis Grizzlies": 0.45,
    "Toronto Raptors": 0.44,
    "Utah Jazz": 0.43,
    "San Antonio Spurs": 0.42,
    "Portland Trail Blazers": 0.41,
    "Charlotte Hornets": 0.40,
    "Detroit Pistons": 0.39,
    "Washington Wizards": 0.38,
  };

  const homeStrength = teamStrengths[homeTeam] || 0.50;
  const awayStrength = teamStrengths[awayTeam] || 0.50;
  
  const homeAdvantage = 0.03;
  const adjustedHomeStrength = homeStrength + homeAdvantage;
  
  const totalStrength = adjustedHomeStrength + awayStrength;
  const homeWinProb = adjustedHomeStrength / totalStrength;
  
  const predictedWinner = homeWinProb >= 0.5 ? homeTeam : awayTeam;
  const winProbability = homeWinProb >= 0.5 ? homeWinProb : (1 - homeWinProb);
  const confidence = Math.abs(homeWinProb - 0.5) * 2;

  // Store in canonical table first (will respect unique constraint)
  await supabase
    .from('ai_game_predictions')
    .insert({
      game_id: gameId,
      game_date: gameDate,
      sport: 'NBA',
      home_team: homeTeam,
      away_team: awayTeam,
      ai_predicted_winner: predictedWinner,
      ai_predicted_probability: Math.round(winProbability * 10000) / 10000,
      ai_confidence_score: Math.round(confidence * 10000) / 10000,
      model_version: 'v1',
      prediction_source: 'ai',
    });

  return {
    predicted_winner: predictedWinner,
    predicted_win_probability: Math.round(winProbability * 10000) / 10000,
    confidence_score: Math.round(confidence * 10000) / 10000,
    model_version: 'v1',
  };
}

export function usePredictionSnapshots(dateRange?: { start: string; end: string }) {
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");

  // Fetch snapshots for date range
  const { data: snapshots, isLoading, refetch } = useQuery({
    queryKey: ["prediction-snapshots", dateRange?.start || sevenDaysAgo, dateRange?.end || today],
    queryFn: async () => {
      const startDate = dateRange?.start || sevenDaysAgo;
      const endDate = dateRange?.end || today;
      
      const { data, error } = await supabase
        .from("daily_prediction_snapshots")
        .select("*")
        .gte("snapshot_date", startDate)
        .lte("snapshot_date", endDate)
        .order("snapshot_date", { ascending: false })
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as PredictionSnapshot[];
    },
  });

  // Generate snapshots for a specific date
  // Uses canonical ai_game_predictions as the source of truth
  const generateSnapshots = useMutation({
    mutationFn: async ({ date, games, isBackfill = false }: { 
      date: string; 
      games: Array<{ 
        game_id: string; 
        home_team: string; 
        away_team: string;
        home_score?: number;
        away_score?: number;
        status?: string;
      }>; 
      isBackfill?: boolean;
    }) => {
      const snapshots = await Promise.all(games.map(async game => {
        // Try to get canonical prediction first
        let prediction = await getCanonicalPrediction(game.game_id);
        
        // If no canonical prediction exists, generate and store one
        if (!prediction) {
          prediction = await generateAndStorePrediction(
            game.home_team, 
            game.away_team, 
            game.game_id, 
            date
          );
        }
        
        // Determine actual winner if game is final
        let actualWinner = null;
        let success = null;
        if (game.status === "Final" && game.home_score !== undefined && game.away_score !== undefined) {
          actualWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
          success = prediction.predicted_winner === actualWinner;
        }
        
        return {
          snapshot_date: date,
          sport: "NBA",
          game_id: game.game_id,
          home_team: game.home_team,
          away_team: game.away_team,
          predicted_winner: prediction.predicted_winner,
          predicted_win_probability: prediction.predicted_win_probability,
          confidence_score: prediction.confidence_score,
          model_version: prediction.model_version || "v1",
          is_backfilled: isBackfill,
          actual_winner: actualWinner,
          home_score: game.home_score || null,
          away_score: game.away_score || null,
          game_status: game.status || null,
          success,
          result_linked_at: actualWinner ? new Date().toISOString() : null,
        };
      }));

      const { data, error } = await supabase
        .from("daily_prediction_snapshots")
        .upsert(snapshots, { onConflict: "snapshot_date,game_id" })
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-snapshots"] });
    },
  });

  // Link results for finished games
  const linkResults = useMutation({
    mutationFn: async (games: Array<{
      game_id: string;
      home_team: string;
      away_team: string;
      home_score: number;
      away_score: number;
      game_date: string;
    }>) => {
      const updates = games.map(game => {
        const actualWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
        
        return supabase
          .from("daily_prediction_snapshots")
          .update({
            actual_winner: actualWinner,
            home_score: game.home_score,
            away_score: game.away_score,
            game_status: "Final",
            success: supabase.rpc ? undefined : undefined, // Will be computed in the query
            result_linked_at: new Date().toISOString(),
          })
          .eq("game_id", game.game_id)
          .eq("snapshot_date", game.game_date);
      });

      await Promise.all(updates);
      
      // Now update success field based on predicted_winner vs actual_winner
      for (const game of games) {
        const actualWinner = game.home_score > game.away_score ? game.home_team : game.away_team;
        
        const { data: snapshot } = await supabase
          .from("daily_prediction_snapshots")
          .select("predicted_winner")
          .eq("game_id", game.game_id)
          .eq("snapshot_date", game.game_date)
          .single();
        
        if (snapshot) {
          await supabase
            .from("daily_prediction_snapshots")
            .update({ success: snapshot.predicted_winner === actualWinner })
            .eq("game_id", game.game_id)
            .eq("snapshot_date", game.game_date);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prediction-snapshots"] });
    },
  });

  // Calculate accuracy stats
  const stats = snapshots ? {
    total: snapshots.length,
    withResults: snapshots.filter(s => s.success !== null).length,
    correct: snapshots.filter(s => s.success === true).length,
    incorrect: snapshots.filter(s => s.success === false).length,
    accuracy: snapshots.filter(s => s.success !== null).length > 0
      ? (snapshots.filter(s => s.success === true).length / snapshots.filter(s => s.success !== null).length) * 100
      : 0,
  } : null;

  return {
    snapshots,
    isLoading,
    refetch,
    generateSnapshots,
    linkResults,
    stats,
  };
}

// Hook to auto-generate snapshots for today's games
export function useAutoGenerateSnapshots() {
  const { generateSnapshots, linkResults } = usePredictionSnapshots();

  const autoGenerate = async (games: Array<{
    GameID: string;
    HomeTeam: string;
    AwayTeam: string;
    HomeTeamScore?: number;
    AwayTeamScore?: number;
    Status: string;
    Day: string;
  }>) => {
    if (!games || games.length === 0) return;

    // Group games by date
    const gamesByDate = games.reduce((acc, game) => {
      const date = game.Day.split("T")[0];
      if (!acc[date]) acc[date] = [];
      acc[date].push({
        game_id: game.GameID,
        home_team: game.HomeTeam,
        away_team: game.AwayTeam,
        home_score: game.HomeTeamScore,
        away_score: game.AwayTeamScore,
        status: game.Status,
      });
      return acc;
    }, {} as Record<string, Array<any>>);

    // Generate snapshots for each date
    for (const [date, dateGames] of Object.entries(gamesByDate)) {
      await generateSnapshots.mutateAsync({
        date,
        games: dateGames,
        isBackfill: new Date(date) < new Date(format(new Date(), "yyyy-MM-dd")),
      });
    }
  };

  return { autoGenerate, isGenerating: generateSnapshots.isPending };
}
