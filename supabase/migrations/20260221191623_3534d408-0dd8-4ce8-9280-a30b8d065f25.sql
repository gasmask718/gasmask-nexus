
-- Strict Verification Snapshots table
CREATE TABLE IF NOT EXISTS public.audit_verification_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  batch_id uuid NOT NULL REFERENCES public.audit_batches(id) ON DELETE CASCADE,
  store_id uuid NULL,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'verified' CHECK (status IN ('verified', 'issues_found')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_verification_snapshots_batch_idx ON public.audit_verification_snapshots (batch_id);
CREATE INDEX IF NOT EXISTS audit_verification_snapshots_store_idx ON public.audit_verification_snapshots (store_id);

-- Enable RLS
ALTER TABLE public.audit_verification_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_verification_snapshots_owner_admin_all"
ON public.audit_verification_snapshots
FOR ALL
USING (public.has_audit_engine_access(auth.uid()))
WITH CHECK (public.has_audit_engine_access(auth.uid()));
