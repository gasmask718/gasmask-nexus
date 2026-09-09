ALTER TABLE public.business_leads
  ADD COLUMN IF NOT EXISTS instagram_username text,
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS instagram_bio text,
  ADD COLUMN IF NOT EXISTS instagram_followers integer;

ALTER TABLE public.business_leads
  DROP CONSTRAINT IF EXISTS business_leads_category_canonical;

ALTER TABLE public.business_leads
  ADD CONSTRAINT business_leads_category_canonical
    CHECK (category = ANY (ARRAY[
      'event_hall','rental_company','caterer','bartender','florist',
      'photographer','videographer','decorator','event_planner','entertainer',
      'dj','photo_booth','lighting','transportation','security','staff',
      'cleaner','other','limo','chauffeur','exotic_car','party_bus','yacht',
      'nightclub','security_firm','authenticator','private_chef','beauty',
      'model','creator','cameraman'
    ]::text[]));