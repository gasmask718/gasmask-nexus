import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ─── Executive KPI Summary ───
export function useMarketplaceKPIs() {
  return useQuery({
    queryKey: ['marketplace-control-kpis'],
    queryFn: async () => {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

      const [ordersRes, fulfillmentsRes, payoutsRes, disputesRes] = await Promise.all([
        supabase.from('marketplace_orders').select('id, total, payment_status, fulfillment_status, created_at, dispute_status'),
        supabase.from('marketplace_fulfillments').select('id, status, created_at, wholesaler_id'),
        supabase.from('wholesaler_payouts').select('id, status, net_amount, amount, dispute_flag'),
        supabase.from('marketplace_orders').select('id').neq('dispute_status', 'none').not('dispute_status', 'is', null),
      ]);

      const orders = ordersRes.data || [];
      const fulfillments = fulfillmentsRes.data || [];
      const payouts = payoutsRes.data || [];

      const gmv7d = orders.filter(o => o.created_at >= d7).reduce((s, o) => s + (o.total || 0), 0);
      const gmv30d = orders.filter(o => o.created_at >= d30).reduce((s, o) => s + (o.total || 0), 0);

      const pendingShipment = fulfillments.filter(f => f.status === 'pending').length;
      const overdueShipment = fulfillments.filter(f => {
        if (f.status !== 'pending' || !f.created_at) return false;
        return (now.getTime() - new Date(f.created_at).getTime()) > 48 * 3600000;
      }).length;

      const inSettlement = payouts.filter(p => p.status === 'in_settlement').length;
      const heldTotal = payouts.filter(p => p.status === 'held').reduce((s, p) => s + (p.net_amount || 0), 0);
      const activeDisputes = (disputesRes.data || []).length;

      const totalOrders30d = orders.filter(o => o.created_at >= d30).length;
      const refundedOrders = payouts.filter(p => p.status === 'reversed').length;
      const refundRate = totalOrders30d > 0 ? ((refundedOrders / totalOrders30d) * 100) : 0;

      return {
        gmv7d, gmv30d, pendingShipment, overdueShipment, inSettlement,
        heldTotal, activeDisputes, refundRate,
        totalFulfillments: fulfillments.length,
        shippedCount: fulfillments.filter(f => ['shipped', 'completed'].includes(f.status || '')).length,
      };
    },
    staleTime: 30_000,
  });
}

// ─── Overdue Fulfillments ───
export function useOverdueFulfillments() {
  return useQuery({
    queryKey: ['marketplace-overdue-fulfillments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_fulfillments')
        .select('id, order_id, wholesaler_id, status, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const now = Date.now();
      return (data || []).map(f => {
        const hoursElapsed = (now - new Date(f.created_at).getTime()) / 3600000;
        return {
          id: f.id,
          order_id: f.order_id,
          wholesaler_id: f.wholesaler_id,
          status: f.status,
          created_at: f.created_at,
          hoursElapsed,
          severity: hoursElapsed > 48 ? 'critical' as const : hoursElapsed > 24 ? 'warning' as const : 'ok' as const,
        };
      }).filter(f => f.severity !== 'ok');
    },
    staleTime: 30_000,
  });
}

// ─── Active Disputes ───
export function useActiveDisputes() {
  return useQuery({
    queryKey: ['marketplace-active-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, wholesaler_id, dispute_status, dispute_reason, dispute_opened_at, payment_status, total')
        .neq('dispute_status', 'none')
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Held/At-Risk Payouts ───
export function useHeldPayouts() {
  return useQuery({
    queryKey: ['marketplace-held-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('id, wholesaler_id, order_id, net_amount, status, hold_reason, dispute_flag, settlement_start_at, settlement_release_at')
        .in('status', ['held', 'in_settlement'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Vendor Performance (from materialized view) ───
export function useVendorPerformance() {
  return useQuery({
    queryKey: ['vendor-performance-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_performance_summary' as any)
        .select('*')
        .order('risk_score', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

// ─── Order Deep-Dive ───
export function useOrderDeepDive(orderId: string | null) {
  return useQuery({
    queryKey: ['order-deep-dive', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      if (!orderId) return null;

      const [orderRes, fulfillmentsRes, payoutsRes, messagesRes, liabilitiesRes] = await Promise.all([
        supabase.from('marketplace_orders').select('*').eq('id', orderId).single(),
        supabase.from('marketplace_fulfillments').select('*').eq('order_id', orderId),
        supabase.from('wholesaler_payouts').select('*').eq('order_id', orderId),
        supabase.from('order_messages').select('*').eq('order_id', orderId).order('created_at'),
        supabase.from('vendor_liabilities').select('*').eq('order_id', orderId),
      ]);

      return {
        order: orderRes.data,
        fulfillments: fulfillmentsRes.data || [],
        payouts: payoutsRes.data || [],
        messages: messagesRes.data || [],
        liabilities: liabilitiesRes.data || [],
      };
    },
  });
}

// ─── Admin Actions ───
export function useAdminAction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      action_type: string;
      related_order_id?: string;
      related_vendor_id?: string;
      previous_state?: any;
      new_state?: any;
      reason: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('marketplace_admin_actions').insert({
        admin_user_id: user.id,
        action_type: params.action_type,
        related_order_id: params.related_order_id || null,
        related_vendor_id: params.related_vendor_id || null,
        previous_state: params.previous_state || null,
        new_state: params.new_state || null,
        reason: params.reason,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Action logged', description: 'Admin action recorded successfully.' });
      queryClient.invalidateQueries({ queryKey: ['marketplace-control'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

// ─── Admin Action Log ───
export function useAdminActionLog() {
  return useQuery({
    queryKey: ['marketplace-admin-action-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Message Oversight ───
export function useMessageOversight(filter?: string) {
  return useQuery({
    queryKey: ['marketplace-message-oversight', filter],
    queryFn: async () => {
      let query = supabase
        .from('order_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filter === 'dispute_related') {
        query = query.eq('message_type', 'dispute_related');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}
