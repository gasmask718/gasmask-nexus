
-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 0 — TERRITORY INTELLIGENCE & CONTROL CENTER
-- Foundation schema for pre-CRM address-level awareness.
-- Unit of control: ADDRESS, not store.
-- No CRM pollution. No UI. Schema + integrity only.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Territory Neighborhoods ──────────────────────────────────────────────
-- Defines coverage zones (boroughs, neighborhoods, districts).
-- completion_percentage is derived at query time, not stored manually.
CREATE TABLE public.territory_neighborhoods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  total_address_count INTEGER NOT NULL DEFAULT 0,
  target_store_count INTEGER NOT NULL DEFAULT 0,
  completion_percentage NUMERIC(5,2) GENERATED ALWAYS AS (
    CASE WHEN target_store_count > 0
      THEN LEAST((total_address_count::numeric / target_store_count) * 100, 100)
      ELSE 0
    END
  ) STORED,
  status TEXT NOT NULL DEFAULT 'untouched'
    CHECK (status IN ('untouched', 'in_progress', 'dominated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.territory_neighborhoods IS
  'Coverage zones for territory intelligence. Tracks domination progress per area.';

-- ── 2. Territory Addresses ──────────────────────────────────────────────────
-- Every physical address in target territory. Exists whether or not a store is known.
CREATE TABLE public.territory_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT,
  neighborhood_id UUID REFERENCES public.territory_neighborhoods(id),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  address_type TEXT NOT NULL DEFAULT 'unknown'
    CHECK (address_type IN ('commercial', 'residential', 'unknown')),
  discovery_status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (discovery_status IN (
      'unknown', 'scouted', 'verified_store', 'not_a_store',
      'not_interested', 'no_tobacco', 'wholesaler'
    )),
  verified_sells_grabba BOOLEAN,
  discovered_by TEXT NOT NULL DEFAULT 'import'
    CHECK (discovered_by IN ('ai', 'human', 'import')),
  last_checked_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.territory_addresses IS
  'Every physical address in target territory. The atomic unit of territory intelligence. Exists independent of store knowledge.';

-- ── 3. Territory Store Candidates ───────────────────────────────────────────
-- Addresses believed to be stores but NOT yet CRM-approved.
-- Nothing here is a real store. No orders, invoices, or payments attach here.
CREATE TABLE public.territory_store_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territory_address_id UUID NOT NULL REFERENCES public.territory_addresses(id),
  store_name_guess TEXT,
  sells_tobacco TEXT NOT NULL DEFAULT 'unknown'
    CHECK (sells_tobacco IN ('yes', 'no', 'unknown')),
  interest_level TEXT NOT NULL DEFAULT 'cold'
    CHECK (interest_level IN ('cold', 'warm', 'interested')),
  source TEXT NOT NULL DEFAULT 'import'
    CHECK (source IN ('ai_call', 'manual_call', 'scout', 'import')),
  last_contacted_at TIMESTAMPTZ,
  next_action TEXT DEFAULT 'call'
    CHECK (next_action IN ('call', 'visit', 'ignore')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.territory_store_candidates IS
  'Pre-CRM store candidates. These are guesses/leads — NOT real stores. Human verification required before CRM promotion.';

-- ── 4. Territory Activity Log ───────────────────────────────────────────────
-- Immutable audit trail. Every territory action is logged here.
CREATE TABLE public.territory_activity_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  territory_address_id UUID NOT NULL REFERENCES public.territory_addresses(id),
  action_type TEXT NOT NULL
    CHECK (action_type IN ('scouted', 'called', 'visited', 'pitched', 'verified', 'rejected')),
  actor_type TEXT NOT NULL
    CHECK (actor_type IN ('ai', 'human')),
  actor_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.territory_activity_log IS
  'Immutable audit trail for all territory intelligence actions. Never deleted.';

-- ── 5. Indexes for performance ──────────────────────────────────────────────
CREATE INDEX idx_territory_addresses_neighborhood ON public.territory_addresses(neighborhood_id);
CREATE INDEX idx_territory_addresses_discovery ON public.territory_addresses(discovery_status);
CREATE INDEX idx_territory_addresses_city_state ON public.territory_addresses(city, state);
CREATE INDEX idx_territory_candidates_address ON public.territory_store_candidates(territory_address_id);
CREATE INDEX idx_territory_activity_address ON public.territory_activity_log(territory_address_id);
CREATE INDEX idx_territory_activity_type ON public.territory_activity_log(action_type);

-- ── 6. Updated-at trigger for territory_addresses ───────────────────────────
CREATE TRIGGER update_territory_addresses_updated_at
  BEFORE UPDATE ON public.territory_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── 7. RLS — Strict governance ──────────────────────────────────────────────
ALTER TABLE public.territory_neighborhoods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_store_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_activity_log ENABLE ROW LEVEL SECURITY;

-- Neighborhoods: readable by all authenticated, writable by owner/admin/staff
CREATE POLICY "Authenticated users can read neighborhoods"
  ON public.territory_neighborhoods FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage neighborhoods"
  ON public.territory_neighborhoods FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Addresses: readable by all authenticated, writable by owner/admin/staff
CREATE POLICY "Authenticated users can read addresses"
  ON public.territory_addresses FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage addresses"
  ON public.territory_addresses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Store candidates: readable by all authenticated, writable by owner/admin/staff
CREATE POLICY "Authenticated users can read candidates"
  ON public.territory_store_candidates FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Staff can manage candidates"
  ON public.territory_store_candidates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Activity log: readable by all authenticated, insertable by all authenticated (immutable)
CREATE POLICY "Authenticated users can read activity log"
  ON public.territory_activity_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert activity log"
  ON public.territory_activity_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Activity log: no updates or deletes (immutable)
-- RLS implicitly blocks UPDATE/DELETE since no policies exist for those operations
