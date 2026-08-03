import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Executive KPI Summary ───
export function useMarketplaceKPIs() {
  return useQuery({
    queryKey: ['marketplace-control-kpis'],
    queryFn: async () => {
      const now = new Date();
      const d7 = new Date(now.getTime() - 7 * 86400000).toISOString();
      const d30 = new Date(now.getTime() - 30 * 86400000).toISOString();

      const [ordersRes, fulfillmentsRes, payoutsRes, disputesRes, frozenRes] = await Promise.all([
        supabase.from('marketplace_orders').select('id, total, payment_status, fulfillment_status, created_at, dispute_status'),
        supabase.from('marketplace_fulfillments').select('id, status, created_at, wholesaler_id, updated_at'),
        supabase.from('wholesaler_payouts').select('id, status, net_amount, amount, dispute_flag'),
        supabase.from('marketplace_orders').select('id').neq('dispute_status', 'none').not('dispute_status', 'is', null),
        supabase.from('wholesalers').select('id').eq('is_frozen', true),
      ]);

      const orders = ordersRes.data || [];
      const fulfillments = fulfillmentsRes.data || [];
      const payouts = payoutsRes.data || [];

      const gmv7d = orders.filter(o => o.created_at && o.created_at >= d7).reduce((s, o) => s + (o.total || 0), 0);
      const gmv30d = orders.filter(o => o.created_at && o.created_at >= d30).reduce((s, o) => s + (o.total || 0), 0);

      const pendingShipment = fulfillments.filter(f => f.status === 'pending').length;
      const overdueShipment = fulfillments.filter(f => {
        if (f.status !== 'pending' || !f.created_at) return false;
        return (now.getTime() - new Date(f.created_at).getTime()) > 48 * 3600000;
      }).length;

      const inSettlement = payouts.filter(p => p.status === 'in_settlement').length;
      const heldTotal = payouts.filter(p => p.status === 'held').reduce((s, p) => s + (p.net_amount || 0), 0);
      const activeDisputes = (disputesRes.data || []).length;

      const totalOrders30d = orders.filter(o => o.created_at && o.created_at >= d30).length;
      const refundedOrders = payouts.filter(p => p.status === 'reversed').length;
      const refundRate = totalOrders30d > 0 ? ((refundedOrders / totalOrders30d) * 100) : 0;

      const shippedFulfillments = fulfillments.filter(f => ['shipped', 'completed'].includes(f.status) && f.updated_at && f.created_at);
      const avgFulfillmentTime = shippedFulfillments.length > 0
        ? shippedFulfillments.reduce((s, f) => s + (new Date(f.updated_at!).getTime() - new Date(f.created_at!).getTime()), 0) / shippedFulfillments.length / 3600000
        : 0;

      const riskHeat: 'red' | 'yellow' | 'green' = overdueShipment > 5 || activeDisputes > 3 ? 'red'
        : overdueShipment > 2 || activeDisputes > 1 ? 'yellow' : 'green';

      return {
        gmv7d, gmv30d, pendingShipment, overdueShipment, inSettlement,
        heldTotal, activeDisputes, refundRate, avgFulfillmentTime, riskHeat,
        frozenVendors: (frozenRes.data || []).length,
        shippedCount: shippedFulfillments.length,
      };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ─── Financial Exposure Bar ───
export function useFinancialExposure() {
  return useQuery({
    queryKey: ['marketplace-financial-exposure'],
    queryFn: async () => {
      const now = new Date();
      const h48ago = new Date(now.getTime() - 48 * 3600000).toISOString();

      const [paidOrdersRes, overdueOrdersRes, payoutsRes, disputeOrdersRes] = await Promise.all([
        supabase.from('marketplace_orders').select('total').eq('payment_status', 'paid'),
        supabase.from('marketplace_orders').select('total').eq('payment_status', 'paid').lt('created_at', h48ago),
        supabase.from('wholesaler_payouts').select('net_amount, status, dispute_flag'),
        supabase.from('marketplace_orders').select('total').neq('dispute_status', 'none').not('dispute_status', 'is', null),
      ]);

      const pendingRevenue = (paidOrdersRes.data || []).reduce((s, o) => s + (o.total || 0), 0);
      const atRiskRevenue = (overdueOrdersRes.data || []).reduce((s, o) => s + (o.total || 0), 0);
      
      const payouts = payoutsRes.data || [];
      const heldPayoutTotal = payouts.filter(p => p.status === 'held').reduce((s, p) => s + (p.net_amount || 0), 0);
      const disputeTotal = (disputeOrdersRes.data || []).reduce((s, o) => s + (o.total || 0), 0);
      const potentialLiability = heldPayoutTotal + disputeTotal;
      
      const marketplaceFloat = payouts.filter(p => p.status === 'in_settlement').reduce((s, p) => s + (p.net_amount || 0), 0);

      return { pendingRevenue, atRiskRevenue, potentialLiability, marketplaceFloat };
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

// ─── System Mode Detection ───
export function useSystemMode() {
  return useQuery({
    queryKey: ['marketplace-system-mode'],
    queryFn: async () => {
      const now = new Date();
      const h48ago = new Date(now.getTime() - 48 * 3600000).toISOString();

      const [overdueRes, disputesRes, heldRes] = await Promise.all([
        supabase.from('marketplace_fulfillments').select('id', { count: 'exact', head: true }).eq('status', 'pending').lt('created_at', h48ago),
        supabase.from('marketplace_orders').select('id', { count: 'exact', head: true }).neq('dispute_status', 'none').not('dispute_status', 'is', null),
        supabase.from('wholesaler_payouts').select('net_amount').eq('status', 'held'),
      ]);

      const overdueCount = overdueRes.count || 0;
      const disputeCount = disputesRes.count || 0;
      const heldVolume = (heldRes.data || []).reduce((s, p) => s + (p.net_amount || 0), 0);

      if (overdueCount > 10 || disputeCount > 5 || heldVolume > 10000) return 'lockdown' as const;
      if (overdueCount > 3 || disputeCount > 2 || heldVolume > 3000) return 'heightened' as const;
      return 'operational' as const;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── Order Lifecycle Grid ───
export function useOrderLifecycle() {
  return useQuery({
    queryKey: ['marketplace-order-lifecycle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_orders')
        .select('id, user_id, wholesaler_id, payment_status, fulfillment_status, dispute_status, total, created_at, order_type')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const orderIds = (data || []).map(o => o.id);
      const [fulfillmentsRes, vendorPerfRes] = await Promise.all([
        orderIds.length > 0
          ? supabase.from('marketplace_fulfillments').select('order_id, wholesaler_id').in('order_id', orderIds)
          : Promise.resolve({ data: [] }),
        supabase.from('v_vendor_performance_summary' as any).select('*'),
      ]);

      const vendorCounts: Record<string, number> = {};
      ((fulfillmentsRes as any).data || []).forEach((f: any) => {
        vendorCounts[f.order_id] = (vendorCounts[f.order_id] || 0) + 1;
      });

      const vendorPerf: Record<string, any> = {};
      ((vendorPerfRes as any).data || []).forEach((v: any) => {
        vendorPerf[v.vendor_id] = v;
      });

      const now = Date.now();
      return (data || []).map(o => {
        const hoursSincePaid = o.created_at ? (now - new Date(o.created_at).getTime()) / 3600000 : 0;
        const vPerf = o.wholesaler_id ? vendorPerf[o.wholesaler_id] : null;
        const hasDispute = o.dispute_status && o.dispute_status !== 'none';
        
        // Order Risk Score (0-100)
        let riskScore = 0;
        if (hoursSincePaid > 72) riskScore += 30;
        else if (hoursSincePaid > 48) riskScore += 20;
        else if (hoursSincePaid > 24) riskScore += 10;
        if (hasDispute) riskScore += 25;
        if (vPerf) {
          if (Number(vPerf.dispute_rate || 0) > 5) riskScore += 15;
          if (Number(vPerf.avg_ship_time_hours || 0) > 48) riskScore += 10;
          if (Number(vPerf.on_time_percentage || 100) < 80) riskScore += 10;
          if (Number(vPerf.total_liability || 0) > 0) riskScore += 10;
        }
        riskScore = Math.min(100, riskScore);

        // Recommended actions
        const recommendations: Array<{ action: string; reason: string; impact: string; reduction: number }> = [];
        if (hoursSincePaid > 48 && o.fulfillment_status === 'pending') {
          recommendations.push({ action: 'escalate_fulfillment', reason: `${Math.round(hoursSincePaid)}h since payment, still pending`, impact: 'Reduce fulfillment delay', reduction: 15 });
        }
        if (hasDispute) {
          recommendations.push({ action: 'hold_payout', reason: 'Active dispute on order', impact: `Protect $${(o.total || 0).toFixed(2)} in funds`, reduction: 20 });
        }
        if (vPerf && Number(vPerf.dispute_rate || 0) > 10) {
          recommendations.push({ action: 'freeze_vendor', reason: `Vendor dispute rate at ${Number(vPerf.dispute_rate).toFixed(1)}%`, impact: 'Prevent further exposure', reduction: 25 });
        }
        if (vPerf && Number(vPerf.on_time_percentage || 100) < 70 && hoursSincePaid > 24) {
          recommendations.push({ action: 'escalate_fulfillment', reason: `Vendor on-time rate ${Number(vPerf.on_time_percentage).toFixed(0)}%`, impact: 'Proactive vendor management', reduction: 10 });
        }

        return {
          ...o,
          vendorCount: vendorCounts[o.id] || 0,
          riskFlag: !!hasDispute,
          riskScore,
          riskLevel: riskScore >= 81 ? 'critical' as const : riskScore >= 51 ? 'high' as const : riskScore >= 21 ? 'medium' as const : 'low' as const,
          hoursSincePaid,
          vendorPerformance: vPerf,
          recommendations,
        };
      });
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
        const hoursElapsed = f.created_at ? (now - new Date(f.created_at).getTime()) / 3600000 : 0;
        return { ...f, hoursElapsed, severity: hoursElapsed > 48 ? 'critical' as const : hoursElapsed > 24 ? 'warning' as const : 'ok' as const };
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
        .select('id, wholesaler_id, user_id, dispute_status, dispute_reason, dispute_opened_at, payment_status, total')
        .neq('dispute_status', 'none')
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Settlement Pipeline ───
export function useSettlementPipeline() {
  return useQuery({
    queryKey: ['marketplace-settlement-pipeline'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('id, wholesaler_id, order_id, net_amount, status, settlement_start_at, settlement_release_at, dispute_flag, hold_reason, created_at')
        .in('status', ['in_settlement', 'held', 'reversed', 'approved'])
        .order('created_at', { ascending: false });

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
        .from('v_vendor_performance_summary' as any)
        .select('*')
        .order('risk_score', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

// ─── Integrity / Anomaly Detection ───
export function useIntegrityAnomalies() {
  return useQuery({
    queryKey: ['marketplace-integrity-anomalies'],
    queryFn: async () => {
      const now = new Date();
      const h48ago = new Date(now.getTime() - 48 * 3600000).toISOString();

      const [overdueRes, allFulfillmentsRes, allPayoutsRes] = await Promise.all([
        supabase.from('marketplace_orders')
          .select('id, total, payment_status, created_at, wholesaler_id')
          .eq('payment_status', 'paid')
          .lt('created_at', h48ago),
        supabase.from('marketplace_fulfillments')
          .select('id, order_id, status, tracking_number'),
        supabase.from('wholesaler_payouts')
          .select('id, order_id, net_amount, status'),
      ]);

      const fulfillmentsByOrder = new Map<string, any[]>();
      (allFulfillmentsRes.data || []).forEach(f => {
        const arr = fulfillmentsByOrder.get(f.order_id) || [];
        arr.push(f);
        fulfillmentsByOrder.set(f.order_id, arr);
      });

      const payoutsByOrder = new Map<string, any[]>();
      (allPayoutsRes.data || []).forEach(p => {
        const arr = payoutsByOrder.get(p.order_id) || [];
        arr.push(p);
        payoutsByOrder.set(p.order_id, arr);
      });

      const anomalies: Array<{ type: string; order_id: string; detail: string; severity: string }> = [];

      (overdueRes.data || []).forEach(o => {
        const ffs = fulfillmentsByOrder.get(o.id) || [];
        if (ffs.length === 0) {
          anomalies.push({ type: 'no_fulfillment', order_id: o.id, detail: 'Paid order has no fulfillment record', severity: 'critical' });
        }
        ffs.forEach(f => {
          if (f.status === 'shipped' && !f.tracking_number) {
            anomalies.push({ type: 'no_tracking', order_id: o.id, detail: 'Shipped fulfillment missing tracking number', severity: 'warning' });
          }
        });
        const payouts = payoutsByOrder.get(o.id) || [];
        if (payouts.length === 0) {
          anomalies.push({ type: 'no_payout', order_id: o.id, detail: 'Order missing payout record', severity: 'warning' });
        }
        payouts.forEach(p => {
          if ((p.net_amount || 0) < 0) {
            anomalies.push({ type: 'negative_payout', order_id: o.id, detail: `Negative net payout: $${p.net_amount}`, severity: 'critical' });
          }
        });
      });

      return anomalies;
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

// ─── Admin Actions (with actual side effects) ───
export function useAdminAction() {
  const queryClient = useQueryClient();

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

      // Execute the side effect
      if (params.action_type === 'hold_payout' && params.related_order_id) {
        await supabase.from('wholesaler_payouts')
          .update({ status: 'held', hold_reason: params.reason })
          .eq('order_id', params.related_order_id);
      } else if (params.action_type === 'release_payout' && params.related_order_id) {
        await supabase.from('wholesaler_payouts')
          .update({ status: 'approved', hold_reason: null })
          .eq('order_id', params.related_order_id)
          .eq('status', 'held');
      } else if (params.action_type === 'freeze_vendor' && params.related_vendor_id) {
        await supabase.from('wholesalers')
          .update({ is_frozen: true } as any)
          .eq('id', params.related_vendor_id);
      } else if (params.action_type === 'unfreeze_vendor' && params.related_vendor_id) {
        await supabase.from('wholesalers')
          .update({ is_frozen: false } as any)
          .eq('id', params.related_vendor_id);
      } else if (params.action_type === 'reverse_payout' && params.related_order_id) {
        await supabase.from('wholesaler_payouts')
          .update({ status: 'reversed' })
          .eq('order_id', params.related_order_id);
      } else if (params.action_type === 'convert_to_liability' && params.related_order_id && params.related_vendor_id) {
        const { data: payouts } = await supabase.from('wholesaler_payouts')
          .select('net_amount')
          .eq('order_id', params.related_order_id)
          .limit(1);
        const amount = payouts?.[0]?.net_amount || 0;
        if (amount > 0) {
          await supabase.from('vendor_liabilities').insert({
            wholesaler_id: params.related_vendor_id,
            order_id: params.related_order_id,
            amount,
            reason: params.reason,
            status: 'pending',
          } as any);
        }
      } else if (params.action_type === 'marketplace_freeze') {
        await supabase.from('marketplace_config' as any)
          .update({ value: { active: true }, updated_by: user.id } as any)
          .eq('key', 'marketplace_freeze');
      } else if (params.action_type === 'marketplace_unfreeze') {
        await supabase.from('marketplace_config' as any)
          .update({ value: { active: false }, updated_by: user.id } as any)
          .eq('key', 'marketplace_freeze');
      }

      // Log the action
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
      toast.success('Action executed and logged');
      queryClient.invalidateQueries({ queryKey: ['marketplace-control-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-held-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-settlement-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['vendor-performance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-admin-action-log'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-order-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-kill-switch'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-financial-exposure'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-system-mode'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Action failed');
    },
  });
}

// ─── Admin Action Log ───
export function useAdminActionLog(filters?: { actionType?: string; orderId?: string; vendorId?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['marketplace-admin-action-log', filters],
    queryFn: async () => {
      let query = supabase
        .from('marketplace_admin_actions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.actionType) query = query.eq('action_type', filters.actionType);
      if (filters?.orderId) query = query.eq('related_order_id', filters.orderId);
      if (filters?.vendorId) query = query.eq('related_vendor_id', filters.vendorId);
      if (filters?.dateFrom) query = query.gte('created_at', filters.dateFrom);
      if (filters?.dateTo) query = query.lte('created_at', filters.dateTo);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Message Oversight (upgraded) ───
export function useMessageOversight(filters?: { type?: string; orderId?: string; vendorId?: string }) {
  return useQuery({
    queryKey: ['marketplace-message-oversight', filters],
    queryFn: async () => {
      let query = supabase
        .from('order_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (filters?.type === 'dispute_related') query = query.eq('message_type', 'dispute_related');
      if (filters?.orderId) query = query.eq('order_id', filters.orderId);
      if (filters?.vendorId) query = query.eq('vendor_id', filters.vendorId);

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    staleTime: 30_000,
  });
}

// ─── Kill Switch ───
export function useMarketplaceKillSwitch() {
  return useQuery({
    queryKey: ['marketplace-kill-switch'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketplace_config' as any)
        .select('value')
        .eq('key', 'marketplace_freeze')
        .single();

      if (error || !data) return { active: false };
      const val = (data as any)?.value;
      return val || { active: false };
    },
    staleTime: 10_000,
  });
}

// ─── Refresh materialized view ───
export function useRefreshVendorPerformance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('refresh_vendor_performance' as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vendor performance data refreshed');
      queryClient.invalidateQueries({ queryKey: ['vendor-performance-summary'] });
    },
    onError: () => {
      toast.error('Failed to refresh — function may not exist yet');
    },
  });
}
