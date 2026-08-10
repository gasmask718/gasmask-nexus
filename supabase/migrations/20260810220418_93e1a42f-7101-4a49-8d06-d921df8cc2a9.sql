ALTER TABLE public.grant_business_profiles
  ADD COLUMN IF NOT EXISTS funding_client_id uuid REFERENCES public.funding_clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gbp_funding_client_id
  ON public.grant_business_profiles(funding_client_id)
  WHERE funding_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_grant_applications_funding_client_id
  ON public.grant_applications(funding_client_id)
  WHERE funding_client_id IS NOT NULL;

-- Unified Capital Plan read-model. SECURITY DEFINER so it can aggregate across
-- both engines, but it enforces the same access rule as the underlying tables.
CREATE OR REPLACE FUNCTION public.get_capital_plan(_client_id uuid)
RETURNS TABLE (
  client_id uuid,
  source text,
  reference_id uuid,
  counterparty text,
  status text,
  amount_requested numeric,
  amount_approved numeric,
  amount_funded numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_funding_staff(auth.uid())
    OR public.is_grants_staff()
    OR public.is_funding_client_self(_client_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT
    fa.client_id,
    'funding'::text,
    fa.id,
    COALESCE(fa.lender_name, 'Unknown lender')::text,
    fa.status::text,
    COALESCE(fa.amount_requested, 0)::numeric,
    COALESCE(fa.amount_approved, 0)::numeric,
    COALESCE(fa.amount_funded, 0)::numeric,
    fa.created_at
  FROM public.funding_applications fa
  WHERE fa.client_id = _client_id

  UNION ALL

  SELECT
    ga.funding_client_id,
    'grant'::text,
    ga.id,
    COALESCE(ga.funder_name, ga.grant_name, 'Unknown funder')::text,
    ga.status::text,
    COALESCE(ga.amount_requested, 0)::numeric,
    COALESCE(ga.amount_awarded, 0)::numeric,
    CASE WHEN ga.award_date IS NOT NULL THEN COALESCE(ga.amount_awarded, 0) ELSE 0 END::numeric,
    ga.created_at
  FROM public.grant_applications ga
  WHERE ga.funding_client_id = _client_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_capital_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_capital_plan(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_capital_plan(uuid) TO service_role;