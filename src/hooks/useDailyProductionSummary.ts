/**
 * DAILY PRODUCTION SUMMARY HOOKS
 * Supervisor-controlled daily output entry with goal tracking.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export interface DailyProductionSummaryRecord {
  id: string;
  office_id: string;
  production_date: string;
  supervisor_user_id: string | null;
  workers_present: number;
  boxes_completed: number;
  tobacco_lbs_used: number;
  notes: string | null;
  created_at: string;
}

export function useTodayProductionSummary(officeId: string | undefined) {
  const today = format(new Date(), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['daily-production-summary', officeId, today],
    queryFn: async () => {
      if (!officeId) return null;
      const { data, error } = await supabase
        .from('daily_production_summary')
        .select('*')
        .eq('office_id', officeId)
        .eq('production_date', today)
        .maybeSingle();
      if (error) throw error;
      return data as DailyProductionSummaryRecord | null;
    },
    enabled: !!officeId,
  });
}

export function useRecentProductionSummaries(officeId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['daily-production-summaries', officeId, days],
    queryFn: async () => {
      if (!officeId) return [];
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      const { data, error } = await supabase
        .from('daily_production_summary')
        .select('*')
        .eq('office_id', officeId)
        .gte('production_date', format(cutoff, 'yyyy-MM-dd'))
        .order('production_date', { ascending: false });
      if (error) throw error;
      return (data || []) as DailyProductionSummaryRecord[];
    },
    enabled: !!officeId,
  });
}

export function useUpsertDailyProductionSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      officeId: string;
      workersPresent: number;
      boxesCompleted: number;
      tobaccoLbsUsed: number;
      notes?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const today = format(new Date(), 'yyyy-MM-dd');

      const { data, error } = await supabase
        .from('daily_production_summary')
        .upsert({
          office_id: params.officeId,
          production_date: today,
          supervisor_user_id: userData.user?.id || null,
          workers_present: params.workersPresent,
          boxes_completed: params.boxesCompleted,
          tobacco_lbs_used: params.tobaccoLbsUsed,
          notes: params.notes || null,
        }, {
          onConflict: 'office_id,production_date',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-production-summary'] });
      queryClient.invalidateQueries({ queryKey: ['daily-production-summaries'] });
      toast({ title: 'Daily summary saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    },
  });
}
