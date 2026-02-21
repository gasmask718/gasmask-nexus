
-- Phase 3: Note–Invoice Reconciliation Engine
-- Table: audit_reconciliation_results

CREATE TABLE IF NOT EXISTS public.audit_reconciliation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.audit_batches(id) ON DELETE CASCADE,
  store_id uuid NULL,
  
  reconciliation_type text NOT NULL CHECK (reconciliation_type IN (
    'missing_note',
    'missing_invoice',
    'orphan_invoice',
    'amount_mismatch',
    'payment_mismatch',
    'duplicate_risk'
  )),
  
  related_event_id uuid NULL REFERENCES public.audit_note_events(id) ON DELETE SET NULL,
  related_invoice_id uuid NULL,
  
  recommended_action text NOT NULL CHECK (recommended_action IN (
    'create_note',
    'create_invoice',
    'update_invoice',
    'mark_paid',
    'merge',
    'review'
  )),
  
  confidence_score numeric(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  
  event_summary text NULL,
  invoice_summary text NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','approved','rejected','applied')),
  applied_at timestamptz NULL,
  applied_by uuid NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS audit_recon_batch_idx ON public.audit_reconciliation_results (batch_id);
CREATE INDEX IF NOT EXISTS audit_recon_store_idx ON public.audit_reconciliation_results (store_id);
CREATE INDEX IF NOT EXISTS audit_recon_status_idx ON public.audit_reconciliation_results (status);
CREATE INDEX IF NOT EXISTS audit_recon_type_idx ON public.audit_reconciliation_results (reconciliation_type);

-- RLS
ALTER TABLE public.audit_reconciliation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_recon_owner_admin_select"
ON public.audit_reconciliation_results
FOR SELECT
USING (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_recon_owner_admin_insert"
ON public.audit_reconciliation_results
FOR INSERT
WITH CHECK (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_recon_owner_admin_update"
ON public.audit_reconciliation_results
FOR UPDATE
USING (public.has_audit_engine_access(auth.uid()));
