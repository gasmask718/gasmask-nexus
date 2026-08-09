-- 1) Signup fix: system-provisioned role inserts have no auth.uid().
--    Attribute them to the subject user and mark the source as 'system'.
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_subject uuid := COALESCE(NEW.user_id, OLD.user_id);
BEGIN
  INSERT INTO public.admin_audit_log (actor_user_id, action, target_type, target_id, before, after, reason)
  VALUES (
    COALESCE(v_actor, v_subject),
    'user_role.' || lower(TG_OP),
    'user_roles',
    v_subject,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    CASE
      WHEN v_actor IS NULL THEN 'system self-provisioned role (signup); no authenticated actor'
      ELSE 'role change via ' || COALESCE(current_setting('request.method', true), 'sql')
    END
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- 2) influencers: PII (dob/email/phone) was anon-readable. Require authentication.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.influencers FROM anon;

DROP POLICY IF EXISTS "Ambassadors can view their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Ambassadors can insert their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Ambassadors can update their influencers" ON public.influencers;
DROP POLICY IF EXISTS "Owner full access to influencers" ON public.influencers;

CREATE POLICY "Ambassadors can view their influencers"
ON public.influencers FOR SELECT TO authenticated
USING (
  ambassador_id = current_ambassador_id()
  OR EXISTS (
    SELECT 1 FROM influencer_assignments ia
    WHERE ia.influencer_id = influencers.id
      AND ia.ambassador_id = current_ambassador_id()
      AND ia.active = true
  )
  OR ambassador_id IS NULL
);

CREATE POLICY "Ambassadors can insert their influencers"
ON public.influencers FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Ambassadors can update their influencers"
ON public.influencers FOR UPDATE TO authenticated
USING (
  ambassador_id = current_ambassador_id()
  OR EXISTS (
    SELECT 1 FROM influencer_assignments ia
    WHERE ia.influencer_id = influencers.id
      AND ia.ambassador_id = current_ambassador_id()
      AND ia.active = true
  )
);

CREATE POLICY "Owner full access to influencers"
ON public.influencers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['owner'::app_role,'admin'::app_role])))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY (ARRAY['owner'::app_role,'admin'::app_role])));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencers TO authenticated;
GRANT ALL ON public.influencers TO service_role;

-- 3) ut_staff (dob) and dd_shipping_accounts (account_number): remove anon reachability.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.ut_staff FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.dd_shipping_accounts FROM anon;

DROP POLICY IF EXISTS "Business members can view staff" ON public.ut_staff;
DROP POLICY IF EXISTS "Admins and owners can manage staff" ON public.ut_staff;

CREATE POLICY "Business members can view staff"
ON public.ut_staff FOR SELECT TO authenticated
USING (is_business_member(business_id, auth.uid()) OR is_admin(auth.uid()) OR is_owner(auth.uid()));

CREATE POLICY "Admins and owners can manage staff"
ON public.ut_staff FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR is_owner(auth.uid()) OR is_business_admin(business_id, auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_owner(auth.uid()) OR is_business_admin(business_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_staff TO authenticated;
GRANT ALL ON public.ut_staff TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dd_shipping_accounts TO authenticated;
GRANT ALL ON public.dd_shipping_accounts TO service_role;