import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface WholesalerPayout {
  id: string;
  wholesaler_id: string | null;
  amount: number;
  platform_fee: number | null;
  net_amount: number;
  status: string | null;
  payout_method: string | null;
  payout_reference: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  approved_at: string | null;
  settlement_start_at: string | null;
  settlement_release_at: string | null;
  hold_reason: string | null;
  reversal_reason: string | null;
  created_at: string | null;
}

export interface FinancialSummary {
  totalEarnings: number;
  pendingPayout: number;
  approvedPendingDeliveryPayout: number;
  inSettlementPayout: number;
  approvedPayout: number;
  paidPayout: number;
  heldPayout: number;
  pendingCount: number;
  approvedPendingDeliveryCount: number;
  inSettlementCount: number;
  approvedCount: number;
  paidCount: number;
  heldCount: number;
  totalOrders: number;
  platformFees: number;
  averageOrderValue: number;
}

export function useWholesalerPayouts() {
  const { profile } = useWholesalerProfile();
  const queryClient = useQueryClient();

  const payoutsQuery = useQuery({
    queryKey: ['wholesaler-payouts', profile?.id],
    queryFn: async () => {
      if (!profile) return [];

      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('*')
        .eq('wholesaler_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as WholesalerPayout[];
    },
    enabled: !!profile,
  });

  const financialSummaryQuery = useQuery({
    queryKey: ['wholesaler-financial-summary', profile?.id],
    queryFn: async () => {
      if (!profile) return null;

      // Get all payouts grouped by status
      const { data: allPayouts, error: payoutsError } = await supabase
        .from('wholesaler_payouts')
        .select('net_amount, platform_fee, amount, status')
        .eq('wholesaler_id', profile.id);

      if (payoutsError) throw payoutsError;

      const rows = allPayouts || [];
      const byStatus = (s: string) => rows.filter(r => r.status === s);
      const sumNet = (arr: typeof rows) => arr.reduce((s, r) => s + Number(r.net_amount || 0), 0);

      const pending = byStatus('pending');
      const approvedPendingDelivery = byStatus('approved_pending_delivery');
      const inSettlement = byStatus('in_settlement');
      const approved = byStatus('approved');
      const paid = byStatus('paid');
      const held = byStatus('held');

      const totalEarnings = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
      const platformFees = rows.reduce((s, r) => s + Number(r.platform_fee || 0), 0);

      // Get order count
      const { data: orders } = await supabase
        .from('marketplace_orders')
        .select('id')
        .eq('wholesaler_id', profile.id)
        .eq('payment_status', 'paid');

      const totalOrders = orders?.length || 0;

      return {
        totalEarnings,
        pendingPayout: sumNet(pending),
        approvedPendingDeliveryPayout: sumNet(approvedPendingDelivery),
        inSettlementPayout: sumNet(inSettlement),
        approvedPayout: sumNet(approved),
        paidPayout: sumNet(paid),
        heldPayout: sumNet(held),
        pendingCount: pending.length,
        approvedPendingDeliveryCount: approvedPendingDelivery.length,
        inSettlementCount: inSettlement.length,
        approvedCount: approved.length,
        paidCount: paid.length,
        heldCount: held.length,
        totalOrders,
        platformFees,
        averageOrderValue: totalOrders > 0 ? totalEarnings / totalOrders : 0,
      } as FinancialSummary;
    },
    enabled: !!profile,
  });

  const requestPayout = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error('No wholesaler profile');

      // Calculate pending earnings
      const { data: orders } = await supabase
        .from('marketplace_orders')
        .select('subtotal')
        .eq('wholesaler_id', profile.id)
        .eq('payment_status', 'paid')
        .eq('fulfillment_status', 'delivered');

      const totalEarnings = orders?.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0) || 0;
      const platformFee = totalEarnings * 0.10; // 10% platform fee
      const netAmount = totalEarnings - platformFee;

      if (netAmount < 50) {
        throw new Error('Minimum payout amount is $50');
      }

      const { error } = await supabase
        .from('wholesaler_payouts')
        .insert([{
          wholesaler_id: profile.id,
          amount: totalEarnings,
          platform_fee: platformFee,
          net_amount: netAmount,
          status: 'pending',
          period_end: new Date().toISOString().split('T')[0],
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wholesaler-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['wholesaler-financial-summary'] });
      toast.success('Payout requested');
    },
    onError: (error) => {
      toast.error(`Failed to request payout: ${error.message}`);
    },
  });

  return {
    payouts: payoutsQuery.data || [],
    financialSummary: financialSummaryQuery.data,
    isLoading: payoutsQuery.isLoading || financialSummaryQuery.isLoading,
    requestPayout: requestPayout.mutateAsync,
    isRequesting: requestPayout.isPending,
  };
}
