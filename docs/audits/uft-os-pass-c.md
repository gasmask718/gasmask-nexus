# UFT OS-Side Audit — Pass C: Bridge + Compile

**Date:** 2026-06-04 · **Gate:** 1 (Hub Truth) · **Scope:** 16 UFT pages in project `e9aba3c3`

---

## 1. Bridge Reality (the exact fix)

**File:** `src/services/uftApi.ts`

### Bugs (confirmed in Pass A, re-verified Pass C)

```ts
// Bug 1 — points at the SAME project (Dynasty OS), not the UFT platform
const UFT_API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qalaaroashbggynpvqct'}.supabase.co/functions/v1`;

// Bug 2 — no Authorization header sent; platform functions reject as 401
const uftHeaders = { 'Content-Type': 'application/json' };
```

Net effect: every `getUFTPlatformMetrics` / `getUFTVendorSummary` / `getUFTAmbassadorLeaderboard` call either hits the wrong project (404 on missing fn) or is silently swallowed by callers — UI falls back to `0` / "Offline" / hardcoded constants.

### Required fix (one-file change + one secret)

```ts
// Hard-pin the UFT platform project ref. Do NOT reuse VITE_SUPABASE_PROJECT_ID.
const UFT_PROJECT_REF = 'pxylmrmwqmxotqffejbe';
const UFT_API_BASE    = `https://${UFT_PROJECT_REF}.supabase.co/functions/v1`;

// Read a bearer issued by the UFT platform (anon or service-scoped, per fn JWT setting).
// Stored as Vite-exposed env in this project's .env (publishable).
const UFT_ANON_KEY = import.meta.env.VITE_UFT_ANON_KEY as string;

const uftHeaders = {
  'Content-Type': 'application/json',
  apikey: UFT_ANON_KEY,
  Authorization: `Bearer ${UFT_ANON_KEY}`,
};
```

Action items for David:
1. Get UFT platform anon key from project `pxylmrmwqmxotqffejbe` → add as **`VITE_UFT_ANON_KEY`** in this project's env (publishable, safe to expose).
2. Confirm UFT functions `ut-get-platform-metrics`, `ut-get-vendor-summary`, `ut-get-ambassador-leaderboard` exist + return JSON shape matching `UFTPlatformMetrics` / `UFTVendorSummary` / `UFTAmbassador` interfaces.
3. Add a Pass-D smoke test: `fetch(UFT_API_BASE + '/ut-get-platform-metrics')` returns 200 with non-zero `total_vendors`.

---

## 2. Drift Check — OS-local vs Platform

| Metric | OS-local (`ut_*`) | Platform (bridge) | Canonical | Action |
|---|---|---|---|---|
| Vendor count | 0 (no vendors table populated) | live | **Platform** | Bridge must work; nothing to reconcile |
| Revenue (event bookings) | 1 row in `ut_event_bookings` | live | **Platform** | OS-local is dev-seed; retire reads once bridge live |
| Revenue (kits) | `ut_kit_orders` = 0 | live | **Platform** | Same |
| Ambassador count / earnings | constants in `UFTAmbassadors.tsx` | live | **Platform** | Replace constants with bridge call |
| Launch checklist | localStorage only | n/a | **OS-local** (operator scratch) | Keep local OR move to `ut_launch_checklist` table |
| Territory leads | `ut_partner_leads` 2,756 ✅ | n/a (operator-only) | **OS-local** | Keep |
| Territory heatmap | `ut_get_territory_heatmap` 1,169 ✅ | n/a | **OS-local** | Keep |

**Ruling:** There is **no two-truths problem today** — OS-local revenue/vendor tables are empty or constants. Platform is the only real revenue/vendor source. Once the bridge works, OS-local revenue tables become deprecated reads (or get repurposed for OS-only ops metrics).

---

## 3. Scoreboard — 16 UFT Pages

### Per-page honesty matrix

| # | Route | Page | Honesty | Verdict | Gaps |
|---|---|---|---|---|---|
| 1 | `/os/unforgettable` | UT Penthouse | 30% | needs_work | wrapper KPIs hardcoded |
| 2 | `/os/unforgettable/intelligence` | UT Intel Command | **100%** | ready | — |
| 3 | `/os/unforgettable/outreach` | UT Outreach | **90%** | ready | `ut_outreach_logs` not written |
| 4 | `/os/unforgettable/onboarding` | UT Onboarding | 0% | stub | zero supabase calls |
| 5 | `/os/unforgettable/marketplace` | UT Marketplace Ctrl | 10% | stub | wrapper only |
| 6 | `/os/unforgettable/products` | UT Product Engine | 50% | needs_work | reads ok, writes thin |
| 7 | `/os/unforgettable/automation` | UT Automation | 10% | stub | no engine wired |
| 8 | `/os/unforgettable/analytics` | UT Analytics | 10% | stub | hardcoded constants |
| 9 | `/os/unforgettable/pricing-intelligence` | UT Pricing Intel | **100%** | ready | scorer fires |
| 10 | `/os/unforgettable/event-spaces` | UT Event Spaces | 60% | needs_work | CRUD ok, no platform sync |
| 11 | `/os/unforgettable/virtual-tours` | UT Virtual Tours | 60% | needs_work | CRUD ok, no platform sync |
| 12 | `/uft/dashboard` | UFT Dashboard | 10% | needs_work | broken bridge |
| 13 | `/uft/revenue` | UFT Revenue | 10% | needs_work | broken bridge + constants |
| 14 | `/uft/vendors` | UFT Vendors | 0% | stub | `DEMO_VENDORS` only |
| 15 | `/uft/ambassadors` | UFT Ambassadors | 0% | stub | fake broadcast button |
| 16 | `/uft/launch` | UFT Launch | 0% | stub | localStorage static checklist |

**OS-side honesty average: ~33%** (530 / 16). 3 ready · 5 needs_work · 8 stub.

### GATE 1 verdict: ❌ **NOT CERTIFIED**

Punch list to certification (in order):
1. **Fix bridge** (`uftApi.ts` 2-line change + `VITE_UFT_ANON_KEY`) → unlocks pages 12, 13, 14, 15
2. **Kill `DEMO_VENDORS`** in `UFTVendors.tsx` → wire `getUFTVendorSummary` list endpoint
3. **Wire ambassador broadcast** in `UFTAmbassadors.tsx` → real `supabase.functions.invoke('ut-broadcast-ambassadors')`
4. **Replace hardcoded `UFTRevenue` constants** → bridge `getUFTPlatformMetrics`
5. **Write `ut_outreach_logs`** on every send in `UTOutreachCommand` (logging gap from Pass B)
6. **Decide event-spaces/virtual-tours platform sync** (build sync edge fn OR mark OS-only)
7. **Kill or build Onboarding / Marketplace Ctrl / Automation / Analytics** stubs

### Kill / Fix / Build ledger for David

| Action | Pages | Effort |
|---|---|---|
| **FIX** | uftApi.ts bridge, UFTVendors, UFTAmbassadors, UFTRevenue, UFTDashboard, UTOutreach logging | S–M (1 day) |
| **BUILD** | platform-sync for event-spaces + virtual-tours, ut_launch_checklist table | M (2–3 days) |
| **KILL or BUILD (decision)** | UnforgettableOnboarding, UTMarketplaceControl, UTAutomation, UTAnalytics, UTPenthouse wrapper KPIs | needs product call |

---

## 4. Pass C Cleanup — Done

- ✅ `event_spaces` row `PASS_B_AUDIT_SPACE` deleted
- ✅ `virtual_tour_requests` row `PASS_B_AUDIT_VENUE` deleted
- ✅ All 16 UFT pages upserted into `floor_directory` with Pass A–B verdicts (visible at `/os-directory`)
- 🚩 **Logged as fix item:** `ut_outreach_logs` currently never written on send-path; add insert in `sendSmsTemplate` / outreach edge fn

---

## 5. Next Pass

Ready for **Pass D — Bridge Repair Sprint** on your signal: fix `uftApi.ts`, add `VITE_UFT_ANON_KEY`, kill `DEMO_VENDORS`, wire ambassador broadcast, write `ut_outreach_logs`. ETA: one focused build cycle.
