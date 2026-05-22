
-- ============================================================
-- PART 1: PRICING SCHEMA
-- ============================================================
ALTER TABLE public.tt_vehicles
  ADD COLUMN IF NOT EXISTS partner_cost     numeric(10,2),
  ADD COLUMN IF NOT EXISTS customer_price   numeric(10,2),
  ADD COLUMN IF NOT EXISTS markup_pct       numeric(5,2);

ALTER TABLE public.tt_partners
  ADD COLUMN IF NOT EXISTS default_partner_cost   numeric(10,2),
  ADD COLUMN IF NOT EXISTS default_customer_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS default_markup_pct     numeric(5,2),
  ADD COLUMN IF NOT EXISTS portal_status text NOT NULL DEFAULT 'seeded',
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Portal status check (drop+recreate to be idempotent)
ALTER TABLE public.tt_partners DROP CONSTRAINT IF EXISTS tt_partners_portal_status_check;
ALTER TABLE public.tt_partners ADD CONSTRAINT tt_partners_portal_status_check
  CHECK (portal_status IN ('seeded','invited','active'));

CREATE UNIQUE INDEX IF NOT EXISTS tt_partners_user_id_uidx
  ON public.tt_partners(user_id) WHERE user_id IS NOT NULL;

-- ============================================================
-- PRICE RESOLUTION HELPER (single source of truth)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tt_resolve_price(
  _partner_cost   numeric,
  _customer_price numeric,
  _markup_pct     numeric
) RETURNS TABLE(customer_price numeric, margin numeric, margin_pct numeric)
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT
    cp,
    CASE WHEN cp IS NULL OR _partner_cost IS NULL THEN NULL
         ELSE cp - _partner_cost END,
    CASE WHEN cp IS NULL OR _partner_cost IS NULL OR _partner_cost = 0 THEN NULL
         ELSE round(((cp - _partner_cost) / _partner_cost) * 100, 2) END
  FROM (
    SELECT COALESCE(
      _customer_price,
      CASE WHEN _partner_cost IS NOT NULL AND _markup_pct IS NOT NULL
           THEN round(_partner_cost * (1 + _markup_pct/100.0), 2) END
    ) AS cp
  ) s;
$$;

-- ============================================================
-- MARGIN REPORTING VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.tt_pricing_margin_v AS
SELECT
  'vehicle'::text AS scope,
  v.id,
  v.name AS label,
  p.id AS partner_id,
  p.name AS partner_name,
  v.partner_cost,
  r.customer_price,
  r.margin,
  r.margin_pct
FROM public.tt_vehicles v
LEFT JOIN public.tt_partners p ON p.id = v.owner_partner_id
CROSS JOIN LATERAL public.tt_resolve_price(v.partner_cost, v.customer_price, v.markup_pct) r
UNION ALL
SELECT
  'partner_default'::text,
  p.id,
  p.name,
  p.id,
  p.name,
  p.default_partner_cost,
  r.customer_price,
  r.margin,
  r.margin_pct
FROM public.tt_partners p
CROSS JOIN LATERAL public.tt_resolve_price(p.default_partner_cost, p.default_customer_price, p.default_markup_pct) r
WHERE p.default_partner_cost IS NOT NULL;

-- ============================================================
-- PART 2: PORTAL RLS (partner-scoped reads — additive)
-- ============================================================
-- Make sure RLS is on (no-op if already)
ALTER TABLE public.tt_dispatch_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tt_bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partner sees own dispatches" ON public.tt_dispatch_requests;
CREATE POLICY "Partner sees own dispatches" ON public.tt_dispatch_requests
  FOR SELECT TO authenticated
  USING (
    accepted_partner_id IS NOT NULL
    AND accepted_partner_id::text IN (
      SELECT id::text FROM public.tt_partners WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partner updates own dispatches" ON public.tt_dispatch_requests;
CREATE POLICY "Partner updates own dispatches" ON public.tt_dispatch_requests
  FOR UPDATE TO authenticated
  USING (
    accepted_partner_id::text IN (
      SELECT id::text FROM public.tt_partners WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Partner sees own bookings" ON public.tt_bookings;
CREATE POLICY "Partner sees own bookings" ON public.tt_bookings
  FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.tt_partners WHERE user_id = auth.uid())
  );

-- Partner can read their own partner record
DROP POLICY IF EXISTS "Partner sees own record" ON public.tt_partners;
CREATE POLICY "Partner sees own record" ON public.tt_partners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- CLAIM-INVITE RPC (one-shot; never sets password)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tt_claim_partner(_partner_id uuid)
RETURNS public.tt_partners
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.tt_partners;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.tt_partners
     SET user_id = auth.uid(),
         portal_status = 'active',
         claimed_at = now()
   WHERE id = _partner_id
     AND user_id IS NULL
  RETURNING * INTO _row;

  IF _row.id IS NULL THEN
    RAISE EXCEPTION 'Partner not found or already claimed';
  END IF;

  RETURN _row;
END $$;

REVOKE ALL ON FUNCTION public.tt_claim_partner(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.tt_claim_partner(uuid) TO authenticated;

-- ============================================================
-- CAPABILITY ROLLUP TRIGGER (post-import auto-refresh)
-- ============================================================
CREATE OR REPLACE FUNCTION public.tt_partner_capability_rollup()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _pid uuid := COALESCE(NEW.owner_partner_id, OLD.owner_partner_id);
BEGIN
  IF _pid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE public.tt_partners SET
    styles_offered = COALESCE(
      (SELECT array_agg(DISTINCT style) FROM public.tt_vehicles
        WHERE owner_partner_id = _pid AND style IS NOT NULL),
      ARRAY[]::text[]
    ),
    offers_star_ceiling = EXISTS(
      SELECT 1 FROM public.tt_vehicles
       WHERE owner_partner_id = _pid AND star_ceiling = true
    ),
    offers_red_carpet = EXISTS(
      SELECT 1 FROM public.tt_vehicles
       WHERE owner_partner_id = _pid AND red_carpet = true
    )
  WHERE id = _pid;

  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_tt_partner_capability_rollup ON public.tt_vehicles;
CREATE TRIGGER trg_tt_partner_capability_rollup
AFTER INSERT OR UPDATE OF style, star_ceiling, red_carpet, owner_partner_id
   OR DELETE
ON public.tt_vehicles
FOR EACH ROW
EXECUTE FUNCTION public.tt_partner_capability_rollup();
