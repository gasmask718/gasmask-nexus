## Root cause

The audit's symptom ("silent failures") is real but the diagnosis is slightly off. Current state on all six tables:

- RLS is enabled
- One policy exists per table: `FOR ALL TO authenticated USING (true)` — permissive, not admin-only
- **No `GRANT` to `authenticated`, `anon`, or `service_role`** — only the sandbox role

Without table-level `GRANT`s, PostgREST returns a permission error before RLS is even evaluated. That's why non-admins (and technically everyone via the Data API) hit silent failures. So the fix is two parts: add grants, and tighten the overly-permissive `USING (true)` policy into a role-scoped one that matches the app's RBAC (`public.has_role(auth.uid(), 'role')`).

## Role mapping

Project uses `public.user_roles` + `public.has_role(_user_id, _role app_role)`. There is no `team_member` role in the enum. Closest working roles for RE/SF back-office access:

- `owner`, `admin` — full access
- `va`, `employee`, `staff` — SELECT / INSERT / UPDATE (no DELETE)
- `realestate_worker` — same as va/employee, RE tables only

DELETE stays admin/owner only to protect the ledger.

## SQL to paste into the Supabase SQL Editor

```sql
-- ============================================================
-- RE + SF core tables: GRANTs + role-scoped RLS
-- Safe to re-run: drops old permissive policy, recreates scoped ones
-- ============================================================

-- Helper: consistent role check (already exists as public.has_role)
-- SELECT public.has_role(auth.uid(), 'admin'::app_role);

DO $$
DECLARE
  t text;
  re_tables text[]  := ARRAY['re_leads','re_deals','re_buyers'];
  sf_tables text[]  := ARRAY['surplus_funds_leads','surplus_funds_cases','surplus_funds_attorneys'];
  all_tables text[] := re_tables || sf_tables;
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    -- 1. Grants (PostgREST cannot see the table without these)
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);

    -- 2. Drop the old "authenticated can do anything" policy
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage %I" ON public.%I;', t, t);
    -- Also drop any prior scoped policies so this script is idempotent
    EXECUTE format('DROP POLICY IF EXISTS "%I_select_team"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_insert_team"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_update_team"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%I_delete_admin" ON public.%I;', t, t);
  END LOOP;
END $$;

-- ---------- Real Estate (owner/admin/va/employee/staff/realestate_worker) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['re_leads','re_deals','re_buyers'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$I_select_team" ON public.%1$I
        FOR SELECT TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'realestate_worker')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_insert_team" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'realestate_worker')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_update_team" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'realestate_worker')
        )
        WITH CHECK (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
          OR public.has_role(auth.uid(),'realestate_worker')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_delete_admin" ON public.%1$I
        FOR DELETE TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
        );
    $f$, t);
  END LOOP;
END $$;

-- ---------- Surplus Funds (owner/admin/va/employee/staff) ----------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['surplus_funds_leads','surplus_funds_cases','surplus_funds_attorneys'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$I_select_team" ON public.%1$I
        FOR SELECT TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_insert_team" ON public.%1$I
        FOR INSERT TO authenticated
        WITH CHECK (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_update_team" ON public.%1$I
        FOR UPDATE TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
        )
        WITH CHECK (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
          OR public.has_role(auth.uid(),'va')
          OR public.has_role(auth.uid(),'employee')
          OR public.has_role(auth.uid(),'staff')
        );
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "%1$I_delete_admin" ON public.%1$I
        FOR DELETE TO authenticated
        USING (
          public.has_role(auth.uid(),'owner')
          OR public.has_role(auth.uid(),'admin')
        );
    $f$, t);
  END LOOP;
END $$;
```

## Notes

- `anon` is intentionally NOT granted — none of these tables should be public.
- No `team_member` role exists in `app_role`; `va`, `employee`, `staff` cover that intent. Say the word if you want a new `team_member` enum value added instead.
- If you'd prefer I run this through the migration tool (with approval flow) instead of you pasting it, approve this plan and I'll switch to build and run `supabase--migration`.
