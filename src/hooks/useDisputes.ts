/**
 * Commission Disputes Hook - Full dispute lifecycle management
 * RLS-scoped, status-aware, audit-safe
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// =====================================================
// TYPES
// =====================================================

export type DisputeStatus = 'submitted' | 'under_review' | 'needs_info' | 'approved' | 'rejected' | 'resolved';
export type DisputeReasonCode = 'missing_commission' | 'wrong_rate' | 'wrong_amount' | 'duplicate' | 'refund' | 'other';
export type DisputePriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Dispute {
  id: string;
  ambassador_id: string;
  commission_ledger_id: string | null;
  store_id: string | null;
  source_channel: string | null;
  source_id: string | null;
  reason_code: DisputeReasonCode;
  title: string | null;
  description: string;
  requested_amount: number | null;
  currency: string;
  status: DisputeStatus;
  priority: DisputePriority;
  submitted_at: string;
  updated_at: string;
  assigned_admin_user_id: string | null;
  admin_notes: string | null;
  resolution_summary: string | null;
  adjustment_ledger_id: string | null;
  reviewed_at: string | null;
  resolved_at: string | null;
  // Joined fields
  ambassador_name?: string;
  ledger_source_name?: string;
  ledger_amount?: number;
  message_count?: number;
  evidence_count?: number;
}

export interface DisputeMessage {
  id: string;
  dispute_id: string;
  author_role: 'ambassador' | 'admin';
  author_ambassador_id: string | null;
  author_admin_user_id: string | null;
  message: string;
  created_at: string;
}

export interface DisputeEvidence {
  id: string;
  dispute_id: string;
  uploaded_by_ambassador_id: string | null;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  created_at: string;
}

export interface DisputeKPIs {
  ambassador_id: string;
  open_disputes: number;
  approved_disputes: number;
  rejected_disputes: number;
  resolved_disputes: number;
  total_disputes: number;
}

export interface CreateDisputeInput {
  commission_ledger_id?: string;
  store_id?: string;
  source_channel?: string;
  source_id?: string;
  reason_code: DisputeReasonCode;
  title?: string;
  description: string;
  requested_amount?: number;
}

// =====================================================
// AMBASSADOR HOOKS
// =====================================================

/**
 * Fetch all disputes for current ambassador (RLS-scoped)
 */
export function useDisputes() {
  return useQuery({
    queryKey: ['disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_disputes')
        .select(`
          *,
          commission_ledger(source_name, commission_amount)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map((d: any) => ({
        ...d,
        ledger_source_name: d.commission_ledger?.source_name,
        ledger_amount: d.commission_ledger?.commission_amount,
      })) as Dispute[];
    },
  });
}

/**
 * Fetch single dispute with messages and evidence
 */
export function useDispute(disputeId: string | undefined) {
  return useQuery({
    queryKey: ['dispute', disputeId],
    queryFn: async () => {
      if (!disputeId) return null;
      
      // Use commission_ledger_id hint to specify which FK to use
      const { data, error } = await supabase
        .from('commission_disputes')
        .select(`
          *,
          ledger:commission_ledger!commission_ledger_id(source_name, commission_amount, earned_at),
          store_master(store_name)
        `)
        .eq('id', disputeId)
        .single();

      if (error) throw error;
      
      // Transform to expected shape
      const dispute = data as any;
      return {
        ...dispute,
        commission_ledger: dispute.ledger,
      } as Dispute & { 
        commission_ledger?: { source_name: string; commission_amount: number; earned_at: string };
        store_master?: { store_name: string };
      };
    },
    enabled: !!disputeId,
  });
}

/**
 * Fetch messages for a dispute
 */
export function useDisputeMessages(disputeId: string | undefined) {
  return useQuery({
    queryKey: ['dispute-messages', disputeId],
    queryFn: async () => {
      if (!disputeId) return [];
      
      const { data, error } = await supabase
        .from('commission_dispute_messages')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as DisputeMessage[];
    },
    enabled: !!disputeId,
  });
}

/**
 * Fetch evidence for a dispute
 */
export function useDisputeEvidence(disputeId: string | undefined) {
  return useQuery({
    queryKey: ['dispute-evidence', disputeId],
    queryFn: async () => {
      if (!disputeId) return [];
      
      const { data, error } = await supabase
        .from('commission_dispute_evidence')
        .select('*')
        .eq('dispute_id', disputeId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as DisputeEvidence[];
    },
    enabled: !!disputeId,
  });
}

/**
 * Fetch dispute KPIs for current ambassador
 */
export function useDisputeKPIs() {
  return useQuery({
    queryKey: ['dispute-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dispute_kpis')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return (data || {
        open_disputes: 0,
        approved_disputes: 0,
        rejected_disputes: 0,
        resolved_disputes: 0,
        total_disputes: 0,
      }) as DisputeKPIs;
    },
  });
}

// =====================================================
// AMBASSADOR MUTATIONS
// =====================================================

/**
 * Create a new dispute
 */
export function useCreateDispute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: CreateDisputeInput) => {
      // Get current ambassador ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      if (!ambassador) throw new Error('Not an ambassador');
      
      const { data, error } = await supabase
        .from('commission_disputes')
        .insert({
          ambassador_id: ambassador.id,
          commission_ledger_id: input.commission_ledger_id || null,
          store_id: input.store_id || null,
          source_channel: input.source_channel || null,
          source_id: input.source_id || null,
          reason_code: input.reason_code,
          title: input.title || null,
          description: input.description,
          requested_amount: input.requested_amount || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-kpis'] });
      toast.success('Dispute submitted successfully');
    },
    onError: (error) => {
      toast.error(`Failed to submit dispute: ${error.message}`);
    },
  });
}

/**
 * Add a message to a dispute
 */
export function useAddDisputeMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ disputeId, message }: { disputeId: string; message: string }) => {
      // Get current ambassador ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      const { data, error } = await supabase
        .from('commission_dispute_messages')
        .insert({
          dispute_id: disputeId,
          author_role: ambassador ? 'ambassador' : 'admin',
          author_ambassador_id: ambassador?.id || null,
          author_admin_user_id: ambassador ? null : user.id,
          message,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Message sent');
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}

/**
 * Upload evidence to a dispute
 */
export function useUploadEvidence() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ disputeId, file }: { disputeId: string; file: File }) => {
      // Get current ambassador ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      const { data: ambassador } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('user_id', user.id)
        .single();
      
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const filePath = `disputes/${disputeId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('dispute-evidence')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;
      
      // dispute-evidence is private: persist the object path, sign it at read time.
      
      // Create evidence record
      const { data, error } = await supabase
        .from('commission_dispute_evidence')
        .insert({
          dispute_id: disputeId,
          uploaded_by_ambassador_id: ambassador?.id || null,
          file_url: filePath,
          file_name: file.name,
          mime_type: file.type,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['dispute-evidence', disputeId] });
      toast.success('Evidence uploaded');
    },
    onError: (error) => {
      toast.error(`Failed to upload evidence: ${error.message}`);
    },
  });
}

// =====================================================
// ADMIN HOOKS
// =====================================================

/**
 * Fetch admin dispute queue
 */
export function useAdminDisputeQueue(filters?: {
  status?: DisputeStatus;
  priority?: DisputePriority;
  ambassadorId?: string;
}) {
  return useQuery({
    queryKey: ['admin-dispute-queue', filters],
    queryFn: async () => {
      let query = supabase
        .from('admin_dispute_queue')
        .select('*')
        .order('priority', { ascending: false })
        .order('submitted_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.ambassadorId) {
        query = query.eq('ambassador_id', filters.ambassadorId);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Admin queue view has different fields - cast appropriately
      return (data || []) as unknown as Dispute[];
    },
  });
}

// =====================================================
// ADMIN MUTATIONS
// =====================================================

/**
 * Admin: Pick up a dispute
 */
export function useAdminPickupDispute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (disputeId: string) => {
      const { error } = await supabase.rpc('admin_pickup_dispute', {
        p_dispute_id: disputeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-queue'] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Dispute assigned to you');
    },
    onError: (error) => {
      toast.error(`Failed to pick up dispute: ${error.message}`);
    },
  });
}

/**
 * Admin: Request more info
 */
export function useAdminRequestInfo() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ disputeId, message }: { disputeId: string; message: string }) => {
      const { error } = await supabase.rpc('admin_request_info', {
        p_dispute_id: disputeId,
        p_message: message,
      });
      if (error) throw error;
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['dispute-messages', disputeId] });
      toast.success('Information requested from ambassador');
    },
    onError: (error) => {
      toast.error(`Failed to request info: ${error.message}`);
    },
  });
}

/**
 * Admin: Approve dispute with adjustment
 */
export function useAdminApproveDispute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      disputeId, 
      adjustmentAmount, 
      resolutionSummary 
    }: { 
      disputeId: string; 
      adjustmentAmount: number; 
      resolutionSummary?: string;
    }) => {
      const { data, error } = await supabase.rpc('admin_approve_dispute', {
        p_dispute_id: disputeId,
        p_adjustment_amount: adjustmentAmount,
        p_resolution_summary: resolutionSummary || null,
      });
      if (error) throw error;
      return data as string; // adjustment ledger ID
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['commission-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['commission-totals'] });
      toast.success('Dispute approved and adjustment created');
    },
    onError: (error) => {
      toast.error(`Failed to approve dispute: ${error.message}`);
    },
  });
}

/**
 * Admin: Reject dispute
 */
export function useAdminRejectDispute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      disputeId, 
      resolutionSummary 
    }: { 
      disputeId: string; 
      resolutionSummary?: string;
    }) => {
      const { error } = await supabase.rpc('admin_reject_dispute', {
        p_dispute_id: disputeId,
        p_resolution_summary: resolutionSummary || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      toast.success('Dispute rejected');
    },
    onError: (error) => {
      toast.error(`Failed to reject dispute: ${error.message}`);
    },
  });
}

/**
 * Admin: Resolve dispute (final step)
 */
export function useAdminResolveDispute() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      disputeId, 
      adminNotes 
    }: { 
      disputeId: string; 
      adminNotes?: string;
    }) => {
      const { error } = await supabase.rpc('admin_resolve_dispute', {
        p_dispute_id: disputeId,
        p_admin_notes: adminNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { disputeId }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-dispute-queue'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes'] });
      queryClient.invalidateQueries({ queryKey: ['dispute-kpis'] });
      toast.success('Dispute resolved');
    },
    onError: (error) => {
      toast.error(`Failed to resolve dispute: ${error.message}`);
    },
  });
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

export const REASON_CODE_LABELS: Record<DisputeReasonCode, string> = {
  missing_commission: 'Missing Commission',
  wrong_rate: 'Incorrect Rate Applied',
  wrong_amount: 'Wrong Amount Calculated',
  duplicate: 'Duplicate Entry',
  refund: 'Refund-Related Issue',
  other: 'Other',
};

export const STATUS_LABELS: Record<DisputeStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  needs_info: 'Needs Information',
  approved: 'Approved',
  rejected: 'Rejected',
  resolved: 'Resolved',
};

export const STATUS_COLORS: Record<DisputeStatus, string> = {
  submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  under_review: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  needs_info: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  approved: 'bg-green-500/10 text-green-400 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  resolved: 'bg-muted text-muted-foreground border-border',
};

export const PRIORITY_COLORS: Record<DisputePriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/10 text-blue-400',
  high: 'bg-amber-500/10 text-amber-400',
  urgent: 'bg-red-500/10 text-red-400',
};
