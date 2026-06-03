import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CandidateType = 'reorder' | 'owner_order' | 'collect_payment' | 'follow_up' | 'prospect';

export interface RouteCandidate {
  store_id: string;
  store_name: string;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  boro: string | null;
  candidate_type: CandidateType;
  why: string;
  priority: number;
  value: number;
  last_visit_date: string | null;
  signal_at: string | null;
}

export function useRouteCandidates() {
  return useQuery({
    queryKey: ['route-candidates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('v_route_candidates')
        .select('*')
        .order('priority', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as RouteCandidate[];
    },
    refetchInterval: 60_000,
  });
}
