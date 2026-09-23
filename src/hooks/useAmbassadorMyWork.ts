/**
 * useAmbassadorMyWork — the signed-in ambassador's OWN store activity.
 *
 * Canonical sources (no new tracking tables):
 *  - HANDLED BY ME : store_review_events (review_type = 'handled', reviewed_by = auth user)
 *  - STORES I ADDED: stores.captured_by_user_id (field capture) UNION
 *                    store_master.sourced_by_ambassador_id (canonical sourcing attribution)
 *
 * Assigned ≠ handled. Territory-visible ≠ worked on. Nothing here reads localStorage.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveAmbassadorId } from '@/hooks/useAmbassadorComms';

export interface MyWorkStore {
  store_id: string;
  name: string;
  location: string | null;
  status: string | null;
  /** handled_at (ISO) for handled rows, captured/sourced date for added rows */
  at: string | null;
  /** approval/review state — only meaningful for added stores */
  approval_status?: string | null;
  source?: 'capture' | 'sourced';
}

async function resolveStoreLabels(ids: string[]) {
  const map = new Map<string, { name: string; location: string | null; status: string | null }>();
  if (ids.length === 0) return map;

  const [{ data: masters }, { data: legacy }] = await Promise.all([
    supabase
      .from('store_master')
      .select('id, store_name, address, city, state, status')
      .in('id', ids),
    supabase
      .from('stores')
      .select('id, name, address_street, address_city, address_state, status')
      .in('id', ids),
  ]);

  (legacy ?? []).forEach((s: any) => {
    map.set(s.id, {
      name: s.name || 'Store',
      location: [s.address_street, s.address_city, s.address_state].filter(Boolean).join(', ') || null,
      status: s.status ?? null,
    });
  });
  // store_master is canonical — it wins when both exist
  (masters ?? []).forEach((s: any) => {
    map.set(s.id, {
      name: s.store_name || 'Store',
      location: [s.address, s.city, s.state].filter(Boolean).join(', ') || null,
      status: s.status ?? null,
    });
  });

  return map;
}

/** Stores this ambassador personally marked handled (most recent handling per store). */
export function useMyHandledStores() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ambassador-my-handled', user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyWorkStore[]> => {
      const { data, error } = await (supabase as any)
        .from('store_review_events')
        .select('store_id, handled_on, reviewed_at')
        .eq('review_type', 'handled')
        .eq('reviewed_by', user!.id)
        .order('reviewed_at', { ascending: false });
      if (error) throw error;

      const rows = (data ?? []) as Array<{ store_id: string; handled_on: string | null; reviewed_at: string }>;
      const latest = new Map<string, { store_id: string; at: string }>();
      rows.forEach((r) => {
        if (!r.store_id || latest.has(r.store_id)) return;
        latest.set(r.store_id, { store_id: r.store_id, at: r.reviewed_at });
      });

      const ids = [...latest.keys()];
      const labels = await resolveStoreLabels(ids);

      return [...latest.values()].map((r) => ({
        store_id: r.store_id,
        name: labels.get(r.store_id)?.name ?? 'Store',
        location: labels.get(r.store_id)?.location ?? null,
        status: labels.get(r.store_id)?.status ?? null,
        at: r.at,
      }));
    },
  });
}

/** Stores this ambassador added in the field (capture form + canonical sourcing). */
export function useMyAddedStores() {
  const { user } = useAuth();
  const ambassadorId = useEffectiveAmbassadorId();

  return useQuery({
    queryKey: ['ambassador-my-added', user?.id, ambassadorId],
    enabled: !!user?.id,
    queryFn: async (): Promise<MyWorkStore[]> => {
      const [captured, sourced] = await Promise.all([
        supabase
          .from('stores')
          .select('id, name, address_street, address_city, address_state, status, approval_status, captured_at')
          .eq('captured_by_user_id', user!.id)
          .order('captured_at', { ascending: false }),
        ambassadorId
          ? supabase
              .from('store_master')
              .select('id, store_name, address, city, state, status, sourced_at')
              .eq('sourced_by_ambassador_id', ambassadorId)
              .is('deleted_at', null)
              .order('sourced_at', { ascending: false, nullsFirst: false })
          : Promise.resolve({ data: [], error: null } as any),
      ]);

      if (captured.error) throw captured.error;
      if ((sourced as any).error) throw (sourced as any).error;

      const byId = new Map<string, MyWorkStore>();

      ((captured.data ?? []) as any[]).forEach((s) => {
        byId.set(s.id, {
          store_id: s.id,
          name: s.name || 'Store',
          location: [s.address_street, s.address_city, s.address_state].filter(Boolean).join(', ') || null,
          status: s.status ?? null,
          approval_status: s.approval_status ?? null,
          at: s.captured_at ?? null,
          source: 'capture',
        });
      });

      (((sourced as any).data ?? []) as any[]).forEach((s) => {
        const existing = byId.get(s.id);
        byId.set(s.id, {
          store_id: s.id,
          name: s.store_name || existing?.name || 'Store',
          location: [s.address, s.city, s.state].filter(Boolean).join(', ') || existing?.location || null,
          status: s.status ?? existing?.status ?? null,
          approval_status: existing?.approval_status ?? null,
          at: s.sourced_at ?? existing?.at ?? null,
          source: existing?.source ?? 'sourced',
        });
      });

      return [...byId.values()].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
    },
  });
}
