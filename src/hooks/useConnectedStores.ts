/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useConnectedStores — Shared hook for "same owner" store groups.
 *
 * SINGLE SOURCE OF TRUTH: groups stores strictly by `connected_group_id`.
 * NO owner_name string fallback. If a store has no group_id, its connected
 * count is 0 (not "everyone who shares your first name").
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ConnectedStoreRow {
  id: string;
  name: string;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  phone: string | null;
  primary_contact_name: string | null;
  connected_group_id: string | null;
  status: string | null;
  last_order_date: string | null;
  needs_order: boolean;
  contacts: { id: string; name: string; role: string | null; phone: string | null }[];
  inventory: { brand: string; current_tubes_left: number | null }[];
}

/**
 * Fetch every store in the same connected group as `currentStoreId`,
 * excluding the current store itself. Returns [] if no group_id.
 */
export function useConnectedStores(
  currentStoreId: string,
  groupId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['connected-stores', currentStoreId, groupId],
    queryFn: async (): Promise<ConnectedStoreRow[]> => {
      if (!groupId) return [];

      const { data: storesData, error: storesError } = await supabase
        .from('stores')
        .select(
          'id, name, address_street, address_city, address_state, address_zip, phone, primary_contact_name, connected_group_id, status',
        )
        .eq('connected_group_id', groupId)
        .eq('approval_status', 'approved')
        .is('deleted_at', null)
        .neq('id', currentStoreId);

      if (storesError) throw storesError;
      if (!storesData || storesData.length === 0) return [];

      const storeIds = storesData.map((s) => s.id);

      // Parallel enrichment.
      const [contactsRes, inventoryRes, needsOrderRes, masterRes] = await Promise.all([
        supabase
          .from('store_contacts')
          .select('id, store_id, name, role, phone')
          .in('store_id', storeIds),
        supabase
          .from('store_tube_inventory')
          .select('store_id, brand, current_tubes_left')
          .in('store_id', storeIds),
        supabase
          .from('store_tube_inventory_status')
          .select('store_id, needs_order')
          .in('store_id', storeIds)
          .eq('needs_order', true),
        supabase
          .from('store_master')
          .select('id, last_order_at')
          .in('id', storeIds),
      ]);

      const contactsByStore = (contactsRes.data || []).reduce(
        (acc, c: any) => {
          (acc[c.store_id] ||= []).push({
            id: c.id,
            name: c.name,
            role: c.role,
            phone: c.phone,
          });
          return acc;
        },
        {} as Record<string, ConnectedStoreRow['contacts']>,
      );

      const inventoryByStore = (inventoryRes.data || []).reduce(
        (acc, i: any) => {
          (acc[i.store_id] ||= []).push({
            brand: i.brand,
            current_tubes_left: i.current_tubes_left,
          });
          return acc;
        },
        {} as Record<string, ConnectedStoreRow['inventory']>,
      );

      const needsOrderStores = new Set(
        (needsOrderRes.data || []).map((r: any) => r.store_id),
      );

      const lastOrderByStore = new Map<string, string | null>(
        (masterRes.data || []).map((r: any) => [r.id, r.last_order_at ?? null]),
      );

      return storesData.map((s: any) => ({
        ...s,
        last_order_date: lastOrderByStore.get(s.id) ?? null,
        needs_order: needsOrderStores.has(s.id),
        contacts: contactsByStore[s.id] || [],
        inventory: inventoryByStore[s.id] || [],
      })) as ConnectedStoreRow[];
    },
    enabled: !!currentStoreId,
  });
}

/**
 * Fetch just the count of connected stores for a given group_id (fast).
 */
export function useConnectedStoresCount(groupId: string | null | undefined) {
  return useQuery({
    queryKey: ['connected-stores-count', groupId],
    queryFn: async (): Promise<number> => {
      if (!groupId) return 0;
      const { count, error } = await supabase
        .from('stores')
        .select('id', { count: 'exact', head: true })
        .eq('connected_group_id', groupId)
        .eq('approval_status', 'approved')
        .is('deleted_at', null);
      if (error) throw error;
      return Math.max(0, (count ?? 0) - 1); // exclude self
    },
    enabled: !!groupId,
  });
}
