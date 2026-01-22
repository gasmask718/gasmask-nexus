/**
 * Commission Ledger Hook - Single source of truth for all commission data
 * Read-only, RLS-scoped, zero client-side calculations
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'reversed';
export type SourceChannel = 'store_order' | 'wholesale_order' | 'affiliate' | 'team_override';

export interface CommissionLedgerEntry {
  id: string;
  ambassador_id: string;
  store_id: string | null;
  source_channel: SourceChannel;
  source_id: string;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  commission_plan_id: string | null;
  status: CommissionStatus;
  earned_at: string;
  approved_at: string | null;
  paid_at: string | null;
  reversal_of: string | null;
  created_at: string;
  // Joined fields
  store_name?: string;
  plan_name?: string;
}

export interface CommissionTotals {
  ambassador_id: string;
  pending_total: number;
  approved_total: number;
  paid_total: number;
  reversed_total: number;
  lifetime_total: number;
  pending_count: number;
  approved_count: number;
  paid_count: number;
}

export interface ChannelBreakdown {
  ambassador_id: string;
  source_channel: SourceChannel;
  channel_total: number;
  entry_count: number;
}

export interface PayoutBatch {
  id: string;
  ambassador_id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  status: 'pending' | 'paid' | 'failed';
  paid_at: string | null;
  created_at: string;
}

interface UseCommissionLedgerOptions {
  storeId?: string;
  status?: CommissionStatus;
  sourceChannel?: SourceChannel;
  limit?: number;
}

/**
 * Fetch commission ledger entries with optional filters
 * RLS automatically scopes to ambassador's own data
 */
export function useCommissionLedger(options: UseCommissionLedgerOptions = {}) {
  const { storeId, status, sourceChannel, limit = 50 } = options;

  return useQuery({
    queryKey: ['commission-ledger', storeId, status, sourceChannel, limit],
    queryFn: async () => {
      let query = supabase
        .from('commission_ledger')
        .select(`
          *,
          store_master(store_name),
          commission_plans(name)
        `)
        .order('earned_at', { ascending: false })
        .limit(limit);

      if (storeId) {
        query = query.eq('store_id', storeId);
      }
      if (status) {
        query = query.eq('status', status);
      }
      if (sourceChannel) {
        query = query.eq('source_channel', sourceChannel);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform to include joined fields
      return (data || []).map((entry: any) => ({
        ...entry,
        store_name: entry.store_master?.store_name || null,
        plan_name: entry.commission_plans?.name || null,
      })) as CommissionLedgerEntry[];
    },
  });
}

/**
 * Fetch aggregated commission totals from SQL view
 * Zero client-side math - totals computed in database
 */
export function useCommissionTotals() {
  return useQuery({
    queryKey: ['commission-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_commission_totals')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

      return (data || {
        pending_total: 0,
        approved_total: 0,
        paid_total: 0,
        reversed_total: 0,
        lifetime_total: 0,
        pending_count: 0,
        approved_count: 0,
        paid_count: 0,
      }) as CommissionTotals;
    },
  });
}

/**
 * Fetch channel breakdown from SQL view
 */
export function useChannelBreakdown() {
  return useQuery({
    queryKey: ['commission-channel-breakdown'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_commission_by_channel')
        .select('*');

      if (error) throw error;

      // Transform to object for easy access
      const breakdown: Record<SourceChannel, number> = {
        store_order: 0,
        wholesale_order: 0,
        affiliate: 0,
        team_override: 0,
      };

      (data || []).forEach((row: any) => {
        if (row.source_channel in breakdown) {
          breakdown[row.source_channel as SourceChannel] = Number(row.channel_total) || 0;
        }
      });

      return breakdown;
    },
  });
}

/**
 * Fetch store-specific commission totals
 */
export function useStoreCommissionTotals(storeId?: string) {
  return useQuery({
    queryKey: ['store-commission-totals', storeId],
    queryFn: async () => {
      if (!storeId) return null;

      const { data, error } = await supabase
        .from('store_commission_totals')
        .select('*')
        .eq('store_id', storeId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return data || {
        pending_total: 0,
        approved_total: 0,
        paid_total: 0,
        lifetime_total: 0,
        entry_count: 0,
        last_commission_at: null,
      };
    },
    enabled: !!storeId,
  });
}

/**
 * Fetch payout batches
 */
export function usePayoutHistory() {
  return useQuery({
    queryKey: ['payout-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_payout_batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutBatch[];
    },
  });
}

/**
 * Combined hook for commission page - all data in one call
 */
export function useCommissionPage() {
  const ledger = useCommissionLedger({ limit: 100 });
  const totals = useCommissionTotals();
  const channels = useChannelBreakdown();
  const payouts = usePayoutHistory();

  return {
    ledger: ledger.data || [],
    totals: totals.data || {
      pending_total: 0,
      approved_total: 0,
      paid_total: 0,
      reversed_total: 0,
      lifetime_total: 0,
      pending_count: 0,
      approved_count: 0,
      paid_count: 0,
    },
    channels: channels.data || {
      store_order: 0,
      wholesale_order: 0,
      affiliate: 0,
      team_override: 0,
    },
    payouts: payouts.data || [],
    isLoading: ledger.isLoading || totals.isLoading || channels.isLoading,
    isError: ledger.isError || totals.isError || channels.isError,
  };
}
