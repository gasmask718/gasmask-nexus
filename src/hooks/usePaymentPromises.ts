// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT PROMISES HOOK — Promise-to-Pay Workflow
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PromiseStatus = 'active' | 'kept' | 'broken' | 'cancelled';

export interface PaymentPromise {
  id: string;
  collection_account_id: string;
  promise_amount: number;
  promise_date: string;
  status: PromiseStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  kept_at: string | null;
  broken_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
}

export interface PromiseStats {
  active_count: number;
  active_amount: number;
  due_next_7_days: number;
  due_next_7_days_amount: number;
  kept_30d: number;
  broken_30d: number;
  kept_rate: number;
}

export interface CreatePromiseParams {
  collection_account_id: string;
  promise_amount: number;
  promise_date: string;
  notes?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function usePaymentPromises(accountId?: string, status?: PromiseStatus) {
  return useQuery({
    queryKey: ['payment-promises', accountId, status],
    queryFn: async () => {
      let query = supabase
        .from('payment_promises')
        .select('*')
        .order('promise_date', { ascending: true });

      if (accountId) query = query.eq('collection_account_id', accountId);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as PaymentPromise[];
    },
  });
}

export function usePromiseStats() {
  return useQuery({
    queryKey: ['promise-stats'],
    queryFn: async () => {
      const now = new Date();
      const next7Days = new Date();
      next7Days.setDate(next7Days.getDate() + 7);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all relevant promises
      const { data: activePromises, error: activeError } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('status', 'active');
      if (activeError) throw activeError;

      const { data: keptPromises, error: keptError } = await supabase
        .from('payment_promises')
        .select('id')
        .eq('status', 'kept')
        .gte('kept_at', thirtyDaysAgo.toISOString());
      if (keptError) throw keptError;

      const { data: brokenPromises, error: brokenError } = await supabase
        .from('payment_promises')
        .select('id')
        .eq('status', 'broken')
        .gte('broken_at', thirtyDaysAgo.toISOString());
      if (brokenError) throw brokenError;

      // Calculate stats
      const active = (activePromises || []) as PaymentPromise[];
      const dueNext7 = active.filter(p => {
        const promiseDate = new Date(p.promise_date);
        return promiseDate >= now && promiseDate <= next7Days;
      });

      const kept30d = keptPromises?.length || 0;
      const broken30d = brokenPromises?.length || 0;
      const total30d = kept30d + broken30d;

      const stats: PromiseStats = {
        active_count: active.length,
        active_amount: active.reduce((sum, p) => sum + Number(p.promise_amount), 0),
        due_next_7_days: dueNext7.length,
        due_next_7_days_amount: dueNext7.reduce((sum, p) => sum + Number(p.promise_amount), 0),
        kept_30d: kept30d,
        broken_30d: broken30d,
        kept_rate: total30d > 0 ? (kept30d / total30d) * 100 : 0,
      };

      return stats;
    },
  });
}

export function useUpcomingPromises(days = 7) {
  return useQuery({
    queryKey: ['upcoming-promises', days],
    queryFn: async () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + days);

      const { data, error } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('status', 'active')
        .gte('promise_date', now.toISOString().split('T')[0])
        .lte('promise_date', futureDate.toISOString().split('T')[0])
        .order('promise_date', { ascending: true });

      if (error) throw error;
      return (data || []) as PaymentPromise[];
    },
  });
}

export function useOverduePromises() {
  return useQuery({
    queryKey: ['overdue-promises'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('status', 'active')
        .lt('promise_date', today)
        .order('promise_date', { ascending: true });

      if (error) throw error;
      return (data || []) as PaymentPromise[];
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function usePromiseMutations() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Create promise
  const createPromise = useMutation({
    mutationFn: async (params: CreatePromiseParams) => {
      const { data, error } = await supabase
        .from('payment_promises')
        .insert({
          ...params,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Log action
      await supabase
        .from('collection_actions')
        .insert({
          collection_account_id: params.collection_account_id,
          action_type: 'promise_created',
          channel: 'internal',
          message_preview: `Promise of $${params.promise_amount} for ${params.promise_date}`,
          payload: { promise_id: data.id, amount: params.promise_amount, date: params.promise_date },
          created_by: user?.id,
        });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['promise-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-promises'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Promise Created', description: 'Payment promise recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark promise as kept
  const markPromiseKept = useMutation({
    mutationFn: async (promiseId: string) => {
      // Get promise details
      const { data: promise } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('id', promiseId)
        .single();

      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          status: 'kept',
          kept_at: new Date().toISOString(),
        })
        .eq('id', promiseId)
        .select()
        .single();
      if (error) throw error;

      // Log action
      if (promise) {
        await supabase
          .from('collection_actions')
          .insert({
            collection_account_id: promise.collection_account_id,
            action_type: 'promise_kept',
            channel: 'internal',
            message_preview: `Promise of $${promise.promise_amount} marked as kept`,
            payload: { promise_id: promiseId },
            created_by: user?.id,
          });
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['promise-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-promises'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-promises'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ title: 'Promise Kept', description: 'Payment promise marked as fulfilled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark promise as broken
  const markPromiseBroken = useMutation({
    mutationFn: async ({ promiseId, escalate = false }: { promiseId: string; escalate?: boolean }) => {
      // Get promise details
      const { data: promise } = await supabase
        .from('payment_promises')
        .select('*')
        .eq('id', promiseId)
        .single();

      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          status: 'broken',
          broken_at: new Date().toISOString(),
        })
        .eq('id', promiseId)
        .select()
        .single();
      if (error) throw error;

      // Log action
      if (promise) {
        await supabase
          .from('collection_actions')
          .insert({
            collection_account_id: promise.collection_account_id,
            action_type: 'promise_broken',
            channel: 'internal',
            message_preview: `Promise of $${promise.promise_amount} marked as broken`,
            payload: { promise_id: promiseId, escalate },
            created_by: user?.id,
          });

        // Escalate if requested
        if (escalate) {
          // Update account risk tier
          await supabase
            .from('collection_accounts')
            .update({ 
              risk_tier: 'high',
              status: 'escalated',
            })
            .eq('id', promise.collection_account_id);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['promise-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-promises'] });
      queryClient.invalidateQueries({ queryKey: ['overdue-promises'] });
      queryClient.invalidateQueries({ queryKey: ['collection-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['collection-actions'] });
      toast({ 
        title: 'Promise Broken', 
        description: 'Payment promise marked as broken',
        variant: 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel promise
  const cancelPromise = useMutation({
    mutationFn: async ({ promiseId, reason }: { promiseId: string; reason?: string }) => {
      const { data, error } = await supabase
        .from('payment_promises')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: reason,
        })
        .eq('id', promiseId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-promises'] });
      queryClient.invalidateQueries({ queryKey: ['promise-stats'] });
      queryClient.invalidateQueries({ queryKey: ['upcoming-promises'] });
      toast({ title: 'Promise Cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  return {
    createPromise,
    markPromiseKept,
    markPromiseBroken,
    cancelPromise,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTO-BREAK OVERDUE PROMISES (Utility for scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

export async function processOverduePromises(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  // Find overdue active promises
  const { data: overduePromises, error: fetchError } = await supabase
    .from('payment_promises')
    .select('id, collection_account_id, promise_amount')
    .eq('status', 'active')
    .lt('promise_date', today);

  if (fetchError) throw fetchError;
  if (!overduePromises || overduePromises.length === 0) return 0;

  // Mark all as broken
  const { error: updateError } = await supabase
    .from('payment_promises')
    .update({
      status: 'broken',
      broken_at: new Date().toISOString(),
    })
    .in('id', overduePromises.map(p => p.id));

  if (updateError) throw updateError;

  // Log actions for each
  const actions = overduePromises.map(p => ({
    collection_account_id: p.collection_account_id,
    action_type: 'promise_broken' as const,
    channel: 'system' as const,
    message_preview: `Auto-broken: Promise of $${p.promise_amount} overdue`,
    payload: { promise_id: p.id, auto_broken: true },
  }));

  await supabase.from('collection_actions').insert(actions);

  return overduePromises.length;
}
