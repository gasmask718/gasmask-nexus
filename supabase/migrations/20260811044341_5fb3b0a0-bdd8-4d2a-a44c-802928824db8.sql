ALTER TABLE public.clipper_applications ADD COLUMN IF NOT EXISTS clipper_account_id uuid REFERENCES public.clipper_accounts(id) ON DELETE SET NULL;
ALTER TABLE public.clipper_accounts ADD COLUMN IF NOT EXISTS application_id uuid REFERENCES public.clipper_applications(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_clipper_accounts_application_id ON public.clipper_accounts(application_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clipper_accounts_user_id_uniq ON public.clipper_accounts(user_id) WHERE user_id IS NOT NULL;

-- Public should never be able to self-create a clipper account row.
DROP POLICY IF EXISTS ca_insert ON public.clipper_accounts;
CREATE POLICY ca_admin_insert ON public.clipper_accounts
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role));

-- The approval edge function now owns the approval email (it includes the login link),
-- so the legacy duplicate-email trigger is retired.
DROP TRIGGER IF EXISTS after_clipper_approved ON public.clipper_accounts;
DROP TRIGGER IF EXISTS trg_notify_clipper_approved ON public.clipper_accounts;