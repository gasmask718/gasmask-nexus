
DO $$
DECLARE t text; b uuid := 'c3d4e5f6-a7b8-9012-cdef-123456789012';
BEGIN
  FOREACH t IN ARRAY ARRAY['dialer_campaigns','dialer_settings','dialer_agent_availability','dialer_followups','dialer_disposition_config','dialer_engine_cycle_logs','dialer_engine_locks','outbound_call_queue'] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET DEFAULT %L', t, b);
    EXECUTE format('UPDATE public.%I SET business_id = %L WHERE business_id IS NULL', t, b);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN business_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(business_id)', 'idx_'||t||'_business_id', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Admin full access on dialer_agent_availability" ON public.dialer_agent_availability;
DROP POLICY IF EXISTS "Admin manage dialer_disposition_config" ON public.dialer_disposition_config;
DROP POLICY IF EXISTS "Admin roles read engine logs" ON public.dialer_engine_cycle_logs;
DROP POLICY IF EXISTS "Admin roles manage engine locks" ON public.dialer_engine_locks;
DROP POLICY IF EXISTS "Admin access dialer_followups" ON public.dialer_followups;
DROP POLICY IF EXISTS "Admin full access on dialer_settings" ON public.dialer_settings;
DROP POLICY IF EXISTS "Admin full access on outbound_call_queue" ON public.outbound_call_queue;
DROP POLICY IF EXISTS dialer_campaigns_admin_select ON public.dialer_campaigns;
DROP POLICY IF EXISTS dialer_campaigns_admin_insert ON public.dialer_campaigns;
DROP POLICY IF EXISTS dialer_campaigns_admin_update ON public.dialer_campaigns;

DO $$
DECLARE t text; base text := 'has_role(auth.uid(),''admin'') OR has_role(auth.uid(),''owner'') OR has_business_role(auth.uid(),''va'',business_id)';
BEGIN
  FOREACH t IN ARRAY ARRAY['dialer_agent_availability','dialer_disposition_config','dialer_engine_cycle_logs','dialer_engine_locks','dialer_followups','dialer_settings','outbound_call_queue','dialer_campaigns'] LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (%s) WITH CHECK (%s)', t||'_admin_va_scoped', t, base, base);
  END LOOP;
END $$;
