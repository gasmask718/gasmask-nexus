import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GameWithScore {
  id: string;
  game_id: string;
  home_team: string;
  away_team: string;
  game_date: string;
  status: string;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
}

interface OpenMoneylineEntry {
  id: string;
  user_id: string;
  date: string;
  team: string | null;
  opponent: string | null;
  side: string | null;
  status: string;
}

interface SettlementResult {
  settled: number;
  wins: number;
  losses: number;
  scoresUpdated: number;
  errors: string[];
}

const SETTLEMENT_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Hook to automatically settle NBA Moneyline entries
 * Runs on page load and every 15 minutes
 */
export const useMoneylineSettlement = () => {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [lastSettlementRun, setLastSettlementRun] = useState<Date | null>(null);

  // Fetch ALL final games (date-agnostic - settlement looks at any completed game)
  const { data: finalGames, refetch: refetchFinalGames } = useQuery({
    queryKey: ['nba-final-games-all'],
    queryFn: async (): Promise<GameWithScore[]> => {
      // Fetch all final games from the last 7 days to cover any unsettled entries
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('nba_games_today')
        .select('id, game_id, home_team, away_team, game_date, status, home_score, away_score, winner')
        .eq('status', 'Final')
        .gte('game_date', sevenDaysAgoStr);

      if (error) {
        console.error('Error fetching final games:', error);
        return [];
      }

      return (data || []) as GameWithScore[];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  // Fetch ALL open moneyline entries (date-agnostic - status-based filtering only)
  const { data: openEntries, refetch: refetchOpenEntries } = useQuery({
    queryKey: ['open-moneyline-entries-all'],
    queryFn: async (): Promise<OpenMoneylineEntry[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch ALL open entries regardless of date
      const { data, error } = await supabase
        .from('pick_entries')
        .select('id, user_id, date, team, opponent, side, status')
        .eq('user_id', user.id)
        .eq('market', 'Moneyline')
        .eq('sport', 'NBA')
        .eq('status', 'open')
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching open entries:', error);
        return [];
      }

      return (data || []) as OpenMoneylineEntry[];
    },
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // Settlement mutation
  const settlementMutation = useMutation({
    mutationFn: async (): Promise<SettlementResult> => {
      const result: SettlementResult = { settled: 0, wins: 0, losses: 0, scoresUpdated: 0, errors: [] };

      // Step 1: Call edge function to update scores from SportsDataIO
      try {
        console.log('[Settlement] Fetching latest scores from SportsDataIO...');
        const { data: scoresData, error: scoresError } = await supabase.functions.invoke('nba-stats-engine', {
          body: { action: 'update_scores' }
        });

        if (scoresError) {
          console.error('[Settlement] Error updating scores:', scoresError);
          result.errors.push(`Failed to fetch scores: ${scoresError.message}`);
        } else {
          result.scoresUpdated = scoresData?.games_updated || 0;
          console.log(`[Settlement] Updated ${result.scoresUpdated} game scores`);
        }
      } catch (err) {
        console.error('[Settlement] Exception updating scores:', err);
        result.errors.push(`Score update exception: ${err}`);
      }

      // Step 2: Refetch final games after score update
      await refetchFinalGames();
      await refetchOpenEntries();

      // Get fresh data
      const freshFinalGames = queryClient.getQueryData<GameWithScore[]>(['nba-final-games-all']) || [];
      const freshOpenEntries = queryClient.getQueryData<OpenMoneylineEntry[]>(['open-moneyline-entries-all']) || [];

      console.log(`[Settlement] Final games available: ${freshFinalGames.length}, Open entries: ${freshOpenEntries.length}`);

      if (!freshFinalGames.length || !freshOpenEntries.length) {
        return result;
      }

      // Step 3: Match and settle entries
      for (const entry of freshOpenEntries) {
        try {
          // Find matching game by team/opponent
          const matchedGame = freshFinalGames.find(game => {
            const entryTeam = entry.team?.toUpperCase();
            const entryOpponent = entry.opponent?.toUpperCase();
            const gameHome = game.home_team?.toUpperCase();
            const gameAway = game.away_team?.toUpperCase();
            
            // Match by team and opponent
            const matchByTeamOpponent = 
              (entryTeam === gameHome && entryOpponent === gameAway) ||
              (entryTeam === gameAway && entryOpponent === gameHome);
            
            // Match by date
            const matchByDate = entry.date === game.game_date;
            
            return matchByTeamOpponent && matchByDate && game.winner;
          });

          if (!matchedGame || !matchedGame.winner) {
            console.log(`[Settlement] No matching final game for entry ${entry.id} (${entry.team} vs ${entry.opponent} on ${entry.date})`);
            continue;
          }

          // Determine result: check if selected team won
          const selectedTeam = entry.team?.toUpperCase();
          const winningTeam = matchedGame.winner?.toUpperCase();
          const isWin = selectedTeam === winningTeam;
          const entryResult = isWin ? 'W' : 'L';

          console.log(`[Settlement] Settling entry ${entry.id}: ${entry.team} vs ${matchedGame.winner} = ${entryResult}`);

          // Update the entry
          const { error: updateError } = await supabase
            .from('pick_entries')
            .update({
              status: 'settled',
              result: entryResult,
              settled_at: new Date().toISOString(),
              locked_at: new Date().toISOString(),
              actual_result_value: isWin ? 1 : 0,
            })
            .eq('id', entry.id)
            .eq('status', 'open'); // Ensure we don't settle twice

          if (updateError) {
            result.errors.push(`Failed to settle entry ${entry.id}: ${updateError.message}`);
            console.error(`[Settlement] Update error for ${entry.id}:`, updateError);
            continue;
          }

          result.settled++;
          if (isWin) {
            result.wins++;
          } else {
            result.losses++;
          }
        } catch (err) {
          result.errors.push(`Error processing entry ${entry.id}: ${err}`);
          console.error(`[Settlement] Exception for ${entry.id}:`, err);
        }
      }

      setLastSettlementRun(new Date());
      return result;
    },
    onSuccess: (result) => {
      if (result.settled > 0) {
        toast.success(
          `Settled ${result.settled} entries: ${result.wins}W / ${result.losses}L`,
          { duration: 5000 }
        );
      } else if (result.scoresUpdated > 0) {
        toast.info(`Updated ${result.scoresUpdated} game scores (no entries to settle)`, { duration: 3000 });
      }
      
      // Invalidate queries to refresh UI
      queryClient.invalidateQueries({ queryKey: ['open-moneyline-entries-all'] });
      queryClient.invalidateQueries({ queryKey: ['moneyline-entries'] });
      queryClient.invalidateQueries({ queryKey: ['nba-final-games-all'] });
      queryClient.invalidateQueries({ queryKey: ['betting-analytics'] });
      
      if (result.errors.length > 0) {
        console.error('[Settlement] Errors:', result.errors);
      }
    },
    onError: (error) => {
      console.error('[Settlement] Failed:', error);
      toast.error('Failed to run settlement');
    },
  });

  // Run settlement function
  const runSettlement = useCallback(() => {
    if (!settlementMutation.isPending) {
      console.log('[Settlement] Starting settlement run...');
      settlementMutation.mutate();
    }
  }, [settlementMutation]);

  // Run on mount and set up interval
  useEffect(() => {
    // Run immediately on mount after a short delay to let data load
    const timer = setTimeout(() => {
      runSettlement();
    }, 5000); // Delay 5s after mount

    // Set up 15-minute interval
    intervalRef.current = setInterval(() => {
      console.log('[Settlement] Running scheduled settlement...');
      runSettlement();
    }, SETTLEMENT_INTERVAL_MS);

    return () => {
      clearTimeout(timer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [runSettlement]);

  return {
    runSettlement,
    isSettling: settlementMutation.isPending,
    lastSettlementRun,
    finalGamesCount: finalGames?.length || 0,
    openEntriesCount: openEntries?.length || 0,
    openEntries: openEntries || [],
    finalGames: finalGames || [],
  };
};
