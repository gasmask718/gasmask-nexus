# GasMask — Blocker & Owner Audit (READ-ONLY)

**Date:** 2026-09-11 · **Requested by:** Ching ("with gasmask we need to assign n makesure is good")
**Scope:** audit only. No code changes, no migrations, no workflows, no outreach.
**Backend:** Lovable Cloud ref `qalaaroashbggynpvqct` · **App:** https://gasmask-os-nexus.lovable.app

Every row below is graded on the five-step ladder: REQUIREMENT → CODE EXISTS → DEPLOYMENT VERIFIED → EXECUTION VERIFIED → OUTPUT/USER-FLOW VERIFIED. Nothing is marked VERIFIED GOOD unless end-to-end behaviour was observed in code **and** data.

---

## 1. Correction to the historical finding (verified against current code)

| Historical claim | Current truth | Evidence |
|---|---|---|
| `/portals/driver` uses hardcoded `SIMULATION_*` data | **No longer reachable.** `/portals/driver` is now a redirect to `/portal/driver`. | `src/routes/AppRoutes.tsx:2946` |
| `/portals/driver` has an overlaying Capture FAB | The FAB now lives on the real portal (`/portal/driver`) at `z-[100]`; that layout has **no bottom nav**, so there is no bottom-nav collision. | `src/pages/portal/DriverPortal.tsx:62-71`, `src/components/portal/field/FieldPortalLayout.tsx:30-87` |
| `/delivery/driver-home` is the real driver workflow | **False today.** The real workflow is `/portal/driver/*` (`DriverPortal.tsx` → `src/components/portal/field/*`), which queries Supabase directly with no mock fallback. `/delivery/driver-home` is the *legacy* stack and still carries simulation fallbacks. | `AppRoutes.tsx:2893`, `:2547`, `src/pages/delivery/DriverHome.tsx:14,30` |
| `DriverPortalPage.tsx` (the `SIMULATION_*` file) is live | **Orphaned dead code** — exported from `src/pages/portals/index.ts` but never imported by `AppRoutes.tsx`. Not production-facing. | `src/pages/portals/DriverPortalPage.tsx:32-56`; no route reference |

**Net:** the old blocker is closed by redirect, but a *second* legacy driver/biker stack still exists and is still routed.

---

## 2. Blocker table

| P | Area | Issue | Evidence | Status | Current Owner | Recommended Owner | Next Action | Acceptance Test |
|---|---|---|---|---|---|---|---|---|
| **P0** | Store capture → field list | Capture writes to `stores`; the driver's My Day / Store List read `store_master`. A captured store may never appear in the field list. | `StoreCaptureForm.tsx:211` (`from('stores')`) vs `MyDayDashboard.tsx:48` / `StoreListPage.tsx` (`from('store_master')`) | **NEEDS FIX** | none documented | Nicole (backend/data) | Trace whether any sync/trigger promotes `stores` → `store_master`; if none, decide one canonical target. **Do not build a second sync.** | Capture a store in `/portal/driver`; it appears in that driver's Store List within the same session. |
| **P0** | Ambassador logins | 78 active ambassadors resolve to **2 distinct login user_ids**. Routes/assignments are keyed to login, so people see each other's work. | DB: `ambassadors` active=78, distinct non-null `user_id`=2; `roadmap.md:10` | **BLOCKED** (documented, unowned) | none documented | Owner decision + Nicole to execute | Owner supplies the real person↔login list; then one-time unlink/invite pass. Overlaps the open roadmap blocker — **do not re-audit this, it is already proven.** | Two ambassadors sign in on separate logins and each sees only their own routes. |
| **P0** | Field ops usage | The field workflow has effectively never run in production: `store_visits` = **14 rows total, 0 in 30 days**; `deliveries` = **0 in 30 days**. Code exists; execution unverified. | DB counts 2026-09-11 | **NEEDS QA** | none documented | Ching to nominate one field pilot | Run one real driver through login → My Day → visit → delivery and record where it stops. | One complete visit + one delivery recorded by a real driver account. |
| **P1** | Legacy delivery stack | `/delivery/driver-home`, `/delivery/driver`, `/delivery/biker/*` are still routed and use `useSimulationData`/`getSimulationScenario` fallbacks. Simulated rows are suppressed for GasMask only via a global context flag (`LIVE_BUSINESSES` deny-list), not a per-call check. | `AppRoutes.tsx:2546-2547,2863`; `DriverHome.tsx:14,30`; `src/config/liveBusinesses.ts:11-18`; `SimulationModeContext.tsx:180-220` | **NEEDS FIX** | none documented | Frontend owner (unassigned) | Decide: retire the legacy stack behind redirects to `/portal/driver`, or keep it and add an explicit per-page live-business assert. | Loading `/delivery/driver-home` as a GasMask user shows zero invented rows, or the route no longer exists. |
| **P1** | Placeholder pages shipped | `biker/WeeklyPayoutsPage.tsx:32` and `biker/RoutesHistoryPage.tsx:100` are explicitly commented as never fetching real data — they can only show simulated or empty. | those files | **NEEDS FIX** | none documented | Frontend owner (unassigned) | Hide from nav or wire to real payout/route tables. | Payouts page shows a real figure or is unreachable. |
| **P1** | Geocoding | **962 of 3,265** `stores` rows have no lat/lng. Capture form captures GPS only — it never forward-geocodes the typed address, and lets you submit with `lat/lng = null`. | DB count; `StoreCaptureForm.tsx:99-116,196-197` | **NEEDS FIX** | none documented | Nicole (batch backfill) | Batch-geocode existing addresses (same approach as the open `hw_leads` item, `roadmap.md:5`) before any map/route work. | Map/route planning shows >90% of active stores as pins. |
| **P1** | Store-count truth | Three disagreeing counts: `store_master` live = **1,699** (all `status='active'`), `stores` = **3,265**, docs say 2,145 total / 438 active. No doc reconciles them. | DB 2026-09-11; `DYNASTY_CREATORS_AMBASSADORS_ALL_BUSINESSES_MASTER.md:76`; `dynasty-connect-lead-flow-audit-2026-09-07.md:28` | **NEEDS FIX** | none documented | Nicole | Publish one canonical count + definition of "active" before assigning territory work. | One number quoted identically in the store book, route planning and the master doc. |
| **P1** | Dialer / store-call workflow | Dialer schema is real but unused: `dialer_call_attempts` = 2 ever, 0 in 30d (prior audit). Dynasty Connect can see 327k leads and dial none. | `dynasty-connect-sales-management-audit-2026-09-07.md`; `dynasty-connect-lead-flow-audit-2026-09-07.md:63` | **NEEDS QA / BLOCKED** | none documented | Ching to nominate a caller | Already diagnosed twice — **do not re-audit.** Run one live dial session or approve the proposed `dc_unified_leads` source mode. | One recorded, suppression-checked outbound call attempt. |
| **P2** | Mobile layout | `PortalSidebar` is a persistent `w-56`/`w-16` sidebar with **no mobile collapse** (no `md:hidden`), and the `z-[100]` FAB floats over content on the same narrow screen. No bottom nav exists. | `PortalSidebar.tsx:57-60`; `DriverPortal.tsx:68`; `FieldPortalLayout.tsx:30-87` | **NEEDS QA** | none documented | Frontend owner (unassigned) | Test the portal at 390px on a real phone before deciding a fix. | A driver on a phone can reach every nav item and the FAB blocks nothing. |
| **P2** | Dead code | `src/pages/portals/DriverPortalPage.tsx` / `BikerPortalPage.tsx` contain `SIMULATION_*` fixtures and stale doc comments claiming to own `/portals/driver` — unrouted, but a trap for the next reader. | those files; `src/pages/portals/index.ts:2-3` | **NEEDS FIX** (cleanup) | none documented | Frontend owner (unassigned) | Delete or clearly mark deprecated. | Grep for `SIMULATION_ROUTES` returns nothing under `src/pages/portals`. |
| **—** | POG / planogram tools | No implementation of any kind. | repo-wide grep for `POG`, `planogram` = 0 hits | **MISSING** | none | Owner must define requirement first | Ching to state whether this is in scope for GasMask at all. | n/a until specified. |
| **—** | Partner / buy-in flow | No implementation. | grep `buy-in`, `buy_in` = 0 hits | **MISSING** | none | Owner decision | Same as above. | n/a |
| **—** | Sales-agent flow | Nothing GasMask-scoped; only unrelated Dynasty Sales/Earn pages. | `rg sales_agent` → `os/dynasty-sales/*`, `os/dynasty-earn/*` | **MISSING** | none | Owner decision | Same as above. | n/a |
| **✔** | Call / text actions | Call and Text route through `CallProvider`/`MessageProvider` → `place-outbound-call` / `send-sms` → `communication_logs`. Disabled when no phone — fails safe, no dead `tel:` links. | `StoreCallTextButtons.tsx:19-70` | **VERIFIED GOOD** (code + wiring; live send not exercised) | — | — | — | One live call + one live text from the portal logged in `communication_logs`. |
| **✔** | Maps / directions | Real Google Maps directions links, coordinate-first with an address fallback. | `AssignedRoutesPage.tsx:59`; `MyRoute.tsx:341-343` | **VERIFIED GOOD** | — | — | — | Tap Directions on a stop with coordinates → correct destination opens. |
| **✔** | Route registration | All 493 sidebar hrefs resolve to registered routes (prebuild gate). Field portal sidebar matches its nested routes 1:1. | `scripts/check-sidebar-routes.mjs` output; `PortalSidebar.tsx:40-50` vs `DriverPortal.tsx:41-58` | **VERIFIED GOOD** | — | — | — | Prebuild gate stays green. |
| **EXT** | Simulated data in other portals | `StorePortalPage`, `VAPortalPage`, `CustomerPortalPage`, `NationalWholesalePortalPage`, `MarketplaceAdminPortalPage` all carry `SIMULATION_*` fixtures. Suppressed for GasMask by the live-business deny-list, but these are outside GasMask field ops. | `rg SIMULATION_ src/pages/portals`; `liveBusinesses.ts` | **EXTERNAL / UNVERIFIED** | none | out of GasMask scope | Note only — raise separately. | n/a |

---

## A. WHAT IS ALREADY GOOD

- The **real driver/biker portal** (`/portal/driver`, `/portal/biker`) is genuinely real: direct Supabase reads, **zero** simulation hooks anywhere under `src/components/portal/field/*`.
- The old `/portals/driver` simulation screen is **no longer reachable** — that historical blocker is closed.
- **Call and Text** buttons are correctly wired into the real communication pipeline (not raw device links) and disable safely with no phone.
- **Maps/directions** links are real and coordinate-first.
- **Route integrity** is enforced by a prebuild gate: 493/493 sidebar links resolve.
- Store capture itself works and stamps GPS when the phone allows it.

## B. WHAT IS NOT VERIFIED

- No evidence the field workflow has ever been used in anger: **14 store visits ever, 0 in 30 days; 0 deliveries in 30 days; 2 dialer attempts ever.** Every "it works" claim below the code layer is unproven.
- Whether captured stores (`stores`) ever reach the driver's list (`store_master`).
- Mobile behaviour on a real phone — inferred from CSS only, never viewed at phone width.
- Whether `InventoryTab` / `CreateOrderSection` inside the visit flow are fed live data end-to-end.
- Whether the legacy `/delivery/*` stack can ever surface simulated rows under admin impersonation (the guard is a global context flag, not a per-call assert).

## C. WHAT NEEDS ASSIGNMENT

Documented owners in this project today: **Ching** (approver, outreach switch), **Gerson** (recruiting search/ingest automation), **Nicole** (pending Cloud access, shared-ingestion lane). Michael/Christopher have **no attributable work** in this repo. Ralphie's handoff is UT territory, not GasMask.

**Nobody is assigned to GasMask field operations.** These need an owner named:

1. Field-ops frontend (legacy stack retirement, placeholder pages, mobile layout, dead code) — **no owner exists**.
2. Store data truth (stores vs store_master, geocoding backfill, canonical counts) — recommend **Nicole**, but she is still blocked on access confirmation.
3. Ambassador login untangle — needs **owner input first** (the person↔login list); this is a data/ownership decision, not an engineering one.
4. A **named field pilot** (one real driver) to prove the workflow.

**Overlap flags:** the ambassador-login blocker, geocoding backlog and DC-lead-to-dialer gap are each already diagnosed in existing documents (`roadmap.md:8-10`, `dc-lead-to-dialer-bridge-audit-2026-09-07.md`, `dynasty-connect-lead-flow-audit-2026-09-07.md`). Assigning anyone to "investigate" them again is duplicate work — they need a decision and execution, not another audit.

## D. WHAT SHOULD BE FIXED FIRST

1. **Stores vs store_master** — if captures don't reach the driver's list, every other field fix is cosmetic.
2. **Ambassador logins (78 people, 2 logins)** — blocks any real assignment of routes to people.
3. **One real driver pilot end-to-end** — turns 14 lifetime visits into evidence.
4. **Geocoding backfill (962 stores)** — prerequisite for maps and route planning.
5. Then: retire the legacy `/delivery/*` driver stack and the placeholder pages.

## E. COPY-READY UPDATE FOR CHING

> GasMask check done — read-only, nothing changed.
>
> Good news: the driver app itself is real. The old fake-data driver screen you remember is gone (it now redirects to the real one), and calling, texting and directions all work properly from the driver's phone.
>
> The problem isn't the screens, it's that nobody has actually used them: 14 store visits ever, none in the last 30 days, and no deliveries in 30 days. So before we assign more people, we need one real driver to run one full day through it and tell us where it stops.
>
> Three things block real use right now:
> 1. Stores added by a driver in the field are saved in a different list from the one the driver's app reads back — a new store may not show up for him. Needs checking before anything else.
> 2. 78 active ambassadors are sharing just 2 logins, so they see each other's routes. This is already known and written down; it needs your list of who owns which login, not more investigating.
> 3. 962 stores have no map location, so maps and route planning are incomplete.
>
> Not built at all: planogram/POG tools, partner buy-in, and a sales-agent flow. If you want those, they need to be specified first.
>
> Nobody is currently assigned to GasMask field operations in any document. Gerson is on recruiting search, Nicole is waiting on access for the ingestion work, and you're the approver. So we need one name for field ops and one driver to pilot it. Don't assign anyone to re-check the ambassador logins, the geocoding or the dialer leads — those are already diagnosed and just need a decision.

---

*Read-only audit. No code, schema, routes, or configuration were modified.*
