-- ============ Stage 0 PII lockdown ============
-- Helper: staff-only ALL policy + client-self SELECT where client_id exists

DO $$
DECLARE t text; p record;
  client_scoped text[] := ARRAY['funding_applications','funding_banking_velocity','funding_credit_items',
    'funding_dispute_rounds','funding_mailing_log','funding_plaid_connections','funding_plaid_transactions',
    'funding_task_cards','funding_tasks','funding_tradeline_accounts','funding_client_lender_matches',
    'funding_autofill_runs','funding_dfs_scores','shelf_corp_tracker'];
  staff_only text[] := ARRAY['funding_bills','funding_payment_cards','funding_tradeline_vault_cards',
    'funding_tradeline_vault_transactions','deletion_letter_recipients','funding_mailbox_config',
    'funding_machine_settings','funding_lender_relationships','funding_infrastructure_checklist',
    'funding_morning_briefings','funding_daily_briefings_legacy','funding_lender_database','funding_card_database'];
BEGIN
  FOREACH t IN ARRAY (client_scoped || staff_only) LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_funding_staff(auth.uid())) WITH CHECK (public.is_funding_staff(auth.uid()))', t||'_staff_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)', t||'_service_all', t);
  END LOOP;

  FOREACH t IN ARRAY client_scoped LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_funding_client_self(client_id, auth.uid()))', t||'_self_select', t);
  END LOOP;
END $$;