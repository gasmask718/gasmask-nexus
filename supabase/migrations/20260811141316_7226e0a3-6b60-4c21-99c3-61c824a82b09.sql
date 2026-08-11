
-- 1. Repair get_capital_plan (referenced non-existent funding_applications columns)
CREATE OR REPLACE FUNCTION public.get_capital_plan(_client_id uuid)
 RETURNS TABLE(client_id uuid, source text, reference_id uuid, counterparty text, status text, amount_requested numeric, amount_approved numeric, amount_funded numeric, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    COALESCE(fa.requested_amount, 0)::numeric,
    COALESCE(fa.approved_amount, 0)::numeric,
    CASE WHEN lower(fa.status) IN ('funded','closed_funded') THEN COALESCE(fa.approved_amount, 0) ELSE 0 END::numeric,
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
$function$;

-- 2. Client-scoped read access to their own grant records (staff policies unchanged)
DROP POLICY IF EXISTS grant_applications_client_self_select ON public.grant_applications;
CREATE POLICY grant_applications_client_self_select
  ON public.grant_applications FOR SELECT TO authenticated
  USING (funding_client_id IS NOT NULL AND public.is_funding_client_self(funding_client_id, auth.uid()));

DROP POLICY IF EXISTS gbp_client_self_select ON public.grant_business_profiles;
CREATE POLICY gbp_client_self_select
  ON public.grant_business_profiles FOR SELECT TO authenticated
  USING (funding_client_id IS NOT NULL AND public.is_funding_client_self(funding_client_id, auth.uid()));

GRANT SELECT ON public.grant_applications TO authenticated;
GRANT SELECT ON public.grant_business_profiles TO authenticated;

-- 3. Restrict what a portal client may change on their own funding_clients row
CREATE OR REPLACE FUNCTION public.funding_clients_guard_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Backend (service_role / cron) and funding staff are unaffected.
  IF auth.uid() IS NULL OR public.is_funding_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Portal client: only contact + basic business identity may change.
  NEW.id                        := OLD.id;
  NEW.user_id                   := OLD.user_id;
  NEW.portal_user_id            := OLD.portal_user_id;
  NEW.email                     := OLD.email;
  NEW.status                    := OLD.status;
  NEW.stage                     := OLD.stage;
  NEW.intake_status             := OLD.intake_status;
  NEW.assigned_operator         := OLD.assigned_operator;
  NEW.assigned_advisor          := OLD.assigned_advisor;
  NEW.notes                     := OLD.notes;
  NEW.current_dfs_score         := OLD.current_dfs_score;
  NEW.current_funding_ceiling   := OLD.current_funding_ceiling;
  NEW.projected_funding_ceiling := OLD.projected_funding_ceiling;
  NEW.credit_score_estimate     := OLD.credit_score_estimate;
  NEW.target_credit_score       := OLD.target_credit_score;
  NEW.score_tu                  := OLD.score_tu;
  NEW.score_eq                  := OLD.score_eq;
  NEW.score_ex                  := OLD.score_ex;
  NEW.funding_target            := OLD.funding_target;
  NEW.funding_received          := OLD.funding_received;
  NEW.target_funding_amount     := OLD.target_funding_amount;
  NEW.grant_eligible            := OLD.grant_eligible;
  NEW.personal_guarantee_ok     := OLD.personal_guarantee_ok;
  NEW.ssn_last4                 := OLD.ssn_last4;
  NEW.ai_last_analysis          := OLD.ai_last_analysis;
  NEW.ai_analysis_date          := OLD.ai_analysis_date;
  NEW.updated_at                := now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS funding_clients_guard_self_update_trg ON public.funding_clients;
CREATE TRIGGER funding_clients_guard_self_update_trg
  BEFORE UPDATE ON public.funding_clients
  FOR EACH ROW EXECUTE FUNCTION public.funding_clients_guard_self_update();
