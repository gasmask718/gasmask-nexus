ALTER TABLE public.brandaro_qualified_leads
  ADD COLUMN IF NOT EXISTS reviews jsonb,
  ADD COLUMN IF NOT EXISTS photos jsonb;

COMMENT ON COLUMN public.brandaro_qualified_leads.reviews IS 'Google Places (New) reviews: [{author,rating,text,relative_time,published_at,profile_photo_url}]';
COMMENT ON COLUMN public.brandaro_qualified_leads.photos IS 'Resolved Google Places photo image URLs: [{url,width,height,attribution}]';