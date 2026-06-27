ALTER TABLE public.tt_partners
ADD COLUMN IF NOT EXISTS application_id_external UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_tt_partners_application_external
ON public.tt_partners(application_id_external)
WHERE application_id_external IS NOT NULL;