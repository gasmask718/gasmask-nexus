import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LenderMatchRow {
  id: string;
  client_id: string;
  lender_id: string;
  match_score: number | null;
  match_reasons: string[] | null;
  status: string | null;
  matched_at: string | null;
  lender: {
    lender_name: string | null;
    product_name: string | null;
    category: string | null;
    max_amount: number | null;
    submission_method: string | null;
    automation_allowed: boolean | null;
    application_url: string | null;
    is_qa_fixture: boolean | null;
  } | null;
}

/** Persisted lender matches for a client. Empty is a real answer, not an error. */
export function useLenderMatches(clientId?: string) {
  return useQuery({
    queryKey: ['lender-matches', clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funding_client_lender_matches')
        .select(
          `id, client_id, lender_id, match_score, match_reasons, status, matched_at,
           lender:funding_lender_database (
             lender_name, product_name, category, max_amount,
             submission_method, automation_allowed, application_url, is_qa_fixture
           )`,
        )
        .eq('client_id', clientId!)
        .order('match_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LenderMatchRow[];
    },
  });
}

/** Re-runs the deterministic matching engine for a client. */
export function useRunLenderMatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data, error } = await supabase.functions.invoke('lender-matching-engine', {
        body: { client_id: clientId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as {
        lender_universe: number;
        matched_count: number;
        counts: Record<string, number>;
        missing_prerequisites: string[];
        note?: string;
      };
    },
    onSuccess: (_d, clientId) => {
      qc.invalidateQueries({ queryKey: ['lender-matches', clientId] });
      qc.invalidateQueries({ queryKey: ['capital-plan', clientId] });
    },
  });
}
