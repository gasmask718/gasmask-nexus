# Partner Pricing + Portal Seeding + Bulk Import — Plan

Three coordinated changes. **Nothing applied yet** — review then approve.

---

## Pre-flight finding (important — read first)

There is **no existing self-service partner portal** for `tt_partners`. The only partner-touching surface today is:

- `src/pages/partner/PartnerRespond.tsx` — token-based SMS response landing (no login)
- `TTPartners`, `PenthousePartners`, `TopTierPartnerDashboard` — all **admin** views (David's side)

So Part 2B is not "confirm existing portal reads by partner_id" — it's **build a minimal partner portal scoped by partner_id**. Flagging because spec assumed one exists. Two options:

- **(a) Minimal scope (recommended now):** ship schema + bulk import + claim-invite flow + a small `/partner/portal` page (dispatch inbox + booking history scoped by `partner_id`). Defer rich portal UI to its own task.
- **(b) Full portal build now:** adds ~5–8 more components/pages. Larger surface, more review.

**Plan below assumes (a).** Confirm or switch to (b).

---

## Part 1 — Pricing Schema (Migration A)

### `tt_vehicles` additions
```sql
ALTER TABLE tt_vehicles
  ADD COLUMN partner_cost     numeric(10,2),
  ADD COLUMN customer_price   numeric(10,2),  -- explicit wins
  ADD COLUMN markup_pct       numeric(5,2);   -- fallback
```

### `tt_partners` additions (standard-rate for pools)
```sql
ALTER TABLE tt_partners
  ADD COLUMN default_partner_cost   numeric(10,2),
  ADD COLUMN default_customer_price numeric(10,2),
  ADD COLUMN default_markup_pct     numeric(5,2),
  ADD COLUMN portal_status text NOT NULL DEFAULT 'seeded'
    CHECK (portal_status IN ('seeded','invited','active')),
  ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN invited_at timestamptz,
  ADD COLUMN claimed_at timestamptz;

CREATE UNIQUE INDEX tt_partners_user_id_uidx
  ON tt_partners(user_id) WHERE user_id IS NOT NULL;
```

### Price-resolution helper (SQL, single source of truth)
```sql
CREATE OR REPLACE FUNCTION public.tt_resolve_price(
  _partner_cost   numeric,
  _customer_price numeric,
  _markup_pct     numeric
) RETURNS TABLE(customer_price numeric, margin numeric, margin_pct numeric)
LANGUAGE sql IMMUTABLE AS $$
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
```

Mirror TS helper at `src/lib/toptier/resolvePrice.ts` for client use — same logic, returns `{ customerPrice, margin, marginPct }`. **One canonical formula** used by dispatch, admin, and reporting.

### Margin reporting view
```sql
CREATE OR REPLACE VIEW tt_pricing_margin_v AS
SELECT 'vehicle'::text AS scope, v.id, v.name AS label, p.id AS partner_id, p.name AS partner,
       v.partner_cost, (tt_resolve_price(v.partner_cost, v.customer_price, v.markup_pct)).*
  FROM tt_vehicles v LEFT JOIN tt_partners p ON p.id = v.owner_partner_id
UNION ALL
SELECT 'partner_default', p.id, p.name, p.id, p.name,
       p.default_partner_cost,
       (tt_resolve_price(p.default_partner_cost, p.default_customer_price, p.default_markup_pct)).*
  FROM tt_partners p
 WHERE p.default_partner_cost IS NOT NULL;
```

**Quote-pattern partners (jets/coach/heli) stay NULL — no constraint forces pricing.** Validation lives in the importer (Part 3B), not the DB, so quote partners aren't blocked.

---

## Part 2 — Portal Seeding & Claim-on-Login

### Schema (already in Migration A above)
`portal_status`, `user_id`, `invited_at`, `claimed_at`.

### 2B — Partner-scoped data access
Add RLS to `tt_dispatch_requests` + `tt_bookings`:

```sql
CREATE POLICY "Partner sees own dispatches" ON tt_dispatch_requests
  FOR SELECT TO authenticated
  USING (partner_id IN (SELECT id FROM tt_partners WHERE user_id = auth.uid()));

CREATE POLICY "Partner sees own bookings" ON tt_bookings
  FOR SELECT TO authenticated
  USING (assigned_partner_id IN (SELECT id FROM tt_partners WHERE user_id = auth.uid()));
```
(Admin policies untouched — additive only.)

Data is keyed by `partner_id`. The orders exist before any login does; the moment a partner claims and `user_id` is linked, RLS opens their inbox.

### 2C — Claim-invite flow (we never set their password)

**Admin button "Invite to Portal"** on `PenthousePartners` row → calls new edge function `tt-invite-partner`:

```ts
// supabase/functions/tt-invite-partner/index.ts
// Uses admin client: supabase.auth.admin.inviteUserByEmail(email, {
//   redirectTo: `${SITE_URL}/partner/claim?partner_id=${partnerId}`,
//   data: { tt_partner_id: partnerId }
// })
// Then UPDATE tt_partners SET portal_status='invited', invited_at=now()
```

**Claim landing `/partner/claim`** (new page):
- User arrives via magic link → Supabase session exists.
- Page prompts them to **set their own password** (`supabase.auth.updateUser({ password })`).
- On success, call RPC `tt_claim_partner(partner_id)`:
  ```sql
  CREATE FUNCTION tt_claim_partner(_partner_id uuid) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    UPDATE tt_partners
       SET user_id = auth.uid(), portal_status = 'active', claimed_at = now()
     WHERE id = _partner_id AND user_id IS NULL;  -- one-shot claim
  END $$;
  ```
- Redirect to `/partner/portal`.

**Confirmation: we never call `admin.createUser` with a password.** `inviteUserByEmail` sends a Supabase magic link; the partner sets credentials themselves. Documented in code comments.

### 2D — Minimal `/partner/portal` page (scope-a)
`src/pages/partner/PartnerPortal.tsx`:
- Header: business name + portal_status badge
- Tab 1: **Active dispatch requests** (status in sent/accepted) — Accept/Decline buttons (write to same `tt_dispatch_requests.status`, mirrors SMS responses)
- Tab 2: **Booking history** (assigned_partner_id = me)
- Reads via standard supabase client; RLS handles scoping.

**SMS dispatch unchanged.** Portal is a parallel record — seeded-but-not-claimed partners still get SMS and respond by text; their portal just accumulates jobs until they claim.

---

## Part 3 — Bulk Import

### Edge function `bulk-import-partners`
- Auth: admin only (check role).
- Input: `{ rows: PartnerImportRow[], dryRun: boolean }`.
- Parse → validate → (commit or dry-run report).
- **Idempotent:** upsert match key = normalized `phone` OR `email`. Existing → update; new → insert with `portal_status='seeded'`.
- For each partner: insert/update vehicles (match by partner_id + name).
- Returns: `{ imported: n, updated: n, rejected: [{row, reasons[]}], wouldImport?: [...] }`.

### Validation rules (3B) — reject + report, never silent-drop
| Check | Error |
|---|---|
| `partner_type` not in `tt_service_routing.partner_types` (any row) | `unknown_partner_type` |
| Vehicle row has no parent partner | `orphan_vehicle` |
| Vehicle on fixed-price service (asset_fallback/pool_style/hybrid) with **both** `customer_price` and `markup_pct` null | `missing_pricing` |
| Asset-pattern vehicle missing `dispatch_model` | `missing_dispatch_model` |
| Style not in known styles enum | `unknown_style` |
| Missing required: business_name, phone OR email, partner_type | `missing_required:<field>` |

Quote-pattern partners (jet/coach/heli) → pricing checks skipped.

### Admin page `/admin/partners/import`
`src/pages/admin/PartnersImport.tsx`:
1. CSV upload (papaparse) + paste-as-array
2. Column mapping preview (auto-detect by header name)
3. **Dry-run** → shows would-import / would-update / rejects-with-reasons table
4. **Commit** button (disabled until dry-run runs)
5. Result summary + downloadable reject CSV

Sidebar registration: add to `src/components/Layout.tsx` under TopTier admin section.

### Auto-rollup after import (3D)
Trigger on `tt_vehicles` insert/update that updates the partner's `styles_offered`, `offers_star_ceiling`, `offers_red_carpet` aggregate fields:
```sql
CREATE OR REPLACE FUNCTION tt_partner_capability_rollup()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE tt_partners SET
    styles_offered = (SELECT array_agg(DISTINCT style) FROM tt_vehicles WHERE owner_partner_id = NEW.owner_partner_id AND style IS NOT NULL),
    offers_star_ceiling = EXISTS(SELECT 1 FROM tt_vehicles WHERE owner_partner_id = NEW.owner_partner_id AND star_ceiling = true),
    offers_red_carpet   = EXISTS(SELECT 1 FROM tt_vehicles WHERE owner_partner_id = NEW.owner_partner_id AND red_carpet = true)
   WHERE id = NEW.owner_partner_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tt_partner_capability_rollup
AFTER INSERT OR UPDATE OF style, star_ceiling, red_carpet, owner_partner_id
ON tt_vehicles FOR EACH ROW EXECUTE FUNCTION tt_partner_capability_rollup();
```

---

## Guardrail confirmations

- ✅ `tt-smart-dispatch` untouched. The 5 patterns + legacy path keep working — new columns are additive and nullable.
- ✅ Pricing nullable everywhere; quote-pattern partners not required to set it.
- ✅ Importer reports rejects; no silent drops.
- ✅ We never set partner passwords — `inviteUserByEmail` + partner-driven `updateUser({ password })`.
- ✅ `selectLegacyScored` (NULL pattern) not referenced; beauty regression remains green.

---

## File manifest (what gets created/edited on approval)

**Migrations**
- `supabase/migrations/<ts>_tt_pricing_and_portal.sql` (Part 1 + 2A + 2B RLS + rollup trigger + claim RPC + view + helper fn)

**Edge functions**
- `supabase/functions/bulk-import-partners/index.ts`
- `supabase/functions/tt-invite-partner/index.ts`

**Frontend**
- `src/lib/toptier/resolvePrice.ts` (mirror helper)
- `src/pages/admin/PartnersImport.tsx`
- `src/pages/partner/PartnerPortal.tsx`
- `src/pages/partner/PartnerClaim.tsx`
- Route registrations in `src/routes/AppRoutes.tsx`
- Sidebar entry in `src/components/Layout.tsx`
- "Invite to Portal" button on `PenthousePartners.tsx`

---

## Sequenced execution after approval

1. Apply migration → wait for types regen
2. Deploy `bulk-import-partners` + `tt-invite-partner`
3. Build frontend (importer page, portal, claim, invite button)
4. **Test batch:** import 3 clearly-marked sample partners (1 asset = exotic w/ vehicle + pricing, 1 pool = sprinter standard-rate, 1 quote = jet, no pricing). Verify:
   - `tt_pricing_margin_v` returns correct margins for the two priced rows
   - Dispatch an `exotic-cars` job → row appears in partner-scoped query as the test partner's user
   - Invite the test partner email → magic link arrives, claim flow completes, `portal_status='active'`, `user_id` linked
5. Report results, then unlock for real-partner import.

---

## Decisions I need from you

1. **Scope (a) minimal portal vs (b) full portal now?** Recommending (a).
2. **Test batch:** do you have 3 real partners to seed, or use clearly-marked `SEED_TEST_*` samples?
3. **Invite email:** use Supabase default magic-link email, or scaffold a branded TopTier auth email template first? (Default works; branded is one extra step.)

Reply with answers (or "go with recommendations") and I'll apply Migration A first, pause for types regen, then build the rest.
