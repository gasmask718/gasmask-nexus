-- Truck-decor coordination: addon fields on tt_bookings
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS decor_addon boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decor_partner_id uuid REFERENCES public.tt_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS decor_package_slug text;

-- Index for "find truck-with-decor jobs by decorator"
CREATE INDEX IF NOT EXISTS idx_tt_bookings_decor_partner
  ON public.tt_bookings (decor_partner_id)
  WHERE decor_addon = true;

-- Guardrail: if decor_addon=true, decor_partner_id must be set
ALTER TABLE public.tt_bookings
  DROP CONSTRAINT IF EXISTS tt_bookings_decor_addon_requires_partner;
ALTER TABLE public.tt_bookings
  ADD CONSTRAINT tt_bookings_decor_addon_requires_partner
  CHECK (decor_addon = false OR decor_partner_id IS NOT NULL);

-- Meeting-point fields on tt_dispatch_requests (decorator's row only, by convention)
ALTER TABLE public.tt_dispatch_requests
  ADD COLUMN IF NOT EXISTS meeting_point_address text,
  ADD COLUMN IF NOT EXISTS meeting_point_time timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_point_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS meeting_point_set_by uuid;