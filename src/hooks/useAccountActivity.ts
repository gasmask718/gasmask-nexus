// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT ACTIVITY — ONE canonical operational activity feed.
//
// Reads public.v_store_activity, which UNIONs the systems that already exist
// (store_review_events, store_notes, v_store_comms_detail, store_visits,
// deliveries, route_stops, orders, store_samples_given, store_sample_checks,
// follow_up_queue, store_tube_inventory, invoices, field_submissions).
//
// Nothing here writes activity. There is no second activity table.
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type ActivityKind =
  | 'review'
  | 'review_audit'
  | 'note'
  | 'call'
  | 'text'
  | 'visit'
  | 'delivery'
  | 'route'
  | 'order'
  | 'samples'
  | 'followup'
  | 'inventory'
  | 'invoice'
  | 'field';

export interface ActivityRow {
  activity_id: string;
  store_id: string;
  kind: ActivityKind;
  subtype: string | null;
  occurred_at: string;
  actor_id: string | null;
  contact_id: string | null;
  title: string;
  detail: string | null;
  status: string | null;
  is_open: boolean;
  direction: string | null;
  is_current: boolean;
  storeName?: string | null;
  actorName?: string | null;
  contactName?: string | null;
}

/** Filter groups shown in the UI. `review_audit` is deliberately hidden by default. */
export const ACTIVITY_FILTERS: { value: string; label: string; kinds: ActivityKind[] }[] = [
  { value: 'all', label: 'All activity', kinds: [] },
  { value: 'delivery', label: 'Delivery', kinds: ['delivery'] },
  { value: 'route', label: 'Route', kinds: ['route'] },
  { value: 'order', label: 'Order', kinds: ['order'] },
  { value: 'samples', label: 'Samples', kinds: ['samples'] },
  { value: 'call', label: 'Calls', kinds: ['call'] },
  { value: 'text', label: 'Texts', kinds: ['text'] },
  { value: 'note', label: 'Notes', kinds: ['note'] },
  { value: 'review', label: 'Reviews', kinds: ['review'] },
  { value: 'followup', label: 'Follow-ups', kinds: ['followup'] },
  { value: 'inventory', label: 'Inventory', kinds: ['inventory'] },
  { value: 'invoice', label: 'Invoices / payments', kinds: ['invoice'] },
  { value: 'visit', label: 'Visits', kinds: ['visit'] },
  { value: 'field', label: 'Field updates', kinds: ['field'] },
];

export interface AccountActivityParams {
  storeId?: string;
  storeIds?: string[];
  kindFilter?: string; // one of ACTIVITY_FILTERS.value
  workerId?: string; // actor_id
  openState?: 'all' | 'open' | 'done';
  search?: string; // store or contact name
  page?: number; // 1-based
  pageSize?: number;
  includeReviewAudit?: boolean;
  enabled?: boolean;
}

export function useAccountActivity(params: AccountActivityParams) {
  const {
    storeId,
    storeIds,
    kindFilter = 'all',
    workerId,
    openState = 'all',
    search,
    page = 1,
    pageSize = 25,
    includeReviewAudit = false,
    enabled = true,
  } = params;

  return useQuery({
    queryKey: [
      'account-activity',
      storeId ?? null,
      storeIds?.join(',') ?? null,
      kindFilter,
      workerId ?? null,
      openState,
      search ?? '',
      page,
      pageSize,
      includeReviewAudit,
    ],
    enabled,
    staleTime: 15_000,
    queryFn: async () => {
      // Free-text search resolves to canonical store ids / contact ids first —
      // activity is NEVER matched on address text.
      let searchStoreIds: string[] | null = null;
      let searchContactIds: string[] | null = null;
      if (search && search.trim().length >= 2) {
        const term = `%${search.trim()}%`;
        const [{ data: stores }, { data: contacts }] = await Promise.all([
          (supabase as any)
            .from('store_master')
            .select('id')
            .ilike('store_name', term)
            .limit(300),
          (supabase as any).from('store_contacts').select('id, store_id').ilike('name', term).limit(300),
        ]);
        searchStoreIds = (stores || []).map((s: any) => s.id);
        searchContactIds = (contacts || []).map((c: any) => c.id);
        const contactStoreIds = (contacts || []).map((c: any) => c.store_id).filter(Boolean);
        searchStoreIds = Array.from(new Set([...(searchStoreIds || []), ...contactStoreIds]));
        if (searchStoreIds.length === 0 && searchContactIds.length === 0) {
          return { rows: [] as ActivityRow[], total: 0 };
        }
      }

      let q = (supabase as any)
        .from('v_store_activity')
        .select('*', { count: 'exact' })
        .order('occurred_at', { ascending: false });

      if (storeId) q = q.eq('store_id', storeId);
      if (storeIds?.length) q = q.in('store_id', storeIds);
      if (searchStoreIds?.length) q = q.in('store_id', searchStoreIds);

      const group = ACTIVITY_FILTERS.find((f) => f.value === kindFilter);
      if (group && group.kinds.length) {
        q = q.in('kind', group.kinds);
      } else if (!includeReviewAudit) {
        q = q.neq('kind', 'review_audit');
      }

      if (workerId) q = q.eq('actor_id', workerId);
      if (openState === 'open') q = q.eq('is_open', true);
      if (openState === 'done') q = q.eq('is_open', false);

      const from = (page - 1) * pageSize;
      q = q.range(from, from + pageSize - 1);

      const { data, error, count } = await q;
      if (error) throw error;

      const rows = (data || []) as ActivityRow[];

      // Resolve display names for the exact canonical ids (never address text).
      const sIds = Array.from(new Set(rows.map((r) => r.store_id).filter(Boolean)));
      const aIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      const cIds = Array.from(new Set(rows.map((r) => r.contact_id).filter(Boolean) as string[]));

      const [storesRes, actorsRes, contactsRes] = await Promise.all([
        sIds.length
          ? (supabase as any).from('store_master').select('id, store_name').in('id', sIds)
          : Promise.resolve({ data: [] }),
        aIds.length
          ? (supabase as any).from('profiles').select('id, name, email').in('id', aIds)
          : Promise.resolve({ data: [] }),
        cIds.length
          ? (supabase as any).from('store_contacts').select('id, name').in('id', cIds)
          : Promise.resolve({ data: [] }),
      ]);

      const storeMap = new Map((storesRes.data || []).map((s: any) => [s.id, s.store_name]));
      const actorMap = new Map(
        (actorsRes.data || []).map((p: any) => [p.id, p.name || p.email || 'Unknown user']),
      );
      const contactMap = new Map((contactsRes.data || []).map((c: any) => [c.id, c.name]));

      return {
        rows: rows.map((r) => ({
          ...r,
          storeName: (storeMap.get(r.store_id) as string) ?? null,
          actorName: r.actor_id ? ((actorMap.get(r.actor_id) as string) ?? 'Unknown user') : null,
          contactName: r.contact_id ? ((contactMap.get(r.contact_id) as string) ?? null) : null,
        })),
        total: count ?? 0,
      };
    },
  });
}

/** Worker/user options for the activity filter. */
export function useActivityWorkers() {
  return useQuery({
    queryKey: ['activity-worker-options'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('profiles')
        .select('id, name, email')
        .order('name', { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.id, name: p.name || p.email || 'Unknown user' }));
    },
  });
}
