
-- ============================================================
-- MARKETPLACE LISTING GATE
-- Only onboarded + verified partners can have published listings
-- ============================================================

-- 1) Validation trigger: prevent publishing listings for unverified partners
CREATE OR REPLACE FUNCTION public.ut_enforce_listing_publish_gate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  partner_record RECORD;
BEGIN
  -- Only check on publish
  IF NEW.status = 'published' THEN
    SELECT onboarding_complete, is_verified, profile_completeness
    INTO partner_record
    FROM public.ut_partners
    WHERE id = NEW.partner_id;

    IF partner_record IS NULL THEN
      RAISE EXCEPTION 'Partner not found — cannot publish listing';
    END IF;

    IF partner_record.onboarding_complete IS NOT TRUE THEN
      RAISE EXCEPTION 'Partner has not completed onboarding — cannot publish listing';
    END IF;

    IF partner_record.is_verified IS NOT TRUE THEN
      RAISE EXCEPTION 'Partner is not verified — cannot publish listing';
    END IF;

    IF COALESCE(partner_record.profile_completeness, 0) < 50 THEN
      RAISE EXCEPTION 'Partner profile completeness is below 50%% — cannot publish listing';
    END IF;

    -- Auto-set published_at
    NEW.published_at := COALESCE(NEW.published_at, now());
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger
DROP TRIGGER IF EXISTS trg_ut_listing_publish_gate ON public.ut_listings;
CREATE TRIGGER trg_ut_listing_publish_gate
  BEFORE INSERT OR UPDATE ON public.ut_listings
  FOR EACH ROW
  EXECUTE FUNCTION public.ut_enforce_listing_publish_gate();

-- 2) RLS policy: public can only see published listings from verified partners
-- Drop existing select policies first to avoid conflicts
DO $$
BEGIN
  -- Drop if exists (safe)
  DROP POLICY IF EXISTS "Public can view published listings" ON public.ut_listings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Public can view published listings"
  ON public.ut_listings
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND EXISTS (
      SELECT 1 FROM public.ut_partners p
      WHERE p.id = partner_id
        AND p.onboarding_complete = true
        AND p.is_verified = true
    )
  );

-- 3) Helper function: check if a partner can publish
CREATE OR REPLACE FUNCTION public.ut_can_partner_publish(p_partner_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'can_publish', (
      COALESCE(p.onboarding_complete, false) = true
      AND COALESCE(p.is_verified, false) = true
      AND COALESCE(p.profile_completeness, 0) >= 50
    ),
    'onboarding_complete', COALESCE(p.onboarding_complete, false),
    'is_verified', COALESCE(p.is_verified, false),
    'profile_completeness', COALESCE(p.profile_completeness, 0),
    'missing', (
      SELECT jsonb_agg(item) FROM (
        SELECT 'onboarding' AS item WHERE COALESCE(p.onboarding_complete, false) = false
        UNION ALL
        SELECT 'verification' WHERE COALESCE(p.is_verified, false) = false
        UNION ALL
        SELECT 'profile_50pct' WHERE COALESCE(p.profile_completeness, 0) < 50
      ) missing_items
    )
  )
  FROM public.ut_partners p
  WHERE p.id = p_partner_id;
$$;
