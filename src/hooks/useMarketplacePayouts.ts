import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

export interface MarketplacePayout {
  id: string;
  wholesaler_id: string | null;
  order_id: string | null;
  amount: number;
  platform_fee: number | null;
  net_amount: number;
  status: string | null;
  approved_at: string | null;
  paid_at: string | null;
  hold_reason: string | null;
  reversal_reason: string | null;
  created_at: string | null;
  wholesaler?: {
    id: string;
    business_name: string | null;
    contact_name: string | null;
  } | null;
}

export function useMarketplacePayouts(statusFilter?: string) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const payoutsQuery = useQuery({
    queryKey: ['marketplace-payouts-admin', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('wholesaler_payouts')
        .select(`
          *,
          wholesaler:wholesaler_profiles(id, business_name, contact_name)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map((p: any) => ({
        ...p,
        wholesaler: Array.isArray(p.wholesaler) ? p.wholesaler[0] : p.wholesaler,
      })) as MarketplacePayout[];
    },
  });

  const statsQuery = useQuery({
    queryKey: ['marketplace-payout-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wholesaler_payouts')
        .select('status, net_amount, amount, platform_fee');
      if (error) throw error;

      const rows = data || [];
      const pending = rows.filter(r => r.status === 'pending');
      const approved = rows.filter(r => r.status === 'approved');
      const paid = rows.filter(r => r.status === 'paid');
      const held = rows.filter(r => r.status === 'held');

      return {
        pendingCount: pending.length,
        pendingAmount: pending.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        approvedCount: approved.length,
        approvedAmount: approved.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        paidCount: paid.length,
        paidAmount: paid.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        heldCount: held.length,
        heldAmount: held.reduce((s, r) => s + Number(r.net_amount || 0), 0),
        totalFees: rows.reduce((s, r) => s + Number(r.platform_fee || 0), 0),
      };
    },
  });

  const logEvent = async (payoutId: string, action: string, oldStatus: string, newStatus: string, reason?: string) => {
    await supabase.from('marketplace_payout_events').insert([{
      payout_id: payoutId,
      actor_user_id: user?.id || '',
      action,
      old_status: oldStatus,
      new_status: newStatus,
      reason: reason || null,
    }]);
  };

  const markPaid = useMutation({
    mutationFn: async (payoutId: string) => {
      // Verify it's approved first
      const { data: payout } = await supabase
        .from('wholesaler_payouts')
        .select('status')
        .eq('id', payoutId)
        .single();

      if (payout?.status !== 'approved') {
        throw new Error('Can only pay approved payouts');
      }

      const { error } = await supabase
        .from('wholesaler_payouts')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', payoutId);
      if (error) throw error;

      await logEvent(payoutId, 'paid', 'approved', 'paid');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-payouts-admin'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-payout-stats'] });
      toast.success('Payout marked as paid');
    },
    onError: (e) => toast.error(e.message),
  });

  const holdPayout = useMutation({
    mutationFn: async ({ payoutId, reason }: { payoutId: string; reason: string }) => {
      const { data: payout } = await supabase
        .from('wholesaler_payouts')
        .select('status')
        .eq('id', payoutId)
        .single();

      const oldStatus = payout?.status || 'unknown';

      const { error } = await supabase
        .from('wholesaler_payouts')
        .update({ status: 'held', hold_reason: reason })
        .eq('id', payoutId);
      if (error) throw error;

      await logEvent(payoutId, 'held', oldStatus, 'held', reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-payouts-admin'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-payout-stats'] });
      toast.success('Payout placed on hold');
    },
    onError: (e) => toast.error(e.message),
  });

  const reversePayout = useMutation({
    mutationFn: async ({ payoutId, reason }: { payoutId: string; reason: string }) => {
      const { data: payout } = await supabase
        .from('wholesaler_payouts')
        .select('status')
        .eq('id', payoutId)
        .single();

      const oldStatus = payout?.status || 'unknown';

      const { error } = await supabase
        .from('wholesaler_payouts')
        .update({ status: 'reversed', reversal_reason: reason })
        .eq('id', payoutId);
      if (error) throw error;

      await logEvent(payoutId, 'reversed', oldStatus, 'reversed', reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marketplace-payouts-admin'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-payout-stats'] });
      toast.success('Payout reversed');
    },
    onError: (e) => toast.error(e.message),
  });

  return {
    payouts: payoutsQuery.data || [],
    stats: statsQuery.data,
    isLoading: payoutsQuery.isLoading,
    markPaid: markPaid.mutateAsync,
    holdPayout: holdPayout.mutateAsync,
    reversePayout: reversePayout.mutateAsync,
    isProcessing: markPaid.isPending || holdPayout.isPending || reversePayout.isPending,
  };
}
