// ═══════════════════════════════════════════════════════════════════════════════
// FIELD SUBMISSION REVIEW & APPROVAL HOOK
// Governance layer for all field-user mutations
// ═══════════════════════════════════════════════════════════════════════════════

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type FieldEntityTypeEnum = Database['public']['Enums']['field_entity_type'];
type FieldActionTypeEnum = Database['public']['Enums']['field_action_type'];
type FieldSubmissionStatusEnum = Database['public']['Enums']['field_submission_status'];

export type FieldEntityType = FieldEntityTypeEnum;
export type FieldActionType = FieldActionTypeEnum;
export type FieldSubmissionStatus = FieldSubmissionStatusEnum;

export interface FieldSubmission {
  id: string;
  submitted_by_user_id: string;
  submitted_by_role: string;
  store_id: string;
  entity_type: FieldEntityType;
  entity_id: string | null;
  action_type: FieldActionType;
  payload_before: Record<string, unknown> | null;
  payload_after: Record<string, unknown>;
  submission_status: FieldSubmissionStatus;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  amendment_notes: string | null;
  is_applied: boolean | null;
  is_rolled_back: boolean | null;
  risk_score: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  submitter_name?: string;
  store_name?: string;
  reviewer_name?: string;
}

export interface CreateFieldSubmissionParams {
  storeId: string;
  entityType: FieldEntityType;
  entityId?: string;
  actionType: FieldActionType;
  payloadBefore?: Record<string, unknown>;
  payloadAfter: Record<string, unknown>;
  userRole: 'driver' | 'biker' | 'ambassador';
}

/**
 * Create a field submission record (write-ahead log)
 * Called BEFORE or ALONGSIDE production writes
 */
export function useCreateFieldSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateFieldSubmissionParams) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const insertData: Database['public']['Tables']['field_submissions']['Insert'] = {
        submitted_by_user_id: user.id,
        submitted_by_role: params.userRole,
        store_id: params.storeId,
        entity_type: params.entityType,
        entity_id: params.entityId || null,
        action_type: params.actionType,
        payload_before: params.payloadBefore as unknown as Database['public']['Tables']['field_submissions']['Insert']['payload_before'],
        payload_after: params.payloadAfter as unknown as Database['public']['Tables']['field_submissions']['Insert']['payload_after'],
        submission_status: 'pending_review',
        is_applied: true,
      };

      const { data, error } = await supabase
        .from('field_submissions')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
    },
  });
}

/**
 * Fetch all field submissions with filters
 */
export function useFieldSubmissions(filters?: {
  status?: FieldSubmissionStatus;
  entityType?: FieldEntityType;
  storeId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['field-submissions', filters],
    queryFn: async () => {
      let query = supabase
        .from('field_submissions')
        .select(`
          *,
          store:store_master(name)
        `)
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('submission_status', filters.status);
      }
      if (filters?.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }
      if (filters?.storeId) {
        query = query.eq('store_id', filters.storeId);
      }
      if (filters?.limit) {
        query = query.limit(filters.limit);
      } else {
        query = query.limit(100);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch profile names separately for submitters and reviewers
      const submitterIds = [...new Set((data || []).map((d: any) => d.submitted_by_user_id).filter(Boolean))];
      const reviewerIds = [...new Set((data || []).map((d: any) => d.reviewed_by_user_id).filter(Boolean))];
      const allUserIds = [...new Set([...submitterIds, ...reviewerIds])];

      let profileMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allUserIds);
        
        profileMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Unknown';
          return acc;
        }, {});
      }

      return (data || []).map((item: any) => ({
        ...item,
        submitter_name: profileMap[item.submitted_by_user_id] || 'Unknown',
        store_name: item.store?.name || 'Unknown Store',
        reviewer_name: item.reviewed_by_user_id ? (profileMap[item.reviewed_by_user_id] || null) : null,
      })) as FieldSubmission[];
    },
  });
}

/**
 * Fetch submissions for a specific store
 */
export function useStoreFieldSubmissions(storeId: string | undefined, limit = 10) {
  return useQuery({
    queryKey: ['field-submissions', 'store', storeId, limit],
    queryFn: async () => {
      if (!storeId) return [];

      const { data, error } = await supabase
        .from('field_submissions')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      // Fetch profile names for submitters
      const submitterIds = [...new Set((data || []).map((d: any) => d.submitted_by_user_id).filter(Boolean))];
      let profileMap: Record<string, string> = {};
      if (submitterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', submitterIds);
        
        profileMap = (profiles || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.id] = p.full_name || 'Unknown';
          return acc;
        }, {});
      }

      return (data || []).map((item: any) => ({
        ...item,
        submitter_name: profileMap[item.submitted_by_user_id] || 'Unknown',
      })) as FieldSubmission[];
    },
    enabled: !!storeId,
  });
}

/**
 * Get submission stats
 */
export function useFieldSubmissionStats() {
  return useQuery({
    queryKey: ['field-submissions', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_submissions')
        .select('submission_status, risk_score');

      if (error) throw error;

      const items = data || [];
      return {
        pending: items.filter(i => i.submission_status === 'pending_review').length,
        approved: items.filter(i => i.submission_status === 'approved').length,
        rejected: items.filter(i => i.submission_status === 'rejected').length,
        autoApproved: items.filter(i => i.submission_status === 'auto_approved').length,
        highRisk: items.filter(i => (i.risk_score || 0) >= 50).length,
        total: items.length,
      };
    },
  });
}

/**
 * Approve a submission
 */
export function useApproveSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('field_submissions')
        .update({
          submission_status: 'approved' as FieldSubmissionStatus,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Submission approved');
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
    },
    onError: (error) => {
      toast.error(`Failed to approve: ${error.message}`);
    },
  });
}

/**
 * Reject a submission
 */
export function useRejectSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ submissionId, reason }: { submissionId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('field_submissions')
        .update({
          submission_status: 'rejected' as FieldSubmissionStatus,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason: reason,
        })
        .eq('id', submissionId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Submission rejected');
      queryClient.invalidateQueries({ queryKey: ['field-submissions'] });
    },
    onError: (error) => {
      toast.error(`Failed to reject: ${error.message}`);
    },
  });
}

/**
 * Get entity type label
 */
export function getEntityTypeLabel(type: FieldEntityType): string {
  const labels: Record<FieldEntityType, string> = {
    brand_sticker: 'Brand Sticker',
    tube_inventory: 'Tube Inventory',
    invoice: 'Invoice',
    invoice_line_item: 'Invoice Line Item',
    order_note: 'Order Note',
    visit_log: 'Visit Log',
    store_update: 'Store Update',
  };
  return labels[type] || type;
}

/**
 * Get action type label
 */
export function getActionTypeLabel(type: FieldActionType): string {
  const labels: Record<FieldActionType, string> = {
    create: 'Created',
    update: 'Updated',
    delete: 'Deleted',
  };
  return labels[type] || type;
}

/**
 * Get status color
 */
export function getStatusColor(status: FieldSubmissionStatus): string {
  const colors: Record<FieldSubmissionStatus, string> = {
    pending_review: 'bg-amber-500/10 text-amber-600',
    approved: 'bg-green-500/10 text-green-600',
    rejected: 'bg-destructive/10 text-destructive',
    auto_approved: 'bg-blue-500/10 text-blue-600',
  };
  return colors[status] || 'bg-muted text-muted-foreground';
}
