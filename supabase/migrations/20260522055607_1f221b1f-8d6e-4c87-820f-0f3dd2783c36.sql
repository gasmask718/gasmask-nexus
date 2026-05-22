-- =========================================================
-- PHASE 1 — DECORATOR IDENTITY UNIFICATION (retry 2)
-- Fix #1: tt_service_routing column is `slug`
-- Fix #2: tt_partners.status allowed values do not include 'pending_claim'
-- =========================================================

ALTER TABLE public.decorators
  ADD COLUMN IF NOT EXISTS tt_partner_id uuid REFERENCES public.tt_partners(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS source_legacy_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS decorators_tt_partner_id_uidx
  ON public.decorators(tt_partner_id)
  WHERE tt_partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS decorators_source_legacy_id_idx
  ON public.decorators(source_legacy_id)
  WHERE source_legacy_id IS NOT NULL;

UPDATE public.tt_service_routing
SET partner_types = (
  SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(partner_types, ARRAY[]::text[]) || ARRAY['decorator']))
)
WHERE slug IN ('hotel-decor', 'truck-decor');

DO $$
DECLARE
  r RECORD;
  v_tt_partner_id uuid;
BEGIN
  FOR r IN
    SELECT id, name, city, lat, lng, service_radius_miles,
           bio, rating, is_active, independent_contractor,
           specialties, media, price_range
    FROM public.decor_providers
  LOOP
    SELECT tt_partner_id INTO v_tt_partner_id
      FROM public.decorators
     WHERE source_legacy_id = r.id
     LIMIT 1;

    IF v_tt_partner_id IS NOT NULL THEN
      CONTINUE;
    END IF;

    INSERT INTO public.tt_partners (
      name, business_name, partner_type, service_category,
      city, status, portal_status, is_active
    ) VALUES (
      r.name,
      r.name,
      'decorator',
      'decor',
      r.city,
      'pending',
      'invited',
      COALESCE(r.is_active, true)
    )
    RETURNING id INTO v_tt_partner_id;

    INSERT INTO public.decorators (
      tt_partner_id, source_legacy_id,
      name, city, lat, lng, service_radius_miles,
      bio, rating, specialties, is_active
    ) VALUES (
      v_tt_partner_id, r.id,
      r.name, r.city, r.lat, r.lng, r.service_radius_miles,
      r.bio, r.rating, r.specialties, COALESCE(r.is_active, true)
    );
  END LOOP;
END $$;

ALTER TABLE IF EXISTS public.decor_providers
  RENAME TO decor_providers_legacy;

COMMENT ON TABLE public.decor_providers_legacy IS
  'DEPRECATED 2026-05-22 — backfilled into tt_partners + decorators via decorators.source_legacy_id. Drop after 30-day audit window (~2026-06-22).';
