/**
 * WORKER SUBMISSIONS HOOK
 * 
 * Manages the pending_review submission lifecycle:
 * - Workers submit production logs (lbs, tubes, boxes, defects)
 * - Managers approve/reject in the approval queue
 * - Approved submissions auto-create batch outputs
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// ============================================================
// TYPES
// ============================================================

export interface WorkerSubmission {
  id: string;
  batch_id: string | null;
  office_id: string;
  worker_id: string | null;
  submitted_by: string | null;
  lbs_processed: number;
  tubes_produced: number;
  boxes_packed: number;
  defects_count: number;
  defect_reason: string | null;
  waste_lbs: number;
  downtime_minutes: number;
  downtime_reason: string | null;
  quality_check_passed: boolean | null;
  notes: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'auto_approved';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  auto_rule_applied: string | null;
  resulting_output_id: string | null;
  shift_label: string | null;
  submission_date: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  worker?: { id: string; full_name: string; role: string } | null;
  batch?: { id: string; brand: string; batch_date: string } | null;
}

export interface SubmissionFormData {
  batch_id: string;
  office_id: string;
  worker_id?: string;
  lbs_processed: number;
  tubes_produced: number;
  boxes_packed: number;
  defects_count: number;
  defect_reason?: string;
  waste_lbs: number;
  downtime_minutes: number;
  downtime_reason?: string;
  quality_check_passed?: boolean;
  notes?: string;
  shift_label?: string;
}

// ============================================================
// FETCH SUBMISSIONS
// ============================================================

export function useWorkerSubmissions(officeId: string, statusFilter?: string) {
  return useQuery({
    queryKey: ['worker-submissions', officeId, statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('production_worker_submissions')
        .select(`
          *,
          worker:production_workers!production_worker_submissions_worker_id_fkey(id, full_name, role),
          batch:production_batches!production_worker_submissions_batch_id_fkey(id, brand, batch_date)
        `)
        .eq('office_id', officeId)
        .order('created_at', { ascending: false });

      if (statusFilter) {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as WorkerSubmission[];
    },
    enabled: !!officeId,
  });
}

// Pending submissions count for badge
export function usePendingSubmissionCount(officeId: string) {
  return useQuery({
    queryKey: ['worker-submissions-pending-count', officeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('production_worker_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('office_id', officeId)
        .eq('status', 'pending_review');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!officeId,
    refetchInterval: 30000, // Poll every 30s for live updates
  });
}

// ============================================================
// CREATE SUBMISSION (Worker)
// ============================================================

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SubmissionFormData) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { data: result, error } = await supabase
        .from('production_worker_submissions')
        .insert({
          batch_id: data.batch_id,
          office_id: data.office_id,
          worker_id: data.worker_id || null,
          submitted_by: user.user.id,
          lbs_processed: data.lbs_processed,
          tubes_produced: data.tubes_produced,
          boxes_packed: data.boxes_packed,
          defects_count: data.defects_count,
          defect_reason: data.defect_reason || null,
          waste_lbs: data.waste_lbs,
          downtime_minutes: data.downtime_minutes,
          downtime_reason: data.downtime_reason || null,
          quality_check_passed: data.quality_check_passed ?? null,
          notes: data.notes || null,
          shift_label: data.shift_label || 'day',
          status: 'pending_review',
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-submissions', variables.office_id] });
      queryClient.invalidateQueries({ queryKey: ['worker-submissions-pending-count', variables.office_id] });
      toast({ title: 'Submission sent', description: 'Your production log is pending manager review.' });
    },
    onError: (error: any) => {
      toast({ title: 'Submission failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// APPROVE / REJECT (Manager)
// ============================================================

export function useReviewSubmission() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ 
      submissionId, 
      decision, 
      reviewNotes,
      officeId,
    }: { 
      submissionId: string; 
      decision: 'approved' | 'rejected';
      reviewNotes?: string;
      officeId: string;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Update submission status
      const { data: submission, error } = await supabase
        .from('production_worker_submissions')
        .update({
          status: decision,
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', submissionId)
        .select(`
          *,
          worker:production_workers!production_worker_submissions_worker_id_fkey(id, full_name, role),
          batch:production_batches!production_worker_submissions_batch_id_fkey(id, brand, batch_date)
        `)
        .single();

      if (error) throw error;

      // If approved, create batch output record + earning
      if (decision === 'approved' && submission) {
        const sub = submission as unknown as WorkerSubmission;
        if (sub.batch_id) {
          const { data: output, error: outputError } = await supabase
            .from('production_batch_outputs')
            .insert({
              batch_id: sub.batch_id,
              brand: sub.batch?.brand || 'gasmask',
              boxes_completed: sub.boxes_packed,
              tubes_used: sub.tubes_produced,
              stickers_used: 0,
              empty_boxes_used: sub.boxes_packed,
              defects_count: sub.defects_count,
              defect_reason: sub.defect_reason,
              worker_id: sub.worker_id,
              notes: `Auto-created from worker submission ${sub.id}`,
              stickers_issued: 0,
              empty_boxes_issued: sub.boxes_packed,
              variance_stickers: 0,
              variance_boxes: 0,
            })
            .select()
            .single();

          if (outputError) {
            console.error('Failed to create batch output from submission:', outputError);
          } else if (output) {
            // Link the output back to the submission
            await supabase
              .from('production_worker_submissions')
              .update({ resulting_output_id: output.id })
              .eq('id', submissionId);
          }

          // Auto-create earning record if worker is assigned
          if (sub.worker_id) {
            try {
              await supabase.rpc('create_earning_from_submission', {
                p_submission_id: sub.id,
                p_worker_id: sub.worker_id,
                p_batch_id: sub.batch_id,
                p_office_id: sub.office_id,
                p_quantity: sub.boxes_packed || 1,
                p_approved_by: user.user!.id,
              });
            } catch (e) {
              console.error('Failed to create earning from submission:', e);
            }
          }
        }
      }

      return submission;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-submissions', variables.officeId] });
      queryClient.invalidateQueries({ queryKey: ['worker-submissions-pending-count', variables.officeId] });
      queryClient.invalidateQueries({ queryKey: ['production-batches'] });
      queryClient.invalidateQueries({ queryKey: ['production-batch-outputs'] });
      toast({
        title: variables.decision === 'approved' ? 'Submission approved' : 'Submission rejected',
        description: variables.decision === 'approved' 
          ? 'Batch output has been created from the submission.'
          : 'The submission has been rejected.',
      });
    },
    onError: (error: any) => {
      toast({ title: 'Review failed', description: error.message, variant: 'destructive' });
    },
  });
}

// ============================================================
// BULK APPROVE
// ============================================================

export function useBulkApproveSubmissions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ submissionIds, officeId }: { submissionIds: string[]; officeId: string }) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('production_worker_submissions')
        .update({
          status: 'approved',
          reviewed_by: user.user.id,
          reviewed_at: new Date().toISOString(),
          review_notes: 'Bulk approved',
        })
        .in('id', submissionIds);

      if (error) throw error;
      return { count: submissionIds.length };
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['worker-submissions', variables.officeId] });
      queryClient.invalidateQueries({ queryKey: ['worker-submissions-pending-count', variables.officeId] });
      toast({ title: `${result.count} submissions approved`, description: 'Batch outputs will be generated.' });
    },
    onError: (error: any) => {
      toast({ title: 'Bulk approve failed', description: error.message, variant: 'destructive' });
    },
  });
}
