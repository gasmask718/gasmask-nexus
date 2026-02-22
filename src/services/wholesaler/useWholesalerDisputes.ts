import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWholesalerProfile } from "./useWholesalerProfile";

export interface VendorDispute {
  orderId: string;
  orderIdShort: string;
  disputeStatus: string;
  disputeReason: string | null;
  disputeOpenedAt: string | null;
  disputeResolvedAt: string | null;
  payoutStatus: string | null;
  holdReason: string | null;
  reversalReason: string | null;
  amount: number;
}

export function useWholesalerDisputes() {
  const { profile } = useWholesalerProfile();

  const disputesQuery = useQuery({
    queryKey: ['wholesaler-disputes', profile?.id],
    queryFn: async (): Promise<VendorDispute[]> => {
      if (!profile) return [];

      // Fetch orders with active disputes for this vendor
      const { data: orders, error } = await supabase
        .from('marketplace_orders')
        .select('id, dispute_status, dispute_reason, dispute_opened_at, dispute_resolved_at, subtotal')
        .eq('wholesaler_id', profile.id)
        .neq('dispute_status', 'none')
        .order('dispute_opened_at', { ascending: false });

      if (error) throw error;
      if (!orders?.length) return [];

      // Get related payouts
      const orderIds = orders.map(o => o.id);
      const { data: payouts } = await supabase
        .from('wholesaler_payouts')
        .select('order_id, status, hold_reason, reversal_reason')
        .eq('wholesaler_id', profile.id)
        .in('dispute_linked_order_id', orderIds);

      const payoutMap = new Map((payouts || []).map(p => [p.order_id, p]));

      return orders.map(o => {
        const payout = payoutMap.get(o.id);
        return {
          orderId: o.id,
          orderIdShort: o.id.slice(0, 8),
          disputeStatus: o.dispute_status || 'unknown',
          disputeReason: o.dispute_reason,
          disputeOpenedAt: o.dispute_opened_at,
          disputeResolvedAt: o.dispute_resolved_at,
          payoutStatus: payout?.status || null,
          holdReason: payout?.hold_reason || null,
          reversalReason: payout?.reversal_reason || null,
          amount: Number(o.subtotal || 0),
        };
      });
    },
    enabled: !!profile,
  });

  return {
    disputes: disputesQuery.data || [],
    isLoading: disputesQuery.isLoading,
    hasDisputes: (disputesQuery.data?.length || 0) > 0,
  };
}
