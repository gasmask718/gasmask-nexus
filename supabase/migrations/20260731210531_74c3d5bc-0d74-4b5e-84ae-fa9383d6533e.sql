
DO $$
DECLARE t text; b uuid := 'c3d4e5f6-a7b8-9012-cdef-123456789012';
BEGIN
  FOREACH t IN ARRAY ARRAY['store_opportunities','store_tube_inventory_status','store_communication_preferences'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id) DEFAULT %L', t, b);
    EXECUTE format('UPDATE public.%I x SET business_id = m.business_id FROM public.store_master m WHERE x.store_id = m.id AND m.business_id IS NOT NULL AND x.business_id IS DISTINCT FROM m.business_id', t);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', t, b);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', 'idx_'||t||'_business_id', t);
  END LOOP;
  EXECUTE format('ALTER TABLE public.voicemails ALTER COLUMN business_id SET DEFAULT %L', b);
  EXECUTE format('UPDATE public.voicemails SET business_id = %L WHERE business_id IS NULL', b);
  EXECUTE 'ALTER TABLE public.voicemails ALTER COLUMN business_id SET NOT NULL';
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_voicemails_business_id ON public.voicemails(business_id)';
END $$;

DROP POLICY IF EXISTS va_select_store_opportunities ON public.store_opportunities;
DROP POLICY IF EXISTS va_insert_store_opportunities ON public.store_opportunities;
DROP POLICY IF EXISTS va_update_store_opportunities ON public.store_opportunities;
CREATE POLICY va_select_store_opportunities ON public.store_opportunities FOR SELECT TO authenticated USING (has_business_role(auth.uid(),'va',business_id));
CREATE POLICY va_insert_store_opportunities ON public.store_opportunities FOR INSERT TO authenticated WITH CHECK (has_business_role(auth.uid(),'va',business_id));
CREATE POLICY va_update_store_opportunities ON public.store_opportunities FOR UPDATE TO authenticated USING (has_business_role(auth.uid(),'va',business_id)) WITH CHECK (has_business_role(auth.uid(),'va',business_id));

DROP POLICY IF EXISTS "VAs have full access to tube intel" ON public.store_tube_inventory_status;
CREATE POLICY "VAs have full access to tube intel" ON public.store_tube_inventory_status FOR ALL TO authenticated
USING (has_business_role(auth.uid(),'va',business_id)) WITH CHECK (has_business_role(auth.uid(),'va',business_id));

DROP POLICY IF EXISTS "Operators read store comm prefs" ON public.store_communication_preferences;
DROP POLICY IF EXISTS "Operators update store comm prefs" ON public.store_communication_preferences;
DROP POLICY IF EXISTS "Operators write store comm prefs" ON public.store_communication_preferences;
CREATE POLICY "Operators read store comm prefs" ON public.store_communication_preferences FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'csr') OR has_role(auth.uid(),'ambassador') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY "Operators update store comm prefs" ON public.store_communication_preferences FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'csr') OR has_role(auth.uid(),'ambassador') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'csr') OR has_role(auth.uid(),'ambassador') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY "Operators write store comm prefs" ON public.store_communication_preferences FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'owner') OR has_role(auth.uid(),'csr') OR has_role(auth.uid(),'ambassador') OR has_role(auth.uid(),'staff') OR has_business_role(auth.uid(),'va',business_id));

DROP POLICY IF EXISTS "Staff can view voicemails" ON public.voicemails;
DROP POLICY IF EXISTS "Staff can update voicemails" ON public.voicemails;
CREATE POLICY "Staff can view voicemails" ON public.voicemails FOR SELECT TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'developer') OR has_business_role(auth.uid(),'va',business_id));
CREATE POLICY "Staff can update voicemails" ON public.voicemails FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'developer') OR has_business_role(auth.uid(),'va',business_id));
