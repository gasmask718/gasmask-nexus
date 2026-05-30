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
  // New governance fields
  changed_fields: string[] | null;
  risk_reasons: string[] | null;
  submission_source: string | null;
  admin_notes: string | null;
  rollback_of_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  submitter_name?: string;
  store_name?: string;
  store_address?: string;
  reviewer_name?: string;
}

export interface FieldSubmissionFilters {
  status?: FieldSubmissionStatus;
  entityType?: FieldEntityType;
  storeId?: string;
  limit?: number;
  search?: string;
  timeRange?: '24h' | '7d' | '30d' | 'all';
  quickFilter?: 'high_risk' | 'pending_old' | 'multiple_same_user' | null;
}

/**
 * Fetch all field submissions with filters
 */
export function useFieldSubmissions(filters?: FieldSubmissionFilters) {
  return useQuery({
    queryKey: ['field-submissions', filters],
    queryFn: async () => {
      let query = supabase
        .from('field_submissions')
        .select(`
          *,
          store:store_master(store_name, address)
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
      
      // Time range filter
      if (filters?.timeRange && filters.timeRange !== 'all') {
        const now = new Date();
        let cutoff: Date;
        switch (filters.timeRange) {
          case '24h':
            cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          case '7d':
            cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
          case '30d':
            cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          default:
            cutoff = new Date(0);
        }
        query = query.gte('created_at', cutoff.toISOString());
      }
      
      // Quick filters
      if (filters?.quickFilter === 'high_risk') {
        query = query.gte('risk_score', 50);
      } else if (filters?.quickFilter === 'pending_old') {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        query = query
          .eq('submission_status', 'pending_review')
          .lt('created_at', cutoff);
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
      const PLACEHOLDER_NAMES = ['new user', 'unknown', ''];
      
      const isValidName = (name: string | null | undefined): boolean => {
        if (!name) return false;
        return !PLACEHOLDER_NAMES.includes(name.trim().toLowerCase());
      };

      if (allUserIds.length > 0) {
        // Fetch from profiles table (include email for last-resort name)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', allUserIds);
        
        (profiles || []).forEach((p: any) => {
          if (isValidName(p.name)) profileMap[p.id] = p.name;
        });

        // Fill gaps from bikers table (uses 'full_name' + 'user_id')
        const missingIds = allUserIds.filter(id => !profileMap[id]);
        if (missingIds.length > 0) {
          const { data: bikers } = await supabase
            .from('bikers')
            .select('user_id, full_name')
            .in('user_id', missingIds);
          (bikers || []).forEach((b: any) => {
            if (b.user_id && isValidName(b.full_name)) profileMap[b.user_id] = b.full_name;
          });
        }

        // Fill gaps from drivers table
        const stillMissing = allUserIds.filter(id => !profileMap[id]);
        if (stillMissing.length > 0) {
          const { data: drivers } = await supabase
            .from('drivers')
            .select('user_id, full_name')
            .in('user_id', stillMissing);
          (drivers || []).forEach((d: any) => {
            if (d.user_id && isValidName(d.full_name)) profileMap[d.user_id] = d.full_name;
          });
        }

        // Last resort: use email prefix for any still-missing
        if (profiles) {
          const finalMissing = allUserIds.filter(id => !profileMap[id]);
          finalMissing.forEach(id => {
            const profile = (profiles as any[]).find(p => p.id === id);
            if (profile?.email) {
              profileMap[id] = profile.email.split('@')[0];
            }
          });
        }
      }

      let results = (data || []).map((item: any) => ({
        ...item,
        submitter_name: profileMap[item.submitted_by_user_id] || 'Unknown',
        store_name: item.store?.store_name || 'Unknown Store',
        store_address: item.store?.address || null,
        reviewer_name: item.reviewed_by_user_id ? (profileMap[item.reviewed_by_user_id] || null) : null,
      })) as FieldSubmission[];
      
      // Client-side search filter
      if (filters?.search) {
        const searchLower = filters.search.toLowerCase();
        results = results.filter(item => 
          item.store_name?.toLowerCase().includes(searchLower) ||
          item.submitter_name?.toLowerCase().includes(searchLower) ||
          item.entity_type.toLowerCase().includes(searchLower) ||
          item.store_address?.toLowerCase().includes(searchLower)
        );
      }
      
      return results;
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
      const PLACEHOLDER_NAMES = ['new user', 'unknown', ''];
      const isValidName = (name: string | null | undefined): boolean => {
        if (!name) return false;
        return !PLACEHOLDER_NAMES.includes(name.trim().toLowerCase());
      };

      if (submitterIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', submitterIds);
        
        (profiles || []).forEach((p: any) => {
          if (isValidName(p.name)) profileMap[p.id] = p.name;
        });

        const missingIds = submitterIds.filter(id => !profileMap[id]);
        if (missingIds.length > 0) {
          const { data: bikers } = await supabase
            .from('bikers')
            .select('user_id, full_name')
            .in('user_id', missingIds);
          (bikers || []).forEach((b: any) => {
            if (b.user_id && isValidName(b.full_name)) profileMap[b.user_id] = b.full_name;
          });
        }
        const stillMissing = submitterIds.filter(id => !profileMap[id]);
        if (stillMissing.length > 0) {
          const { data: drivers } = await supabase
            .from('drivers')
            .select('user_id, full_name')
            .in('user_id', stillMissing);
          (drivers || []).forEach((d: any) => {
            if (d.user_id && isValidName(d.full_name)) profileMap[d.user_id] = d.full_name;
          });
        }
        // Last resort: email prefix
        if (profiles) {
          submitterIds.filter(id => !profileMap[id]).forEach(id => {
            const p = (profiles as any[]).find(pr => pr.id === id);
            if (p?.email) profileMap[id] = p.email.split('@')[0];
          });
        }
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
 * Get submission stats including quick filter counts
 */
export function useFieldSubmissionStats() {
  return useQuery({
    queryKey: ['field-submissions', 'stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_submissions')
        .select('submission_status, risk_score, created_at, submitted_by_user_id, store_id');

      if (error) throw error;

      const items = data || [];
      const now = Date.now();
      const oneDayAgo = now - 24 * 60 * 60 * 1000;
      
      // Count pending items older than 24h
      const pendingOld = items.filter(i => 
        i.submission_status === 'pending_review' && 
        new Date(i.created_at).getTime() < oneDayAgo
      ).length;
      
      // Count users with multiple submissions to same store in 24h
      const recentSubmissions = items.filter(i => 
        new Date(i.created_at).getTime() > oneDayAgo
      );
      const userStoreMap = new Map<string, number>();
      recentSubmissions.forEach(s => {
        const key = `${s.submitted_by_user_id}-${s.store_id}`;
        userStoreMap.set(key, (userStoreMap.get(key) || 0) + 1);
      });
      const multipleSameUser = Array.from(userStoreMap.values()).filter(count => count >= 2).length;
      
      return {
        pending: items.filter(i => i.submission_status === 'pending_review').length,
        approved: items.filter(i => i.submission_status === 'approved').length,
        rejected: items.filter(i => i.submission_status === 'rejected').length,
        autoApproved: items.filter(i => i.submission_status === 'auto_approved').length,
        highRisk: items.filter(i => (i.risk_score || 0) >= 50).length,
        pendingOld,
        multipleSameUser,
        total: items.length,
      };
    },
  });
}

/**
 * Approve a submission AND apply the mutation
 */
export function useApproveSubmission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (submissionId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch submission to get submitter info
      const { data: submission } = await supabase
        .from('field_submissions')
        .select('submitted_by_user_id, entity_type, store_id, store:store_master(store_name)')
        .eq('id', submissionId)
        .single();

      // Step 1: Update status to approved + record reviewer
      const { error: statusError } = await supabase
        .from('field_submissions')
        .update({
          submission_status: 'approved' as FieldSubmissionStatus,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (statusError) throw statusError;

      // Step 2: Call RPC to apply the mutation
      const { data: applyResult, error: applyError } = await supabase
        .rpc('apply_field_submission', {
          p_submission_id: submissionId,
        });

      if (applyError) throw applyError;

      // Step 3: Verify success
      const result = applyResult as Record<string, unknown>;
      if (!result?.success) {
        throw new Error((result?.error as string) || 'Failed to apply submission mutation');
      }

      // Step 4: Notify submitter
      if (submission?.submitted_by_user_id) {
        const storeName = (submission as any)?.store?.store_name || 'a store';
        const entityLabel = getEntityTypeLabel(submission.entity_type as FieldEntityType);
        await supabase.from('notifications').insert({
          user_id: submission.submitted_by_user_id,
          type: 'submission_approved',
          title: 'Change Approved ✅',
          message: `Your ${entityLabel} change for ${storeName} has been approved and applied.`,
          entity_type: 'field_submission',
          entity_id: submissionId,
          action_url: `/portal/biker`,
        }).throwOnError();
      }

      return result;
    },
    onSuccess: () => {
      toast.success('Submission approved and applied');
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

      // Fetch submission to get submitter info
      const { data: submission } = await supabase
        .from('field_submissions')
        .select('submitted_by_user_id, entity_type, store_id, store:store_master(store_name)')
        .eq('id', submissionId)
        .single();

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

      // Notify submitter of rejection
      if (submission?.submitted_by_user_id) {
        const storeName = (submission as any)?.store?.store_name || 'a store';
        const entityLabel = getEntityTypeLabel(submission.entity_type as FieldEntityType);
        await supabase.from('notifications').insert({
          user_id: submission.submitted_by_user_id,
          type: 'submission_rejected',
          title: 'Change Rejected ❌',
          message: `Your ${entityLabel} change for ${storeName} was rejected. Reason: ${reason}`,
          entity_type: 'field_submission',
          entity_id: submissionId,
          action_url: `/portal/biker`,
        }).throwOnError();
      }
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
    store_contact: 'Store Contact',
    wholesaler_association: 'Wholesaler Association',
    connected_store: 'Connected Store',
    store_questionnaire: 'Questionnaire',
    new_store: 'New Store',
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
 * Get pending submissions count - for nav badge
 */
export function usePendingFieldSubmissionsCount() {
  return useQuery({
    queryKey: ['field-submissions', 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('field_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('submission_status', 'pending_review');
      
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });
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
