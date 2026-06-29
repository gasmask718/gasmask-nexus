ALTER TABLE public.wholesalers
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS preferred_contact text DEFAULT 'email';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wholesalers_preferred_contact_check'
  ) THEN
    ALTER TABLE public.wholesalers
      ADD CONSTRAINT wholesalers_preferred_contact_check
      CHECK (preferred_contact IN ('email','whatsapp','both'));
  END IF;
END $$;