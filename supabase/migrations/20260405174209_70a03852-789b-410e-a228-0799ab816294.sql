
-- 1. Add venues array to nightlife_partners for venue-level matching
ALTER TABLE public.nightlife_partners
ADD COLUMN IF NOT EXISTS venues text[] DEFAULT '{}';

-- 2. Auto-assign function: match by city + venue
CREATE OR REPLACE FUNCTION public.auto_assign_nightlife_promoter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_promoter_id uuid;
BEGIN
  -- Try exact city + venue match first
  IF NEW.venue IS NOT NULL AND NEW.venue <> '' THEN
    SELECT id INTO matched_promoter_id
    FROM nightlife_partners
    WHERE is_active = true
      AND lower(city) = lower(NEW.city)
      AND NEW.venue = ANY(venues)
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Fallback: match by city only
  IF matched_promoter_id IS NULL THEN
    SELECT id INTO matched_promoter_id
    FROM nightlife_partners
    WHERE is_active = true
      AND lower(city) = lower(NEW.city)
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Assign if found
  IF matched_promoter_id IS NOT NULL THEN
    NEW.assigned_promoter_id := matched_promoter_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Trigger on insert
DROP TRIGGER IF EXISTS trg_auto_assign_nightlife_promoter ON public.nightlife_requests;
CREATE TRIGGER trg_auto_assign_nightlife_promoter
  BEFORE INSERT ON public.nightlife_requests
  FOR EACH ROW
  WHEN (NEW.assigned_promoter_id IS NULL)
  EXECUTE FUNCTION public.auto_assign_nightlife_promoter();
