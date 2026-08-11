import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { FUNDING_CLIENT_SAFE_COLUMNS } from '@/lib/funding/pii';

export interface FundingClientRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  business_type: string | null;
  ein: string | null;
  ssn_last4: string | null;
  time_in_business_months: number | null;
  monthly_revenue: number | null;
  credit_score_estimate: number | null;
  current_dfs_score: number | null;
  funding_target: number | null;
  funding_received: number | null;
  stage: string | null;
  status: string | null;
}

/**
 * Single client of record for the Funding Hub. Never selects the encrypted SSN
 * column — the browser only ever sees ssn_last4.
 */
export function useFundingClient(clientId?: string) {
  return useQuery({
    queryKey: ['funding-client', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_clients')
        .select(FUNDING_CLIENT_SAFE_COLUMNS)
        .eq('id', clientId!)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as FundingClientRow | null;
    },
  });
}

/** All Funding Hub clients — the only client list in Dynasty Capital. */
export function useFundingClients() {
  return useQuery({
    queryKey: ['funding-clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_clients')
        .select(FUNDING_CLIENT_SAFE_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as FundingClientRow[];
    },
  });
}
