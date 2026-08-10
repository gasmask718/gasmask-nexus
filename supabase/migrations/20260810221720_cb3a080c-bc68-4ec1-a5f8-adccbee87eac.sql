-- 1. Client-facing grant applications must carry a valid funding client.
CREATE OR REPLACE FUNCTION public.enforce_grant_application_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.applicant_type = 'funding_client' THEN
    IF NEW.funding_client_id IS NULL THEN
      RAISE EXCEPTION 'client-facing grant applications require funding_client_id';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.funding_clients fc WHERE fc.id = NEW.funding_client_id) THEN
      RAISE EXCEPTION 'funding_client_id % does not exist', NEW.funding_client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_application_identity ON public.grant_applications;
CREATE TRIGGER trg_grant_application_identity
BEFORE INSERT OR UPDATE ON public.grant_applications
FOR EACH ROW EXECUTE FUNCTION public.enforce_grant_application_identity();

-- 2. Lookup indexes for client-scoped reads.
CREATE INDEX IF NOT EXISTS idx_grant_applications_funding_client
  ON public.grant_applications(funding_client_id) WHERE funding_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_client_grant_matches_client
  ON public.client_grant_matches(client_id);

-- 3. One identity for eligibility: results resolve through the profile to the client.
CREATE OR REPLACE VIEW public.grant_eligibility_by_client
WITH (security_invoker = on) AS
SELECT
  p.funding_client_id,
  p.id            AS business_profile_id,
  p.business_name,
  r.id            AS eligibility_result_id,
  r.grant_opportunity_id,
  r.eligibility_status,
  r.eligibility_score,
  r.application_status,
  r.last_checked_at
FROM public.grant_business_profiles p
JOIN public.grant_eligibility_results r ON r.business_profile_id = p.id;

GRANT SELECT ON public.grant_eligibility_by_client TO authenticated;
GRANT SELECT ON public.grant_eligibility_by_client TO service_role;