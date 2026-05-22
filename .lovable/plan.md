
# Decor Marketplace — Full Phased Build Plan

A new **service-provider marketplace** layered on TopTier, with **decorators as the first instance**. Decorators are self-priced (marketplace), unlike the platform-priced transportation pool. Five phases, gated by approval + proof. Transportation dispatch and the 5 live patterns are not touched outside Phase 3's additive change.

---

## Guiding invariants (apply to every phase)

- `tt_partners` is the single identity of record for all dispatchable providers (transport AND service).
- The 5 existing dispatch patterns and `selectLegacyScored` are read-only for this build. Phase 3 only **adds** a 6th pattern.
- Every `.insert()/.update()/.rpc()` checks error and surfaces it (same discipline that closed the swallowed-success bugs).
- Beauty regression (existing service dispatch) is re-run after every dispatch-touching phase.
- Phase gating is hard: no phase begins until the prior phase's VERIFY passes.

---

## Phase 0 — This plan (no code)

Output the full shape, get approval, then begin Phase 1.

---

## Phase 1 — Identity Unification

**Goal:** one row per decorator in `tt_partners`. Retire fragmentation.

Today: `decorators` (0 rows, has `user_id`), `decor_providers` (4 rows, fully orphaned — no `user_id`, no `tt_partner_id`), `tt_partners` (0 decor rows).

**Recommendation: keep `decorators` as the profile-extension table (bio/media/service area), make `decor_providers` a deprecated read-only legacy view, migrate its 4 rows into `tt_partners` + `decorators`.** Rationale: `decorators` already has `user_id` (claim-ready); `decor_providers` is a stale seed table.

### Migration (Phase 1)
```sql
-- 1. Link decorators to tt_partners
ALTER TABLE decorators ADD COLUMN tt_partner_id uuid REFERENCES tt_partners(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX decorators_tt_partner_id_uniq ON decorators(tt_partner_id) WHERE tt_partner_id IS NOT NULL;

-- 2. Backfill: for each decor_providers row, create tt_partners row + decorators row + link.
--    Done in a one-shot DO block keyed on name (the 4 rows have no phone/email to dedupe).
--    Records source_legacy_id = decor_providers.id for audit.

-- 3. Rename decor_providers -> decor_providers_legacy (kept for read-only audit, 30-day retention).
ALTER TABLE decor_providers RENAME TO decor_providers_legacy;
```

### Code (Phase 1)
- `bulk-import-partners`: add a `decorator` branch — when `partner_type='decorator'`, insert `tt_partners` (as today) AND a paired `decorators` row with `tt_partner_id` set. Error-checked end-to-end (same audit discipline). Nested `packages[]` allowed but written in Phase 2.

### VERIFY (Phase 1)
1. `SELECT count(*) FROM decorators WHERE tt_partner_id IS NOT NULL` = 4.
2. Each legacy decor_providers row joins to a real `tt_partners` row by `decorators.source_legacy_id`.
3. Seed a test decorator via importer → lands as one tt_partners + one decorators row, linked.
4. No partner_type='decorator' rows are orphaned (`tt_partners.id NOT IN (SELECT tt_partner_id FROM decorators)` returns 0).

---

## Phase 2 — Self-Defined Packages + Pricing Surface

**Goal:** decorators define their own packages with their own prices; public surfaces read from those packages (no hardcoded teasers).

Today: `provider_packages` (0 rows, right shape, `provider_id` not pointing at `tt_partners`). HotelDecor.tsx / TruckDecor.tsx render hardcoded `experiences[]/packages[]` constants.

### Migration (Phase 2)
```sql
ALTER TABLE provider_packages
  ADD COLUMN tt_partner_id uuid REFERENCES tt_partners(id) ON DELETE CASCADE,
  ADD COLUMN category text,            -- 'hotel-decor' | 'truck-decor' | 'yacht-decor' | ...
  ADD COLUMN platform_fee_pct numeric NOT NULL DEFAULT 15,
  ADD COLUMN is_published boolean NOT NULL DEFAULT false;

CREATE INDEX provider_packages_partner_cat_idx
  ON provider_packages(tt_partner_id, category) WHERE is_published;

-- Computed/derived view exposing partner_take = price * (1 - platform_fee_pct/100)
CREATE OR REPLACE VIEW provider_packages_v AS
SELECT pp.*, p.business_name, p.name AS partner_name,
       (pp.price * (1 - pp.platform_fee_pct/100.0))::numeric(10,2) AS partner_take,
       (pp.price * (pp.platform_fee_pct/100.0))::numeric(10,2) AS platform_fee
FROM provider_packages pp
JOIN tt_partners p ON p.id = pp.tt_partner_id;
```

### Code (Phase 2)
- **Partner Portal** (`PartnerPortal.tsx`): new "Packages" tab for `partner_type='decorator'` — CRUD on `provider_packages` (name, description, inclusions JSONB, price, category, is_published). Errors surfaced.
- **Public surfaces:**
  - `/decorators/:id` — read packages from `provider_packages_v WHERE tt_partner_id = :id AND is_published`.
  - `/services/hotel-decor` and `/services/truck-decor` — "starting from" computed as `MIN(price) FROM provider_packages_v WHERE category=... AND is_published`. Remove hardcoded `experiences[]/packages[]` constants; replace with real queries (loading + empty states).
- **Importer** (Phase 1 branch extension): accept optional `packages: [{name, price, category, platform_fee_pct?}]` and write them.

### VERIFY (Phase 2)
1. Decorator logs into portal, creates a $X package → row appears in `provider_packages` with correct `tt_partner_id`, `platform_fee_pct`, `is_published=true`.
2. `/decorators/:id` lists that package at $X with correct inclusions.
3. `/services/hotel-decor` "starting from" matches `MIN(price)` for hotel-decor category packages.
4. `rg "experiences = \[" src/pages/services/HotelDecor.tsx src/pages/services/TruckDecor.tsx` returns nothing — hardcoded teasers gone.

---

## Phase 3 — `marketplace_direct` Dispatch Pattern (additive 6th pattern)

**Goal:** customer-chosen decorator → routes to exactly that decorator, no broadcast.

### Migration (Phase 3)
```sql
-- 1. Extend the validate_dispatch_pattern trigger to accept 'marketplace_direct'
--    (read existing trigger first, append the value to the allowed set — same pattern used for the 5 existing).

-- 2. Activate decor routing
UPDATE tt_service_routing
SET dispatch_pattern = 'marketplace_direct', is_active = true
WHERE service_slug IN ('hotel-decor', 'truck-decor');
```

### Code (Phase 3)
- **Dispatch engine** (the file that holds `selectLegacyScored` and the 5 pattern selectors): add `selectMarketplaceDirect(request)`:
  - Requires `request.chosen_partner_id` (set from booking's chosen decorator).
  - Returns exactly `[{ id: chosen_partner_id, ... }]`. No scoring, no broadcast.
  - Writes one `tt_dispatch_requests` row with `accepted_partner_id` pre-set to the chosen partner (or `matched_partners=[chosen]` + auto-accept depending on existing semantics — will mirror selectLegacyScored's row shape exactly).
- **Booking creation flow** for hotel-decor / truck-decor: customer's chosen `decorator_id` (already collected on category pages) is written to `tt_bookings.chosen_partner_id` (new column added in migration above) and propagated into dispatch request.
- **Portal visibility:** dispatch request is keyed on `tt_partners.id` (already the case in `PartnerPortal.tsx` via the matched_partners predicate). No portal change needed if Phase 1 unification is clean.

### VERIFY (Phase 3) — function-invoke proof, not just SELECTs
1. Create a hotel-decor booking with chosen decorator A → invoke dispatch edge function → `tt_dispatch_requests` row has only decorator A.
2. Log into A's portal → request appears under Dispatch Requests.
3. Beauty regression: run a beauty booking → still dispatches through its existing pattern, unchanged.
4. Pattern allowlist: try `dispatch_pattern='garbage'` → trigger rejects (proves trigger still enforces).

---

## Phase 4 — Commission / Payout

**Goal:** completed decor booking writes a commission entry.

### Migration (Phase 4)
- Trigger or RPC: on `tt_bookings.status -> 'completed'` for marketplace_direct service types, insert into `commission_events`:
  - `source_entity_type='decor_package_booking'`
  - `source_entity_id=booking.id`
  - `gross_amount=package.price`
  - `commission_rate=package.platform_fee_pct`
  - `commission_amount=gross * rate`
- New view `decor_commission_v` joining `commission_events` ↔ `provider_packages_v` ↔ `tt_partners` for admin reporting.

### Code (Phase 4)
- Admin reporting widget on `/admin/marketplace-control` showing decor commission totals.

### VERIFY (Phase 4)
1. Mark a test decor booking complete → `commission_events` row written with correct `commission_amount`.
2. Reversal (booking cancelled after completion) writes a compensating row, not an UPDATE (per ledger-truth invariant).
3. `decor_commission_v` shows the row.

---

## Phase 5 — Linked Bookings (yacht/club/car decor add-ons)

**Goal:** add-on decor is a second booking linked to a parent (yacht/club/exotic-car).

### Migration (Phase 5)
```sql
ALTER TABLE tt_bookings
  ADD COLUMN parent_booking_id uuid REFERENCES tt_bookings(id) ON DELETE CASCADE,
  ADD COLUMN booking_role text DEFAULT 'primary' CHECK (booking_role IN ('primary','addon_decor'));
CREATE INDEX tt_bookings_parent_idx ON tt_bookings(parent_booking_id);
```

### Code (Phase 5)
- Yacht/Club/Exotic-Car detail pages: "Add Decor" CTA → opens decorator picker (filtered to relevant category: yacht-decor/club-decor/car-decor) → on confirm, creates a SECOND `tt_bookings` row with `parent_booking_id=parent.id`, `booking_role='addon_decor'`, `chosen_partner_id=decorator`, then dispatches via `marketplace_direct`.
- Add `yacht-decor`, `club-decor`, `car-decor` to `tt_service_routing` (active, `marketplace_direct`).
- **Payment decision point — flag, don't build blind:** present two options (pay-with-parent vs separate charge) and wait for user choice before wiring payment. Default plan stub: separate charge on the addon booking using the same Stripe path as standalone decor.

### VERIFY (Phase 5)
1. Book yacht + decor → two `tt_bookings` rows, decor row's `parent_booking_id` = yacht row's id.
2. Decor row dispatches via marketplace_direct to chosen decorator; decorator sees it in portal.
3. Cancelling parent cascades or flags addon (per agreed cancellation policy — to be confirmed).

---

## Cross-phase dependency graph
```text
Phase 1 (identity) ──► Phase 2 (packages need tt_partner_id)
                                  │
                                  ▼
                       Phase 3 (dispatch needs real partners + packages to land on)
                                  │
                                  ▼
                       Phase 4 (commission needs completed marketplace_direct bookings)
                                  │
                                  ▼
                       Phase 5 (linked bookings reuse marketplace_direct + commission)
```

## How transportation stays safe at each step
- Phase 1: only adds a column to `decorators` + renames `decor_providers`; no transport table touched.
- Phase 2: only adds columns to `provider_packages` (orphaned table, 0 rows, no transport consumer).
- Phase 3: extends the pattern allowlist (additive) and flips two routing rows that were `is_active=false`. The 5 existing patterns are untouched in code and DB. Beauty regression re-run.
- Phase 4: new trigger scoped to `service_type IN (decor categories)`. Transport bookings excluded.
- Phase 5: `parent_booking_id` is NULLABLE with `DEFAULT NULL`; existing transport bookings unaffected.

---

## What I need from you to start Phase 1
1. **Approve this Phase 0 plan.**
2. Confirm the **`decorators` over `decor_providers`** recommendation (keep `decorators` as profile-extension; deprecate `decor_providers` to `_legacy`). If you prefer the reverse, I'll re-spec Phase 1.
3. Confirm default **`platform_fee_pct = 15%`** (placeholder; easy to change before Phase 2).

On approval of (1)+(2)+(3), I'll post the Phase 1 migration SQL + importer diff for review before applying.
