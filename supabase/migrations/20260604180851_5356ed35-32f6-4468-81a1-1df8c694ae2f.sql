
-- ═══ Drop legacy compat views (bridge dies) ═══
DROP VIEW IF EXISTS public.ambassador_commissions;
DROP VIEW IF EXISTS public.commission_events;

-- ═══ Rename column on v_store_commission_performance to avoid view-name collision ═══
DROP VIEW IF EXISTS public.v_store_commission_performance;
CREATE VIEW public.v_store_commission_performance AS
SELECT sm.id AS store_id,
    sm.store_name,
    sm.city,
    sm.state,
    count(cl.id) AS commission_count,
    COALESCE(sum(cl.gross_amount), (0)::numeric) AS store_revenue,
    COALESCE(sum(cl.commission_amount), (0)::numeric) AS commissions_generated,
    count(DISTINCT cl.ambassador_id) AS ambassadors_involved,
    max(cl.earned_at) AS last_activity
   FROM (store_master sm
     LEFT JOIN commission_ledger cl ON ((cl.store_id = sm.id)))
  GROUP BY sm.id, sm.store_name, sm.city, sm.state;

GRANT SELECT ON public.v_store_commission_performance TO authenticated;
GRANT ALL ON public.v_store_commission_performance TO service_role;

-- ═══ hr_employees.is_test ═══
ALTER TABLE public.hr_employees ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS hr_employees_is_test_idx ON public.hr_employees(is_test) WHERE is_test = true;
UPDATE public.hr_employees SET is_test = true WHERE id = '8f1fd48e-e58f-4df3-8733-f7f42de2aea3';
COMMENT ON COLUMN public.hr_employees.is_test IS 'Test identity flag (e.g. Gas mask) — excluded from headcount stats.';

-- ═══ Mark hr_payroll deprecated ═══
COMMENT ON TABLE public.hr_payroll IS 'DEPRECATED (T3 K6) — Payroll Manager / payroll_records is canonical. Do not write.';

-- ═══ owner_settings (key/value, owner-only) ═══
CREATE TABLE IF NOT EXISTS public.owner_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owner_settings TO authenticated;
GRANT ALL ON public.owner_settings TO service_role;

ALTER TABLE public.owner_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner can manage owner_settings" ON public.owner_settings;
CREATE POLICY "Owner can manage owner_settings"
  ON public.owner_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_owner_settings_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS owner_settings_updated_at ON public.owner_settings;
CREATE TRIGGER owner_settings_updated_at
  BEFORE UPDATE ON public.owner_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_owner_settings_updated_at();

-- ═══ floor_directory final reconciliation ═══
UPDATE public.floor_directory SET status = 'ready', last_audited = now()
 WHERE page_route = '/hr/onboarding';

UPDATE public.floor_directory SET status = 'ready', last_audited = now()
 WHERE page_route = '/__cleanup/commission-ledger-readers';

UPDATE public.floor_directory
   SET purpose = 'External trading platform link, persisted in owner_settings.', last_audited = now()
 WHERE page_route = '/os/owner/holdings/crypto';
