CREATE TABLE IF NOT EXISTS public.anon_access_revocation_log (
  id bigserial PRIMARY KEY,
  object_name text NOT NULL,
  object_kind text NOT NULL,
  privileges_before text,
  note text,
  revoked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.anon_access_revocation_log TO authenticated;
GRANT ALL ON public.anon_access_revocation_log TO service_role;
ALTER TABLE public.anon_access_revocation_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY anon_revocation_log_staff_read ON public.anon_access_revocation_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Record old policy definitions before tightening
INSERT INTO public.anon_access_revocation_log(object_name, object_kind, privileges_before, note)
SELECT tablename||'.'||policyname, 'policy',
  format('CREATE POLICY %I ON public.%I AS %s FOR %s TO %s%s%s;', policyname, tablename, permissive, cmd,
    array_to_string(roles, ','), coalesce(' USING ('||qual||')',''), coalesce(' WITH CHECK ('||with_check||')','')),
  'roles changed public -> authenticated'
FROM pg_policies WHERE schemaname='public'
  AND (tablename, policyname) IN (('stores','stores_simulation_select'),('stores','stores_simulation_insert'),
       ('stores','stores_simulation_update'),('store_master','store_master_simulation_delete'));

ALTER POLICY stores_simulation_select ON public.stores TO authenticated;
ALTER POLICY stores_simulation_insert ON public.stores TO authenticated;
ALTER POLICY stores_simulation_update ON public.stores TO authenticated;
ALTER POLICY store_master_simulation_delete ON public.store_master TO authenticated;

-- Revoke anon from core tables and every view built (directly or transitively) on them
DO $$
DECLARE r record; privs text;
BEGIN
  FOR r IN
    WITH RECURSIVE base AS (
      SELECT c.oid FROM pg_class c WHERE c.relnamespace='public'::regnamespace
        AND c.relname IN ('stores','store_master','store_contacts','store_notes','invoices','invoice_line_items','phantom_invoice_review','route_insights')
    ), deps AS (
      SELECT oid FROM base
      UNION
      SELECT v.oid FROM deps d
        JOIN pg_depend dp ON dp.refobjid = d.oid AND dp.classid='pg_rewrite'::regclass
        JOIN pg_rewrite rw ON rw.oid = dp.objid
        JOIN pg_class v ON v.oid = rw.ev_class AND v.oid <> d.oid
    )
    SELECT c.oid, c.relname, c.relkind FROM deps JOIN pg_class c ON c.oid=deps.oid
    WHERE c.relnamespace='public'::regnamespace
  LOOP
    SELECT string_agg(p, ',') INTO privs FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p
      WHERE has_table_privilege('anon', r.oid, p);
    IF privs IS NOT NULL THEN
      INSERT INTO public.anon_access_revocation_log(object_name, object_kind, privileges_before, note)
      VALUES (r.relname, CASE r.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'matview' ELSE 'table' END,
              'GRANT '||privs||' ON public.'||quote_ident(r.relname)||' TO anon;', 'revoked from anon');
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', r.relname);
    END IF;
  END LOOP;
END $$;