import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CandidateType =
  | 'reorder'
  | 'owner_order'
  | 'collect_payment'
  | 'follow_up'
  | 'prospect'
  | 'bring_samples'
  | 'win_back'
  | 'at_risk';

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
  /** Present for candidates sourced from `store_opportunities.route_flag`. */
  due_date?: string | null;
  /** Present for candidates sourced from `store_opportunities.route_flag`. */
  opportunity_id?: string | null;
  /** e.g. 'route_flag' when this row came from a flagged opportunity. */
  signal_source?: string | null;
}

function priorityForDue(dueIso: string | null): number {
  if (!dueIso) return 3;
  const due = new Date(dueIso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 6;      // overdue
  if (diffDays === 0) return 5;    // today
  if (diffDays <= 3) return 4;     // this week
  return 3;                        // upcoming
}

export function useRouteCandidates() {
  return useQuery({
    queryKey: ['route-candidates'],
    queryFn: async () => {
      const [viewRes, flagRes] = await Promise.all([
        (supabase as any)
          .from('v_route_candidates')
          .select('*')
          .order('priority', { ascending: false })
          .limit(5000),
        (supabase as any)
          .from('store_opportunities')
          .select(`
            id,
            opportunity_text,
            due_date,
            created_at,
            store:store_master!store_id (
              id,
              store_name,
              address,
              city,
              neighborhood,
              boro,
              last_visit_date
            )
          `)
          .eq('route_flag', true)
          .eq('is_completed', false)
          .limit(2000),
      ]);

      if (viewRes.error) throw viewRes.error;
      if (flagRes.error) throw flagRes.error;

      const viewRows = (viewRes.data || []) as RouteCandidate[];

      const flagRows: RouteCandidate[] = (flagRes.data || [])
        .filter((r: any) => r.store)
        .map((r: any) => {
          const dueLabel = r.due_date
            ? ` (due ${new Date(r.due_date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })})`
            : '';
          const why = `Route follow-up: ${r.opportunity_text}${dueLabel}`;
          return {
            store_id: r.store.id,
            store_name: r.store.store_name,
            address: r.store.address ?? null,
            city: r.store.city ?? null,
            neighborhood: r.store.neighborhood ?? null,
            boro: r.store.boro ?? null,
            candidate_type: 'follow_up' as CandidateType,
            why,
            priority: priorityForDue(r.due_date),
            value: 0,
            last_visit_date: r.store.last_visit_date ?? null,
            signal_at: r.created_at ?? null,
            due_date: r.due_date ?? null,
            opportunity_id: r.id,
            signal_source: 'route_flag',
          };
        });

      return [...viewRows, ...flagRows];
    },
    refetchInterval: 60_000,
  });
}
