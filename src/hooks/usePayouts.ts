import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types
export interface PayoutBatch {
  id: string;
  period_start: string;
  period_end: string;
  currency: string;
  status: 'draft' | 'review' | 'approved' | 'processing' | 'paid' | 'failed' | 'cancelled';
  total_amount: number;
  items_count: number;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  payout_provider: 'stripe' | 'manual';
  export_csv_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface PayoutBatchItem {
  id: string;
  payout_batch_id: string;
  ambassador_id: string;
  payout_account_id: string | null;
  amount: number;
  currency: string;
  status: 'queued' | 'processing' | 'paid' | 'failed' | 'skipped';
  provider_transfer_id: string | null;
  provider_payout_id: string | null;
  failure_reason: string | null;
  created_at: string;
  // Joined fields
  ambassador_name?: string;
  payout_account?: PayoutAccount | null;
}

export interface PayoutAccount {
  id: string;
  ambassador_id: string;
  provider: 'stripe' | 'manual';
  provider_account_id: string | null;
  payouts_enabled: boolean;
  kyc_status: 'unverified' | 'pending' | 'verified' | 'rejected';
  country: string;
  currency: string;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayoutStatementLine {
  payout_batch_item_id: string;
  batch_id: string;
  period_start: string;
  period_end: string;
  commission_id: string;
  source_channel: string;
  source_name: string;
  commission_amount: number;
  earned_at: string;
  override_plan_id: string | null;
  parent_commission_id: string | null;
}

// =============================================
// PAYOUT BATCHES
// =============================================

export function usePayoutBatches(statusFilter?: string) {
  return useQuery({
    queryKey: ['payout-batches', statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from('payout_batches')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PayoutBatch[];
    },
  });
}

export function usePayoutBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['payout-batch', batchId],
    queryFn: async () => {
      if (!batchId) return null;
      const { data, error } = await (supabase as any)
        .from('payout_batches')
        .select('*')
        .eq('id', batchId)
        .single();
      if (error) throw error;
      return data as PayoutBatch;
    },
    enabled: !!batchId,
  });
}

export function usePayoutBatchItems(batchId: string | undefined) {
  return useQuery({
    queryKey: ['payout-batch-items', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await (supabase as any)
        .from('payout_batch_items')
        .select(`
          *,
          ambassadors!inner(name),
          ambassador_payout_accounts(*)
        `)
        .eq('payout_batch_id', batchId)
        .order('amount', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((item: any) => ({
        ...item,
        ambassador_name: item.ambassadors?.name,
        payout_account: item.ambassador_payout_accounts,
      })) as PayoutBatchItem[];
    },
    enabled: !!batchId,
  });
}

export function useCreatePayoutBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      periodStart, 
      periodEnd, 
      provider = 'stripe' 
    }: { 
      periodStart: string; 
      periodEnd: string; 
      provider?: 'stripe' | 'manual';
    }) => {
      const { data, error } = await supabase.rpc('create_payout_batch', {
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_provider: provider,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (batchId) => {
      queryClient.invalidateQueries({ queryKey: ['payout-batches'] });
      toast({ title: 'Payout batch created', description: `Batch ID: ${batchId?.slice(0, 8)}...` });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create batch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSubmitBatchForReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase.rpc('submit_payout_batch_for_review', {
        p_batch_id: batchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-batches'] });
      queryClient.invalidateQueries({ queryKey: ['payout-batch'] });
      toast({ title: 'Batch submitted for review' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to submit', description: error.message, variant: 'destructive' });
    },
  });
}

export function useApproveBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase.rpc('approve_payout_batch', {
        p_batch_id: batchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-batches'] });
      queryClient.invalidateQueries({ queryKey: ['payout-batch'] });
      toast({ title: 'Batch approved', description: 'Ready for processing' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to approve', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelBatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase.rpc('cancel_payout_batch', {
        p_batch_id: batchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-batches'] });
      queryClient.invalidateQueries({ queryKey: ['payout-batch'] });
      toast({ title: 'Batch cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to cancel', description: error.message, variant: 'destructive' });
    },
  });
}

export function useStartBatchProcessing() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase.rpc('start_payout_batch_processing', {
        p_batch_id: batchId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-batches'] });
      queryClient.invalidateQueries({ queryKey: ['payout-batch'] });
      toast({ title: 'Processing started' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to start processing', description: error.message, variant: 'destructive' });
    },
  });
}

export function useSkipPayoutItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ itemId, reason }: { itemId: string; reason: string }) => {
      const { error } = await supabase.rpc('skip_payout_item', {
        p_item_id: itemId,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-batch-items'] });
      toast({ title: 'Item skipped' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to skip item', description: error.message, variant: 'destructive' });
    },
  });
}

// =============================================
// PAYOUT ACCOUNTS (Ambassador)
// =============================================

export function usePayoutAccounts(ambassadorId: string | undefined) {
  return useQuery({
    queryKey: ['payout-accounts', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await (supabase as any)
        .from('ambassador_payout_accounts')
        .select('*')
        .eq('ambassador_id', ambassadorId);
      if (error) throw error;
      return (data || []) as PayoutAccount[];
    },
    enabled: !!ambassadorId,
  });
}

export function useMyPayoutAccounts() {
  return useQuery({
    queryKey: ['my-payout-accounts'],
    queryFn: async () => {
      // Get current user's ambassador record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: ambassador } = await (supabase as any)
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!ambassador) return [];

      const { data, error } = await (supabase as any)
        .from('ambassador_payout_accounts')
        .select('*')
        .eq('ambassador_id', ambassador.id);
      
      if (error) throw error;
      return (data || []) as PayoutAccount[];
    },
  });
}

export function useUpsertPayoutAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (account: Partial<PayoutAccount> & { ambassador_id: string }) => {
      const { data, error } = await (supabase as any)
        .from('ambassador_payout_accounts')
        .upsert(account, { 
          onConflict: 'ambassador_id,provider',
          ignoreDuplicates: false 
        })
        .select()
        .single();
      if (error) throw error;
      return data as PayoutAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payout-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['my-payout-accounts'] });
      toast({ title: 'Payout account saved' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to save account', description: error.message, variant: 'destructive' });
    },
  });
}

// =============================================
// AMBASSADOR PAYOUT HISTORY
// =============================================

export function useMyPayoutHistory() {
  return useQuery({
    queryKey: ['my-payout-history'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: ambassador } = await (supabase as any)
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!ambassador) return [];

      const { data, error } = await (supabase as any)
        .from('payout_batch_items')
        .select(`
          *,
          payout_batches(period_start, period_end, status, payout_provider)
        `)
        .eq('ambassador_id', ambassador.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
  });
}

export function usePayoutStatement(itemId: string | undefined) {
  return useQuery({
    queryKey: ['payout-statement', itemId],
    queryFn: async () => {
      if (!itemId) return [];
      const { data, error } = await (supabase as any)
        .from('v_payout_item_statement_lines')
        .select('*')
        .eq('payout_batch_item_id', itemId)
        .order('earned_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PayoutStatementLine[];
    },
    enabled: !!itemId,
  });
}

// =============================================
// BATCH EXPORT
// =============================================

export function usePayoutBatchExport(batchId: string | undefined) {
  return useQuery({
    queryKey: ['payout-batch-export', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await (supabase as any)
        .from('v_payout_batch_export')
        .select('*')
        .eq('batch_id', batchId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!batchId,
  });
}

// =============================================
// ADMIN STATS
// =============================================

export function usePayoutStats() {
  return useQuery({
    queryKey: ['payout-stats'],
    queryFn: async () => {
      const { data: batches, error } = await (supabase as any)
        .from('payout_batches')
        .select('status, total_amount, items_count');
      
      if (error) throw error;

      const stats = {
        totalPaid: 0,
        pendingAmount: 0,
        draftBatches: 0,
        reviewBatches: 0,
        approvedBatches: 0,
        processingBatches: 0,
      };

      (batches || []).forEach((batch: any) => {
        if (batch.status === 'paid') {
          stats.totalPaid += batch.total_amount;
        } else if (['draft', 'review', 'approved', 'processing'].includes(batch.status)) {
          stats.pendingAmount += batch.total_amount;
        }
        
        if (batch.status === 'draft') stats.draftBatches++;
        if (batch.status === 'review') stats.reviewBatches++;
        if (batch.status === 'approved') stats.approvedBatches++;
        if (batch.status === 'processing') stats.processingBatches++;
      });

      return stats;
    },
  });
}
