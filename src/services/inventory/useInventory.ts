// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ENGINE SERVICE — Products, Alerts, Snapshots, Dashboard Stats
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface Product {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  type: string;
  category: string | null;
  variant: string | null;
  description: string | null;
  unit_type: string;
  cost: number | null;
  wholesale_price: number | null;
  suggested_retail_price: number | null;
  store_price: number | null;
  case_size: number | null;
  units_per_box: number | null;
  moq: number | null;
  reorder_point: number | null;
  reorder_qty: number | null;
  safety_stock: number | null;
  hero_score: number | null;
  ghost_score: number | null;
  image_url: string | null;
  is_active: boolean | null;
  business_id: string | null;
  vertical_id: string | null;
  brand_id: string | null;
  created_at: string | null;
  brand?: { id: string; name: string; color?: string };
}

export interface InventoryAlert {
  id: string;
  product_id: string | null;
  alert_warehouse_id: string | null;
  business_id: string | null;
  alert_type: string;
  severity: string | null;
  current_quantity: number | null;
  threshold: number | null;
  message: string | null;
  is_resolved: boolean | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string | null;
  product?: Product;
}

export interface InventorySnapshot {
  id: string;
  snapshot_date: string;
  snapshot_warehouse_id: string | null;
  business_id: string | null;
  total_units: number | null;
  total_value: number | null;
  total_products: number | null;
  low_stock_count: number | null;
  out_of_stock_count: number | null;
  created_at: string | null;
}

export interface InventoryDashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalStockValue: number;
  totalUnitsOnHand: number;
  totalUnitsReserved: number;
  totalUnitsInTransit: number;
  lowStockItems: number;
  outOfStockItems: number;
  deadStockItems: number;
  incomingPOs: number;
  overdueAlerts: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

export function useProducts(params?: { businessId?: string; verticalId?: string; brandId?: string; search?: string }) {
  return useQuery({
    queryKey: ['products', params],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`*, brand:brands(id, name, color)`)
        .order('name');

      if (params?.businessId) {
        query = query.eq('business_id', params.businessId);
      }
      if (params?.verticalId) {
        query = query.eq('vertical_id', params.verticalId);
      }
      if (params?.brandId) {
        query = query.eq('brand_id', params.brandId);
      }
      if (params?.search) {
        query = query.or(`name.ilike.%${params.search}%,sku.ilike.%${params.search}%,barcode.ilike.%${params.search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Product[];
    },
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`*, brand:brands(id, name, color)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as unknown as Product;
    },
    enabled: !!id,
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<Product>) => {
      const { data, error } = await supabase
        .from('products')
        .insert({
          name: product.name!,
          sku: product.sku,
          barcode: product.barcode,
          type: product.type || 'standard',
          category: product.category,
          variant: product.variant,
          description: product.description,
          unit_type: product.unit_type || 'unit',
          cost: product.cost,
          wholesale_price: product.wholesale_price,
          suggested_retail_price: product.suggested_retail_price,
          store_price: product.store_price,
          case_size: product.case_size,
          units_per_box: product.units_per_box,
          moq: product.moq,
          reorder_point: product.reorder_point,
          reorder_qty: product.reorder_qty,
          safety_stock: product.safety_stock,
          image_url: product.image_url,
          is_active: product.is_active ?? true,
          business_id: product.business_id,
          vertical_id: product.vertical_id,
          brand_id: product.brand_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Product created');
    },
    onError: (error) => {
      toast.error(`Failed to create product: ${error.message}`);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Product> & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product', id] });
      toast.success('Product updated');
    },
    onError: (error) => {
      toast.error(`Failed to update product: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ALERTS
// ═══════════════════════════════════════════════════════════════════════════════

export function useInventoryAlerts(params?: { unresolved?: boolean; severity?: string }) {
  return useQuery({
    queryKey: ['inventory-alerts', params],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      let filtered = data || [];
      if (params?.unresolved) {
        filtered = filtered.filter(a => !a.is_resolved);
      }
      if (params?.severity) {
        filtered = filtered.filter(a => a.severity === params.severity);
      }
      
      return filtered as unknown as InventoryAlert[];
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('inventory_alerts')
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id,
        })
        .eq('id', alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      toast.success('Alert resolved');
    },
    onError: (error) => {
      toast.error(`Failed to resolve alert: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

export function useInventoryDashboardStats() {
  return useQuery({
    queryKey: ['inventory-dashboard-stats'],
    queryFn: async () => {
      const [productsRes, stockRes, alertsRes, posRes] = await Promise.all([
        supabase.from('products').select('id, is_active, wholesale_price', { count: 'exact' }),
        supabase.from('inventory_stock').select('quantity_on_hand, quantity_reserved, quantity_in_transit, reorder_point'),
        supabase.from('inventory_alerts').select('id, severity', { count: 'exact' }).eq('is_resolved', false),
        supabase.from('purchase_orders').select('id, status'),
      ]);

      const products = productsRes.data || [];
      const stocks = stockRes.data || [];
      const pos = posRes.data || [];

      const activeProducts = products.filter(p => p.is_active).length;
      const totalUnitsOnHand = stocks.reduce((sum, s) => sum + (s.quantity_on_hand || 0), 0);
      const totalUnitsReserved = stocks.reduce((sum, s) => sum + (s.quantity_reserved || 0), 0);
      const totalUnitsInTransit = stocks.reduce((sum, s) => sum + (s.quantity_in_transit || 0), 0);
      const lowStockItems = stocks.filter(s => 
        s.reorder_point && (s.quantity_on_hand || 0) <= s.reorder_point && (s.quantity_on_hand || 0) > 0
      ).length;
      const outOfStockItems = stocks.filter(s => (s.quantity_on_hand || 0) === 0).length;
      const incomingPOs = pos.filter(p => ['placed', 'paid', 'in_transit', 'shipped'].includes(p.status || '')).length;

      return {
        totalProducts: productsRes.count || 0,
        activeProducts,
        totalStockValue: 0, // Would need to join products for prices
        totalUnitsOnHand,
        totalUnitsReserved,
        totalUnitsInTransit,
        lowStockItems,
        outOfStockItems,
        deadStockItems: 0, // Would need movement history
        incomingPOs,
        overdueAlerts: alertsRes.count || 0,
      } as InventoryDashboardStats;
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVENTORY ENGINE RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

export function useRunInventoryEngine() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mode: 'scan_alerts' | 'generate_snapshot' | 'compute_scores' | 'full_scan') => {
      const { data, error } = await supabase.functions.invoke('inventory-engine', {
        body: { mode },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data, mode) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      
      if (mode === 'scan_alerts') {
        toast.success(`Created ${data?.alerts_created || 0} alerts`);
      } else if (mode === 'generate_snapshot') {
        toast.success('Inventory snapshot saved');
      } else if (mode === 'compute_scores') {
        toast.success(`Updated ${data?.products_scored || 0} product scores`);
      } else {
        toast.success('Inventory engine completed');
      }
    },
    onError: (error) => {
      toast.error(`Inventory engine error: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOW STOCK REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function useLowStockReport() {
  return useQuery({
    queryKey: ['low-stock-report'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_stock')
        .select(`
          *,
          warehouse:warehouses(id, name, code)
        `)
        .not('reorder_point', 'is', null)
        .order('quantity_on_hand');

      if (error) throw error;
      
      // Filter to items at or below reorder point
      return (data || []).filter(item => 
        item.reorder_point && (item.quantity_on_hand || 0) <= item.reorder_point
      );
    },
  });
}
