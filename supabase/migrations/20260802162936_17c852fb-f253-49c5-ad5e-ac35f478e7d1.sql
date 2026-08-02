-- 1. Document intended safe state on the view itself
COMMENT ON VIEW public.products_public IS
$doc$SAFE-STATE CONTRACT (do not change without updating public.public_view_contracts)

PURPOSE: public/storefront-safe projection of public.products_all.

FORBIDDEN COLUMNS (must NEVER appear here):
  supplier_cost_cents, cost_cents, cost, margin_pct, supplier_id,
  wholesale_cost_cents, profit_cents

REQUIRED GRANTS (exact):
  anon          -> SELECT only
  authenticated -> SELECT only
  service_role  -> ALL

Any INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER grant to anon or
authenticated is a security regression. Writes must go through
public.products_all (RLS-protected) or a service-role edge function.

Enforced by: public.assert_public_view_grants(), the scheduled
`public-view-security-probe` edge function, and scripts/check-public-view-grants.mjs
(runs on every build).$doc$;

-- 2. Machine-readable contract registry
CREATE TABLE IF NOT EXISTS public.public_view_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_name text NOT NULL UNIQUE,
  allowed_privileges text[] NOT NULL DEFAULT ARRAY['SELECT'],
  public_roles text[] NOT NULL DEFAULT ARRAY['anon','authenticated'],
  forbidden_columns text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.public_view_contracts TO authenticated;
GRANT ALL ON public.public_view_contracts TO service_role;
ALTER TABLE public.public_view_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can read view contracts" ON public.public_view_contracts;
CREATE POLICY "Staff can read view contracts"
ON public.public_view_contracts FOR SELECT TO authenticated USING (true);

DROP TRIGGER IF EXISTS trg_public_view_contracts_updated_at ON public.public_view_contracts;
CREATE TRIGGER trg_public_view_contracts_updated_at
BEFORE UPDATE ON public.public_view_contracts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.public_view_contracts (view_name, allowed_privileges, public_roles, forbidden_columns, notes)
VALUES (
  'products_public',
  ARRAY['SELECT'],
  ARRAY['anon','authenticated'],
  ARRAY['supplier_cost_cents','cost_cents','cost','margin_pct','supplier_id','wholesale_cost_cents','profit_cents'],
  'Storefront projection of products_all. Read-only for the public; writes go through products_all (RLS) or service-role edge functions.'
)
ON CONFLICT (view_name) DO UPDATE
SET allowed_privileges = EXCLUDED.allowed_privileges,
    public_roles       = EXCLUDED.public_roles,
    forbidden_columns  = EXCLUDED.forbidden_columns,
    notes              = EXCLUDED.notes,
    updated_at         = now();

-- 3. Grant / column assertion
CREATE OR REPLACE FUNCTION public.assert_public_view_grants()
RETURNS TABLE (view_name text, role_name text, violation text, detail text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Excess privileges granted to public roles
  SELECT c.view_name,
         g.grantee::text,
         'excess_privilege'::text,
         g.privilege_type::text
  FROM public.public_view_contracts c
  JOIN information_schema.role_table_grants g
    ON g.table_schema = 'public'
   AND g.table_name = c.view_name
   AND g.grantee = ANY (c.public_roles)
  WHERE upper(g.privilege_type) <> ALL (SELECT upper(unnest(c.allowed_privileges)))

  UNION ALL

  -- Missing required SELECT
  SELECT c.view_name,
         r.role_name,
         'missing_select'::text,
         'role has no SELECT on view'::text
  FROM public.public_view_contracts c
  CROSS JOIN LATERAL unnest(c.public_roles) AS r(role_name)
  WHERE 'SELECT' = ANY (SELECT upper(unnest(c.allowed_privileges)))
    AND NOT EXISTS (
      SELECT 1 FROM information_schema.role_table_grants g
      WHERE g.table_schema = 'public'
        AND g.table_name = c.view_name
        AND g.grantee = r.role_name
        AND upper(g.privilege_type) = 'SELECT'
    )

  UNION ALL

  -- Forbidden columns leaked into the view
  SELECT c.view_name,
         '-'::text,
         'forbidden_column'::text,
         col.column_name::text
  FROM public.public_view_contracts c
  JOIN information_schema.columns col
    ON col.table_schema = 'public'
   AND col.table_name = c.view_name
  WHERE col.column_name = ANY (c.forbidden_columns)

  UNION ALL

  -- Contract exists but view does not
  SELECT c.view_name, '-'::text, 'view_missing'::text, 'no such view in public schema'::text
  FROM public.public_view_contracts c
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.views v
    WHERE v.table_schema = 'public' AND v.table_name = c.view_name
  );
$$;

GRANT EXECUTE ON FUNCTION public.assert_public_view_grants() TO authenticated, service_role;

-- 4. Register the health check
INSERT INTO public.health_checks (check_key, kind, business, floor, label, cadence_expected_minutes, config, enabled)
VALUES (
  'public_view_security_probe',
  'cron',
  'dynasty_direct',
  'security',
  'Public View Security Probe (products_public anon write probes + grant contract)',
  1440,
  jsonb_build_object('jobname','public-view-security-probe','function','public-view-security-probe'),
  true
)
ON CONFLICT (check_key) DO UPDATE
SET label = EXCLUDED.label,
    cadence_expected_minutes = EXCLUDED.cadence_expected_minutes,
    config = EXCLUDED.config,
    enabled = true;