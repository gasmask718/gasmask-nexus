// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE SERVICE — Warehouses, Inventory, Stock Movements, PO Items
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string | null;
  contact_phone: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface WarehouseZone {
  id: string;
  warehouse_id: string | null;
  name: string;
  code: string;
  created_at: string | null;
}

export interface WarehouseBin {
  id: string;
  warehouse_id: string | null;
  zone_id: string | null;
  bin_code: string;
  description: string | null;
  created_at: string | null;
}

export interface InventoryStock {
  id: string;
  product_id: string | null;
  warehouse_id: string | null;
  bin_id: string | null;
  owner_type: string | null;
  owner_id: string | null;
  quantity_on_hand: number | null;
  quantity_reserved: number | null;
  quantity_in_transit: number | null;
  reorder_point: number | null;
  reorder_target: number | null;
  created_at: string | null;
  warehouse?: Warehouse;
  product?: { id: string; name: string; sku?: string };
}

export interface InventoryMovement {
  id: string;
  product_id: string | null;
  from_warehouse_id: string | null;
  from_bin_id: string | null;
  to_warehouse_id: string | null;
  to_bin_id: string | null;
  movement_type: string | null;
  quantity: number | null;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string | null;
  product_id: string | null;
  quantity_ordered: number;
  quantity_received: number | null;
  unit_cost: number | null;
  created_at: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSES
// ═══════════════════════════════════════════════════════════════════════════════

export function useWarehouses() {
  return useQuery({
    queryKey: ['warehouses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Warehouse[];
    },
  });
}

export function useWarehouse(id: string) {
  return useQuery({
    queryKey: ['warehouse', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Warehouse;
    },
    enabled: !!id,
  });
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (warehouse: Partial<Warehouse>) => {
      const { data, error } = await supabase
        .from('warehouses')
        .insert({
          name: warehouse.name!,
          code: warehouse.code!,
          type: warehouse.type,
          address_line1: warehouse.address_line1,
          city: warehouse.city,
          state: warehouse.state,
          zip: warehouse.zip,
          country: warehouse.country,
          contact_phone: warehouse.contact_phone,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      toast.success('Warehouse created');
    },
    onError: (error) => {
      toast.error(`Failed to create warehouse: ${error.message}`);
    },
  });
}

export function useUpdateWarehouse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Warehouse> & { id: string }) => {
      const { data, error } = await supabase
        .from('warehouses')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse', id] });
      toast.success('Warehouse updated');
    },
    onError: (error) => {
      toast.error(`Failed to update warehouse: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY STOCK
// ═══════════════════════════════════════════════════════════════════════════════

export function useInventoryStock(warehouseId?: string) {
  return useQuery({
    queryKey: ['inventory-stock', warehouseId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_stock')
        .select(`*, warehouse:warehouses(*)`)
        .order('created_at', { ascending: false });

      if (warehouseId) {
        query = query.eq('warehouse_id', warehouseId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as InventoryStock[];
    },
  });
}

export function useProductStock(productId: string) {
  return useQuery({
    queryKey: ['product-stock', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`*, warehouse:warehouses(*)`)
        .eq('product_id', productId);

      if (error) throw error;
      return data as unknown as InventoryStock[];
    },
    enabled: !!productId,
  });
}

export function useUpdateInventoryStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InventoryStock> & { id: string }) => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Stock updated');
    },
    onError: (error) => {
      toast.error(`Failed to update stock: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY MOVEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

export function useInventoryMovements(params?: { productId?: string; warehouseId?: string; limit?: number }) {
  return useQuery({
    queryKey: ['inventory-movements', params],
    queryFn: async () => {
      let query = supabase
        .from('inventory_movements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(params?.limit || 100);

      if (params?.productId) {
        query = query.eq('product_id', params.productId);
      }
      if (params?.warehouseId) {
        query = query.or(`from_warehouse_id.eq.${params.warehouseId},to_warehouse_id.eq.${params.warehouseId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryMovement[];
    },
  });
}

export function useLogInventoryMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movement: {
      product_id?: string;
      from_warehouse_id?: string;
      to_warehouse_id?: string;
      movement_type: string;
      quantity: number;
      reference_type?: string;
      reference_id?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('inventory_movements')
        .insert(movement as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      toast.success('Movement logged');
    },
    onError: (error) => {
      toast.error(`Failed to log movement: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDER ITEMS
// ═══════════════════════════════════════════════════════════════════════════════

export function usePurchaseOrderItems(purchaseOrderId: string) {
  return useQuery({
    queryKey: ['purchase-order-items', purchaseOrderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .select('*')
        .eq('purchase_order_id', purchaseOrderId)
        .order('created_at');

      if (error) throw error;
      return data as PurchaseOrderItem[];
    },
    enabled: !!purchaseOrderId,
  });
}

export function useCreatePurchaseOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Partial<PurchaseOrderItem>) => {
      const { data, error } = await supabase
        .from('purchase_order_items')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, item) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-order-items', item.purchase_order_id] });
      toast.success('Item added to PO');
    },
    onError: (error) => {
      toast.error(`Failed to add item: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE BRAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

export function useRunWarehouseBrain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: 'route_orders' | 'receive_po' | 'restock_insights') => {
      const { data, error } = await supabase.functions.invoke('warehouse-brain-engine', {
        body: { mode },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, mode) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-orders'] });
      
      if (mode === 'route_orders') {
        toast.success(`Routed ${data?.orders_routed || 0} orders`);
      } else if (mode === 'restock_insights') {
        toast.success(`Generated ${data?.ai_insights_created || 0} AI insights`);
      } else {
        toast.success('Warehouse brain completed');
      }
    },
    onError: (error) => {
      toast.error(`Warehouse brain error: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAREHOUSE STATS
// ═══════════════════════════════════════════════════════════════════════════════

export function useWarehouseStats() {
  return useQuery({
    queryKey: ['warehouse-stats'],
    queryFn: async () => {
      const [warehousesRes, stockRes, posRes, ordersRes] = await Promise.all([
        supabase.from('warehouses').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('inventory_stock').select('quantity_on_hand, quantity_reserved, reorder_point'),
        supabase.from('purchase_orders').select('id, status'),
        supabase.from('marketplace_orders').select('id', { count: 'exact' }),
      ]);

      const stocks = stockRes.data || [];
      const pos = posRes.data || [];

      const totalOnHand = stocks.reduce((sum, s) => sum + (s.quantity_on_hand || 0), 0);
      const totalReserved = stocks.reduce((sum, s) => sum + (s.quantity_reserved || 0), 0);
      const lowStockItems = stocks.filter(s => 
        s.reorder_point && (s.quantity_on_hand || 0) <= s.reorder_point
      ).length;

      const openPOs = pos.filter(p => ['draft', 'sent', 'confirmed', 'in_transit'].includes(p.status || '')).length;

      return {
        totalWarehouses: warehousesRes.count || 0,
        totalStockUnits: totalOnHand,
        reservedUnits: totalReserved,
        lowStockItems,
        openPOs,
        unroutedOrders: ordersRes.count || 0,
      };
    },
  });
}
