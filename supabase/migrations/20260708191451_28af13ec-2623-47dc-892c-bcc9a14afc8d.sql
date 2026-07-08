-- 1. Extend dc_phone_numbers
ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS state TEXT NULL;

ALTER TABLE public.dc_phone_numbers
  ADD COLUMN IF NOT EXISTS bland_registered BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dc_phone_numbers.bland_registered IS
  'true = this Twilio-owned number is also registered inside Bland (BYON); Bland can dial FROM it. false = Twilio-only; dial via Twilio Voice API.';

-- 2. Backfill state for 15 mirrored Brandaro rows (Phase 0 dynasty snapshot)
UPDATE public.dc_phone_numbers SET state='AZ' WHERE phone_number='+16027371645';
UPDATE public.dc_phone_numbers SET state='CA' WHERE phone_number='+12132978049';
UPDATE public.dc_phone_numbers SET state='CA' WHERE phone_number='+12135834490';
UPDATE public.dc_phone_numbers SET state='FL' WHERE phone_number='+13055207414';
UPDATE public.dc_phone_numbers SET state='GA' WHERE phone_number='+14048009371';
UPDATE public.dc_phone_numbers SET state='GA' WHERE phone_number='+14709314883';
UPDATE public.dc_phone_numbers SET state='IL' WHERE phone_number='+18472389630';
UPDATE public.dc_phone_numbers SET state='NJ' WHERE phone_number='+18483588206';
UPDATE public.dc_phone_numbers SET state='NY' WHERE phone_number='+19292389353';
UPDATE public.dc_phone_numbers SET state='NY' WHERE phone_number='+19295727822';
UPDATE public.dc_phone_numbers SET state='NY' WHERE phone_number='+19296598565';
UPDATE public.dc_phone_numbers SET state='NY' WHERE phone_number='+19296613201';
UPDATE public.dc_phone_numbers SET state='NY' WHERE phone_number='+19296746727';
UPDATE public.dc_phone_numbers SET state='TX' WHERE phone_number='+18887598857';
UPDATE public.dc_phone_numbers SET state='TX' WHERE phone_number='+18888636609';

-- 3. Create bland_owned_numbers
CREATE TABLE IF NOT EXISTS public.bland_owned_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL UNIQUE,
  business TEXT NOT NULL,
  state TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  friendly_name TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bland_owned_numbers TO authenticated;
GRANT ALL ON public.bland_owned_numbers TO service_role;

ALTER TABLE public.bland_owned_numbers ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_bland_owned_numbers_touch_updated_at ON public.bland_owned_numbers;
CREATE TRIGGER trg_bland_owned_numbers_touch_updated_at
  BEFORE UPDATE ON public.bland_owned_numbers
  FOR EACH ROW EXECUTE FUNCTION public.dc_phone_numbers_touch_updated_at();

DROP POLICY IF EXISTS "authenticated read bland_owned_numbers" ON public.bland_owned_numbers;
CREATE POLICY "authenticated read bland_owned_numbers"
  ON public.bland_owned_numbers FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "admin manage bland_owned_numbers" ON public.bland_owned_numbers;
CREATE POLICY "admin manage bland_owned_numbers"
  ON public.bland_owned_numbers FOR ALL TO authenticated
  USING (public.is_brandaro_admin(auth.uid()))
  WITH CHECK (public.is_brandaro_admin(auth.uid()));

-- 4. Seed Dallas Bland-owned fallback
INSERT INTO public.bland_owned_numbers
  (phone_number, business, state, is_active, friendly_name, notes)
VALUES
  ('+12142394316', 'brandaro', 'TX', true, 'BRANDARO DALLAS 1',
   'Purchased from Bland when Twilio provisioning was not ready. Migrated from dynasty_phone_numbers during T7c-A. Reference for future Bland-owned number strategy.')
ON CONFLICT (phone_number) DO NOTHING;
