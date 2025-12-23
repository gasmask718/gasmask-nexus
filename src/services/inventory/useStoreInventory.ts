// ═══════════════════════════════════════════════════════════════════════════════
// STORE INVENTORY SERVICE — Track products at store level by full address
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface StoreInventoryItem {
  id: string;
  store_id: string;
  product_id: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  reorder_point: number;
  last_restock_date: string | null;
  last_sale_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  store?: {
    id: string;
    store_name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
    store_type: string | null;
    borough?: { id: string; name: string } | null;
  };
  product?: {
    id: string;
    name: string;
    sku: string | null;
    category: string | null;
    brand?: { id: string; name: string } | null;
  };
}

export interface StoreInventoryFilters {
  storeId?: string;
  productId?: string;
  city?: string;
  boroughId?: string;
  lowStockOnly?: boolean;
  search?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function useStoreInventory(filters?: StoreInventoryFilters) {
  return useQuery({
    queryKey: ['store-inventory', filters],
    queryFn: async () => {
      let query = supabase
        .from('store_inventory')
        .select(`
          *,
          store:store_master(
            id, store_name, address, city, state, zip, phone, store_type,
            borough:boroughs(id, name)
          ),
          product:products(
            id, name, sku, category,
            brand:brands(id, name)
          )
        `)
        .order('updated_at', { ascending: false });

      if (filters?.storeId) {
        query = query.eq('store_id', filters.storeId);
      }
      if (filters?.productId) {
        query = query.eq('product_id', filters.productId);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = (data || []) as unknown as StoreInventoryItem[];

      // Client-side filters for joined data
      if (filters?.city) {
        results = results.filter(item => item.store?.city === filters.city);
      }
      if (filters?.boroughId) {
        results = results.filter(item => (item.store?.borough as any)?.id === filters.boroughId);
      }
      if (filters?.lowStockOnly) {
        results = results.filter(item => item.quantity_on_hand <= item.reorder_point);
      }
      if (filters?.search) {
        const term = filters.search.toLowerCase();
        results = results.filter(item =>
          item.store?.store_name?.toLowerCase().includes(term) ||
          item.store?.address?.toLowerCase().includes(term) ||
          item.product?.name?.toLowerCase().includes(term) ||
          item.product?.sku?.toLowerCase().includes(term)
        );
      }

      return results;
    },
  });
}

export function useStoreInventoryStats() {
  return useQuery({
    queryKey: ['store-inventory-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_inventory')
        .select('quantity_on_hand, quantity_reserved, reorder_point');

      if (error) throw error;

      const items = data || [];
      const totalStores = new Set(items.map(i => i)).size; // Approximate
      const totalUnits = items.reduce((sum, i) => sum + (i.quantity_on_hand || 0), 0);
      const lowStockCount = items.filter(i => i.quantity_on_hand <= i.reorder_point).length;
      const outOfStockCount = items.filter(i => i.quantity_on_hand === 0).length;

      return {
        totalRecords: items.length,
        totalUnits,
        lowStockCount,
        outOfStockCount,
      };
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useUpdateStoreInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      quantity_on_hand,
      reorder_point,
      notes,
      reason,
    }: {
      id: string;
      quantity_on_hand?: number;
      reorder_point?: number;
      notes?: string;
      reason?: string;
    }) => {
      // Get current values for audit
      const { data: current, error: fetchError } = await supabase
        .from('store_inventory')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const updates: Record<string, any> = {};
      if (quantity_on_hand !== undefined) updates.quantity_on_hand = quantity_on_hand;
      if (reorder_point !== undefined) updates.reorder_point = reorder_point;
      if (notes !== undefined) updates.notes = notes;

      const { data, error } = await supabase
        .from('store_inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      // Log audit entry
      if (quantity_on_hand !== undefined && quantity_on_hand !== current.quantity_on_hand) {
        await supabase.from('inventory_audit_log').insert({
          store_inventory_id: id,
          product_id: current.product_id,
          store_id: current.store_id,
          field_changed: 'quantity_on_hand',
          old_value: String(current.quantity_on_hand),
          new_value: String(quantity_on_hand),
          quantity_delta: quantity_on_hand - current.quantity_on_hand,
          change_reason: reason || 'Manual adjustment',
          reference_type: 'manual',
        });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['store-inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-audit-log'] });
      toast.success('Store inventory updated');
    },
    onError: (error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });
}

export function useCreateStoreInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: {
      store_id: string;
      product_id: string;
      quantity_on_hand: number;
      reorder_point?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('store_inventory')
        .insert({
          store_id: item.store_id,
          product_id: item.product_id,
          quantity_on_hand: item.quantity_on_hand,
          reorder_point: item.reorder_point || 0,
          notes: item.notes,
        })
        .select()
        .single();

      if (error) throw error;

      // Log audit entry
      await supabase.from('inventory_audit_log').insert({
        store_inventory_id: data.id,
        product_id: item.product_id,
        store_id: item.store_id,
        field_changed: 'quantity_on_hand',
        old_value: '0',
        new_value: String(item.quantity_on_hand),
        quantity_delta: item.quantity_on_hand,
        change_reason: 'Initial inventory setup',
        reference_type: 'manual',
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['store-inventory-stats'] });
      toast.success('Store inventory created');
    },
    onError: (error) => {
      toast.error(`Failed to create: ${error.message}`);
    },
  });
}
