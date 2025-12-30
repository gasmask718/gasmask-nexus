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
  confirmation_revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
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

export interface UndoConfirmationInput {
  game_id: string;
  reason?: string;
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

  // Get confirmed winner for a specific game (excluding revoked)
  const getConfirmedWinnerByGameId = (gameId: string) => {
    const winner = confirmedWinners?.find(cw => cw.game_id === gameId);
    if (winner && winner.confirmation_revoked) return undefined;
    return winner;
  };

  // Get full record including revoked status
  const getConfirmationRecord = (gameId: string) => {
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
        .select('id, confirmed_winner, override_count, confirmation_revoked')
        .eq('game_id', input.game_id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw checkError;
      }

      const isReconfirm = existing?.confirmation_revoked === true;

      if (existing) {
        // Update existing (override or reconfirm after undo)
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
            confirmation_revoked: false,
            revoked_at: null,
            revoked_by: null,
            revoke_reason: null,
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        // Log audit
        await supabase.from('confirmation_audit_log').insert({
          game_id: input.game_id,
          action: isReconfirm ? 'reconfirm' : 'confirm',
          previous_winner: existing.confirmed_winner,
          new_winner: input.confirmed_winner,
          admin_user_id: user.id,
        });

        return { action: isReconfirm ? 'reconfirmed' : 'updated', game_id: input.game_id };
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

      // Log audit
      await supabase.from('confirmation_audit_log').insert({
        game_id: input.game_id,
        action: 'confirm',
        previous_winner: null,
        new_winner: input.confirmed_winner,
        admin_user_id: user.id,
      });

      return { action: 'created', game_id: input.game_id };
    },
    onSuccess: (data) => {
      toast.success(`Winner ${data.action} successfully`);
      queryClient.invalidateQueries({ queryKey: ['confirmed-winners'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to confirm winner: ${error.message}`);
    },
  });

  // Undo confirmation mutation
  const undoConfirmation = useMutation({
    mutationFn: async (input: UndoConfirmationInput) => {
      if (!user?.id) {
        throw new Error('Must be authenticated to undo confirmations');
      }

      // Get the existing confirmation
      const { data: existing, error: checkError } = await supabase
        .from('confirmed_game_winners')
        .select('id, confirmed_winner, confirmation_source')
        .eq('game_id', input.game_id)
        .single();

      if (checkError) throw checkError;
      if (!existing) throw new Error('No confirmation found to undo');

      // Only allow undo for manual confirmations
      if (existing.confirmation_source !== 'manual_admin') {
        throw new Error('Can only undo manual confirmations');
      }

      // Mark as revoked (don't delete)
      const { error: updateError } = await supabase
        .from('confirmed_game_winners')
        .update({
          confirmation_revoked: true,
          revoked_at: new Date().toISOString(),
          revoked_by: user.id,
          revoke_reason: input.reason || 'Admin undo',
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;

      // Invalidate any prediction evaluations for this game
      await supabase
        .from('prediction_evaluations')
        .update({
          is_valid: false,
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'Confirmation revoked',
        })
        .eq('game_id', input.game_id);

      // Log audit
      await supabase.from('confirmation_audit_log').insert({
        game_id: input.game_id,
        action: 'undo',
        previous_winner: existing.confirmed_winner,
        new_winner: null,
        admin_user_id: user.id,
        reason: input.reason,
      });

      return { game_id: input.game_id };
    },
    onSuccess: () => {
      toast.success('Confirmation undone successfully');
      queryClient.invalidateQueries({ queryKey: ['confirmed-winners'] });
      queryClient.invalidateQueries({ queryKey: ['prediction-evaluations'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to undo: ${error.message}`);
    },
  });

  return {
    confirmedWinners,
    isLoading,
    refetch,
    getConfirmedWinnerByGameId,
    getConfirmationRecord,
    confirmWinner,
    undoConfirmation,
    isConfirming: confirmWinner.isPending,
    isUndoing: undoConfirmation.isPending,
  };
}
