-- 1. route_insights: columns the UI reads + upsert key
ALTER TABLE public.route_insights
  ADD COLUMN IF NOT EXISTS difficulty_score integer,
  ADD COLUMN IF NOT EXISTS recommended_route_group text,
  ADD COLUMN IF NOT EXISTS sample_size integer,
  ADD COLUMN IF NOT EXISTS last_computed_at timestamptz;

DELETE FROM public.route_insights a
 USING public.route_insights b
 WHERE a.store_id = b.store_id AND a.ctid > b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS route_insights_store_id_key
  ON public.route_insights (store_id);

-- 2. Self-signup lands on 'pending' with no elevated role.
--    Client-supplied user_metadata.role is IGNORED (it is writable by the
--    signing-up user). Only server-side app_metadata.provisioned_role, which
--    only service-role invite handlers can set, is honored.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role := 'pending';
  v_provisioned text := NEW.raw_app_meta_data->>'provisioned_role';
BEGIN
  IF v_provisioned IS NOT NULL THEN
    BEGIN
      v_role := v_provisioned::public.app_role;
    EXCEPTION WHEN others THEN
      v_role := 'pending';
    END;
  END IF;

  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', 'New User'),
    NEW.email,
    v_role
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 3. Audit every role grant / change / revoke
CREATE OR REPLACE FUNCTION public.audit_user_roles_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.admin_audit_log (actor_user_id, action, target_type, target_id, before, after, reason)
  VALUES (
    auth.uid(),
    'user_role.' || lower(TG_OP),
    'user_roles',
    COALESCE(NEW.user_id, OLD.user_id),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END,
    'role change via ' || COALESCE(current_setting('request.method', true), 'sql')
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_audit_user_roles ON public.user_roles;
CREATE TRIGGER trg_audit_user_roles
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.audit_user_roles_change();