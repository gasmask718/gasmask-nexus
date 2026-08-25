ALTER TABLE public.crm_partners
  ADD COLUMN IF NOT EXISTS business text NOT NULL DEFAULT 'toptier',
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS office_address text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS coverage_areas text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS stage text DEFAULT 'identified',
  ADD COLUMN IF NOT EXISTS licence_number text,
  ADD COLUMN IF NOT EXISTS licence_state text,
  ADD COLUMN IF NOT EXISTS licence_status text,
  ADD COLUMN IF NOT EXISTS insurance_expiry date,
  ADD COLUMN IF NOT EXISTS insurance_status text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

ALTER TABLE public.crm_partners
  DROP CONSTRAINT IF EXISTS crm_partners_stage_check;
ALTER TABLE public.crm_partners
  ADD CONSTRAINT crm_partners_stage_check
  CHECK (stage IS NULL OR stage IN ('identified','contacted','interested','applied','activated','declined'));

ALTER TABLE public.crm_partners
  DROP CONSTRAINT IF EXISTS crm_partners_category_check;
ALTER TABLE public.crm_partners
  ADD CONSTRAINT crm_partners_category_check
  CHECK (category IS NULL OR category IN (
    'chauffeur','exotic car rental','party bus','helicopter','yacht charter',
    'powersports rental','nightlife venue','rooftop venue','event hall',
    'decorator','decor rental','florist','private chef','photographer',
    'beauty-hair-makeup','security-exec protection','rose-gifting supplier','authenticator'
  ));

UPDATE public.crm_partners SET business = 'toptier' WHERE business IS DISTINCT FROM 'toptier';

CREATE UNIQUE INDEX IF NOT EXISTS crm_partners_google_place_id_uniq
  ON public.crm_partners (google_place_id)
  WHERE google_place_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_partners_business_idx ON public.crm_partners (business);
CREATE INDEX IF NOT EXISTS crm_partners_stage_idx ON public.crm_partners (stage);
CREATE INDEX IF NOT EXISTS crm_partners_category_idx ON public.crm_partners (category);

DROP TRIGGER IF EXISTS trg_crm_partners_updated_at ON public.crm_partners;
CREATE TRIGGER trg_crm_partners_updated_at
  BEFORE UPDATE ON public.crm_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS hardening: remove blanket authenticated access
DROP POLICY IF EXISTS "Authenticated users can manage crm partners" ON public.crm_partners;
DROP POLICY IF EXISTS "Authenticated users can view crm partners" ON public.crm_partners;
DROP POLICY IF EXISTS crm_partners_simulation_select ON public.crm_partners;
DROP POLICY IF EXISTS crm_partners_simulation_insert ON public.crm_partners;
DROP POLICY IF EXISTS crm_partners_simulation_update ON public.crm_partners;
DROP POLICY IF EXISTS crm_partners_simulation_delete ON public.crm_partners;

ALTER TABLE public.crm_partners ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_partners TO authenticated;
GRANT ALL ON public.crm_partners TO service_role;
REVOKE ALL ON public.crm_partners FROM anon;

CREATE POLICY crm_partners_staff_select ON public.crm_partners
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
    AND is_simulation = public.is_simulation_mode()
  );

CREATE POLICY crm_partners_staff_insert ON public.crm_partners
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
    AND is_simulation = public.is_simulation_mode()
  );

CREATE POLICY crm_partners_staff_update ON public.crm_partners
  FOR UPDATE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
    AND is_simulation = public.is_simulation_mode()
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff'))
    AND is_simulation = public.is_simulation_mode()
  );

CREATE POLICY crm_partners_staff_delete ON public.crm_partners
  FOR DELETE TO authenticated
  USING (
    (public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin'))
    AND is_simulation = public.is_simulation_mode()
  );