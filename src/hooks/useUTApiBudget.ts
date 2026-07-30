import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UTApiBudgetStatus {
  provider: string;
  monthly_limit: number;
  credits_loaded: number;
  cost_verified: boolean;
  spend_total: number;
  spend_month: number;
  spend_today: number;
  balance: number;
  balance_pct: number;
  month_remaining: number;
  manual_pause: boolean;
  auto_paused: boolean;
  is_paused: boolean;
  status: string;
  calls_total: number;
}

export const UT_API_BUDGET_KEY = ['ut-api-budget-status'];

export function useUTApiBudget(provider = 'google_places') {
  return useQuery({
    queryKey: [...UT_API_BUDGET_KEY, provider],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('ut_api_budget_status')
        .select('*')
        .eq('provider', provider)
        .maybeSingle();
      if (error) throw error;
      return data as UTApiBudgetStatus | null;
    },
    refetchInterval: 30000,
  });
}

export function useUTApiBudgetControls(provider = 'google_places') {
  const qc = useQueryClient();

  const invalidate = () => qc.invalidateQueries({ queryKey: UT_API_BUDGET_KEY });

  const setManualPause = useMutation({
    mutationFn: async (paused: boolean) => {
      const { error } = await (supabase as any)
        .from('ut_api_budget')
        .update({ manual_pause: paused, updated_at: new Date().toISOString() })
        .eq('provider', provider);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const clearAutoPause = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from('ut_api_budget')
        .update({ auto_paused: false, auto_paused_at: null, updated_at: new Date().toISOString() })
        .eq('provider', provider);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { setManualPause, clearAutoPause };
}
