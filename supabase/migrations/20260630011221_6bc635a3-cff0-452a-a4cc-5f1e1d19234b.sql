
-- ============================================================
-- STEP 1: DNC normalized phone column
-- ============================================================
ALTER TABLE public.dnc_list
  ADD COLUMN IF NOT EXISTS phone_e164 text;

-- Best-effort backfill: take digits, prepend +1 when 10 digits, prepend + when 11+ digits
UPDATE public.dnc_list
SET phone_e164 = CASE
  WHEN regexp_replace(phone_number, '\D', '', 'g') = '' THEN NULL
  WHEN length(regexp_replace(phone_number, '\D', '', 'g')) = 10
    THEN '+1' || regexp_replace(phone_number, '\D', '', 'g')
  WHEN length(regexp_replace(phone_number, '\D', '', 'g')) >= 11
    THEN '+' || regexp_replace(phone_number, '\D', '', 'g')
  ELSE phone_number
END
WHERE phone_e164 IS NULL;

CREATE INDEX IF NOT EXISTS idx_dnc_list_phone_e164 ON public.dnc_list(phone_e164);

-- ============================================================
-- STEP 3: dc_disposition_codes canonical registry
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dc_disposition_codes (
  code text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL CHECK (category IN ('positive','negative','neutral','compliance')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dc_disposition_codes TO authenticated, anon;
GRANT ALL ON public.dc_disposition_codes TO service_role;

ALTER TABLE public.dc_disposition_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_disposition_codes_read_all" ON public.dc_disposition_codes
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "dc_disposition_codes_admin_write" ON public.dc_disposition_codes
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.dc_disposition_codes (code, label, category) VALUES
  ('new',            'New (not yet contacted)', 'neutral'),
  ('queued',         'Queued for dialing',      'neutral'),
  ('called',         'Called (no specific outcome)', 'neutral'),
  ('voicemail',      'Voicemail left',          'neutral'),
  ('no_answer',      'No answer',               'neutral'),
  ('callback',       'Callback requested',      'neutral'),
  ('interested',     'Interested',              'positive'),
  ('booked',         'Booked / appointment set','positive'),
  ('not_interested', 'Not interested',          'negative'),
  ('wrong_number',   'Wrong number',            'negative'),
  ('dnc',            'Do Not Call',             'compliance')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- STEP 5: dc_agents.business_unit (nullable, not backfilled yet)
-- ============================================================
ALTER TABLE public.dc_agents
  ADD COLUMN IF NOT EXISTS business_unit text;

-- ============================================================
-- STEP 6: Extend dc_businesses into a proper business-unit registry
-- (Recommendation: extend in place — see report for rationale.)
-- ============================================================
ALTER TABLE public.dc_businesses
  ADD COLUMN IF NOT EXISTS lead_table_name text,
  ADD COLUMN IF NOT EXISTS sync_enabled boolean NOT NULL DEFAULT false;

-- Seed/refresh known business units
INSERT INTO public.dc_businesses (business_key, name, icon, color, is_live, is_internal, sort_order, lead_table_name, sync_enabled)
VALUES
  ('dynasty_direct', 'Dynasty Direct', 'Truck', 'bg-emerald-600', false, false, 90, NULL, false)
ON CONFLICT (business_key) DO NOTHING;

UPDATE public.dc_businesses SET lead_table_name = 'surplus_funds_leads', sync_enabled = true  WHERE business_key = 'surplus_funds';
UPDATE public.dc_businesses SET lead_table_name = 're_leads',           sync_enabled = true  WHERE business_key = 'real_estate';
UPDATE public.dc_businesses SET lead_table_name = NULL,                  sync_enabled = false WHERE business_key IN ('brandaro','gasmask','top_tier','unforgettable_times','dynasty_direct','iclean','playboxxx');

-- ============================================================
-- STEP 7: dc_agent_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dc_agent_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.dc_agents(id) ON DELETE CASCADE,
  business_unit_key text NOT NULL REFERENCES public.dc_businesses(business_key) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary','fallback','overflow','training')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, business_unit_key, role)
);

GRANT SELECT ON public.dc_agent_assignments TO authenticated;
GRANT ALL ON public.dc_agent_assignments TO service_role;

ALTER TABLE public.dc_agent_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dc_agent_assignments_read_auth" ON public.dc_agent_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "dc_agent_assignments_admin_write" ON public.dc_agent_assignments
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_dc_agent_assignments_agent ON public.dc_agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_dc_agent_assignments_unit  ON public.dc_agent_assignments(business_unit_key);
