// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT SERVICE — Suppliers, Products, Purchase Orders
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// Types
export interface Supplier {
  id: string;
  name: string;
  country: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  wechat: string | null;
  notes: string | null;
  reliability_score: number | null;
  lead_time_days: number | null;
  shipping_methods: Json | null;
  payment_terms: string | null;
  status: string | null;
  total_spend: number | null;
  created_at: string | null;
}

export interface SupplierProduct {
  id: string;
  supplier_id: string | null;
  name: string;
  sku: string | null;
  moq: number | null;
  unit_cost: number | null;
  bulk_cost: number | null;
  shipping_weight: number | null;
  shipping_dimensions: Json | null;
  processing_time_days: number | null;
  product_photos: string[] | null;
  category: string | null;
  created_at: string | null;
  supplier?: Supplier;
}

export interface PurchaseOrder {
  id: string;
  supplier_id: string | null;
  products: POProduct[];
  total_cost: number | null;
  shipping_cost: number | null;
  status: string | null;
  estimated_arrival: string | null;
  tracking_number: string | null;
  warehouse_location: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  supplier?: Supplier;
}

export interface POProduct {
  product_id: string;
  name: string;
  qty: number;
  unit_cost: number;
}

export interface RestockForecast {
  id: string;
  product_name: string;
  product_id: string | null;
  current_units: number | null;
  daily_sales_rate: number | null;
  projected_out_date: string | null;
  recommended_reorder_units: number | null;
  priority: string | null;
  created_at: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════════════════════

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useSupplier(id: string) {
  return useQuery({
    queryKey: ['supplier', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data as Supplier;
    },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (supplier: Partial<Supplier>) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          name: supplier.name!,
          country: supplier.country,
          contact_name: supplier.contact_name,
          contact_email: supplier.contact_email,
          contact_phone: supplier.contact_phone,
          wechat: supplier.wechat,
          notes: supplier.notes,
          payment_terms: supplier.payment_terms,
          lead_time_days: supplier.lead_time_days,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier added');
    },
    onError: (error) => {
      toast.error(`Failed to add supplier: ${error.message}`);
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Supplier> & { id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      toast.success('Supplier updated');
    },
    onError: (error) => {
      toast.error(`Failed to update supplier: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPLIER PRODUCTS
// ═══════════════════════════════════════════════════════════════════════════════

export function useSupplierProducts(supplierId?: string) {
  return useQuery({
    queryKey: ['supplier-products', supplierId],
    queryFn: async () => {
      let query = supabase
        .from('supplier_products')
        .select(`*, supplier:suppliers(*)`)
        .order('name');

      if (supplierId) {
        query = query.eq('supplier_id', supplierId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as SupplierProduct[];
    },
  });
}

export function useCreateSupplierProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<SupplierProduct>) => {
      const { data, error } = await supabase
        .from('supplier_products')
        .insert({
          name: product.name!,
          supplier_id: product.supplier_id,
          sku: product.sku,
          moq: product.moq,
          unit_cost: product.unit_cost,
          bulk_cost: product.bulk_cost,
          category: product.category,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier-products'] });
      toast.success('Product added');
    },
    onError: (error) => {
      toast.error(`Failed to add product: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════════

export function usePurchaseOrders(status?: string) {
  return useQuery({
    queryKey: ['purchase-orders', status],
    queryFn: async () => {
      let query = supabase
        .from('purchase_orders')
        .select(`*, supplier:suppliers(*)`)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).map(po => ({
        ...po,
        products: Array.isArray(po.products) ? po.products as unknown as POProduct[] : [],
      })) as PurchaseOrder[];
    },
  });
}

export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: ['purchase-order', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`*, supplier:suppliers(*)`)
        .eq('id', id)
        .single();

      if (error) throw error;
      
      return {
        ...data,
        products: Array.isArray(data.products) ? data.products as unknown as POProduct[] : [],
      } as PurchaseOrder;
    },
    enabled: !!id,
  });
}

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (po: {
      supplier_id?: string;
      products?: POProduct[];
      total_cost?: number;
      shipping_cost?: number;
      status?: string;
      estimated_arrival?: string | null;
      warehouse_location?: string | null;
      notes?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert({
          supplier_id: po.supplier_id,
          products: po.products as unknown as Json,
          total_cost: po.total_cost,
          shipping_cost: po.shipping_cost,
          status: po.status,
          estimated_arrival: po.estimated_arrival,
          warehouse_location: po.warehouse_location,
          notes: po.notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-stats'] });
      toast.success('Purchase order created');
    },
    onError: (error) => {
      toast.error(`Failed to create PO: ${error.message}`);
    },
  });
}

export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, products, ...updates }: Partial<PurchaseOrder> & { id: string }) => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .update({ 
          ...updates, 
          products: products as unknown as Json,
          updated_at: new Date().toISOString() 
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-order', id] });
      queryClient.invalidateQueries({ queryKey: ['procurement-stats'] });
      toast.success('Purchase order updated');
    },
    onError: (error) => {
      toast.error(`Failed to update PO: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECEIVING / INFLOW
// ═══════════════════════════════════════════════════════════════════════════════

export function useLogReceiving() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inflow: {
      po_id: string;
      product_name: string;
      units_in: number;
      cost_per_unit: number;
      receiving_notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('supply_chain_inflow')
        .insert(inflow)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supply-chain-inflow'] });
      toast.success('Inventory received');
    },
    onError: (error) => {
      toast.error(`Failed to log receiving: ${error.message}`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// RESTOCK FORECAST
// ═══════════════════════════════════════════════════════════════════════════════

export function useRestockForecast() {
  return useQuery({
    queryKey: ['restock-forecast'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restock_forecast')
        .select('*')
        .order('projected_out_date', { ascending: true });

      if (error) throw error;
      return data as RestockForecast[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROCUREMENT STATS
// ═══════════════════════════════════════════════════════════════════════════════

export function useProcurementStats() {
  return useQuery({
    queryKey: ['procurement-stats'],
    queryFn: async () => {
      const [suppliersRes, posRes, forecastRes] = await Promise.all([
        supabase.from('suppliers').select('id, total_spend', { count: 'exact' }),
        supabase.from('purchase_orders').select('id, status, total_cost, shipping_cost'),
        supabase.from('restock_forecast').select('id, priority'),
      ]);

      const suppliers = suppliersRes.data || [];
      const pos = posRes.data || [];
      const forecasts = forecastRes.data || [];

      const activePOs = pos.filter(p => ['placed', 'paid', 'in_transit'].includes(p.status || ''));
      const totalSpend = suppliers.reduce((sum, s) => sum + (Number(s.total_spend) || 0), 0);
      const pipelineValue = activePOs.reduce((sum, p) => sum + (Number(p.total_cost) || 0) + (Number(p.shipping_cost) || 0), 0);
      const urgentRestocks = forecasts.filter(f => f.priority === 'urgent').length;

      return {
        totalSuppliers: suppliersRes.count || 0,
        activePOs: activePOs.length,
        totalSpend,
        pipelineValue,
        urgentRestocks,
        inboundShipments: pos.filter(p => p.status === 'in_transit').length,
        outOfStockRisks: forecasts.filter(f => f.priority === 'critical').length,
      };
    },
  });
}
