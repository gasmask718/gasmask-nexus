import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ManualBackfillEntry {
  id: string;
  date: string;
  sport: string;
  market: string;
  home_team: string | null;
  away_team: string | null;
  predicted_side: string | null;
  player_name: string | null;
  stat_type: string | null;
  prop_line: number | null;
  predicted_direction: string | null;
  confidence: number | null;
  result: string;
  actual_winner: string | null;
  actual_stat_value: number | null;
  home_score: number | null;
  away_score: number | null;
  source: string;
  status: string;
  locked: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateBackfillInput {
  date: string;
  sport?: string;
  market: 'Moneyline' | 'Player Prop';
  home_team?: string;
  away_team?: string;
  predicted_side?: string;
  player_name?: string;
  stat_type?: string;
  prop_line?: number;
  predicted_direction?: string;
  confidence?: number;
  result: 'W' | 'L' | 'Push';
  actual_winner?: string;
  actual_stat_value?: number;
  home_score?: number;
  away_score?: number;
  notes?: string;
}

export function useManualBackfill() {
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date()
  });

  const { data: entries = [], isLoading, error } = useQuery({
    queryKey: ['manual-backfill-entries', dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_backfill_entries')
        .select('*')
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', dateRange.to.toISOString().split('T')[0])
        .order('date', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ManualBackfillEntry[];
    }
  });

  const createEntry = useMutation({
    mutationFn: async (input: CreateBackfillInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('manual_backfill_entries')
        .insert({
          date: input.date,
          sport: input.sport || 'NBA',
          market: input.market,
          home_team: input.home_team,
          away_team: input.away_team,
          predicted_side: input.predicted_side,
          player_name: input.player_name,
          stat_type: input.stat_type,
          prop_line: input.prop_line,
          predicted_direction: input.predicted_direction,
          confidence: input.confidence,
          result: input.result,
          actual_winner: input.actual_winner,
          actual_stat_value: input.actual_stat_value,
          home_score: input.home_score,
          away_score: input.away_score,
          notes: input.notes,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manual-backfill-entries'] });
      toast.success('Backfill entry created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create entry: ${error.message}`);
    }
  });

  // Statistics
  const stats = {
    total: entries.length,
    wins: entries.filter(e => e.result === 'W').length,
    losses: entries.filter(e => e.result === 'L').length,
    pushes: entries.filter(e => e.result === 'Push').length,
    winRate: entries.length > 0 
      ? (entries.filter(e => e.result === 'W').length / entries.filter(e => e.result !== 'Push').length * 100) || 0
      : 0,
    moneylineEntries: entries.filter(e => e.market === 'Moneyline').length,
    propEntries: entries.filter(e => e.market === 'Player Prop').length
  };

  return {
    entries,
    isLoading,
    error,
    dateRange,
    setDateRange,
    createEntry,
    stats
  };
}
