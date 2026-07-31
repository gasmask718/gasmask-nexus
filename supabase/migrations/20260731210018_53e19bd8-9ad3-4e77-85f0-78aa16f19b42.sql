
DO $$
DECLARE t text; b uuid := 'e635c756-5c39-4f8d-a7f2-17ace71e2df5';
BEGIN
  FOREACH t IN ARRAY ARRAY['re_leads','re_deals','re_buyers'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) DEFAULT %L', t, b);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', t, b);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', 'idx_'||t||'_business_id', t);
  END LOOP;
END $$;

DO $$
DECLARE t text; base text := 'has_role(auth.uid(),''owner'') OR has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''employee'') OR has_role(auth.uid(),''staff'') OR has_role(auth.uid(),''realestate_worker'') OR has_business_role(auth.uid(),''va'',business_id)';
BEGIN
  FOREACH t IN ARRAY ARRAY['re_leads','re_deals','re_buyers'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_select_team', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_insert_team', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_update_team', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t||'_select_team', t, base);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t||'_insert_team', t, base);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t||'_update_team', t, base, base);
  END LOOP;
END $$;
