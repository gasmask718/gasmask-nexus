/**
 * Ambassador Orders Hook - Unified orders across all channels
 * Scoped to ambassador's assigned stores via RLS
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AmbassadorOrder {
  id: string;
  order_number: string;
  channel: 'store' | 'wholesale' | 'affiliate';
  entity_id: string;
  entity_name: string;
  status: string;
  payment_status: string;
  subtotal: number;
  tax: number;
  total: number;
  created_at: string;
  items_count: number;
  items_summary: string;
  // Receipt status tracking
  receipt_status?: string | null;
  receipt_sent_at?: string | null;
  receipt_phone_used?: string | null;
  receipt_failure_reason?: string | null;
}

export interface OrdersMetrics {
  totalOrders: number;
  totalRevenue: number;
  storeOrders: number;
  wholesaleOrders: number;
  affiliateOrders: number;
  pendingPayments: number;
}

/**
 * Fetch all orders scoped to ambassador's portfolio
 */
export function useAmbassadorOrders(options?: { channel?: string; status?: string; limit?: number }) {
  const { user } = useAuth();
  const { channel, status, limit = 100 } = options || {};

  // First get the ambassador's assigned stores
  const ambassadorQuery = useQuery({
    queryKey: ['ambassador-for-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const ambassadorId = ambassadorQuery.data?.id;

  // Get assigned store IDs
  const assignmentsQuery = useQuery({
    queryKey: ['ambassador-store-ids', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      
      const { data, error } = await supabase
        .from('ambassador_assignments')
        .select('store_id')
        .eq('ambassador_id', ambassadorId)
        .eq('active', true)
        .not('store_id', 'is', null);
      
      if (error) throw error;
      return (data || []).map(a => a.store_id).filter(Boolean);
    },
    enabled: !!ambassadorId,
  });

  const storeIds = assignmentsQuery.data || [];

  // Fetch store orders from store_orders table
  const storeOrdersQuery = useQuery({
    queryKey: ['ambassador-store-orders', storeIds, status, limit],
    queryFn: async () => {
      if (storeIds.length === 0) return [];

      let query = supabase
        .from('store_orders')
        .select(`
          id,
          order_number,
          store_id,
          status,
          payment_status,
          subtotal,
          tax,
          total_amount,
          created_at,
          store:stores!store_id(name)
        `)
        .in('store_id', storeIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((order: any): AmbassadorOrder => ({
        id: order.id,
        order_number: order.order_number,
        channel: 'store',
        entity_id: order.store_id,
        entity_name: order.store?.name || 'Unknown Store',
        status: order.status,
        payment_status: order.payment_status,
        subtotal: Number(order.subtotal || 0),
        tax: Number(order.tax || 0),
        total: Number(order.total_amount || 0),
        created_at: order.created_at,
        items_count: 0,
        items_summary: '',
      }));
    },
    enabled: storeIds.length > 0 && (!channel || channel === 'all' || channel === 'store'),
  });

  // CRITICAL: Also fetch invoices table (where CreateStoreInvoiceModal saves)
  const invoicesQuery = useQuery({
    queryKey: ['ambassador-store-invoices', storeIds, status, limit],
    queryFn: async () => {
      if (storeIds.length === 0) return [];

      let query = supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          store_id,
          payment_status,
          subtotal,
          tax,
          total_amount,
          created_at,
          receipt_status,
          receipt_sent_at,
          store:stores!store_id(name),
          line_items:invoice_line_items(product_name, quantity)
        `)
        .in('store_id', storeIds)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status && status !== 'all') {
        query = query.eq('payment_status', status);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((invoice: any): AmbassadorOrder => {
        const items: { product_name: string; quantity: number }[] = invoice.line_items || [];
        const totalQty = items.reduce((sum, i) => sum + (i.quantity || 0), 0);
        const summary = items.map(i => `${i.product_name || 'Unknown'} x${i.quantity}`).join(', ');
        return {
          id: invoice.id,
          order_number: invoice.invoice_number || `INV-${invoice.id.slice(0, 8).toUpperCase()}`,
          channel: 'store',
          entity_id: invoice.store_id,
          entity_name: invoice.store?.name || 'Unknown Store',
          status: invoice.payment_status === 'paid' ? 'delivered' : 'pending',
          payment_status: invoice.payment_status || 'pending',
          subtotal: Number(invoice.subtotal || invoice.total_amount || 0),
          tax: Number(invoice.tax || 0),
          total: Number(invoice.total_amount || 0),
          created_at: invoice.created_at,
          items_count: totalQty,
          items_summary: summary,
          receipt_status: invoice.receipt_status,
          receipt_sent_at: invoice.receipt_sent_at,
        };
      });
    },
    enabled: storeIds.length > 0 && (!channel || channel === 'all' || channel === 'store'),
  });

  // Combine orders from both tables, deduplicate by ID
  const storeOrders = storeOrdersQuery.data || [];
  const invoiceOrders = invoicesQuery.data || [];
  
  // Merge and sort by date (invoices + store_orders), avoiding duplicates
  const allOrdersMap = new Map<string, AmbassadorOrder>();
  [...storeOrders, ...invoiceOrders].forEach(order => {
    // Prefer invoice data if same ID exists (shouldn't happen but safety)
    if (!allOrdersMap.has(order.id)) {
      allOrdersMap.set(order.id, order);
    }
  });
  
  const orders = Array.from(allOrdersMap.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  
  const metrics: OrdersMetrics = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    storeOrders: orders.filter(o => o.channel === 'store').length,
    wholesaleOrders: orders.filter(o => o.channel === 'wholesale').length,
    affiliateOrders: orders.filter(o => o.channel === 'affiliate').length,
    pendingPayments: orders.filter(o => o.payment_status === 'pending' || o.payment_status === 'unpaid').length,
  };

  const refetchAll = () => {
    ambassadorQuery.refetch();
    assignmentsQuery.refetch();
    storeOrdersQuery.refetch();
    invoicesQuery.refetch();
  };

  return {
    orders,
    metrics,
    isLoading: ambassadorQuery.isLoading || assignmentsQuery.isLoading || storeOrdersQuery.isLoading || invoicesQuery.isLoading,
    isRefetching: storeOrdersQuery.isRefetching || invoicesQuery.isRefetching,
    isError: ambassadorQuery.isError || assignmentsQuery.isError || storeOrdersQuery.isError || invoicesQuery.isError,
    error: ambassadorQuery.error || assignmentsQuery.error || storeOrdersQuery.error || invoicesQuery.error,
    refetch: refetchAll,
  };
}

/**
 * Fetch a single order with details
 */
export function useAmbassadorOrderDetail(orderId: string | null) {
  return useQuery({
    queryKey: ['ambassador-order-detail', orderId],
    queryFn: async () => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('store_orders')
        .select(`
          *,
          store:stores!store_id(name, address_street, address_city, phone)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}
