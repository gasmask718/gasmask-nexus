/**
 * Hooks for ambassador bulk outreach jobs (Phase 5).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type BulkJobStatus = 'queued' | 'processing' | 'paused' | 'complete' | 'failed' | 'cancelled';
export type BulkJobType = 'sms_blast' | 'ai_call_blast';

export interface BulkJob {
  id: string;
  ambassador_id: string;
  job_type: BulkJobType;
  template_id: string | null;
  script_id: string | null;
  objective: string | null;
  target_store_ids: string[];
  total_count: number;
  sent_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  status: BulkJobStatus;
  scheduled_for: string | null;
  pacing_seconds: number;
  language_strategy: 'auto' | 'en' | 'ar';
  custom_variables: Record<string, any> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_summary: any;
}

export interface BulkJobItem {
  id: string;
  job_id: string;
  store_id: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped' | 'cancelled';
  skip_reason: string | null;
  message_id: string | null;
  log_id: string | null;
  error_message: string | null;
  processed_at: string | null;
}

export function useBulkJobs(ambassadorId: string | null) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ambassador-bulk-jobs', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return [];
      const { data, error } = await supabase
        .from('ambassador_bulk_jobs' as any)
        .select('*')
        .eq('ambassador_id', ambassadorId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as BulkJob[];
    },
    enabled: !!ambassadorId,
  });

  // Realtime subscription for live progress
  useEffect(() => {
    if (!ambassadorId) return;
    const ch = supabase
      .channel(`amb-bulk-jobs-${ambassadorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambassador_bulk_jobs', filter: `ambassador_id=eq.${ambassadorId}` }, () => {
        qc.invalidateQueries({ queryKey: ['ambassador-bulk-jobs', ambassadorId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambassador_bulk_job_items' }, () => {
        qc.invalidateQueries({ queryKey: ['ambassador-bulk-jobs', ambassadorId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ambassadorId, qc]);

  return query;
}

export function useBulkJobItems(jobId: string | null) {
  return useQuery({
    queryKey: ['ambassador-bulk-job-items', jobId],
    queryFn: async () => {
      if (!jobId) return [];
      const { data, error } = await supabase
        .from('ambassador_bulk_job_items' as any)
        .select('*')
        .eq('job_id', jobId)
        .order('created_at');
      if (error) throw error;
      return (data || []) as unknown as BulkJobItem[];
    },
    enabled: !!jobId,
    refetchInterval: 5000,
  });
}

interface CreateBulkJobInput {
  ambassador_id: string;
  job_type: BulkJobType;
  template_id?: string | null;
  script_id?: string | null;
  objective?: string | null;
  target_store_ids: string[];
  language_strategy?: 'auto' | 'en' | 'ar';
  custom_variables?: Record<string, any> | null;
  scheduled_for?: string | null;
  pacing_seconds?: number;
}

export function useCreateBulkJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBulkJobInput) => {
      const { data: job, error } = await supabase
        .from('ambassador_bulk_jobs' as any)
        .insert({
          ambassador_id: input.ambassador_id,
          job_type: input.job_type,
          template_id: input.template_id ?? null,
          script_id: input.script_id ?? null,
          objective: input.objective ?? null,
          target_store_ids: input.target_store_ids,
          total_count: input.target_store_ids.length,
          language_strategy: input.language_strategy ?? 'auto',
          custom_variables: input.custom_variables ?? null,
          scheduled_for: input.scheduled_for ?? null,
          pacing_seconds: input.pacing_seconds ?? (input.job_type === 'ai_call_blast' ? 30 : 3),
        })
        .select('*')
        .single();
      if (error) throw error;

      // Seed items
      const items = input.target_store_ids.map((sid) => ({ job_id: (job as any).id, store_id: sid }));
      const { error: itemsErr } = await supabase.from('ambassador_bulk_job_items' as any).insert(items);
      if (itemsErr) throw itemsErr;

      // Activity log
      await supabase.from('ambassador_activity_log').insert({
        ambassador_id: input.ambassador_id,
        action_type: 'bulk_job_created',
        metadata: { job_id: (job as any).id, type: input.job_type, total_count: input.target_store_ids.length },
      });

      // Fire processor if "send now"
      if (!input.scheduled_for) {
        const fn = input.job_type === 'sms_blast' ? 'bulk-sms-processor' : 'bulk-ai-call-processor';
        supabase.functions.invoke(fn, { body: { job_id: (job as any).id } }).catch((e) => {
          console.error('processor invoke failed', e);
        });
      }
      return job as unknown as BulkJob;
    },
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['ambassador-bulk-jobs', job.ambassador_id] });
      toast.success(job.scheduled_for ? 'Bulk job scheduled' : 'Bulk send started');
    },
    onError: (e: any) => { toast.error(e?.message || 'Failed to create bulk job'); },
  });
}

export function useCancelBulkJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase.from('ambassador_bulk_jobs' as any)
        .update({ status: 'cancelled', completed_at: new Date().toISOString() })
        .eq('id', jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ambassador-bulk-jobs'] });
      toast.success('Job cancelled');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to cancel'),
  });
}

export function useRetryFailedItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (originalJob: BulkJob) => {
      // Fetch failed items
      const { data: failed } = await supabase
        .from('ambassador_bulk_job_items' as any)
        .select('store_id')
        .eq('job_id', originalJob.id)
        .eq('status', 'failed');
      const storeIds = (failed || []).map((f: any) => f.store_id);
      if (storeIds.length === 0) throw new Error('No failed items to retry');

      const { data: newJob, error } = await supabase
        .from('ambassador_bulk_jobs' as any)
        .insert({
          ambassador_id: originalJob.ambassador_id,
          job_type: originalJob.job_type,
          template_id: originalJob.template_id,
          script_id: originalJob.script_id,
          objective: originalJob.objective,
          target_store_ids: storeIds,
          total_count: storeIds.length,
          language_strategy: originalJob.language_strategy,
          custom_variables: originalJob.custom_variables,
          pacing_seconds: originalJob.pacing_seconds,
        })
        .select('*').single();
      if (error) throw error;
      const items = storeIds.map((sid) => ({ job_id: (newJob as any).id, store_id: sid }));
      await supabase.from('ambassador_bulk_job_items' as any).insert(items);

      const fn = originalJob.job_type === 'sms_blast' ? 'bulk-sms-processor' : 'bulk-ai-call-processor';
      supabase.functions.invoke(fn, { body: { job_id: (newJob as any).id } });

      return newJob as unknown as BulkJob;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ambassador-bulk-jobs'] });
      toast.success('Retry job queued');
    },
    onError: (e: any) => toast.error(e?.message || 'Retry failed'),
  });
}

export function useBulkJobKpis(ambassadorId: string | null) {
  return useQuery({
    queryKey: ['ambassador-bulk-kpis', ambassadorId],
    queryFn: async () => {
      if (!ambassadorId) return { jobsToday: 0, reachToday: 0, activeJobs: 0 };
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: jobs } = await supabase
        .from('ambassador_bulk_jobs' as any)
        .select('id, status, target_store_ids, created_at')
        .eq('ambassador_id', ambassadorId)
        .gte('created_at', today.toISOString());
      const list = (jobs || []) as any[];
      const reach = new Set<string>();
      list.forEach((j) => (j.target_store_ids || []).forEach((s: string) => reach.add(s)));
      const active = list.filter((j) => ['queued', 'processing', 'paused'].includes(j.status)).length;
      return { jobsToday: list.length, reachToday: reach.size, activeJobs: active };
    },
    enabled: !!ambassadorId,
    refetchInterval: 15000,
  });
}
