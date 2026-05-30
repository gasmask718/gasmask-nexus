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
  source_name: string | null; // Human-readable name for statements
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  commission_plan_id: string | null;
  status: CommissionStatus;
  earned_at: string;
  approved_at: string | null;
  paid_at: string | null;
  reversal_of: string | null;
  payout_batch_id: string | null;
  created_at: string;
  // Joined fields
  store_name?: string;
  plan_name?: string;
}

export interface PayoutEligibleCommission {
  id: string;
  ambassador_id: string;
  store_id: string | null;
  source_channel: SourceChannel;
  source_id: string;
  source_name: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  earned_at: string;
  approved_at: string | null;
  ambassador_name: string;
  store_name: string | null;
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

export type PayoutBatchStatus = 'draft' | 'ready' | 'processing' | 'paid' | 'failed' | 'void';

export interface PayoutBatch {
  id: string;
  ambassador_id: string;
  period_start: string;
  period_end: string;
  currency: string;
  subtotal_amount: number;
  adjustments_amount: number;
  total_amount: number;
  statement_url: string | null;
  export_ref: string | null;
  status: PayoutBatchStatus;
  paid_at: string | null;
  created_at: string;
  items_count: number;
}

export interface UnpaidTotals {
  ambassador_id: string;
  unpaid_approved_total: number;
  unpaid_approved_count: number;
}

export interface PayoutMethod {
  id: string;
  ambassador_id: string;
  method_type: 'ach' | 'stripe_connect' | 'paypal' | 'cashapp' | 'zelle' | 'manual';
  method_label: string | null;
  is_default: boolean;
  external_ref: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

interface UseCommissionLedgerOptions {
  storeId?: string;
  status?: CommissionStatus;
  sourceChannel?: SourceChannel;
  limit?: number;
  /**
   * Defense-in-depth: when provided, explicitly scopes ledger to this ambassador
   * at the app layer in addition to RLS. Pass `useEffectiveAmbassadorId()` from
   * any ambassador-portal page so commissions can never leak even if an RLS
   * policy regresses.
   */
  ambassadorId?: string | null;
}

/**
 * Fetch commission ledger entries with optional filters.
 * RLS scopes to the caller's ambassador rows; pass `ambassadorId` for an
 * explicit second layer of scoping (see UseCommissionLedgerOptions).
 */
export function useCommissionLedger(options: UseCommissionLedgerOptions = {}) {
  const { storeId, status, sourceChannel, limit = 50, ambassadorId } = options;

  return useQuery({
    queryKey: ['commission-ledger', ambassadorId, storeId, status, sourceChannel, limit],
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

      if (ambassadorId) {
        query = query.eq('ambassador_id', ambassadorId);
      }
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

      return (data || []).map((entry: any) => ({
        ...entry,
        store_name: entry.store_master?.store_name || null,
        plan_name: entry.commission_plans?.name || null,
      })) as CommissionLedgerEntry[];
    },
    // If the caller opted into explicit scoping but ambassadorId isn't resolved
    // yet, wait rather than silently fall back to RLS-only.
    enabled: ambassadorId === undefined ? true : !!ambassadorId,
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
 * Fetch payout batches from ambassador_payout_history view
 */
export function usePayoutHistory() {
  return useQuery({
    queryKey: ['payout-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_payout_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutBatch[];
    },
  });
}

/**
 * Fetch unpaid approved commission totals
 */
export function useUnpaidTotals() {
  return useQuery({
    queryKey: ['unpaid-totals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_unpaid_commission_totals')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return (data || {
        unpaid_approved_total: 0,
        unpaid_approved_count: 0,
      }) as UnpaidTotals;
    },
  });
}

/**
 * Fetch ambassador payout methods
 */
export function usePayoutMethods() {
  return useQuery({
    queryKey: ['payout-methods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ambassador_payout_methods')
        .select('*')
        .eq('active', true)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutMethod[];
    },
  });
}

export interface PayoutExportRow {
  payout_batch_id: string;
  ambassador_name: string;
  ambassador_email: string;
  payout_method: string | null;
  payout_destination: string | null;
  period_start: string;
  period_end: string;
  source_channel: string;
  source_id: string;
  store_name: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  earned_at: string;
  batch_total: number;
  currency: string;
}

export interface PayoutStatement {
  batch_id: string;
  ambassador_id: string;
  ambassador_name: string;
  ambassador_email: string | null;
  period_start: string;
  period_end: string;
  paid_at: string | null;
  currency: string;
  subtotal: number;
  adjustments: number;
  total: number;
  status: PayoutBatchStatus;
  statement_url: string | null;
  line_items: Array<{
    earned_at: string;
    source_channel: string;
    store_name: string;
    gross_amount: number;
    rate: number;
    commission: number;
  }>;
  items_count: number;
}

/**
 * Export payout batch to CSV-ready data
 */
export async function exportPayoutBatchCSV(batchId: string): Promise<PayoutExportRow[]> {
  const { data, error } = await supabase
    .rpc('export_payout_batch_csv', { p_batch_id: batchId });
  
  if (error) throw error;
  return (data || []) as PayoutExportRow[];
}

/**
 * Get payout statement data for PDF generation
 */
export async function getPayoutStatement(batchId: string): Promise<PayoutStatement | null> {
  const { data, error } = await supabase
    .rpc('get_payout_statement', { p_batch_id: batchId });
  
  if (error) throw error;
  return data as unknown as PayoutStatement | null;
}

/**
 * Export payouts by period (bulk export)
 */
export async function exportPayoutsByPeriod(startDate: string, endDate: string): Promise<PayoutExportRow[]> {
  const { data, error } = await supabase
    .rpc('export_payouts_by_period', { p_start: startDate, p_end: endDate });
  
  if (error) throw error;
  return (data || []) as PayoutExportRow[];
}

/**
 * Convert export rows to CSV string
 */
export function convertToCSV(rows: PayoutExportRow[]): string {
  if (rows.length === 0) return '';
  
  const headers = [
    'Batch ID',
    'Ambassador Name',
    'Ambassador Email',
    'Payout Method',
    'Payout Destination',
    'Period Start',
    'Period End',
    'Source Channel',
    'Source ID',
    'Store Name',
    'Gross Amount',
    'Commission Rate (%)',
    'Commission Amount',
    'Earned At',
    'Batch Total',
    'Currency'
  ];
  
  const csvRows = rows.map(row => [
    row.payout_batch_id,
    row.ambassador_name,
    row.ambassador_email || '',
    row.payout_method || '',
    row.payout_destination || '',
    row.period_start,
    row.period_end,
    row.source_channel,
    row.source_id,
    row.store_name || '',
    row.gross_amount.toFixed(2),
    row.commission_rate.toFixed(2),
    row.commission_amount.toFixed(2),
    row.earned_at,
    row.batch_total.toFixed(2),
    row.currency
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
  
  return [headers.join(','), ...csvRows].join('\n');
}

/**
 * Download CSV file
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Combined hook for commission page - all data in one call
 */
export function useCommissionPage() {
  const ledger = useCommissionLedger({ limit: 100 });
  const totals = useCommissionTotals();
  const channels = useChannelBreakdown();
  const payouts = usePayoutHistory();
  const unpaid = useUnpaidTotals();
  const methods = usePayoutMethods();

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
    unpaid: unpaid.data || {
      unpaid_approved_total: 0,
      unpaid_approved_count: 0,
    },
    payoutMethods: methods.data || [],
    isLoading: ledger.isLoading || totals.isLoading || channels.isLoading || payouts.isLoading,
    isError: ledger.isError || totals.isError || channels.isError || payouts.isError,
  };
}

// =====================================================
// LEDGER MANAGEMENT FUNCTIONS (Admin Operations)
// =====================================================

/**
 * Approve a single pending commission
 */
export async function approveCommission(ledgerId: string): Promise<void> {
  const { error } = await supabase.rpc('approve_commission', {
    p_ledger_id: ledgerId
  });
  if (error) throw error;
}

/**
 * Bulk approve all pending commissions for an ambassador (or all if null)
 */
export async function bulkApproveCommissions(
  ambassadorId?: string,
  beforeDate?: Date
): Promise<number> {
  const { data, error } = await supabase.rpc('bulk_approve_commissions', {
    p_ambassador_id: ambassadorId || null,
    p_before_date: beforeDate?.toISOString() || new Date().toISOString()
  });
  if (error) throw error;
  return data as number;
}

/**
 * Create a reversal for a commission entry
 */
export async function createCommissionReversal(
  ledgerId: string,
  reason?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('create_commission_reversal', {
    p_ledger_id: ledgerId,
    p_reason: reason || 'Manual reversal'
  });
  if (error) throw error;
  return data as string;
}

/**
 * Fetch payout-eligible commissions (approved, unpaid, positive amount)
 */
export function usePayoutEligibleCommissions() {
  return useQuery({
    queryKey: ['payout-eligible-commissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payout_eligible_commissions')
        .select('*')
        .order('earned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as PayoutEligibleCommission[];
    },
  });
}

/**
 * Create a payout batch for an ambassador
 */
export async function createPayoutBatch(
  ambassadorId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<string> {
  const { data, error } = await supabase.rpc('create_payout_batch_for_ambassador', {
    p_ambassador_id: ambassadorId,
    p_period_start: periodStart.toISOString().split('T')[0],
    p_period_end: periodEnd.toISOString().split('T')[0]
  });
  if (error) throw error;
  return data as string;
}

/**
 * Finalize a payout batch (lock for payment)
 */
export async function finalizePayoutBatch(batchId: string): Promise<void> {
  const { error } = await supabase.rpc('finalize_payout_batch', {
    p_batch_id: batchId
  });
  if (error) throw error;
}

/**
 * Mark a payout batch as paid
 */
export async function markPayoutBatchPaid(
  batchId: string,
  exportRef?: string
): Promise<void> {
  const { error } = await supabase.rpc('mark_payout_batch_paid', {
    p_batch_id: batchId,
    p_export_ref: exportRef || null
  });
  if (error) throw error;
}
