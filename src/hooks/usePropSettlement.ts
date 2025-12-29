import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCallback, useState } from 'react';

// EXPLICIT STAT MAPPING - CRITICAL: Only use these mappings for settlement
const STAT_TYPE_MAPPING: Record<string, keyof BoxScoreStats> = {
  'points': 'points',
  'pts': 'points',
  'Points': 'points',
  'PTS': 'points',
  'rebounds': 'rebounds',
  'reb': 'rebounds',
  'Rebounds': 'rebounds',
  'REB': 'rebounds',
  'assists': 'assists',
  'ast': 'assists',
  'Assists': 'assists',
  'AST': 'assists',
  'pra': 'pra',
  'PRA': 'pra',
  'pts+reb+ast': 'pra',
  'three_pointers_made': 'three_pointers_made',
  '3pm': 'three_pointers_made',
  '3PM': 'three_pointers_made',
  'steals': 'steals',
  'stl': 'steals',
  'STL': 'steals',
  'blocks': 'blocks',
  'blk': 'blocks',
  'BLK': 'blocks',
  'turnovers': 'turnovers',
  'tov': 'turnovers',
  'TOV': 'turnovers',
};

interface BoxScoreStats {
  points: number;
  rebounds: number;
  assists: number;
  pra: number;
  three_pointers_made: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: number;
  dnp: boolean;
}

interface BoxScore {
  id: string;
  game_id: string;
  game_date: string;
  player_id: string;
  player_name: string;
  team: string;
  opponent: string;
  points: number;
  rebounds: number;
  assists: number;
  three_pointers_made: number;
  steals: number;
  blocks: number;
  turnovers: number;
  minutes: number;
  pra: number;
  dnp: boolean;
}

interface PropEntry {
  id: string;
  player: string;
  market: string;
  line_value: number;
  side: string;
  date: string;
  team?: string;
  opponent?: string;
  stake: number;
  multiplier?: number;
  format_tag?: string;
  platform?: string;
}

interface SettlementResult {
  entryId: string;
  playerName: string;
  statType: string;
  lineValue: number;
  side: string;
  finalStatValue: number;
  comparisonResult: 'OVER' | 'UNDER' | 'PUSH';
  result: 'W' | 'L' | 'Push';
  dnp: boolean;
  boxScoreId?: string;
  minutesPlayed: number;
}

interface SettlementAuditLog {
  id: string;
  entry_id: string;
  player_name: string;
  stat_type: string;
  line_value: number;
  side: string;
  final_stat_value: number;
  comparison_result: string;
  result: string;
  dnp: boolean;
  minutes_played: number;
  game_date: string;
  settled_at: string;
  box_score_id?: string;
}

/**
 * Get the final stat value from box score using explicit mapping
 * NEVER use averages or projections
 */
function getFinalStatFromBoxScore(boxScore: BoxScore, statType: string): number | null {
  const normalizedStatType = statType.toLowerCase().trim();
  const mappedStat = STAT_TYPE_MAPPING[normalizedStatType] || STAT_TYPE_MAPPING[statType];
  
  if (!mappedStat) {
    console.error(`[PropSettlement] Unknown stat type: ${statType}`);
    return null;
  }

  // EXPLICIT STAT MAPPING - each stat type maps to exactly one box score field
  switch (mappedStat) {
    case 'points':
      return boxScore.points;
    case 'rebounds':
      return boxScore.rebounds;
    case 'assists':
      return boxScore.assists;
    case 'pra':
      // PRA is computed from box score stats: points + rebounds + assists
      return boxScore.points + boxScore.rebounds + boxScore.assists;
    case 'three_pointers_made':
      return boxScore.three_pointers_made;
    case 'steals':
      return boxScore.steals;
    case 'blocks':
      return boxScore.blocks;
    case 'turnovers':
      return boxScore.turnovers;
    default:
      return null;
  }
}

/**
 * Compare actual stat value against line with full float precision
 * NEVER cast to integer
 */
function compareStatToLine(
  actualValue: number,
  lineValue: number,
  side: string
): { comparison: 'OVER' | 'UNDER' | 'PUSH'; result: 'W' | 'L' | 'Push' } {
  // Use full float precision - never cast
  const diff = actualValue - lineValue;
  
  // Determine if actual is over, under, or exactly at line
  let comparison: 'OVER' | 'UNDER' | 'PUSH';
  if (Math.abs(diff) < 0.001) {
    // Essentially equal (handle floating point precision)
    comparison = 'PUSH';
  } else if (diff > 0) {
    comparison = 'OVER';
  } else {
    comparison = 'UNDER';
  }
  
  // Determine W/L based on side (MORE/LESS)
  const normalizedSide = side.toUpperCase();
  let result: 'W' | 'L' | 'Push';
  
  if (comparison === 'PUSH') {
    result = 'Push';
  } else if (normalizedSide === 'MORE' || normalizedSide === 'OVER') {
    result = comparison === 'OVER' ? 'W' : 'L';
  } else if (normalizedSide === 'LESS' || normalizedSide === 'UNDER') {
    result = comparison === 'UNDER' ? 'W' : 'L';
  } else {
    console.error(`[PropSettlement] Unknown side: ${side}`);
    result = 'L';
  }
  
  return { comparison, result };
}

export function usePropSettlement() {
  const queryClient = useQueryClient();
  const [lastSettlementRun, setLastSettlementRun] = useState<Date | null>(null);

  // Fetch box scores for settlement
  const { data: boxScores, refetch: refetchBoxScores } = useQuery({
    queryKey: ['nba-player-box-scores'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('nba_player_box_scores')
        .select('*')
        .order('game_date', { ascending: false })
        .limit(2000);
      
      if (error) throw error;
      return (data || []) as BoxScore[];
    },
  });

  // Fetch open prop entries
  const { data: openPropEntries, refetch: refetchOpenEntries } = useQuery({
    queryKey: ['open-prop-entries'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('pick_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'open')
        .or('format_tag.eq.fantasy_pickem,market.neq.Moneyline')
        .order('date', { ascending: false });

      if (error) throw error;
      return (data || []) as PropEntry[];
    },
  });

  // Fetch settlement audit logs
  const { data: auditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ['prop-settlement-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prop_settlement_audit_log')
        .select('*')
        .order('settled_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as SettlementAuditLog[];
    },
  });

  // Settlement mutation
  const settlementMutation = useMutation({
    mutationFn: async (): Promise<SettlementResult[]> => {
      const results: SettlementResult[] = [];
      
      // Refresh data
      await refetchBoxScores();
      await refetchOpenEntries();

      const freshBoxScores = queryClient.getQueryData<BoxScore[]>(['nba-player-box-scores']) || [];
      const freshOpenEntries = queryClient.getQueryData<PropEntry[]>(['open-prop-entries']) || [];

      console.log(`[PropSettlement] Box scores available: ${freshBoxScores.length}, Open entries: ${freshOpenEntries.length}`);

      if (!freshBoxScores.length || !freshOpenEntries.length) {
        return results;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create player name lookup map (case-insensitive)
      const boxScoreByPlayerDate = new Map<string, BoxScore>();
      for (const bs of freshBoxScores) {
        // Key: lowercase player name + date
        const key = `${bs.player_name.toLowerCase()}_${bs.game_date}`;
        boxScoreByPlayerDate.set(key, bs);
      }

      for (const entry of freshOpenEntries) {
        try {
          // Skip entries without required fields
          if (!entry.player || !entry.market || entry.line_value === null || !entry.side) {
            console.log(`[PropSettlement] Skipping entry ${entry.id}: missing required fields`);
            continue;
          }

          // Find matching box score by player name and date
          const lookupKey = `${entry.player.toLowerCase()}_${entry.date}`;
          const matchingBoxScore = boxScoreByPlayerDate.get(lookupKey);

          if (!matchingBoxScore) {
            console.log(`[PropSettlement] No box score found for ${entry.player} on ${entry.date}`);
            continue;
          }

          // Get the final stat value from box score
          const finalStatValue = getFinalStatFromBoxScore(matchingBoxScore, entry.market);
          if (finalStatValue === null) {
            console.log(`[PropSettlement] Could not map stat type ${entry.market} for ${entry.player}`);
            continue;
          }

          // Handle DNP - if minutes = 0 or DNP flag, result is L
          const isDNP = matchingBoxScore.dnp || matchingBoxScore.minutes === 0;
          let result: 'W' | 'L' | 'Push';
          let comparison: 'OVER' | 'UNDER' | 'PUSH';

          if (isDNP) {
            // DNP handling: mark as L, do NOT auto-win LESS
            result = 'L';
            comparison = 'UNDER'; // They got 0
            console.log(`[PropSettlement] ${entry.player} DNP - marking as L`);
          } else {
            // Compare using full float precision
            const compResult = compareStatToLine(finalStatValue, entry.line_value, entry.side);
            result = compResult.result;
            comparison = compResult.comparison;
          }

          // Calculate P/L
          let profitLoss: number;
          if (result === 'W') {
            profitLoss = entry.multiplier 
              ? (entry.stake * entry.multiplier) - entry.stake 
              : entry.stake;
          } else if (result === 'Push') {
            profitLoss = 0;
          } else {
            profitLoss = -entry.stake;
          }

          console.log(`[PropSettlement] Settling ${entry.player} ${entry.market}: line=${entry.line_value}, actual=${finalStatValue}, side=${entry.side}, comparison=${comparison}, result=${result}`);

          // Update the pick entry
          const { error: updateError } = await supabase
            .from('pick_entries')
            .update({
              status: 'settled',
              result: result,
              profit_loss: profitLoss,
              actual_result_value: finalStatValue,
              settled_at: new Date().toISOString(),
              locked_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          if (updateError) {
            console.error(`[PropSettlement] Failed to update entry ${entry.id}:`, updateError);
            continue;
          }

          // Create audit log entry
          const { error: auditError } = await supabase
            .from('prop_settlement_audit_log')
            .insert({
              entry_id: entry.id,
              user_id: user.id,
              player_name: entry.player,
              stat_type: entry.market,
              line_value: entry.line_value,
              side: entry.side,
              final_stat_value: finalStatValue,
              comparison_result: comparison,
              result: result,
              box_score_id: matchingBoxScore.id,
              game_id: matchingBoxScore.game_id,
              game_date: matchingBoxScore.game_date,
              dnp: isDNP,
              minutes_played: matchingBoxScore.minutes,
              settlement_source: 'box_score',
              raw_box_score_data: {
                points: matchingBoxScore.points,
                rebounds: matchingBoxScore.rebounds,
                assists: matchingBoxScore.assists,
                pra: matchingBoxScore.pra,
                three_pointers_made: matchingBoxScore.three_pointers_made,
                steals: matchingBoxScore.steals,
                blocks: matchingBoxScore.blocks,
                turnovers: matchingBoxScore.turnovers,
                minutes: matchingBoxScore.minutes,
              },
            });

          if (auditError) {
            console.error(`[PropSettlement] Failed to create audit log for ${entry.id}:`, auditError);
          }

          results.push({
            entryId: entry.id,
            playerName: entry.player,
            statType: entry.market,
            lineValue: entry.line_value,
            side: entry.side,
            finalStatValue,
            comparisonResult: comparison,
            result,
            dnp: isDNP,
            boxScoreId: matchingBoxScore.id,
            minutesPlayed: matchingBoxScore.minutes,
          });

        } catch (err) {
          console.error(`[PropSettlement] Error processing entry ${entry.id}:`, err);
        }
      }

      setLastSettlementRun(new Date());
      return results;
    },
    onSuccess: (results) => {
      const wins = results.filter(r => r.result === 'W').length;
      const losses = results.filter(r => r.result === 'L').length;
      const dnps = results.filter(r => r.dnp).length;
      
      queryClient.invalidateQueries({ queryKey: ['pick-entries'] });
      queryClient.invalidateQueries({ queryKey: ['open-prop-entries'] });
      queryClient.invalidateQueries({ queryKey: ['prop-settlement-audit-logs'] });
      
      if (results.length > 0) {
        toast.success(`Settled ${results.length} props: ${wins}W / ${losses}L${dnps > 0 ? ` (${dnps} DNP)` : ''}`);
      } else {
        toast.info('No props to settle');
      }
    },
    onError: (error) => {
      console.error('[PropSettlement] Failed:', error);
      toast.error('Failed to settle props');
    },
  });

  const runSettlement = useCallback(() => {
    if (!settlementMutation.isPending) {
      console.log('[PropSettlement] Starting settlement run...');
      settlementMutation.mutate();
    }
  }, [settlementMutation]);

  return {
    runSettlement,
    isSettling: settlementMutation.isPending,
    lastSettlementRun,
    boxScoresCount: boxScores?.length || 0,
    openEntriesCount: openPropEntries?.length || 0,
    auditLogs: auditLogs || [],
    refetchAuditLogs,
  };
}

// Hook to fetch box scores for a specific date (for Stat Inspector display)
export function usePlayerBoxScores(gameDate?: string) {
  return useQuery({
    queryKey: ['nba-player-box-scores', gameDate],
    queryFn: async () => {
      let query = supabase
        .from('nba_player_box_scores')
        .select('*')
        .order('points', { ascending: false });

      if (gameDate) {
        query = query.eq('game_date', gameDate);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []) as BoxScore[];
    },
  });
}
