# tt-smart-dispatch — 5-Pattern Refactor

## 1. Coach-bus ownership (answered first)

**Question:** does coach-bus belong to `cb-dispatch-engine` or to the new `quote_region` branch?

**Answer: `cb-dispatch-engine` owns it.** Evidence:
- `PenthouseCoachBusDispatch.tsx` invokes only `cb-dispatch-engine` (dispatch / select_quote / send_customer_offer).
- `PenthousePrivateJetDispatch.tsx` also invokes `cb-dispatch-engine` — the cb engine is the shared quote-flow engine for **both** coach-bus and private-jet.
- `PartnerRespond.tsx` (partner quote submission) routes through `cb-dispatch-engine`.

**Implication for tt-smart-dispatch:** the `quote_region` branch must NOT broadcast SMS and must NOT charge. It only:
1. Inserts a `tt_dispatch_requests` row with `status='awaiting_quote'`, `dispatch_pattern='quote_region'`, `payment_leg='pay_after_quote_not_built'`, and `matched_partners` = regional partner list (for visibility).
2. Returns early with `{ success: true, fulfillment: 'quote_region', engine: 'cb-dispatch-engine', matched: N }`.

The cb engine is then triggered manually from the Penthouse UI (existing flow). No double-dispatch.

## 2. Branch architecture

After `resolveRouting()` resolves `routing.dispatch_pattern`:

```text
routing._unrouted || fulfillment_model='manual' || partner_types=[]  → manual queue   (UNCHANGED)
dispatch_pattern = 'pool_style'                                      → selectPoolStyle()
                 = 'asset_fallback'                                  → selectAssetFallback()
                 = 'hybrid'                                          → selectHybrid()
                 = 'quote_region'                                    → selectQuoteRegion()  [selection only]
                 = 'broadcast_hold'                                  → selectBroadcastHold() [selection only]
dispatch_pattern IS NULL (beauty/chef/roses/media/security/massage/
   spa/club/corporate/art-gallery/custom-experience/art-commission)  → selectLegacyScored() (extracted intact)
```

`selectLegacyScored()` is the **current 287-line logic verbatim** — public-site partner query, scoring, top-5, SMS broadcast — pulled into one function with zero behavioral change. Beauty regression test will hit this.

## 3. Per-branch logic

### pool_style (black-truck)
- Source: `tt_drivers` (active, status='approved').
- Filter: `vehicle_classes && [class]` (class derived from routing/booking — for black-truck, partner_types `chauffeur/sedan/suv`).
- Filter: `styles_offered @> [booking.requested_style]` only when `requested_style IS NOT NULL`.
- Amenity filter: `requested_red_carpet=true` → `red_carpet=true`; `requested_star_ceiling=true` → `star_ceiling=true`. NULL/false = no filter.
- Broadcast SMS to filtered set, first-confirm-wins. `dispatch_pattern='pool_style'`, no payment_leg flag.

### asset_fallback (exotic-cars, party-bus, yachts)
- If `booking.vehicle_id IS NOT NULL`: resolve `tt_vehicles.owner_partner_id` → primary partner.
- Fallback list = other `tt_partners` with `partner_type IN routing.partner_types` AND `vehicle_id` in their inventory (`tt_partner_assets.vehicle_id` join), ordered:
  - exotic_supplier: `profit_margin DESC`
  - party_bus_operator / yacht_operator: `profit_margin DESC, rating DESC` *(flag: no `availability_score`/`next_available_at` column — recorded as parked)*
- Amenity filter for exotics same as pool_style.
- Store ordered list in `tt_dispatch_requests.matched_partners[0]=owner, [1..N]=fallback`.
- SMS owner first; partner-respond handler walks the fallback chain on decline/timeout.

### hybrid (sprinters)
- Probe: `SELECT 1 FROM tt_vehicles WHERE style=booking.requested_style AND owner_partner_id IS NOT NULL LIMIT 1`.
- Found → asset path (same selection as `asset_fallback`, partner_type=`sprinter_operator`).
- Not found → pool path (`tt_drivers` where `vehicle_classes && ['sprinter']` + style/amenity filters).

### quote_region (private-jet, coach-bus)  — selection only
- `tt_partners` where `partner_type IN routing.partner_types` AND `service_regions && [booking.pickup_state]`.
- Pickup state resolution: `booking.pickup_state` first; fallback regex on `pickup_location` if null (`/\b([A-Z]{2})\b/` final token).
- Insert `tt_dispatch_requests` with `status='awaiting_quote'`, `dispatch_pattern='quote_region'`, `payment_leg='pay_after_quote_not_built'`, `matched_partners`=list.
- **NO SMS, NO charge, RETURN EARLY.** cb-dispatch-engine handles the rest.

### broadcast_hold (helicopter, jetski, slingshot)  — selection only
- Same regional filter as quote_region.
- Broadcast SMS to regional set (`first-availability-wins` UX exists in partner-respond).
- Insert `tt_dispatch_requests` with `status='sent'`, `dispatch_pattern='broadcast_hold'`, `payment_leg='auth_hold_not_built'`.
- Booking cannot complete without the auth-hold leg — flagged.

## 4. Preserved untouched
- Manual / `_unrouted` queue
- `selectLegacyScored()` — every NULL-pattern service (beauty regression target)
- `cb-dispatch-engine` (not modified)
- `media-dispatch-*`, `tt-auto-dispatch`, `tt-partner-response`
- SMS gateway code (Twilio via connector-gateway)
- `tt_dispatch_requests` row shape — only adding 2 nullable columns

## 5. Migrations (run BEFORE deploy)

### Migration A — schema adds (additive, all nullable)
```sql
ALTER TABLE public.tt_bookings
  ADD COLUMN IF NOT EXISTS requested_style text,
  ADD COLUMN IF NOT EXISTS pickup_state    text;

ALTER TABLE public.tt_dispatch_requests
  ADD COLUMN IF NOT EXISTS dispatch_pattern text,
  ADD COLUMN IF NOT EXISTS payment_leg      text;

CREATE INDEX IF NOT EXISTS idx_tt_dispatch_requests_pattern
  ON public.tt_dispatch_requests(dispatch_pattern);
```

### Migration B — partner_type reconciliation (TEST seed only)
```sql
UPDATE public.tt_partners SET partner_type = 'exotic_supplier'
  WHERE partner_type = 'exotic_owner';
UPDATE public.tt_partners SET partner_type = 'sprinter_operator'
  WHERE partner_type = 'sprinter_op';
UPDATE public.tt_partners SET partner_type = 'aviation_broker'
  WHERE partner_type = 'jet_op';
UPDATE public.tt_partners SET partner_type = 'helicopter_operator'
  WHERE partner_type = 'heli_op';
-- chauffeur unchanged
```
Confirmed against `tt_service_routing.partner_types` — these are the canonical names. Without this update, every pattern branch returns 0 partners silently.

## 6. The diff — `supabase/functions/tt-smart-dispatch/index.ts`

Structurally: keep `serve()` shell, keep booking fetch + routing resolve + manual/unrouted block (lines 12–71) UNCHANGED. Replace lines 73–279 (legacy scoring + SMS) with a pattern dispatcher that calls one of 6 selector functions. The original 73–279 block is moved verbatim into `selectLegacyScored(supabase, publicClient, booking, routing)` and called for NULL pattern.

```diff
@@ after manual/unrouted early-return (line 71) @@
-
-    // Query partners: status = 'approved' AND is_active = true
-    // ... (lines 73–279 — current scoring + SMS body) ...
+
+    // ====== PATTERN DISPATCHER ======
+    const pattern = routing.dispatch_pattern as string | null
+    const ctx = { supabase, publicClient, booking, routing, corsHeaders }
+
+    switch (pattern) {
+      case 'pool_style':      return await selectPoolStyle(ctx)
+      case 'asset_fallback':  return await selectAssetFallback(ctx)
+      case 'hybrid':          return await selectHybrid(ctx)
+      case 'quote_region':    return await selectQuoteRegion(ctx)     // selection only
+      case 'broadcast_hold':  return await selectBroadcastHold(ctx)   // selection only
+      default:                return await selectLegacyScored(ctx)    // NULL pattern: unchanged
+    }
+  } catch (err) { /* unchanged */ }
+})
+
+// ===================== SELECTORS =====================
+
+async function selectLegacyScored(ctx) {
+  // ** verbatim copy of current lines 73–279 ** — public partner query,
+  // candidates build, scoring loop, top-5 dispatch insert, SMS broadcast,
+  // tt_bookings.status='dispatched' update, success response.
+}
+
+async function selectPoolStyle(ctx) {
+  const { supabase, booking, routing } = ctx
+  const classes = routing.partner_types       // e.g. ['chauffeur','sedan','suv']
+  let q = supabase.from('tt_drivers')
+    .select('id, partner_id, driver_name, phone, vehicle_classes, styles_offered, red_carpet, star_ceiling, rating')
+    .eq('status','approved').eq('is_active', true)
+    .overlaps('vehicle_classes', classes)
+  if (booking.requested_style)        q = q.contains('styles_offered', [booking.requested_style])
+  if (booking.requested_red_carpet)   q = q.eq('red_carpet', true)
+  if (booking.requested_star_ceiling) q = q.eq('star_ceiling', true)
+  const { data: drivers } = await q
+  return await insertDispatchAndBroadcast(ctx, drivers || [], {
+    dispatch_pattern: 'pool_style', payment_leg: null, status: 'sent',
+  })
+}
+
+async function selectAssetFallback(ctx) {
+  const { supabase, booking, routing } = ctx
+  let primary = null
+  if (booking.vehicle_id) {
+    const { data: v } = await supabase.from('tt_vehicles')
+      .select('owner_partner_id').eq('id', booking.vehicle_id).maybeSingle()
+    if (v?.owner_partner_id) {
+      const { data: op } = await supabase.from('tt_partners')
+        .select('*').eq('id', v.owner_partner_id).maybeSingle()
+      primary = op
+    }
+  }
+  const orderCol = routing.partner_types.includes('exotic_supplier') ? 'profit_margin' : 'profit_margin'
+  const { data: pool } = await supabase.from('tt_partners')
+    .select('*').in('partner_type', routing.partner_types)
+    .eq('status','approved').eq('is_active', true)
+    .order(orderCol, { ascending: false })
+  const fallback = (pool || []).filter(p => p.id !== primary?.id)
+  const ordered = [primary, ...fallback].filter(Boolean)
+  // amenity filter (exotic only)
+  const filtered = routing.partner_types.includes('exotic_supplier')
+    ? ordered.filter(p => (!booking.requested_red_carpet   || p.red_carpet)
+                       && (!booking.requested_star_ceiling || p.star_ceiling))
+    : ordered
+  return await insertDispatchAndBroadcast(ctx, filtered, {
+    dispatch_pattern: 'asset_fallback', payment_leg: null, status: 'sent',
+  })
+}
+
+async function selectHybrid(ctx) {
+  const { supabase, booking } = ctx
+  let hasAsset = false
+  if (booking.requested_style) {
+    const { data } = await supabase.from('tt_vehicles')
+      .select('id').eq('style', booking.requested_style)
+      .not('owner_partner_id','is', null).limit(1)
+    hasAsset = (data || []).length > 0
+  }
+  return hasAsset ? await selectAssetFallback(ctx) : await selectPoolStyle(ctx)
+}
+
+async function selectQuoteRegion(ctx) {
+  const { supabase, booking, routing } = ctx
+  const state = resolvePickupState(booking)
+  const { data: regional } = await supabase.from('tt_partners')
+    .select('*').in('partner_type', routing.partner_types)
+    .eq('status','approved').eq('is_active', true)
+    .overlaps('service_regions', state ? [state] : [])
+  const list = regional || []
+  const { data: dr } = await supabase.from('tt_dispatch_requests').insert({
+    booking_id: booking.id, booking_reference: booking.booking_reference,
+    service_type: booking.service_type, service_category: routing.service_category,
+    pickup_location: booking.pickup_location, status: 'awaiting_quote',
+    dispatch_pattern: 'quote_region', payment_leg: 'pay_after_quote_not_built',
+    matched_partners: list, auto_matched: true,
+  }).select().single()
+  // NO SMS — cb-dispatch-engine handles quote flow
+  return jsonOk(ctx, { matched: list.length, dispatch_request_id: dr?.id,
+    pattern: 'quote_region', engine: 'cb-dispatch-engine',
+    payment_leg: 'pay_after_quote_not_built' })
+}
+
+async function selectBroadcastHold(ctx) {
+  const { supabase, booking, routing } = ctx
+  const state = resolvePickupState(booking)
+  const { data: regional } = await supabase.from('tt_partners')
+    .select('*').in('partner_type', routing.partner_types)
+    .eq('status','approved').eq('is_active', true)
+    .overlaps('service_regions', state ? [state] : [])
+  return await insertDispatchAndBroadcast(ctx, regional || [], {
+    dispatch_pattern: 'broadcast_hold',
+    payment_leg: 'auth_hold_not_built', status: 'sent',
+  })
+}
+
+function resolvePickupState(b) {
+  if (b.pickup_state) return b.pickup_state.toUpperCase()
+  const m = (b.pickup_location || '').match(/\b([A-Z]{2})\b(?!.*\b[A-Z]{2}\b)/)
+  return m ? m[1] : null
+}
+
+// shared insert + SMS — extracted from current SMS loop, parameterized
+async function insertDispatchAndBroadcast(ctx, list, meta) { /* … */ }
+function jsonOk(ctx, body) { /* … */ }
```

`insertDispatchAndBroadcast` reuses the existing SMS Twilio block verbatim, parameterized by `meta.dispatch_pattern` + `meta.payment_leg` written into the dispatch row. Phone resolution uses partner.phone / driver.phone.

## 7. Parked (explicitly out-of-scope, flagged in code)
- `pay_after_quote_not_built` — quote_region payment leg
- `auth_hold_not_built` — broadcast_hold payment leg
- Party-bus / yacht availability ranking (`availability_score`, `next_available_at`) — using `profit_margin DESC` proxy
- `requested_style` derivation for vehicle_id-only bookings — pool bookings must send `requested_style` explicitly

## 8. Post-deploy test plan (real invocations, not SELECTs)

Create one synthetic booking per case via direct insert into `tt_bookings`, then `supabase.functions.invoke('tt-smart-dispatch', { booking_id })` and read back `tt_dispatch_requests`:

| # | Pattern | Input | Expected `matched_partners` |
|---|---------|-------|------------|
| 1 | pool_style | black-truck, no filters | A, B, C (3 drivers) |
| 2 | pool_style | + requested_red_carpet | A, B |
| 3 | pool_style | + requested_star_ceiling | A |
| 4 | pool_style | + requested_style=escalade | escalade driver only |
| 5 | asset_fallback | exotic owner unavailable | fallback ordered B(0.45) → A(0.30) |
| 6 | hybrid | sprinter style=luxury | asset branch |
| 7 | hybrid | sprinter style=passenger | pool branch |
| 8 | quote_region | private-jet pickup_state=NY | Jet_Ops_NY; status=awaiting_quote; no SMS |
| 9 | quote_region | private-jet pickup_state=FL | empty matched_partners; status=awaiting_quote |
| 10 | broadcast_hold | helicopter pickup_state=NY | Heli_NY; payment_leg='auth_hold_not_built' |
| 11 | **REGRESSION** | beauty (NULL pattern) | hits legacy scored path — top-5 SMS broadcast unchanged |

Report = real `tt_dispatch_requests` rows returned per invocation + pass/fail vs expected.

## 9. Deploy order
1. Run Migration A (schema adds).
2. Run Migration B (partner_type rename).
3. Write new `index.ts` (legacy logic preserved verbatim inside `selectLegacyScored`).
4. Deploy `tt-smart-dispatch`.
5. Run 11-row test matrix, report results.

**Awaiting approval before applying.**
