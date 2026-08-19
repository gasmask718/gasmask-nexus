import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type AutomationJobStatus =
  | 'CREATED' | 'QUEUED' | 'STARTING' | 'RUNNING' | 'FORM_DETECTED' | 'FILLING'
  | 'DOCUMENT_UPLOAD' | 'HUMAN_CHECKPOINT' | 'READY_TO_SUBMIT' | 'SUBMITTING'
  | 'READING_RESPONSE' | 'COMPLETED' | 'FAILED' | 'BLOCKED'
  | 'NEEDS_INFORMATION' | 'NEEDS_HUMAN_REVIEW' | 'CANCELLED';

export interface AutomationJob {
  id: string;
  application_id: string;
  client_id: string | null;
  lender_name: string | null;
  submission_method: 'api' | 'browser' | 'manual';
  status: AutomationJobStatus;
  current_step: string | null;
  attempt_count: number;
  max_attempts: number;
  requires_human_action: boolean;
  human_action_type: string | null;
  missing_fields: string[];
  failure_reason: string | null;
  failure_class: string | null;
  result_status: string | null;
  lender_reference: string | null;
  approved_amount: number | null;
  started_at: string | null;
  last_event_at: string | null;
  created_at: string;
}

/** All automation calls go through the authenticated Automation API — never direct secrets. */
async function callApi<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('funding-automation-api', {
    body: { action, ...payload },
  });
  if (error) {
    const details = (error as any)?.context ? await (error as any).context.text() : error.message;
    throw new Error(details || error.message);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function useAutomationJobs(statusFilter?: string) {
  return useQuery({
    queryKey: ['automation-jobs', statusFilter ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('automation_jobs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (statusFilter && statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AutomationJob[];
    },
    refetchInterval: 15_000,
  });
}

export function useAutomationJobDetail(jobId: string | null) {
  return useQuery({
    queryKey: ['automation-job', jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const [events, checkpoints, sessions] = await Promise.all([
        supabase.from('automation_events').select('*').eq('automation_job_id', jobId!)
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('automation_checkpoints').select('*').eq('automation_job_id', jobId!)
          .order('detected_at', { ascending: false }),
        supabase.from('automation_sessions').select('*').eq('automation_job_id', jobId!)
          .order('started_at', { ascending: false }),
      ]);
      if (events.error) throw events.error;
      if (checkpoints.error) throw checkpoints.error;
      if (sessions.error) throw sessions.error;
      return { events: events.data ?? [], checkpoints: checkpoints.data ?? [], sessions: sessions.data ?? [] };
    },
    refetchInterval: 10_000,
  });
}

export function useAutomationActions() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['automation-jobs'] });
    qc.invalidateQueries({ queryKey: ['automation-job'] });
    qc.invalidateQueries({ queryKey: ['funding-applications'] });
  };

  const wrap = (action: string, success: string) =>
    useMutation({
      mutationFn: (payload: Record<string, unknown>) => callApi(action, payload),
      onSuccess: () => { invalidate(); toast.success(success); },
      onError: (e: Error) => toast.error(e.message),
    });

  return {
    createJob: wrap('create-job', 'Automation job created'),
    cancelJob: wrap('cancel-job', 'Job cancelled'),
    retryJob: wrap('retry-job', 'Job re-queued'),
    resolveCheckpoint: wrap('resolve-checkpoint', 'Checkpoint resolved'),
    switchToManual: wrap('switch-to-manual', 'Switched to manual submission'),
  };
}

export function useLenderAutomationConfigs() {
  return useQuery({
    queryKey: ['lender-automation-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lender_automation_config').select('*').order('lender_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
