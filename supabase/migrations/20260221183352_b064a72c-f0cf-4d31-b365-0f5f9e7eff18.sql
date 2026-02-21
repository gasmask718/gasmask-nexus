
-- ═══ INTELLIGENT AUDIT ENGINE — FULL REBUILD ═══
-- Drop existing tables (cascade) and security function
DROP TABLE IF EXISTS public.audit_approvals_log CASCADE;
DROP TABLE IF EXISTS public.audit_invoice_drafts CASCADE;
DROP TABLE IF EXISTS public.audit_flags CASCADE;
DROP TABLE IF EXISTS public.audit_note_events CASCADE;
DROP TABLE IF EXISTS public.audit_batches CASCADE;
DROP FUNCTION IF EXISTS public.is_owner_admin();

-- ═══ a) audit_batches ═══
CREATE TABLE public.audit_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('raw_text_paste')),
  raw_text text NOT NULL,
  model_name text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  error_message text,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_batches_created_at_idx ON public.audit_batches (created_at DESC);
CREATE INDEX audit_batches_created_by_idx ON public.audit_batches (created_by);

-- ═══ b) audit_note_events ═══
CREATE TABLE public.audit_note_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.audit_batches(id) ON DELETE CASCADE,
  store_id uuid NULL,
  store_match_method text NULL CHECK (store_match_method IN ('exact','fuzzy','address','phone','unlinked')),
  store_match_confidence numeric(5,2) NULL CHECK (store_match_confidence BETWEEN 0 AND 100),
  event_date date NULL,
  event_type text NOT NULL CHECK (event_type IN ('visit','delivery','order_request','payment','unpaid_balance','inventory_check','note_only','unknown')),
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  brand text NULL,
  product text NULL,
  sku text NULL,
  quantity_numeric numeric(12,3) NULL,
  quantity_raw text NULL,
  amount_paid numeric(12,2) NULL,
  amount_unpaid numeric(12,2) NULL,
  raw_line text NOT NULL,
  parsed jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100)
);
CREATE INDEX audit_note_events_batch_idx ON public.audit_note_events (batch_id);
CREATE INDEX audit_note_events_store_idx ON public.audit_note_events (store_id);
CREATE INDEX audit_note_events_date_idx ON public.audit_note_events (event_date);

-- ═══ c) audit_flags ═══
CREATE TABLE public.audit_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.audit_batches(id) ON DELETE CASCADE,
  store_id uuid NULL,
  event_id uuid NULL REFERENCES public.audit_note_events(id) ON DELETE SET NULL,
  flag_type text NOT NULL CHECK (flag_type IN (
    'MISSING_INVOICE','MISSING_NOTE','POSSIBLE_DUPLICATE','PAYMENT_UNMATCHED',
    'QUANTITY_UNPRICED','STORE_NOT_LINKED','FOLLOW_UP_REQUIRED','DATE_AMBIGUOUS','CONFLICTING_AMOUNTS'
  )),
  severity text NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','dismissed')),
  resolution_note text NULL,
  resolved_by uuid NULL,
  resolved_at timestamptz NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence_score numeric(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100)
);
CREATE INDEX audit_flags_batch_idx ON public.audit_flags (batch_id);
CREATE INDEX audit_flags_store_idx ON public.audit_flags (store_id);
CREATE INDEX audit_flags_status_idx ON public.audit_flags (status);

-- ═══ d) audit_invoice_drafts ═══
CREATE TABLE public.audit_invoice_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.audit_batches(id) ON DELETE CASCADE,
  store_id uuid NULL,
  invoice_date date NULL,
  currency text NOT NULL DEFAULT 'USD',
  line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(12,2) NULL,
  taxes numeric(12,2) NULL,
  total numeric(12,2) NULL,
  payment_status text NOT NULL DEFAULT 'unknown' CHECK (payment_status IN ('unknown','unpaid','partial','paid')),
  notes text NULL,
  source_event_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  source_raw_excerpt text NULL,
  confidence_score numeric(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by uuid NULL,
  approved_at timestamptz NULL,
  finalize_status text NOT NULL DEFAULT 'not_finalized' CHECK (finalize_status IN ('not_finalized','ready_to_finalize','finalized')),
  finalized_invoice_id uuid NULL,
  finalized_by uuid NULL,
  finalized_at timestamptz NULL
);
CREATE INDEX audit_invoice_drafts_batch_idx ON public.audit_invoice_drafts (batch_id);
CREATE INDEX audit_invoice_drafts_store_idx ON public.audit_invoice_drafts (store_id);
CREATE INDEX audit_invoice_drafts_approval_idx ON public.audit_invoice_drafts (approval_status);

-- ═══ e) audit_approvals_log (immutable) ═══
CREATE TABLE public.audit_approvals_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('flag','draft')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approve','reject','edit','resolve','dismiss','finalize_intent','finalize_confirmed')),
  before jsonb NULL,
  after jsonb NULL,
  note text NULL,
  batch_id uuid NULL,
  store_id uuid NULL
);
CREATE INDEX audit_approvals_log_created_at_idx ON public.audit_approvals_log (created_at DESC);
CREATE INDEX audit_approvals_log_entity_idx ON public.audit_approvals_log (entity_type, entity_id);

-- ═══ RLS ═══
ALTER TABLE public.audit_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_note_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_invoice_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_approvals_log ENABLE ROW LEVEL SECURITY;

-- Use existing has_audit_engine_access function for policy checks
CREATE POLICY "audit_batches_access" ON public.audit_batches
  FOR ALL USING (public.has_audit_engine_access(auth.uid()))
  WITH CHECK (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_note_events_access" ON public.audit_note_events
  FOR ALL USING (public.has_audit_engine_access(auth.uid()))
  WITH CHECK (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_flags_access" ON public.audit_flags
  FOR ALL USING (public.has_audit_engine_access(auth.uid()))
  WITH CHECK (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_invoice_drafts_access" ON public.audit_invoice_drafts
  FOR ALL USING (public.has_audit_engine_access(auth.uid()))
  WITH CHECK (public.has_audit_engine_access(auth.uid()));

-- Approvals log: select for all authorized, insert only (immutable)
CREATE POLICY "audit_approvals_log_select" ON public.audit_approvals_log
  FOR SELECT USING (public.has_audit_engine_access(auth.uid()));

CREATE POLICY "audit_approvals_log_insert" ON public.audit_approvals_log
  FOR INSERT WITH CHECK (public.has_audit_engine_access(auth.uid()));
