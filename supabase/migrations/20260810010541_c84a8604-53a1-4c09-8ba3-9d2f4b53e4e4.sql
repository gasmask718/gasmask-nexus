-- ============================================================
-- FIX 1 (BUG-05): remove 'developer' from the SBO data gate.
-- src/security/permissions.ts documents developer as UI-only.
-- Verified: zero users currently hold role='developer'.
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_sbo_operator(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role,'owner'::app_role,'staff'::app_role)
  )
$function$;

-- ============================================================
-- FIX 2 (BUG-04): corporate_event_requests anon SELECT.
-- No token/session column exists (columns are id, user_id,
-- company_name, contact_name, email, phone, city, event_type,
-- guest_count, event_date, budget_range, notes, assigned_planner,
-- status, created_at, updated_at) so there is no safe anon scope.
-- Drop the anon SELECT policy. Anon INSERT is preserved.
-- ============================================================
DROP POLICY IF EXISTS "Anon read own requests" ON public.corporate_event_requests;
REVOKE SELECT ON public.corporate_event_requests FROM anon;

-- ============================================================
-- FIX 8.2 (BUG-11): cross-column validation trigger.
-- A CHECK constraint cannot express this (spans columns and is
-- conditional on the transition), so it is a trigger per governance.
-- The graded_at rule fires only on INSERT or a real result change,
-- so the 32 legacy graded rows with NULL graded_at are not blocked.
-- ============================================================
CREATE OR REPLACE FUNCTION public.sbo_capper_picks_validate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.unsupported IS TRUE
     AND (NEW.unsupported_reason IS NULL OR btrim(NEW.unsupported_reason) = '') THEN
    RAISE EXCEPTION
      'sbo_capper_picks: unsupported=true requires a non-empty unsupported_reason (pick %)',
      COALESCE(NEW.id::text, '(new)');
  END IF;

  IF NEW.result IN ('won','lost','push')
     AND NEW.graded_at IS NULL
     AND (TG_OP = 'INSERT' OR NEW.result IS DISTINCT FROM OLD.result) THEN
    RAISE EXCEPTION
      'sbo_capper_picks: result=% requires graded_at to be set (pick %)',
      NEW.result, COALESCE(NEW.id::text, '(new)');
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sbo_capper_picks_validate ON public.sbo_capper_picks;
CREATE TRIGGER trg_sbo_capper_picks_validate
  BEFORE INSERT OR UPDATE ON public.sbo_capper_picks
  FOR EACH ROW EXECUTE FUNCTION public.sbo_capper_picks_validate();