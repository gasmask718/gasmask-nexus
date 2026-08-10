import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CapitalPlanRow {
  client_id: string;
  source: 'funding' | 'grant';
  reference_id: string;
  counterparty: string;
  status: string;
  amount_requested: number;
  amount_approved: number;
  amount_funded: number;
  created_at: string;
}

export interface CapitalPlanTotals {
  requested: number;
  approved: number;
  funded: number;
  pending: number;
}

const PENDING_STATUSES = ['draft', 'pending', 'submitted', 'in_review', 'under_review', 'in_progress'];

/**
 * Unified Capital Plan for one funding client: funding applications + grant
 * applications aggregated by the database, never recomputed in components.
 * Grant rows only appear once the grant application is linked to the client.
 */
export function useCapitalPlan(clientId?: string) {
  return useQuery({
    queryKey: ['capital-plan', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_capital_plan', {
        _client_id: clientId!,
      });
      if (error) throw error;

      const rows = (data ?? []) as unknown as CapitalPlanRow[];
      const num = (v: unknown) => Number(v ?? 0);

      const totals = rows.reduce<CapitalPlanTotals>(
        (acc, r) => {
          acc.requested += num(r.amount_requested);
          acc.approved += num(r.amount_approved);
          acc.funded += num(r.amount_funded);
          if (PENDING_STATUSES.includes((r.status ?? '').toLowerCase())) {
            acc.pending += num(r.amount_requested);
          }
          return acc;
        },
        { requested: 0, approved: 0, funded: 0, pending: 0 },
      );

      return {
        rows,
        totals,
        funding: rows.filter((r) => r.source === 'funding'),
        grants: rows.filter((r) => r.source === 'grant'),
      };
    },
  });
}
