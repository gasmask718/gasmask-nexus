-- Canonical location schema alignment for wholesalers
-- Adds missing columns the UI expects (and future-proof fields) in one pass.

ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS zip_code text,
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'US';

-- Index for city filtering (city already exists, but index may not)
CREATE INDEX IF NOT EXISTS wholesalers_city_idx ON public.wholesalers (city);

-- Safe backfill: if legacy single-line address exists, copy into address_line_1
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='wholesalers' AND column_name='address'
  ) THEN
    UPDATE public.wholesalers
    SET address_line_1 = COALESCE(address_line_1, address)
    WHERE address_line_1 IS NULL AND address IS NOT NULL;
  END IF;

  -- Ensure country is normalized
  UPDATE public.wholesalers
  SET country = 'US'
  WHERE country IS NULL OR btrim(country) = '';
END
$$;