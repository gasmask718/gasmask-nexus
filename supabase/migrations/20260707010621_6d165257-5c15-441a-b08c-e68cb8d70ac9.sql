CREATE TABLE IF NOT EXISTS public.funding_client_lender_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  lender_id uuid NOT NULL REFERENCES public.funding_lender_database(id) ON DELETE CASCADE,
  match_score integer NOT NULL DEFAULT 0,
  match_reasons jsonb,
  status text DEFAULT 'identified' CHECK (status IN ('identified','recommended','applied','approved','denied','skipped')),
  matched_at timestamptz DEFAULT now(),
  applied_at timestamptz,
  decision_at timestamptz,
  approved_amount numeric,
  notes text,
  UNIQUE(client_id, lender_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_client_lender_matches TO authenticated;
GRANT ALL ON public.funding_client_lender_matches TO service_role;

ALTER TABLE public.funding_client_lender_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY fclm_service ON public.funding_client_lender_matches
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY fclm_auth ON public.funding_client_lender_matches
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_fclm_client ON public.funding_client_lender_matches(client_id);
CREATE INDEX IF NOT EXISTS idx_fclm_lender ON public.funding_client_lender_matches(lender_id);
CREATE INDEX IF NOT EXISTS idx_fclm_status ON public.funding_client_lender_matches(status);