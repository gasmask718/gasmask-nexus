import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ConfirmedWinner {
  id: string;
  game_id: string;
  game_date: string;
  sport: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  confirmed_winner: string;
  confirmation_source: string;
  confirmed_by: string | null;
  confirmed_at: string;
  previous_winner: string | null;
  override_count: number;
  notes: string | null;
}

export interface ConfirmWinnerInput {
  game_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score?: number | null;
  away_score?: number | null;
  confirmed_winner: string;
  notes?: string;
}

export function useConfirmedWinners(dateRange?: { start: string; end: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch confirmed winners for a date range
  const { data: confirmedWinners, isLoading, refetch } = useQuery({
    queryKey: ['confirmed-winners', dateRange?.start, dateRange?.end],
    queryFn: async () => {
      let query = supabase
        .from('confirmed_game_winners')
        .select('*')
        .eq('sport', 'NBA')
        .order('game_date', { ascending: false });

      if (dateRange?.start) {
        query = query.gte('game_date', dateRange.start);
      }
      if (dateRange?.end) {
        query = query.lte('game_date', dateRange.end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ConfirmedWinner[];
    },
  });

  // Fetch confirmed winner for a specific game
  const getConfirmedWinnerByGameId = (gameId: string) => {
    return confirmedWinners?.find(cw => cw.game_id === gameId);
  };

  // Confirm winner mutation
  const confirmWinner = useMutation({
    mutationFn: async (input: ConfirmWinnerInput) => {
      if (!user?.id) {
        throw new Error('Must be authenticated to confirm winners');
      }

      // Check if already confirmed
      const { data: existing, error: checkError } = await supabase
        .from('confirmed_game_winners')
        .select('id, confirmed_winner, override_count')
        .eq('game_id', input.game_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      if (existing) {
        // Update existing (override)
        const { error: updateError } = await supabase
          .from('confirmed_game_winners')
          .update({
            confirmed_winner: input.confirmed_winner,
            home_score: input.home_score,
            away_score: input.away_score,
            confirmed_by: user.id,
            confirmed_at: new Date().toISOString(),
            previous_winner: existing.confirmed_winner,
            override_count: existing.override_count + 1,
            notes: input.notes,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        return { action: 'updated', game_id: input.game_id };
      }

      // Insert new confirmation
      const { error: insertError } = await supabase
        .from('confirmed_game_winners')
        .insert({
          game_id: input.game_id,
          game_date: input.game_date,
          sport: 'NBA',
          home_team: input.home_team,
          away_team: input.away_team,
          home_score: input.home_score,
          away_score: input.away_score,
          confirmed_winner: input.confirmed_winner,
          confirmation_source: 'manual_admin',
          confirmed_by: user.id,
          notes: input.notes,
        });

      if (insertError) throw insertError;
      return { action: 'created', game_id: input.game_id };
    },
    onSuccess: (data) => {
      toast.success(`Winner ${data.action === 'updated' ? 'updated' : 'confirmed'} successfully`);
      queryClient.invalidateQueries({ queryKey: ['confirmed-winners'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm winner: ${error.message}`);
    },
  });

  return {
    confirmedWinners,
    isLoading,
    refetch,
    getConfirmedWinnerByGameId,
    confirmWinner,
    isConfirming: confirmWinner.isPending,
  };
}
