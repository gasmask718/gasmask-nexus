/**
 * useStoreTaskRoute — schedule a store on the CANONICAL route system
 * (`routes` + `route_stops`) with an explicit task reason, so the driver
 * sees WHY they are stopping.
 *
 * Reuses the exact same route resolution as StoreQuickActions "Add to Route
 * Plan": today's active route, created if it doesn't exist yet.
 *
 * Completion behavior: when the stop is marked `completed` (or `cancelled`)
 * it stops counting as "scheduled" — the profile flag clears itself.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const TASK_REASONS = {
  physical_inventory_check: 'Physical inventory check',
  update_contact_details: 'Update telephone / contact details',
} as const;

export type TaskReason = keyof typeof TASK_REASONS;

export const OPEN_STOP_STATUSES = ['pending', 'in_progress', 'en_route'];

export interface TaskRouteStop {
  id: string;
  route_id: string;
  stop_reason: TaskReason;
  status: string | null;
  planned_order: number | null;
  route: { id: string; date: string | null; status: string | null } | null;
}

export function useStoreTaskRouteStops(storeId: string | undefined) {
  return useQuery({
    queryKey: ['store-task-route-stops', storeId],
    queryFn: async (): Promise<TaskRouteStop[]> => {
      if (!storeId) return [];
      const { data, error } = await supabase
        .from('route_stops')
        .select('id, route_id, stop_reason, status, planned_order, route:routes(id, date, status)')
        .eq('store_id', storeId)
        .in('stop_reason', Object.keys(TASK_REASONS))
        .in('status', OPEN_STOP_STATUSES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as TaskRouteStop[];
    },
    enabled: !!storeId,
  });
}

async function resolveTodayRouteId(): Promise<string> {
  const today = new Date().toISOString().split('T')[0];

  const { data: existing, error: findErr } = await supabase
    .from('routes')
    .select('id')
    .eq('date', today)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data: created, error: createErr } = await supabase
    .from('routes')
    .insert({ date: today, type: 'delivery', status: 'active', source: 'manual' } as any)
    .select('id')
    .single();
  if (createErr) throw createErr;
  return created.id;
}

export function useAddStoreTaskStop(storeId: string | undefined, storeName?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reason: TaskReason) => {
      if (!storeId) throw new Error('Missing store id');

      // Never create a duplicate stop for the same store + reason.
      const { data: dupe, error: dupeErr } = await supabase
        .from('route_stops')
        .select('id')
        .eq('store_id', storeId)
        .eq('stop_reason', reason)
        .in('status', OPEN_STOP_STATUSES)
        .limit(1);
      if (dupeErr) throw dupeErr;
      if (dupe && dupe.length > 0) return { duplicate: true as const };

      const routeId = await resolveTodayRouteId();

      const { data: lastStop } = await supabase
        .from('route_stops')
        .select('planned_order')
        .eq('route_id', routeId)
        .order('planned_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const label = TASK_REASONS[reason];
      const { error } = await supabase.from('route_stops').insert({
        route_id: routeId,
        store_id: storeId,
        planned_order: (lastStop?.planned_order || 0) + 1,
        status: 'pending',
        stop_reason: reason,
        notes_to_worker: `TASK: ${label}${storeName ? ` — ${storeName}` : ''}`,
      } as any);
      if (error) throw error;
      return { duplicate: false as const };
    },
    onSuccess: (res, reason) => {
      if (res.duplicate) {
        toast.info(`Already scheduled: ${TASK_REASONS[reason].toLowerCase()}`);
      } else {
        toast.success(`Scheduled on today's route: ${TASK_REASONS[reason].toLowerCase()}`);
      }
      qc.invalidateQueries({ queryKey: ['store-task-route-stops', storeId] });
      qc.invalidateQueries({ queryKey: ['route-stops'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e: Error) => toast.error(`Failed to schedule stop: ${e.message}`),
  });
}

export function useRemoveStoreTaskStop(storeId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase.from('route_stops').delete().eq('id', stopId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Route stop removed');
      qc.invalidateQueries({ queryKey: ['store-task-route-stops', storeId] });
      qc.invalidateQueries({ queryKey: ['route-stops'] });
      qc.invalidateQueries({ queryKey: ['routes'] });
    },
    onError: (e: Error) => toast.error(`Failed to remove stop: ${e.message}`),
  });
}
