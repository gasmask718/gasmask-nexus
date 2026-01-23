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

  // Fetch store orders
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
          store:store_master!store_id(store_name)
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
        entity_name: order.store?.store_name || 'Unknown Store',
        status: order.status,
        payment_status: order.payment_status,
        subtotal: Number(order.subtotal || 0),
        tax: Number(order.tax || 0),
        total: Number(order.total_amount || 0),
        created_at: order.created_at,
        items_count: 0, // Would need join to order_items
      }));
    },
    enabled: storeIds.length > 0 && (!channel || channel === 'all' || channel === 'store'),
  });

  // Calculate metrics
  const orders = storeOrdersQuery.data || [];
  
  const metrics: OrdersMetrics = {
    totalOrders: orders.length,
    totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
    storeOrders: orders.filter(o => o.channel === 'store').length,
    wholesaleOrders: orders.filter(o => o.channel === 'wholesale').length,
    affiliateOrders: orders.filter(o => o.channel === 'affiliate').length,
    pendingPayments: orders.filter(o => o.payment_status === 'pending').length,
  };

  return {
    orders,
    metrics,
    isLoading: ambassadorQuery.isLoading || assignmentsQuery.isLoading || storeOrdersQuery.isLoading,
    isError: ambassadorQuery.isError || assignmentsQuery.isError || storeOrdersQuery.isError,
    error: ambassadorQuery.error || assignmentsQuery.error || storeOrdersQuery.error,
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
          store:store_master!store_id(store_name, address, city, phone)
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!orderId,
  });
}
