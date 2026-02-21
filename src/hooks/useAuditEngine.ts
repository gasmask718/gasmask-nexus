import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cast helper for new tables not yet in generated types
const db = supabase as any;

// ═══ Types ═══
export interface AuditBatch {
  id: string;
  raw_input: string;
  input_type: string;
  total_events: number;
  total_flags: number;
  total_drafts: number;
  status: string;
  ai_summary: string | null;
  processed_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AuditNoteEvent {
  id: string;
  batch_id: string;
  raw_text: string;
  store_id: string | null;
  store_name_raw: string | null;
  event_date: string | null;
  event_type: string;
  product: string | null;
  quantity: number | null;
  payment_amount: number | null;
  unpaid_balance: number | null;
  notes: string | null;
  confidence_score: number;
  linked: boolean;
  created_at: string;
}

export interface AuditFlag {
  id: string;
  batch_id: string;
  event_id: string | null;
  store_id: string | null;
  flag_type: string;
  description: string;
  severity: string;
  status: string;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
}

export interface AuditInvoiceDraft {
  id: string;
  batch_id: string;
  store_id: string | null;
  store_name_inferred: string | null;
  inferred_date: string | null;
  brand: string | null;
  products: any[];
  estimated_total: number;
  payment_status_inferred: string;
  confidence_score: number;
  source_event_ids: string[];
  source_notes: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  finalized_invoice_id: string | null;
  created_at: string;
}

// ═══ Parse Notes ═══
export function useParseNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rawText: string) => {
      const { data, error } = await supabase.functions.invoke('audit-note-parser', {
        body: { rawText },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        batch_id: string;
        total_events: number;
        total_flags: number;
        total_drafts: number;
        summary: string | null;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-batches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
      queryClient.invalidateQueries({ queryKey: ['audit-flags'] });
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      toast.success(`Parsed: ${data.total_events} events, ${data.total_flags} flags, ${data.total_drafts} drafts`);
    },
    onError: (error: any) => {
      console.error('Parse failed:', error);
      toast.error(error.message || 'Failed to parse notes');
    },
  });
}

// ═══ Fetch Batches ═══
export function useAuditBatches() {
  return useQuery({
    queryKey: ['audit-batches'],
    queryFn: async () => {
      const { data, error } = await db
        .from('audit_batches')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AuditBatch[];
    },
  });
}

// ═══ Fetch Events for Batch ═══
export function useAuditEvents(batchId: string | null) {
  return useQuery({
    queryKey: ['audit-events', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await db
        .from('audit_note_events')
        .select('*')
        .eq('batch_id', batchId)
        .order('event_date', { ascending: true });
      if (error) throw error;
      return (data || []) as AuditNoteEvent[];
    },
    enabled: !!batchId,
  });
}

// ═══ Fetch Flags for Batch ═══
export function useAuditFlags(batchId: string | null) {
  return useQuery({
    queryKey: ['audit-flags', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await db
        .from('audit_flags')
        .select('*')
        .eq('batch_id', batchId)
        .order('severity', { ascending: false });
      if (error) throw error;
      return (data || []) as AuditFlag[];
    },
    enabled: !!batchId,
  });
}

// ═══ Fetch Invoice Drafts for Batch ═══
export function useAuditDrafts(batchId: string | null) {
  return useQuery({
    queryKey: ['audit-drafts', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await db
        .from('audit_invoice_drafts')
        .select('*')
        .eq('batch_id', batchId)
        .order('confidence_score', { ascending: false });
      if (error) throw error;
      return (data || []) as AuditInvoiceDraft[];
    },
    enabled: !!batchId,
  });
}

// ═══ All Pending Drafts ═══
export function usePendingDrafts() {
  return useQuery({
    queryKey: ['audit-drafts', 'pending'],
    queryFn: async () => {
      const { data, error } = await db
        .from('audit_invoice_drafts')
        .select('*')
        .eq('approval_status', 'pending')
        .order('confidence_score', { ascending: false });
      if (error) throw error;
      return (data || []) as AuditInvoiceDraft[];
    },
  });
}

// ═══ All Open Flags ═══
export function useOpenFlags() {
  return useQuery({
    queryKey: ['audit-flags', 'open'],
    queryFn: async () => {
      const { data, error } = await db
        .from('audit_flags')
        .select('*')
        .eq('status', 'open')
        .order('severity', { ascending: false });
      if (error) throw error;
      return (data || []) as AuditFlag[];
    },
  });
}

// ═══ Approve/Reject Draft ═══
export function useProcessDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      action: 'approve' | 'reject' | 'edit';
      notes?: string;
      rejectionReason?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      await db.from('audit_approvals_log').insert({
        draft_id: params.draftId,
        action: params.action,
        actor_id: user.id,
        notes: params.notes || null,
      });

      if (params.action === 'approve') {
        const { error } = await db
          .from('audit_invoice_drafts')
          .update({
            approval_status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
          })
          .eq('id', params.draftId);
        if (error) throw error;
      } else if (params.action === 'reject') {
        const { error } = await db
          .from('audit_invoice_drafts')
          .update({
            approval_status: 'rejected',
            rejection_reason: params.rejectionReason || params.notes || null,
          })
          .eq('id', params.draftId);
        if (error) throw error;
      }

      return true;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-flags'] });
      toast.success(vars.action === 'approve' ? 'Draft approved' : 'Draft rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process draft');
    },
  });
}

// ═══ Resolve Flag ═══
export function useResolveFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { flagId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await db
        .from('audit_flags')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_notes: params.notes || null,
        })
        .eq('id', params.flagId);
      if (error) throw error;

      await db.from('audit_approvals_log').insert({
        flag_id: params.flagId,
        action: 'resolve_flag',
        actor_id: user.id,
        notes: params.notes || null,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-flags'] });
      toast.success('Flag resolved');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve flag');
    },
  });
}

// ═══ Audit Metrics ═══
export function useAuditMetrics() {
  return useQuery({
    queryKey: ['audit-metrics'],
    queryFn: async () => {
      const [batchesRes, flagsRes, draftsRes] = await Promise.all([
        db.from('audit_batches').select('total_events, total_flags, total_drafts, status'),
        db.from('audit_flags').select('status, flag_type'),
        db.from('audit_invoice_drafts').select('approval_status, estimated_total'),
      ]);

      const batches = (batchesRes.data || []) as any[];
      const flags = (flagsRes.data || []) as any[];
      const drafts = (draftsRes.data || []) as any[];

      const totalEvents = batches.reduce((sum: number, b: any) => sum + (b.total_events || 0), 0);
      const openFlags = flags.filter((f: any) => f.status === 'open').length;
      const pendingDrafts = drafts.filter((d: any) => d.approval_status === 'pending').length;
      const approvedDrafts = drafts.filter((d: any) => d.approval_status === 'approved').length;
      const estimatedRecovery = drafts
        .filter((d: any) => d.approval_status === 'approved')
        .reduce((sum: number, d: any) => sum + (d.estimated_total || 0), 0);
      const missingInvoices = flags.filter((f: any) => f.flag_type === 'MISSING_INVOICE').length;
      const unmatchedPayments = flags.filter((f: any) => f.flag_type === 'PAYMENT_UNMATCHED').length;

      return {
        totalEvents,
        openFlags,
        pendingDrafts,
        approvedDrafts,
        estimatedRecovery,
        missingInvoices,
        unmatchedPayments,
        totalBatches: batches.length,
      };
    },
  });
}
