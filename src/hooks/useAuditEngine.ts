import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Cast helper for tables not yet in generated types
const db = supabase as any;

// ═══ Types (matching exact DB schema) ═══

export interface AuditBatch {
  id: string;
  created_at: string;
  created_by: string;
  source_type: string;
  raw_text: string;
  model_name: string | null;
  status: 'processing' | 'completed' | 'failed';
  error_message: string | null;
  totals: {
    events_created?: number;
    flags_created?: number;
    drafts_created?: number;
    unlinked_events?: number;
  };
}

export interface AuditNoteEvent {
  id: string;
  created_at: string;
  batch_id: string;
  store_id: string | null;
  store_match_method: 'exact' | 'fuzzy' | 'address' | 'phone' | 'unlinked' | null;
  store_match_confidence: number | null;
  event_date: string | null;
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  brand: string | null;
  product: string | null;
  sku: string | null;
  quantity_numeric: number | null;
  quantity_raw: string | null;
  amount_paid: number | null;
  amount_unpaid: number | null;
  raw_line: string;
  parsed: Record<string, any>;
  confidence_score: number;
}

export interface AuditFlag {
  id: string;
  created_at: string;
  batch_id: string;
  store_id: string | null;
  event_id: string | null;
  flag_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved' | 'dismissed';
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  evidence: Record<string, any>;
  confidence_score: number;
}

export interface AuditInvoiceDraft {
  id: string;
  created_at: string;
  batch_id: string;
  store_id: string | null;
  invoice_date: string | null;
  currency: string;
  line_items: Array<{
    brand?: string;
    product?: string;
    sku?: string;
    qty?: number;
    qty_raw?: string;
    unit_price?: number;
    line_total?: number;
  }>;
  subtotal: number | null;
  taxes: number | null;
  total: number | null;
  payment_status: 'unknown' | 'unpaid' | 'partial' | 'paid';
  notes: string | null;
  source_event_ids: string[];
  source_raw_excerpt: string | null;
  confidence_score: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  finalize_status: 'not_finalized' | 'ready_to_finalize' | 'finalized';
  finalized_invoice_id: string | null;
  finalized_by: string | null;
  finalized_at: string | null;
}

// ═══ Parse Notes ═══
export function useParseNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rawText: string) => {
      const { data, error } = await supabase.functions.invoke('audit-note-parser', {
        body: { raw_text: rawText, source_type: 'raw_text_paste' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        batch_id: string;
        status: string;
        totals: {
          events_created: number;
          flags_created: number;
          drafts_created: number;
          unlinked_events: number;
        };
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-batches'] });
      queryClient.invalidateQueries({ queryKey: ['audit-events'] });
      queryClient.invalidateQueries({ queryKey: ['audit-flags'] });
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      const t = data.totals;
      toast.success(`Parsed: ${t.events_created} events, ${t.flags_created} flags, ${t.drafts_created} drafts`);
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

// ═══ Approve/Reject Draft ═══
export function useProcessDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      draftId: string;
      action: 'approve' | 'reject';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get draft before state for audit log
      const { data: draftBefore } = await db
        .from('audit_invoice_drafts')
        .select('*')
        .eq('id', params.draftId)
        .single();

      if (params.action === 'approve') {
        const { error } = await db
          .from('audit_invoice_drafts')
          .update({
            approval_status: 'approved',
            approved_by: user.id,
            approved_at: new Date().toISOString(),
            finalize_status: 'ready_to_finalize',
          })
          .eq('id', params.draftId);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('audit_invoice_drafts')
          .update({ approval_status: 'rejected' })
          .eq('id', params.draftId);
        if (error) throw error;
      }

      // Write immutable audit log
      await db.from('audit_approvals_log').insert({
        actor_id: user.id,
        entity_type: 'draft',
        entity_id: params.draftId,
        action: params.action,
        before: draftBefore || null,
        after: { approval_status: params.action === 'approve' ? 'approved' : 'rejected' },
        note: params.notes || null,
        batch_id: draftBefore?.batch_id || null,
        store_id: draftBefore?.store_id || null,
      });

      return true;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      toast.success(vars.action === 'approve' ? 'Draft approved → ready to finalize' : 'Draft rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to process draft');
    },
  });
}

// ═══ Resolve / Dismiss Flag ═══
export function useResolveFlag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { flagId: string; action?: 'resolve' | 'dismiss'; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const action = params.action || 'resolve';

      const { data: flagBefore } = await db
        .from('audit_flags')
        .select('*')
        .eq('id', params.flagId)
        .single();

      const { error } = await db
        .from('audit_flags')
        .update({
          status: action === 'dismiss' ? 'dismissed' : 'resolved',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
          resolution_note: params.notes || null,
        })
        .eq('id', params.flagId);
      if (error) throw error;

      await db.from('audit_approvals_log').insert({
        actor_id: user.id,
        entity_type: 'flag',
        entity_id: params.flagId,
        action: action,
        before: flagBefore || null,
        after: { status: action === 'dismiss' ? 'dismissed' : 'resolved' },
        note: params.notes || null,
        batch_id: flagBefore?.batch_id || null,
        store_id: flagBefore?.store_id || null,
      });

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-flags'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      toast.success('Flag resolved');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to resolve flag');
    },
  });
}

// ═══ Finalize Intent (two-step gate — Step 1) ═══
export function useFinalizeIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { draftId: string; notes?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: draft } = await db
        .from('audit_invoice_drafts')
        .select('*')
        .eq('id', params.draftId)
        .single();

      if (draft?.approval_status !== 'approved' || draft?.finalize_status !== 'ready_to_finalize') {
        throw new Error('Draft must be approved before finalization');
      }

      await db.from('audit_approvals_log').insert({
        actor_id: user.id,
        entity_type: 'draft',
        entity_id: params.draftId,
        action: 'finalize_intent',
        before: draft,
        note: params.notes || null,
        batch_id: draft?.batch_id || null,
        store_id: draft?.store_id || null,
      });

      return draft as AuditInvoiceDraft;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      toast.info('Finalization prepared — confirm to create live invoice');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to prepare finalization');
    },
  });
}

// ═══ Finalize Draft — Step 2: Create Live Invoice ═══
export function useFinalizeDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draftId: string) => {
      const { data, error } = await supabase.functions.invoke('finalize-audit-draft', {
        body: { draft_id: draftId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        status: string;
        draft_id: string;
        invoice_id: string;
        invoice_number: string;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      toast.success(`✅ Live invoice created: ${data.invoice_number}`);
    },
    onError: (error: any) => {
      console.error('Finalization failed:', error);
      toast.error(error.message || 'Failed to create live invoice');
    },
  });
}

// ═══ Reconciliation Types ═══
export interface AuditReconciliationResult {
  id: string;
  created_at: string;
  batch_id: string;
  store_id: string | null;
  reconciliation_type: 'missing_note' | 'missing_invoice' | 'orphan_invoice' | 'amount_mismatch' | 'payment_mismatch' | 'duplicate_risk';
  related_event_id: string | null;
  related_invoice_id: string | null;
  recommended_action: 'create_note' | 'create_invoice' | 'update_invoice' | 'mark_paid' | 'merge' | 'review';
  confidence_score: number;
  event_summary: string | null;
  invoice_summary: string | null;
  evidence: Record<string, any>;
  status: 'open' | 'approved' | 'rejected' | 'applied';
  applied_at: string | null;
  applied_by: string | null;
}

// ═══ Verification Snapshot Types ═══
export interface VerificationLedgerEntry {
  date: string | null;
  delivery_event_id: string | null;
  delivery_quantity: number | null;
  delivery_amount: number | null;
  invoice_id: string | null;
  invoice_number: string | null;
  invoice_total: number | null;
  note_id: string | null;
  note_excerpt: string | null;
  payment_status: string | null;
  verification_status: 'matched' | 'confirmed_missing_invoice' | 'confirmed_missing_note' | 'payment_status_error' | 'duplicate_risk';
  failure_reason: string | null;
  confidence: number;
  amount_difference: number | null;
}

export interface AuditVerificationSnapshot {
  id: string;
  created_at: string;
  batch_id: string;
  store_id: string | null;
  snapshot: VerificationLedgerEntry[];
  status: 'verified' | 'issues_found';
  summary: {
    total_deliveries: number;
    matched: number;
    missing_invoices: number;
    missing_notes: number;
    duplicate_risks: number;
    payment_events: number;
  };
}

export interface StrictVerificationResponse {
  batch_id: string;
  status: 'verified_clean' | 'issues_found';
  summary: {
    total_deliveries: number;
    matched_deliveries: number;
    confirmed_missing_invoices: number;
    confirmed_missing_notes: number;
    payment_errors: number;
    duplicate_risks: number;
    stores_verified: number;
    stores_with_issues: number;
  };
  total_results: number;
  total_snapshots: number;
}

// ═══ Run Reconciliation ═══
export function useRunReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke('reconcile-audit-batch', {
        body: { batch_id: batchId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        batch_id: string;
        status: string;
        total_results: number;
        summary: Record<string, number>;
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      const s = data.summary;
      const parts = Object.entries(s).map(([k, v]) => `${v} ${k.replace(/_/g, ' ')}`);
      toast.success(`Reconciliation complete: ${parts.join(', ') || 'no issues found'}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Reconciliation failed');
    },
  });
}

// ═══ Fetch Reconciliation Results ═══
export function useReconciliationResults(batchId: string | null) {
  return useQuery({
    queryKey: ['audit-reconciliation', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await db
        .from('audit_reconciliation_results')
        .select('*')
        .eq('batch_id', batchId)
        .order('reconciliation_type', { ascending: true });
      if (error) throw error;
      return (data || []) as AuditReconciliationResult[];
    },
    enabled: !!batchId,
  });
}

// ═══ Apply Reconciliation Action ═══
export function useApplyReconciliation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      resultId: string;
      action: 'approve' | 'reject';
      notes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: result } = await db
        .from('audit_reconciliation_results')
        .select('*')
        .eq('id', params.resultId)
        .single();
      if (!result) throw new Error('Result not found');

      if (params.action === 'approve') {
        // Apply the recommended action
        if (result.recommended_action === 'create_note' && result.store_id && result.event_summary) {
          await db.from('store_notes').insert({
            store_id: result.store_id,
            note_text: `[Audit Engine] ${result.event_summary}`,
            note_date: new Date().toISOString().substring(0, 10),
            created_by: user.id,
          });
        }

        if (result.recommended_action === 'mark_paid' && result.related_invoice_id) {
          await db.from('invoices').update({
            payment_status: 'paid',
            paid_at: new Date().toISOString(),
          }).eq('id', result.related_invoice_id);
        }

        // Update result status
        const { error } = await db
          .from('audit_reconciliation_results')
          .update({
            status: 'applied',
            applied_at: new Date().toISOString(),
            applied_by: user.id,
          })
          .eq('id', params.resultId);
        if (error) throw error;
      } else {
        const { error } = await db
          .from('audit_reconciliation_results')
          .update({ status: 'rejected' })
          .eq('id', params.resultId);
        if (error) throw error;
      }

      // Write audit log
      await db.from('audit_approvals_log').insert({
        actor_id: user.id,
        entity_type: 'flag',
        entity_id: params.resultId,
        action: params.action,
        before: result,
        after: { status: params.action === 'approve' ? 'applied' : 'rejected' },
        note: params.notes || `Reconciliation: ${result.recommended_action}`,
        batch_id: result.batch_id || null,
        store_id: result.store_id || null,
      });

      return true;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['audit-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      toast.success(vars.action === 'approve' ? 'Action applied' : 'Rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to apply action');
    },
  });
}

// ═══ Strict Verification ═══
export function useStrictVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (batchId: string) => {
      const { data, error } = await supabase.functions.invoke('strict-verify-batch', {
        body: { batch_id: batchId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as StrictVerificationResponse;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['audit-reconciliation'] });
      queryClient.invalidateQueries({ queryKey: ['audit-verification-snapshots'] });
      queryClient.invalidateQueries({ queryKey: ['audit-metrics'] });
      if (data.status === 'verified_clean') {
        toast.success('✅ CLEAN — 100% of deliveries accounted for');
      } else {
        const s = data.summary;
        toast.warning(`Issues found: ${s.confirmed_missing_invoices} missing invoices, ${s.confirmed_missing_notes} missing notes, ${s.payment_errors} payment errors`);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'Strict verification failed');
    },
  });
}

// ═══ Fetch Verification Snapshots ═══
export function useVerificationSnapshots(batchId: string | null) {
  return useQuery({
    queryKey: ['audit-verification-snapshots', batchId],
    queryFn: async () => {
      if (!batchId) return [];
      const { data, error } = await db
        .from('audit_verification_snapshots')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as AuditVerificationSnapshot[];
    },
    enabled: !!batchId,
  });
}

// ═══ Audit Metrics ═══
export function useAuditMetrics() {
  return useQuery({
    queryKey: ['audit-metrics'],
    queryFn: async () => {
      const [batchesRes, flagsRes, draftsRes, reconRes] = await Promise.all([
        db.from('audit_batches').select('totals, status'),
        db.from('audit_flags').select('status, flag_type'),
        db.from('audit_invoice_drafts').select('approval_status, total, finalize_status'),
        db.from('audit_reconciliation_results').select('status, reconciliation_type'),
      ]);

      const batches = (batchesRes.data || []) as AuditBatch[];
      const flags = (flagsRes.data || []) as AuditFlag[];
      const drafts = (draftsRes.data || []) as AuditInvoiceDraft[];
      const recon = (reconRes.data || []) as AuditReconciliationResult[];

      const totalEvents = batches.reduce((sum, b) => sum + (b.totals?.events_created || 0), 0);
      const openFlags = flags.filter(f => f.status === 'open').length;
      const pendingDrafts = drafts.filter(d => d.approval_status === 'pending').length;
      const approvedDrafts = drafts.filter(d => d.approval_status === 'approved').length;
      const readyToFinalize = drafts.filter(d => d.finalize_status === 'ready_to_finalize').length;
      const estimatedRecovery = drafts
        .filter(d => d.approval_status === 'approved')
        .reduce((sum, d) => sum + (d.total || 0), 0);
      const missingInvoices = flags.filter(f => f.flag_type === 'MISSING_INVOICE').length;
      const unmatchedPayments = flags.filter(f => f.flag_type === 'PAYMENT_UNMATCHED').length;
      const openRecon = recon.filter(r => r.status === 'open').length;

      return {
        totalEvents,
        openFlags,
        pendingDrafts,
        approvedDrafts,
        readyToFinalize,
        estimatedRecovery,
        missingInvoices,
        unmatchedPayments,
        totalBatches: batches.length,
        openRecon,
      };
    },
  });
}
