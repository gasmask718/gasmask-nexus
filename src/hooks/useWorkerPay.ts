/**
 * WORKER PAY SYSTEM HOOK
 * 
 * Manages the full earnings + payment lifecycle:
 * - Earnings ledger (per batch, per unit)
 * - Payment grouping & issuance
 * - Worker dashboard queries (own earnings/payments)
 * - Admin payroll operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// TYPES
// ============================================================

export interface WorkerEarning {
  id: string;
  worker_id: string;
  batch_id: string | null;
  submission_id: string | null;
  office_id: string;
  earnings_amount: number;
  pay_rate_at_time: number;
  pay_type_at_time: string;
  quantity_completed: number;
  unit_type: string;
  status: 'pending' | 'approved' | 'paid' | 'disputed';
  earned_at: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  payment_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  worker?: { id: string; full_name: string; role: string; pay_rate: number; pay_type: string } | null;
  batch?: { id: string; brand: string; batch_date: string } | null;
}

export interface WorkerPayment {
  id: string;
  worker_id: string;
  office_id: string;
  total_amount: number;
  payment_method: string;
  covered_earnings: string[];
  paid_by: string;
  admin_notes: string | null;
  period_start: string | null;
  period_end: string | null;
  paid_at: string;
  created_at: string;
  // Joined
  worker?: { id: string; full_name: string; role: string } | null;
}

export interface WorkerPaySummary {
  worker_id: string;
  worker_name: string;
  worker_role: string;
  total_earned: number;
  total_paid: number;
  unpaid_balance: number;
  pending_count: number;
  approved_count: number;
}

// ============================================================
// EARNINGS QUERIES
// ============================================================

/** Fetch earnings for an office (admin/manager view) */
export function useOfficeEarnings(officeId: string, statusFilter?: string) {
  return useQuery({
    queryKey: ['worker-earnings', officeId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('production_worker_earnings')
        .select(`
          *,
          worker:production_workers!production_worker_earnings_worker_id_fkey(id, full_name, role, pay_rate, pay_type),
          batch:production_batches!production_worker_earnings_batch_id_fkey(id, brand, batch_date)
        `)
        .eq('office_id', officeId)
        .order('earned_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WorkerEarning[];
    },
    enabled: !!officeId,
  });
}

/** Fetch worker's own earnings (worker dashboard) */
export function useMyEarnings(workerId: string | undefined) {
  return useQuery({
    queryKey: ['my-earnings', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('production_worker_earnings')
        .select(`
          *,
          batch:production_batches!production_worker_earnings_batch_id_fkey(id, brand, batch_date)
        `)
        .eq('worker_id', workerId)
        .order('earned_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as WorkerEarning[];
    },
    enabled: !!workerId,
  });
}

/** Fetch worker's own payments (worker dashboard) */
export function useMyPayments(workerId: string | undefined) {
  return useQuery({
    queryKey: ['my-payments', workerId],
    queryFn: async () => {
      if (!workerId) return [];
      const { data, error } = await supabase
        .from('production_worker_payments')
        .select('*')
        .eq('worker_id', workerId)
        .order('paid_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as unknown as WorkerPayment[];
    },
    enabled: !!workerId,
  });
}

// ============================================================
// WORKER BALANCE SUMMARIES (Admin)
// ============================================================

/** Get per-worker pay summaries for an office */
export function useWorkerPaySummaries(officeId: string) {
  return useQuery({
    queryKey: ['worker-pay-summaries', officeId],
    queryFn: async () => {
      // Get all workers for the office
      const { data: workers, error: wErr } = await supabase
        .from('production_workers')
        .select('id, full_name, role, pay_rate, pay_type, status')
        .eq('office_id', officeId)
        .eq('status', 'active');

      if (wErr) throw wErr;
      if (!workers?.length) return [];

      // Get all earnings for these workers
      const workerIds = workers.map(w => w.id);
      const { data: earnings, error: eErr } = await supabase
        .from('production_worker_earnings')
        .select('worker_id, earnings_amount, status')
        .in('worker_id', workerIds);

      if (eErr) throw eErr;

      // Aggregate
      const summaries: WorkerPaySummary[] = workers.map(worker => {
        const workerEarnings = (earnings || []).filter(e => e.worker_id === worker.id);
        const totalEarned = workerEarnings.reduce((sum, e) => sum + Number(e.earnings_amount), 0);
        const totalPaid = workerEarnings
          .filter(e => e.status === 'paid')
          .reduce((sum, e) => sum + Number(e.earnings_amount), 0);
        const pendingCount = workerEarnings.filter(e => e.status === 'pending').length;
        const approvedCount = workerEarnings.filter(e => e.status === 'approved').length;

        return {
          worker_id: worker.id,
          worker_name: worker.full_name,
          worker_role: worker.role,
          total_earned: totalEarned,
          total_paid: totalPaid,
          unpaid_balance: totalEarned - totalPaid,
          pending_count: pendingCount,
          approved_count: approvedCount,
        };
      });

      return summaries.sort((a, b) => b.unpaid_balance - a.unpaid_balance);
    },
    enabled: !!officeId,
  });
}

// ============================================================
// PAYMENTS QUERIES (Admin)
// ============================================================

export function useOfficePayments(officeId: string) {
  return useQuery({
    queryKey: ['worker-payments', officeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_worker_payments')
        .select(`
          *,
          worker:production_workers!production_worker_payments_worker_id_fkey(id, full_name, role)
        `)
        .eq('office_id', officeId)
        .order('paid_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []) as unknown as WorkerPayment[];
    },
    enabled: !!officeId,
  });
}

// ============================================================
// MUTATIONS
// ============================================================

/** Create an earning record manually (admin) */
export function useCreateEarning() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      worker_id: string;
      batch_id?: string;
      office_id: string;
      earnings_amount: number;
      quantity_completed?: number;
      notes?: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Get worker pay info
      const { data: worker } = await supabase
        .from('production_workers')
        .select('pay_rate, pay_type')
        .eq('id', data.worker_id)
        .single();

      const { data: result, error } = await supabase
        .from('production_worker_earnings')
        .insert({
          worker_id: data.worker_id,
          batch_id: data.batch_id || null,
          office_id: data.office_id,
          earnings_amount: data.earnings_amount,
          pay_rate_at_time: worker?.pay_rate || 0,
          pay_type_at_time: worker?.pay_type || 'per_batch',
          quantity_completed: data.quantity_completed || 1,
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.user.id,
          notes: data.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['worker-earnings', vars.office_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-pay-summaries', vars.office_id] });
      toast({ title: 'Earning recorded' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to record earning', description: error.message, variant: 'destructive' });
    },
  });
}

/** Approve pending earnings (admin) */
export function useApproveEarnings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ earningIds, officeId }: { earningIds: string[]; officeId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('production_worker_earnings')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: user.user.id,
        })
        .in('id', earningIds);

      if (error) throw error;
      return { count: earningIds.length };
    },
    onSuccess: (result, vars) => {
      queryClient.invalidateQueries({ queryKey: ['worker-earnings', vars.officeId] });
      queryClient.invalidateQueries({ queryKey: ['worker-pay-summaries', vars.officeId] });
      toast({ title: `${result.count} earnings approved` });
    },
    onError: (error: any) => {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    },
  });
}

/** Issue payment to a worker (admin) */
export function useIssuePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: {
      worker_id: string;
      office_id: string;
      payment_method: string;
      admin_notes?: string;
      earning_ids?: string[]; // specific earnings to pay, or all approved if empty
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Get approved earnings for this worker
      let earningIds = data.earning_ids;
      if (!earningIds?.length) {
        const { data: approved, error: aErr } = await supabase
          .from('production_worker_earnings')
          .select('id')
          .eq('worker_id', data.worker_id)
          .eq('status', 'approved');

        if (aErr) throw aErr;
        earningIds = (approved || []).map(e => e.id);
      }

      if (!earningIds.length) throw new Error('No approved earnings to pay');

      // Calculate total
      const { data: earnings, error: eErr } = await supabase
        .from('production_worker_earnings')
        .select('id, earnings_amount')
        .in('id', earningIds)
        .eq('status', 'approved');

      if (eErr) throw eErr;
      const totalAmount = (earnings || []).reduce((sum, e) => sum + Number(e.earnings_amount), 0);

      if (totalAmount <= 0) throw new Error('No earnings to pay');

      // Create payment record
      const { data: payment, error: pErr } = await supabase
        .from('production_worker_payments')
        .insert({
          worker_id: data.worker_id,
          office_id: data.office_id,
          total_amount: totalAmount,
          payment_method: data.payment_method,
          covered_earnings: earningIds,
          paid_by: user.user.id,
          admin_notes: data.admin_notes || null,
        })
        .select()
        .single();

      if (pErr) throw pErr;

      // Update earnings to 'paid'
      const { error: uErr } = await supabase
        .from('production_worker_earnings')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_id: payment.id,
        })
        .in('id', earningIds);

      if (uErr) throw uErr;

      return payment;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['worker-earnings', vars.office_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-payments', vars.office_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-pay-summaries', vars.office_id] });
      queryClient.invalidateQueries({ queryKey: ['my-earnings'] });
      queryClient.invalidateQueries({ queryKey: ['my-payments'] });
      toast({ title: 'Payment issued successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Payment failed', description: error.message, variant: 'destructive' });
    },
  });
}

/** Update worker pay rate (admin) */
export function useUpdateWorkerPayRate() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ workerId, payRate, payType }: {
      workerId: string;
      payRate: number;
      payType: string;
    }) => {
      const { error } = await supabase
        .from('production_workers')
        .update({ pay_rate: payRate, pay_type: payType })
        .eq('id', workerId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production-workers'] });
      queryClient.invalidateQueries({ queryKey: ['worker-pay-summaries'] });
      toast({ title: 'Pay rate updated' });
    },
    onError: (error: any) => {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    },
  });
}
