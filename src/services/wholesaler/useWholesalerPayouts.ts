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
  created_at: string | null;
}

export interface FinancialSummary {
  totalEarnings: number;
  pendingPayout: number;
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

      // Get all completed orders
      const { data: orders, error: ordersError } = await supabase
        .from('marketplace_orders')
        .select('total, subtotal')
        .eq('wholesaler_id', profile.id)
        .eq('payment_status', 'paid');

      if (ordersError) throw ordersError;

      // Get pending payouts
      const { data: pendingPayouts, error: payoutsError } = await supabase
        .from('wholesaler_payouts')
        .select('net_amount')
        .eq('wholesaler_id', profile.id)
        .eq('status', 'pending');

      if (payoutsError) throw payoutsError;

      // Get paid payouts
      const { data: paidPayouts, error: paidError } = await supabase
        .from('wholesaler_payouts')
        .select('net_amount, platform_fee')
        .eq('wholesaler_id', profile.id)
        .eq('status', 'paid');

      if (paidError) throw paidError;

      const totalOrders = orders?.length || 0;
      const totalEarnings = orders?.reduce((sum, o) => sum + (Number(o.subtotal) || 0), 0) || 0;
      const pendingPayout = pendingPayouts?.reduce((sum, p) => sum + (Number(p.net_amount) || 0), 0) || 0;
      const platformFees = paidPayouts?.reduce((sum, p) => sum + (Number(p.platform_fee) || 0), 0) || 0;
      const averageOrderValue = totalOrders > 0 ? totalEarnings / totalOrders : 0;

      return {
        totalEarnings,
        pendingPayout,
        totalOrders,
        platformFees,
        averageOrderValue,
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
