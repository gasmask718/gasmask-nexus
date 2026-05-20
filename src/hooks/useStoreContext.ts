/**
 * useStoreContext — single RPC fetch for the store context sidebar.
 * Returns store header, stats, recent orders, preferred products,
 * visits, comm summary, and viewer metadata in one round trip.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { toast } from 'sonner';

export interface StoreContextHeader {
  id: string;
  store_name: string | null;
  owner_name: string | null;
  owner_name_arabic: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  borough_id: string | null;
  status: string | null;
  language_preference: string | null;
  preferred_channel: string | null;
  photo_url: string | null;
  notes: string | null;
  last_visit_at: string | null;
  last_order_at: string | null;
  owed_amount: number | null;
  assigned_ambassador_id: string | null;
}

export interface StoreContextStats {
  total_orders: number;
  avg_order_value: number;
  last_order_date: string | null;
  last_order_amount: number | null;
  outstanding_balance: number;
  days_since_last_order: number | null;
}

export interface StoreContextOrder {
  id: string;
  placed_at: string | null;
  total_amount: number | null;
  order_status: string | null;
  payment_status: string | null;
  item_count: number;
}

export interface StoreContextProduct {
  product_id: string;
  product_name: string;
  brand_id: string | null;
  times_ordered: number;
  last_ordered_at: string | null;
  total_quantity: number;
}

export interface StoreContextVisit {
  id: string;
  started_at: string;
  completed_at: string | null;
  outcome: string | null;
  notes: string | null;
  visited_by: string | null;
  amount_collected: number | null;
  visit_type: string | null;
}

export interface StoreContextComm {
  messages_count: number;
  calls_count: number;
  inbound_30d: number;
  outbound_30d: number;
}

export interface StoreContext {
  store: StoreContextHeader;
  stats: StoreContextStats;
  recent_orders: StoreContextOrder[];
  preferred_products: StoreContextProduct[];
  visits: StoreContextVisit[];
  comm_summary: StoreContextComm;
  viewer: { is_admin: boolean; ambassador_id: string | null };
}

export function useStoreContext(storeId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['store-context', storeId],
    queryFn: async (): Promise<StoreContext | null> => {
      if (!storeId) return null;
      const { data, error } = await supabase.rpc('get_store_context', { p_store_id: storeId });
      if (error) throw error;
      return data as unknown as StoreContext;
    },
    enabled: !!storeId,
    staleTime: 60 * 1000,
  });

  // Realtime: invalidate when store row, orders, or notes change
  useEffect(() => {
    if (!storeId) return;
    const ch = supabase
      .channel(`store-ctx-${storeId}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'store_master', filter: `id=eq.${storeId}` },
        () => queryClient.invalidateQueries({ queryKey: ['store-context', storeId] }))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `store_id=eq.${storeId}` },
        () => queryClient.invalidateQueries({ queryKey: ['store-context', storeId] }))
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'store_visits', filter: `store_id=eq.${storeId}` },
        () => queryClient.invalidateQueries({ queryKey: ['store-context', storeId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [storeId, queryClient]);

  return query;
}

/** Update store notes (debounced autosave usage). */
export function useUpdateStoreNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, notes }: { storeId: string; notes: string }) => {
      const { error } = await supabase
        .from('store_master')
        .update({ notes })
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['store-context', vars.storeId] });
    },
    onError: (e: Error) => toast.error(`Save notes failed: ${e.message}`),
  });
}

/** Mark store dormant. */
export function useUpdateStoreStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, status }: { storeId: string; status: string }) => {
      const { error } = await supabase
        .from('store_master')
        .update({ status })
        .eq('id', storeId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['store-context', vars.storeId] });
      queryClient.invalidateQueries({ queryKey: ['ambassador-threads-v2'] });
      toast.success('Store status updated');
    },
    onError: (e: Error) => toast.error(`Update failed: ${e.message}`),
  });
}

/** Schedule a visit via RPC. */
export function useScheduleVisit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ storeId, scheduledFor, notes }: { storeId: string; scheduledFor: Date; notes?: string }) => {
      const { data, error } = await supabase.rpc('schedule_ambassador_visit', {
        p_store_id: storeId,
        p_scheduled_for: scheduledFor.toISOString(),
        p_notes: notes || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['store-context', vars.storeId] });
      toast.success('Visit scheduled');
    },
    onError: (e: Error) => toast.error(`Schedule failed: ${e.message}`),
  });
}
