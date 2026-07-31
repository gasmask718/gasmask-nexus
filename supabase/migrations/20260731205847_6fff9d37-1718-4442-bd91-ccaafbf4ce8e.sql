
DO $$
DECLARE t text; b uuid := '5e316fdf-9d25-4002-8996-9e9ecfbd4230';
BEGIN
  FOREACH t IN ARRAY ARRAY['surplus_funds_leads','surplus_funds_cases','surplus_funds_attorneys','surplus_funds_attorney_assignments','surplus_funds_contracts','surplus_funds_inquiries','surplus_funds_payments'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) DEFAULT %L', t, b);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', t, b);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT %L', t, b);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', 'idx_'||t||'_business_id', t);
  END LOOP;
END $$;

-- leads
DROP POLICY IF EXISTS surplus_funds_leads_select_team ON public.surplus_funds_leads;
DROP POLICY IF EXISTS surplus_funds_leads_insert_team ON public.surplus_funds_leads;
DROP POLICY IF EXISTS surplus_funds_leads_update_team ON public.surplus_funds_leads;
CREATE POLICY surplus_funds_leads_select_team ON public.surplus_funds_leads FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_leads_insert_team ON public.surplus_funds_leads FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_leads_update_team ON public.surplus_funds_leads FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id))
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));

-- cases
DROP POLICY IF EXISTS surplus_funds_cases_select_team ON public.surplus_funds_cases;
DROP POLICY IF EXISTS surplus_funds_cases_insert_team ON public.surplus_funds_cases;
DROP POLICY IF EXISTS surplus_funds_cases_update_team ON public.surplus_funds_cases;
CREATE POLICY surplus_funds_cases_select_team ON public.surplus_funds_cases FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_cases_insert_team ON public.surplus_funds_cases FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_cases_update_team ON public.surplus_funds_cases FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id))
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));

-- attorneys
DROP POLICY IF EXISTS surplus_funds_attorneys_select_team ON public.surplus_funds_attorneys;
DROP POLICY IF EXISTS surplus_funds_attorneys_insert_team ON public.surplus_funds_attorneys;
DROP POLICY IF EXISTS surplus_funds_attorneys_update_team ON public.surplus_funds_attorneys;
CREATE POLICY surplus_funds_attorneys_select_team ON public.surplus_funds_attorneys FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_attorneys_insert_team ON public.surplus_funds_attorneys FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY surplus_funds_attorneys_update_team ON public.surplus_funds_attorneys FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id))
WITH CHECK (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'employee') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
