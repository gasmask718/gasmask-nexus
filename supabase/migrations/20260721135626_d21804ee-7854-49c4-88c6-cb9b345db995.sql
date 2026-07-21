
DO $$
DECLARE
  t text;
  all_tables text[] := ARRAY['re_leads','re_deals','re_buyers','surplus_funds_leads','surplus_funds_cases','surplus_funds_attorneys'];
BEGIN
  FOREACH t IN ARRAY all_tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated users can manage %s" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_select_team" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert_team" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update_team" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete_admin" ON public.%I;', t, t);
  END LOOP;
END $$;

-- Real Estate tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['re_leads','re_deals','re_buyers'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select_team" ON public.%1$I FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'realestate_worker')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert_team" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'realestate_worker')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update_team" ON public.%1$I FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'realestate_worker')
      )
      WITH CHECK (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff') OR public.has_role(auth.uid(),'realestate_worker')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_delete_admin" ON public.%1$I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
    $f$, t);
  END LOOP;
END $$;

-- Surplus Funds tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['surplus_funds_leads','surplus_funds_cases','surplus_funds_attorneys'] LOOP
    EXECUTE format($f$
      CREATE POLICY "%1$s_select_team" ON public.%1$I FOR SELECT TO authenticated
      USING (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_insert_team" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_update_team" ON public.%1$I FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff')
      )
      WITH CHECK (
        public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin')
        OR public.has_role(auth.uid(),'va') OR public.has_role(auth.uid(),'employee')
        OR public.has_role(auth.uid(),'staff')
      );
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "%1$s_delete_admin" ON public.%1$I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));
    $f$, t);
  END LOOP;
END $$;
