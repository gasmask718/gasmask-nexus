CREATE TABLE IF NOT EXISTS public.sbo_pending_capper_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  normalized_name text NOT NULL,
  display_name text NOT NULL,
  source text,
  group_type text,
  confidence integer,
  sighting_count integer NOT NULL DEFAULT 1,
  seen_message_ids text[] NOT NULL DEFAULT '{}',
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  promoted_at timestamptz,
  promoted_capper_id uuid,
  rejected_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sbo_pending_capper_identities_norm
  ON public.sbo_pending_capper_identities (normalized_name);

GRANT SELECT ON public.sbo_pending_capper_identities TO authenticated;
GRANT ALL ON public.sbo_pending_capper_identities TO service_role;

ALTER TABLE public.sbo_pending_capper_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Operators can view pending capper identities"
  ON public.sbo_pending_capper_identities
  FOR SELECT
  TO authenticated
  USING (public.is_sbo_operator());

CREATE TRIGGER trg_sbo_pending_capper_identities_updated_at
  BEFORE UPDATE ON public.sbo_pending_capper_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();