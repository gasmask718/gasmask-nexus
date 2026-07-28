# MASTER AUDIT #2 — UNFORGETTABLE TIMES: OS HUB (Operator / Management Console)

**Scope:** The operator hub only (`/os/unforgettable/*` + `/uft/*`). Public site excluded except at the seam.
**Method:** Read-only. Route table, page source, Supabase table row counts (`pg_stat_user_tables`), RLS policy counts, edge-function inventory.
**Date of audit run:** current session.
**Project:** Lovable `e9aba3c3` / backend `qalaaroashbggynpvqct`.

Every claim below is grounded in a file path, a route entry, a table name, or a row count. Anything I could not find is labeled **NOT FOUND**. Inferences are labeled **[INFERENCE]**.

---

## SECTION 1 — WHAT THE HUB DOES TODAY (end-to-end walk)

Plain language: **this is two half-built consoles stacked on top of each other, and the thing it is supposed to do — run an event from booking to payout — is the part that does not exist.**

What an operator actually gets today:

1. **Landing (`/os/unforgettable` → `UTPenthouse.tsx`)** — a "Penthouse Command Center" showing Total Leads 2,847 / Contacted 1,204 / Interested 387 / Onboarded 94 / Active Listings 72 / Conversion 3.3%, plus a funnel and an alerts feed. **Every one of those numbers is a hardcoded literal** (`UTPenthouse.tsx` L15–46, zero `supabase` references in the file). The real DB says 2,757 partner leads, 1 called, 0 onboarded partners, 0 listings. This is mock presented as real on the first screen an operator sees.
2. **Acquisition side (genuinely the strongest part)** — Places lead finder, territory jobs, lead intelligence, outreach engine, AI calling and negotiation agents. `ut_partner_leads` holds **2,757 real rows**, `ut_territory_jobs` **465 rows**. This half works.
3. **Marketplace side (the actual business)** — venues, vendors, rentals, catalog, bookings, staffing, dispatch, payouts. `ut_partners` = 0, `ut_listings` = 0, `ut_vendors` = 0, `ut_products` = 0, `ut_bookings` = 0, `ut_payments` = 0, `ut_staff_assignments` = 0, `ut_vendor_payments` = 0. The only live bookings are **3 rows in `ut_event_bookings`** (2 `pending_payment`, 1 `deposit_received`).
4. **Staff/scheduling/payroll suite (28 pages, ~9,700 lines)** — `UnforgettableScheduling`, `UnforgettableAvailability`, `UnforgettablePayroll`, `UnforgettablePerformance`, `UnforgettableDocuments`, `UnforgettableCommunications`, `UnforgettableCustomerService`, `UnforgettableMedia`, `UnforgettableAICalling`, `UnforgettableDashboard`, all `Unforgettable*` detail pages. **Zero `supabase` references across the entire group** — they generate their data in-file (`UnforgettableScheduling.tsx` L14–64: hardcoded `eventTypes`, `venues = ['Grand Ballroom', …]`, `clients = ['Johnson Family', …]`, `names = ['Marcus Johnson', 'Sofia Rodriguez', …]`). This is a fully clickable fake HR/ops console.

**Can an operator run received → staffed → dispatched → completed → paid?**
No. Received → confirmed → completed is real (button-driven status updates on `ut_event_bookings`). **Staffed and dispatched do not exist anywhere in the hub** — there is no UI that reads or writes `ut_staff_assignments` or `ut_event_staff` (grep across `src/pages/os/unforgettable` and `src/pages/uft` returns only `UFTRevenue.tsx` and `UTOutreachCommand.tsx`, both incidental word matches, not staffing logic). **Paid** is a status label, not a settlement.

**Verdict: a real acquisition console bolted to a shell marketplace console, with a mock HR console in between.**

---

## SECTION 2 — SIDEBAR / REACHABILITY

Source of truth checked: `src/components/Layout.tsx` (per project rule), not `osNavigation.ts`.

**`unforgettableHub` group — Layout.tsx L439–455 — 11 links:**

| Sidebar label | Path | Route exists? |
|---|---|---|
| 🎉 Penthouse — Command Center | `/os/unforgettable` | ✅ `UTPenthouse` |
| 🎯 Floor 1 — Lead Intelligence | `/os/unforgettable/intelligence` | ✅ `UTIntelligenceCommandCenter` |
| 📞 Floor 2 — Outreach Command | `/os/unforgettable/outreach` | ✅ `UTOutreachCommand` |
| 📋 Floor 3 — Partner Onboarding | `/os/unforgettable/onboarding` | ✅ `UnforgettableOnboarding` |
| 🏪 Floor 4 — Marketplace Control | `/os/unforgettable/marketplace` | ✅ `UTMarketplaceControl` |
| 📦 Floor 5 — Product Engine | `/os/unforgettable/products` | ✅ `UTProductEngine` |
| 🤖 Floor 6 — AI & Automation | `/os/unforgettable/automation` | ✅ `UTAutomation` |
| 📊 Floor 7 — Analytics | `/os/unforgettable/analytics` | ✅ `UTAnalytics` |
| 💰 Floor 8 — Pricing Intelligence | `/os/unforgettable/pricing-intelligence` | ✅ `PricingIntelligence` |
| 🏛️ Floor 9 — Event Spaces | `/os/unforgettable/event-spaces` | ✅ `UTEventSpaces` |
| 📸 Floor 10 — Virtual Tours | `/os/unforgettable/virtual-tours` | ✅ `UTVirtualTours` |

**`uftPlatform` group — Layout.tsx L456–471 — 10 links**, all routed (`AppRoutes.tsx` L3867–3878): `/uft/dashboard`, `/revenue`, `/vendors`, `/ambassadors`, `/verification`, `/payouts`, `/suppliers`, `/recruiting`, `/ambassador-recruiting`, `/launch`.

### THE HEADLINE REACHABILITY FINDING

`AppRoutes.tsx` registers **~95 routes** under `/os/unforgettable`. The Layout sidebar exposes **11**. There is a *second* in-page nav (`UTHubLayout.tsx` L40 `utNavSections`) that surfaces more, but the following operator-critical pages are **NOT in Layout.tsx's sidebar** and are reachable only by typing the URL or via the secondary hub nav:

`event-bookings` (the booking queue!), `venues`, `staff-management`, `ambassadors`, `payout-manager`, `vendor-payments`, `revenue-dashboard`, `platform-stats`, `event-calendar`, `partners`, `suppliers`, `leads`, `places`, `territory`, `business-requests`, `business-quotes`, `kit-orders`, `consultations`, `quiz-results`, `ambassador-leaderboard`, `ambassador-finder`, `growth-engine`, `pricing-engine`, `customer-acquisition`, `daily-summary`, `shop-dashboard`, plus ~50 supplier/negotiation/shipping pages.

**The single most important operator page in the hub — the bookings queue — is not in the OS sidebar.**

**Dead sidebar redirects** (`AppRoutes.tsx` L3975–3979): the legacy module routes `halls`, `vendors`, `rentals`, `party-bags`, `ai-builder` all `<Navigate>` to `/venues` or `/staff-management`. So "Vendors" → staff page, "Rentals" → venues page, "Party Bags" → venues page, "AI Party Builder" → venues page. Four labels lie about their destination.

**Orphaned registration:** `src/modules/unforgettable/index.ts` declares its own 23-item `sidebarItems` and 23 routes, several pointing components at `UnforgettableDashboard` as a stub. This module registry is **superseded by `AppRoutes.tsx`** and is dead configuration drift.

---

## SECTION 3 — FULL PAGE INVENTORY

101 `.tsx` files in `src/pages/os/unforgettable/` + 10 in `src/pages/uft/`. Grouped by function. "Backend" = file contains real `supabase` client calls.

### 3A. Core marketplace operations (the business)

| Page | Purpose | Reachable | Status | Backend |
|---|---|---|---|---|
| `UTEventBookings.tsx` | Booking queue + lifecycle buttons | URL/hub-nav only | **PARTIAL** | ✅ `ut_event_bookings` (3 rows) |
| `UTEventCalendar.tsx` | Calendar view of events | URL only | PARTIAL | ✅ (2 refs) |
| `UTVenuesManagement.tsx` | Venue approve/manage | URL only | **PARTIAL** | ✅ `event_halls` (4 rows) |
| `UTStaffManagement.tsx` | Staff approve/manage | URL only | **PARTIAL** | ✅ `staff_members_ut` (5 rows) |
| `UTMarketplaceControl.tsx` | "Floor 4" listings gate | ✅ sidebar | **UI-ONLY** | ❌ 0 refs — 3 static cards, 45 lines, no data |
| `UTEventSpaces.tsx` | Floor 9 event spaces | ✅ sidebar | **UI-ONLY** | ❌ 0 refs (326 lines) |
| `UTVirtualTours.tsx` | Floor 10 tours | ✅ sidebar | WORKING | ✅ 68 refs (1,871 lines — most-wired page in hub) |
| `UTEventBuilder.tsx` | Build an event package | URL only | **UI-ONLY** | ❌ 0 refs (419 lines) |
| `UTProductEngine.tsx` | Floor 5 catalog | ✅ sidebar | **UI-ONLY** | ❌ 0 refs (382 lines) |
| `UTProductOrganizer.tsx` | Organize products | URL only | UI-ONLY | ❌ 0 refs |
| `UTShopDashboard.tsx` | Shop overview | URL only | UI-ONLY | ❌ 0 refs (43 lines) |

### 3B. Money

| Page | Purpose | Reachable | Status | Backend |
|---|---|---|---|---|
| `UTPayoutManager.tsx` | Vendor + ambassador payouts | URL only | **PARTIAL/BROKEN** | ✅ `ut_vendor_payments` (**0 rows**); ambassador tab is hardcoded `pendingAmbassador = 0` and a literal "No ambassador payouts pending" `<TableRow>` (L29, L57) — **the ambassador half is a hardcoded empty state, not a query** |
| `UTVendorPayments.tsx` | Vendor payment list | URL only | PARTIAL | ✅ (3 refs), 0 rows |
| `UTRevenueDashboard.tsx` | Revenue | URL only | PARTIAL | ✅ (3 refs), 82 lines |
| `UTPricingEngine.tsx` | Pricing rules | URL only | WORKING-ish | ✅ 11 refs; `ut_vendor_pricing` 8 rows |
| `PricingIntelligence.tsx` | Floor 8 | ✅ sidebar | PARTIAL | ✅ 3 refs |
| `UFTPayouts.tsx` | Payout requests | ✅ `/uft` sidebar | **EMPTY** | ❌ **17 lines total, 0 supabase** — stub |
| `UFTRevenue.tsx` | Platform revenue | ✅ sidebar | **UI-ONLY** | ❌ 0 supabase; `stats`/`externalCards` are literals (L43, L50) |

### 3C. Ambassadors

| Page | Purpose | Reachable | Status | Backend |
|---|---|---|---|---|
| `UTAmbassadorManagement.tsx` | Full ambassador console | URL only | **WORKING** | ✅ 23 refs — `unforgettable_ambassadors` (4), `ut_ambassador_referrals` (0), `ut_ambassador_payouts` (0), `ut_ambassador_insights` (1) + 5 edge functions |
| `UTAmbassadorLeaderboard.tsx` | Leaderboard | URL only | PARTIAL | ✅ 2 refs |
| `UTAmbassadorFinder.tsx` | Prospect ambassadors | URL only | WORKING | ✅ 9 refs; `ut_ambassador_prospects` **0 rows** |
| `UFTAmbassadors.tsx` | UFT-side ambassadors | ✅ sidebar | **UI-ONLY** | ❌ 0 supabase (176 lines) |
| `UFTAmbassadorRecruiting.tsx` | Recruiting pipeline | ✅ sidebar | WORKING | ✅ `ut_recruiting_leads` — **0 rows** |

### 3D. Acquisition / outreach (the real engine)

| Page | Status | Backend |
|---|---|---|
| `UTPlacesLeadFinder.tsx` | WORKING | ✅ 7 refs + `ut-places-search` fn |
| `UTLeadIntelligence.tsx` | WORKING | ✅ 9 refs |
| `UTOutreachEngine.tsx` | PARTIAL | ✅ 4 refs; `ut_outreach_logs` **0 rows** |
| `UTGrowthEngine.tsx` | WORKING | ✅ 16 refs |
| `UTAutomationRuns.tsx` | PARTIAL | ✅ 6 refs; `ut_automation_runs` **0 rows** |
| `UTOutreachCommand.tsx` (884 lines) | **UI-ONLY** | ❌ **0 supabase** — "Floor 2 Outreach Command", a sidebar headline feature, is not wired |
| `UTIntelligenceCommandCenter.tsx` (617 lines) | **UI-ONLY** | ❌ **0 supabase** — Floor 1, sidebar headline, not wired |
| `UTTerritoryControl.tsx` (540) / `UTTerritoryIntelligence.tsx` (243) | **UI-ONLY** | ❌ 0 supabase each (despite `ut_territory_jobs` having 465 real rows and a `useUTTerritoryJobs` hook existing) |
| `UTAutomation.tsx` (Floor 6, sidebar) | **UI-ONLY** | ❌ 0 supabase, 45 lines |
| `UTAnalytics.tsx` (Floor 7, sidebar) | **UI-ONLY** | ❌ 0 supabase, 45 lines |
| `UTIntelligence.tsx` | UI-ONLY | ❌ 0 supabase, 50 lines |
| `UTCategoryDomination.tsx` (316) | UI-ONLY | ❌ 0 supabase |
| `UTGrowthSimulator.tsx` (439) | UI-ONLY | ❌ 0 supabase |

### 3E. Supplier / procurement cluster (18 pages)

Mostly wired: `UTSupplierInbox` (14 refs), `UTSupplierDecisionEngine` (9), `UTSupplierInboxV2` (8), `UTSupplierCommandDashboard` (8), `UTRFQEngine` (6), `UTNegotiationAgent` (5), `UTShippingTracker` (5), `UTShippingQuotes` (5), `UTSupplierManager` (5), `UTAutoOutreach` (5), `UTAutoFinder` (6), `UTSupplierFinder` (3), `UTNegotiationDashboard` (2).
Not wired: `UTSupplierConsole.tsx` (200 lines, 0 refs), `UTGlobalSupplierControl.tsx` (554 lines, 0 refs).
**All of it queries tables with 0 rows** (`ut_suppliers`, `ut_supplier_quotes`, `ut_rfq_requests`, `ut_supplier_threads`, `ut_shipments` — all 0). Fully built plumbing, no water.

### 3F. Staff / HR / scheduling suite — **28 pages, ~9,700 lines, ZERO backend**

`UnforgettableDashboard` (454), `UnforgettableScheduling` (466), `UnforgettableSchedulingToday/Upcoming/Gaps` (547 combined), `UnforgettableAvailability` (310), `UnforgettablePayroll` (300) + `PayrollDetail` (160), `UnforgettablePerformance` (315), `UnforgettableDocuments` (345) + `DocumentDetail` (204), `UnforgettableCommunications` (358), `UnforgettableCustomerService` (417), `UnforgettableMedia` (437) + `MediaDetail` (259), `UnforgettableAICalling` (450) + `AICallDetail` (376), `UnforgettableOnboarding` (322 — **this is sidebar "Floor 3 — Partner Onboarding"**), `UnforgettableStaffProfile/Edit/New/Notes/Call/Email/Venues/Performance/Categories` (~3,000).

Every one: `grep -c supabase` = **0**. Status: **UI-ONLY (mock-as-real)**.

Partial exception: `UnforgettableStaff.tsx` (the list page) has 0 direct supabase refs but imports `useStaffList`/`useStaffCategories` from `src/hooks/useUnforgettableStaff.ts`, which **is** real (`ut_staff`, `ut_staff_categories`). So the staff *list* is real; every staff *detail/action* page around it is mock. `ut_staff` = **1 row**, `ut_staff_categories` = 22 rows.

### 3G. Misc wired-but-empty

`UTBusinessRequests` (7 refs / `ut_business_requests` 0), `UTBusinessQuotes` (8 / 0), `UTBusinessProducts` (4 / 0), `UTBusinessPackages` (4 / 0), `UTKitOrders` (4 / 0), `UTConsultations` (4 / 0), `UTQuizResults` (3 / 0), `UTBrandKitManager` (4 / 0), `UTBrandingPipeline` (5 / 0), `UTDailySummary` (6), `UTPlatformStats` (5), `UTHallOwnerDashboard` (10), `UTStaffMemberDashboard` (10), `UTAIBrain` (2), `UTPerformanceInsights` (3), `UTCampaignPerformance` (3 / `ut_campaigns` 5 rows), `UTEmailSubscribers` (**0 refs, 42 lines — EMPTY**), `UTBizOwnerDashboard`/`Outreach`, `UTCustomerAcquisition`.

**Inventory tally:** ~111 pages. **~46 have real backend calls. ~65 are UI-only or stubs.** Of the 46 wired, the large majority query tables holding 0 rows.

---

## SECTION 4 — DATABASE (hub-side)

131 `ut_*`/`uft_*`/`unforgettable*` tables exist in `public`. Row counts from `pg_stat_user_tables`.

### Tables with data (14 of 131 — **10.7%**)

| Table | Rows | Real vs seed | Wired to hub? |
|---|---|---|---|
| `ut_partner_leads` | **2,757** | **REAL** (2,679 `new`, 77 `needs_enrichment`, 1 `called`) | ✅ `useUTPartnerLeads`, `UTLeadIntelligence`, `UTPlacesLeadFinder` |
| `ut_territory_jobs` | **465** | REAL | ⚠️ hook exists (`useUTTerritoryJobs`) but territory *pages* have 0 supabase refs |
| `ut_state_coverage` | 50 | SEED (all US states) | partial |
| `ut_staff_categories` | 22 | SEED | ✅ |
| `ut_staff_category_kpis` | 22 | SEED (auto-trigger) | ✅ |
| `ut_product_categories` | 18 | SEED | partial |
| `ut_profiles` | 15 | mixed | partial |
| `ut_vendor_pricing` | 8 | SEED | ✅ pricing engine |
| `ut_automation_schedule` | 9 | SEED | partial |
| `ut_campaigns` | 5 | SEED | ✅ |
| `staff_members_ut` | **5** | REAL-ish | ✅ `UTStaffManagement` |
| `event_halls` | **4** | REAL-ish | ✅ `UTVenuesManagement` |
| `unforgettable_ambassadors` | **4** | REAL-ish | ✅ `UTAmbassadorManagement` |
| `ut_lead_sources` | 4 | SEED | partial |
| `ut_event_bookings` | **3** | **REAL** (2 pending_payment, 1 deposit_received) | ✅ `UTEventBookings` |
| `ut_kit_weights` / `ut_shipping_rates` | 3 / 3 | SEED | partial |
| `ut_staff` | 1 | test | ✅ |
| `ut_staff_payments` | 1 | test | ⚠️ |
| `ut_promotions`, `ut_ambassador_insights` | 1 each | test | partial |

### Empty tables the hub depends on (selection — **117 tables at 0 rows**)

`ut_partners` 0 · `ut_vendors` 0 · `ut_listings` 0 · `ut_products` 0 · `ut_suppliers` 0 · `ut_bookings` 0 · `ut_events` 0 · `ut_event_staff` 0 · `ut_staff_assignments` 0 · `ut_payments` 0 · `ut_vendor_payments` 0 · `ut_ambassador_payouts` 0 · `ut_ambassador_referrals` 0 · `ut_orders` 0 · `ut_customers` 0 · `ut_leads` 0 · `ut_reviews` 0 · `ut_quotes` 0 · `ut_partner_venue_profiles` 0 · `ut_partner_rental_profiles` 0 · `ut_partner_food_profiles` 0 · `ut_partner_creative_profiles` 0 · `ut_partner_availability` 0 · `ut_partner_bookings` 0 · `ut_partner_onboarding` 0 · `ut_venue_spaces` 0 · `ut_rental_inventory` 0 · `ut_vendor_blocked_dates` 0 · `ut_recruiting_leads` 0 · `ut_outreach_logs` 0 · `ut_automation_runs` 0.

### THE SCHEMA-FORK FINDING (critical)

The hub reads from **two parallel, unrelated data models** for the same entities:

| Entity | Model A (the designed `ut_partner_*` marketplace) | Model B (what the working UI actually reads) |
|---|---|---|
| Venues | `ut_partner_venue_profiles` (0), `ut_venue_spaces` (0) | **`event_halls` (4)** ← `UTVenuesManagement.tsx` L51 |
| Staff/vendors | `ut_partners` (0), `ut_vendors` (0), `ut_staff` (1) | **`staff_members_ut` (5)** ← `UTStaffManagement.tsx` L64 |
| Ambassadors | `ut_pub_ambassadors` (0) | **`unforgettable_ambassadors` (4)** |
| Bookings | `ut_bookings` (0), `ut_partner_bookings` (0), `ut_events` (0) | **`ut_event_bookings` (3)** |

Four entities, four forks. Nothing joins across them. There is **no `staff_applicants` table** (NOT FOUND) and **no `ut_dispatch*` table** (NOT FOUND).

---

## SECTION 5 — VENDOR / PROVIDER MANAGEMENT

**Can an operator see/approve/manage all vendors + venues + rentals?** Partially, across three disconnected surfaces.

- **Venues** — `UTVenuesManagement.tsx`: real `useQuery` on `event_halls` + real `updateHall` mutation (L69–71). **4 rows.** Functional but tiny, and it manages `event_halls`, not the `ut_partner_venue_profiles` marketplace model.
- **Staff/vendors** — `UTStaffManagement.tsx`: real query + `updateStaff` mutation on `staff_members_ut`. **5 rows.**
- **Rentals** — **NOT FOUND as an operator surface.** `/os/unforgettable/rentals` is a `<Navigate>` redirect to `/venues` (`AppRoutes.tsx` L3977). `ut_partner_rental_profiles`, `ut_partner_rental_items`, `ut_rental_inventory` all 0 rows with no admin page.
- **Unified vendor view** — `UFTVendors.tsx` has type tabs (`venue|staff|rental`) and one supabase ref, and `UFTVerification.tsx` (244 lines) presents an approve/reject queue with **0 supabase references** — the verification queue is a UI mock.
- **`UTMarketplaceControl.tsx` ("Floor 4", sidebar-promoted)** — 45 lines, three static cards reading "No Onboarding = No Listing", "Review and manage all currently published marketplace listings", "Partners awaiting profile review". **No query, no list, no button.** It describes a gate that isn't implemented on that page. (A `useUTMarketplaceGate` hook exists, but this page does not use it.)

**Connect / payout status visible + manageable?** `ut-stripe-connect-onboard` and `ut-stripe-webhook` edge functions exist, but **no hub page displays Connect onboarding state per vendor** (NOT FOUND). `ut_vendor_payments` = 0.

**Vendor mgmt completion: ~30%.**

---

## SECTION 6 — SERVICE CATALOG MANAGEMENT

**The "130+ roles" claim:** `ut_staff_categories` holds **22 rows**, not 130+. `ut_product_categories` holds 18. `ut_listings` = 0, `ut_products` = 0, `ut_partner_services` = 0, `ut_partner_packages` = 0, `ut_event_packages` = 0.

- **Real CRUD:** only on staff categories — `useUnforgettableStaff.ts` has genuine insert/update/delete against `ut_staff_categories` (L161–318), surfaced by `UnforgettableStaffCategories.tsx` (which itself has 0 direct supabase refs and relies on the hook).
- **`UTProductEngine.tsx` (Floor 5, sidebar-promoted, 382 lines): 0 supabase references.** The catalog engine is static.
- **Pricing:** `UTPricingEngine.tsx` is genuinely wired (11 refs) against `ut_vendor_pricing` (8 rows) + `ut-pricing-engine` function. This is the one real catalog-adjacent capability.

**Hub catalog = public site catalog?** **No — and there is no catalog to share.** With `ut_listings` and `ut_products` at 0, neither surface has a live catalog. The intended single source (`ut_listings`) is unpopulated; the hub's only real catalog data lives in `ut_staff_categories`, which is a taxonomy, not listings. **[INFERENCE]** This is pre-fork rather than forked — nothing has been built on either side yet.

**Catalog completion: ~20%.**

---

## SECTION 7 — BOOKING MANAGEMENT (the core operation)

**This is the most real part of the marketplace half, and it's still only a third of a pipeline.**

`UTEventBookings.tsx` (291 lines) — genuine `useQuery` on `ut_event_bookings` (L31) and a genuine `updateStatus` mutation (L54–63) with query invalidation and toasts. Columns available: `event_type, event_date, city, guest_count, budget, package_name, full_price, deposit_amount, deposit_paid, stripe_payment_intent_id, ai_plan, vendor_cost, gross_profit, net_profit, margin_percent, quote_id`.

Lifecycle as implemented (buttons at L110–130):

| Stage | Implemented? | Evidence |
|---|---|---|
| **Received** | ✅ REAL | `receive-event-booking` edge fn inserts into `ut_event_bookings` (L58–60). 3 live rows. |
| **Deposit received** | ✅ REAL | button `pending_payment → deposit_received` |
| **Confirmed** | ✅ REAL | button `deposit_received → confirmed` |
| **Staffed** | ❌ **MISSING** | no status value, no UI, `ut_event_staff`/`ut_staff_assignments` never read or written by any page |
| **Dispatched** | ❌ **MISSING** | no dispatch table, no dispatch page, no notification |
| **Completed** | ⚠️ LABEL ONLY | button `confirmed → completed` — a status flip with no completion artifacts (no proof, no signoff, no timestamps beyond `updated_at`) |
| **Paid** | ❌ **MISSING** | no payout is triggered on completion; `ut_payments` and `ut_vendor_payments` are both 0 and nothing writes to them from this page |

There is also **no booking detail view** — no `event-bookings/:id` route exists (NOT FOUND). Everything is row-level in one table. `ai_plan` and `quote_id` are stored but not rendered as a detail surface.

**Booking mgmt completion: ~45%** (intake and 3 status flips real; detail, staffing, dispatch, settlement absent).

---

## SECTION 8 — STAFF MATCHING / DISPATCH (the operational heart)

**MISSING. Entirely.**

- No page reads or writes `ut_staff_assignments` (0 rows) or `ut_event_staff` (0 rows). Grep across `src/pages/os/unforgettable` and `src/pages/uft` for those table names returns **no matching page**.
- No matching engine: no edge function named for dispatch/assignment/matching exists in the UT function set (43 `ut-*`/UT-related functions listed; none is a matcher). `ut-sync-availability` exists but no UI invokes it from a booking.
- No availability check: `ut_partner_availability` 0, `ut_partner_venue_availability` 0, `ut_vendor_blocked_dates` 0, and `UnforgettableAvailability.tsx` (310 lines) has **0 supabase references** — the availability screen is mock.
- No double-booking prevention: **NOT FOUND** — no unique constraint surface, no conflict check, no calendar collision logic. `UTEventCalendar.tsx` (101 lines, 2 refs) is a display, not a scheduler.
- The scheduling suite (`UnforgettableScheduling*`, 4 pages, 1,013 lines) that *looks* like dispatch generates its events in-file from hardcoded arrays.

Compare with the sibling brand: TopTier has `/os/toptier/dispatch` (Dispatch Center), `tt_dispatch_requests`, and a documented escalation cascade. **UT has no equivalent — this capability was never started.**

**Staff matching / dispatch completion: 0%.** This is the single largest gap in the hub.

---

## SECTION 9 — PAYMENTS / PAYOUTS / COMMISSIONS

**Infrastructure exists at the function layer; nothing has flowed through it.**

Edge functions present: `ut-create-checkout`, `ut-process-booking-payment`, `ut-verify-payment`, `ut-process-refund`, `ut-stripe-connect-onboard`, `ut-stripe-webhook`, `ut-generate-invoice`, `payout-processor`, `ut-track-ambassador-sale`.

| Question | Answer |
|---|---|
| Booking payments visible + reconciled? | Partially — `deposit_paid` and `stripe_payment_intent_id` are columns on `ut_event_bookings`; **`ut_payments` = 0 rows**, so there is no payment ledger. No reconciliation surface exists (NOT FOUND). |
| Vendor/staff payouts processed? | **No.** `ut_vendor_payments` = 0. `UTPayoutManager.tsx` reads it and shows an empty table. `ut_staff_payments` = 1 (test row). |
| Real or bookkeeping? | Neither yet — it is **wired plumbing with zero throughput**. |
| Ambassador commission tracked + paid? | Tracking model exists (`ut_ambassador_referrals` 0, `ut_ambassador_payouts` 0) and `UTAmbassadorManagement.tsx` has real insert/update mutations on payouts (L214, L234) plus `ambassador-notify`. **But `UTPayoutManager.tsx`'s ambassador tab is a hardcoded `0` and a literal empty `<TableRow>` (L29, L57) — it never queries.** Two ambassador payout surfaces, one real, one fake. |
| Dynasty's cut per booking computed? | **Partially — as stored columns, not as a computed engine.** `ut_event_bookings` carries `vendor_cost`, `gross_profit`, `net_profit`, `margin_percent`. Nothing in the hub calculates or writes them; **[INFERENCE]** they are intended to be populated at booking creation and are currently unpopulated logic. No take-rate configuration surface found. |

**Payments/payouts completion: ~25%** (functions written, ledgers empty, one fake surface).

---

## SECTION 10 — AMBASSADOR PROGRAM (hub side)

**The best-built subsystem in the hub after acquisition.**

`UTAmbassadorManagement.tsx` (1,266 lines, 23 supabase refs) does real work:
- Lists `unforgettable_ambassadors` (**4 rows**), approve via `approve-ut-ambassador` edge fn (L177), suspend via direct update (L204).
- Payout create/update on `ut_ambassador_payouts` (L214, L234) with `ambassador-notify` dispatch and a write-back of `payout_status: 'paid'` to the ambassador row (L246).
- Pipeline ops: `run-ut-ambassador-pipeline-test`, `monitor-ut-ambassador-pipeline`, `optimize-ut-ambassador-performance`, `generate-ut-ambassador-insights` (L285–334) — four real AI/ops functions with a dismissible insights feed backed by `ut_ambassador_insights` (1 row).
- Reads `pipeline_health_logs`, `system_operation_logs`, `system_alert_config`.

Supporting: `UTAmbassadorFinder.tsx` (9 refs, `ut_ambassador_prospects` **0 rows**), `UTAmbassadorLeaderboard.tsx` (2 refs + `ut-get-ambassador-leaderboard` fn), `submit-ut-ambassador` / `receive-ut-ambassador` intake functions.

Weaknesses: **referrals table is empty (0)** so commission is never actually computed from real referral events; `UFTAmbassadors.tsx` (176 lines, sidebar-linked) is **0 supabase — a mock duplicate** of a real console; `UTPayoutManager`'s ambassador tab is fake (Section 9).

**Ambassador completion: ~70%** — real console, no data, one mock twin.

---

## SECTION 11 — ACQUISITION ENGINE (scraper + staff intake)

**Partner scraper: BUILT AND RUNNING.** This is the only part of the hub with production-scale real data.

- `supabase/functions/ut-lead-scraper/index.ts` — exists.
- `ut-places-search` — exists; `UTPlacesLeadFinder.tsx` (620 lines, 7 refs) is the operator surface.
- `ut_partner_leads`: **2,757 rows** — 2,679 `new`, 77 `needs_enrichment`, 1 `called`.
- `ut_territory_jobs`: **465 rows**; `ut-run-territory-job` function + `useUTTerritoryJobs` hook exist.
- `ut_state_coverage`: 50 rows (full US grid).
- Intake functions built: `receive-ut-venue`, `receive-ut-staff`, `receive-ut-rental`, `receive-ut-ambassador`.

**Partner map:** `UTTerritoryIntelligence.tsx` / `UTTerritoryControl.tsx` exist (783 lines combined) but have **0 supabase references** — the map does not render the 465 territory jobs or the 2,757 leads. **The scraper fills a warehouse the map cannot see.**

**Staff applicants intake: NOT FOUND.** No `staff_applicants` table in `public`. No applicant intake page. `receive-ut-staff` exists as a function but `ut_staff` holds 1 row. **Per the acquisition spec, staff intake is PENDING — not built.**

**Conversion gap (the damning number):** 2,757 leads scraped → **1 called** → **0 `ut_partners`** → **0 `ut_listings`**. The acquisition engine produces leads that the rest of the hub cannot convert, because outreach logging (`ut_outreach_logs` 0), onboarding (`ut_partner_onboarding` 0, and `UnforgettableOnboarding.tsx` has 0 supabase refs), and listing creation (`ut_listings` 0, `UTProductEngine` 0 refs) are all unwired.

**Acquisition completion: ~65%** (scraper real, map + conversion path unwired, staff intake missing).

---

## SECTION 12 — EVERY PAGE / BUTTON / REAL vs MOCK

### Mock-presented-as-real (flagged — these will mislead an operator)

1. **`UTPenthouse.tsx` (the hub landing page)** — L15–20 KPIs `2,847 / 1,204 / 387 / 94 / 72 / 3.3%`; L25–29 funnel `1643/1204/387/94/72`; L45–46 alerts "143 leads not contacted in 48+ hours", "12 listings blocked by marketplace gate"; L123–131 `47 / 128 / 34%`. **All hardcoded.** Reality: 2,757 leads, 1 called, 0 onboarded, 0 listings. *Highest-severity mock in the hub — it is the first screen.*
2. **`UnforgettableScheduling.tsx` L14–64** — venues `['Grand Ballroom','Sunset Terrace','Garden Pavilion','Rooftop Lounge','Crystal Hall']`, clients `['Johnson Family','Smith Corp','Garcia Wedding',…]`, staff `['Marcus Johnson','Sofia Rodriguez',…]`. Zero of these exist in the DB.
3. **`UFTDashboard.tsx` L17 `REVENUE_MOCK`, L30 `HEALTH_ITEMS`** — a mock revenue chart and a hardcoded system-health panel on a sidebar-linked command center.
4. **`UFTRevenue.tsx` L43 `stats`, L50 `externalCards`** — hardcoded revenue figures, 0 supabase.
5. **`UnforgettablePayroll.tsx` / `UnforgettablePerformance.tsx` / `UnforgettableAvailability.tsx` / `UnforgettableDocuments.tsx` / `UnforgettableCommunications.tsx`** — in-file generated datasets, 0 supabase.
6. **`UTPayoutManager.tsx` L29** — `const pendingAmbassador = 0;` rendered as a real "$0 Ambassador Payouts" KPI. It is a literal, not a query result.
7. **`UFTVerification.tsx`** — 244-line approve/reject verification queue, 0 supabase. Approving there does nothing.

### Dead / misleading buttons

- Sidebar **Vendors → `/os/unforgettable/vendors`** → redirects to Staff Management (`AppRoutes.tsx` L3976).
- Sidebar **Rentals**, **Party Bags**, **AI Party Builder** → all redirect to Venues (L3977–3979).
- **Floor 4 Marketplace Control** — three cards, no controls at all.
- **Floor 6 Automation / Floor 7 Analytics** — 45 lines each, no data, no actions.
- Every button in the 28-page HR/scheduling suite (call, email, edit, save, approve, pay) mutates local React state only.
- `UFTPayouts.tsx` — 17 lines, sidebar-linked, effectively blank.

### Real, working buttons (the short list)

`UTEventBookings` status transitions · `UTVenuesManagement` update-hall · `UTStaffManagement` update-staff · `UTAmbassadorManagement` approve/suspend/payout/pipeline-run/insight-dismiss · `UTPlacesLeadFinder` search · `UTPricingEngine` · supplier inbox/RFQ actions · `useUnforgettableStaff` category CRUD · `UTVirtualTours`.

---

## SECTION 13 — SECURITY / ACCESS

| Check | Finding |
|---|---|
| Auth gate | ✅ Both `/os/unforgettable/*` (`AppRoutes.tsx` L3884) and `/uft/*` (L3867) sit under `<ProtectedLayout />` — authenticated-only. |
| **RoleGuard** | ❌ **NOT FOUND on any UT route.** No `<RoleGuard allowedRoles=[...]>` wraps the UT or UFT blocks. `UTHubLayout.tsx` contains **no role check** (grep for `RoleGuard`/role returns nothing). **Any authenticated Dynasty OS user can open the entire UT operator hub**, including ambassador payout creation, vendor approval, and booking status mutation. Same class of gap flagged in the Clipper Nation and UBEN audits. |
| Operator vs vendor vs ambassador separation | ⚠️ Partially by *page*, not by *permission*: `UTHallOwnerDashboard` and `UTStaffMemberDashboard` are partner-facing views living **inside the admin hub** at admin-only URLs, with no role gate distinguishing them. Portal hooks (`useUTVenuePortal`, `useUTRentalPortal`, `useUTCreativePortal`, `useUTCatererPortal`, `useUTPartnerPortal`) exist, implying an intended separation that is not enforced at the route layer. |
| RLS on hub tables | ✅ Enabled everywhere checked, with policies present: `ut_event_bookings` (4 policies), `ut_partner_leads` (1), `event_halls` (4), `staff_members_ut` (5), `unforgettable_ambassadors` (7), `ut_bookings` (5), `ut_staff` (2), `ut_staff_assignments` (2), `ut_payments` (1), `ut_vendor_payments` (1), `ut_ambassador_payouts` (1). **⚠️ `ut_partner_leads` guards 2,757 rows of scraped business PII with a single policy — worth a targeted review.** |
| Customer PII | `ut_event_bookings` stores `name, email, phone` — RLS on with 4 policies. No PII masking in the hub UI (**[INFERENCE]** acceptable for an operator console *if* role-gated, which it is not). |
| Payment secrets | ✅ Stripe handled server-side (`ut-stripe-connect-onboard`, `ut-stripe-webhook`, `ut-create-checkout`, `ut-verify-payment`). No client-side key usage found in UT pages. |

**Security posture: RLS good, route authorization missing.**

---

## SECTION 14 — CONNECTION TO PUBLIC SITE + DYNASTY ECOSYSTEM

**Seam identified: `supabase/functions/receive-event-booking/index.ts`.** It builds an `insertPayload` (L39) and inserts into `ut_event_bookings` (L58–60), returning `{ success: true, id }` (L102). This is the **one working bridge** — the public site POSTs a booking, it lands in the hub table, and `UTEventBookings` renders it. The 3 live rows are proof the bridge works.

Companion intake functions confirm the pattern is external-site → edge function → hub table: `receive-ut-venue`, `receive-ut-staff`, `receive-ut-rental`, `receive-ut-ambassador`, `submit-ut-ambassador`.

**Architecture:** the public site is a **separate deployment bridged by edge functions**, not the same project. Consistent with the project's Cross-Site CRUD Proxy standard.

**Disconnects:**
1. **Catalog flows nowhere.** The hub has no live catalog (`ut_listings` 0, `ut_products` 0) and `UTProductEngine` has 0 supabase refs, so the public site cannot be reading a hub-managed catalog. **The bridge is one-way: bookings in, nothing out.**
2. **No booking acknowledgement loop back to the site** beyond `ut-send-booking-confirmation` (email), so a customer sees no status after the hub flips `confirmed`.
3. **Vendor/venue intake functions exist but their target tables are empty** (`ut_partners` 0, `ut_partner_venue_profiles` 0) — the intake endpoints are deployed but unused.

**TopTier API:** **NOT FOUND** — no UT page or function exposes a feed TopTier consumes. `src/lib/toptierApi.ts` exists but is TopTier's own client. UT ↔ TopTier are siblings in the sidebar with **no data seam between them** (the `ut_*` vs `tt_*` prefix isolation rule is honored, but no bridge was built).

**Empire HUD / Dynasty OS writes:** `UTAmbassadorManagement` writes to shared `pipeline_health_logs`, `system_operation_logs`, and `system_alert_config` (`system_name = 'ut_ambassador_pipeline'`) — **[INFERENCE]** these are the OS-wide monitoring tables, so the ambassador pipeline (only) reports into the Dynasty OS health plane. No other UT subsystem does.

---

## SECTION 15 — TWO PERCENTAGES + SCORECARD

### BUILD COMPLETION %

| Area | Build % | Basis |
|---|---|---|
| Acquisition engine (scraper/leads) | **65%** | 2,757 real leads, scraper + places fn live; map pages unwired; staff intake missing |
| Ambassador program | **70%** | Real 1,266-line console + 5 edge fns; 4 rows, 0 referrals, mock twin at `/uft/ambassadors` |
| Booking management | **45%** | Real intake + 3 status flips; no detail view, no staffing, no settlement |
| Vendor / provider mgmt | **30%** | 4 venues + 5 staff manageable; rentals absent; Connect status invisible; Floor 4 is static |
| Payments / payouts / commissions | **25%** | 9 edge fns written; every ledger at 0 rows; one hardcoded-zero surface |
| Service catalog mgmt | **20%** | Only staff-category CRUD real; Product Engine 0 refs; 0 listings |
| **Staff matching / dispatch** | **0%** | No table used, no page, no engine, no availability check, no conflict prevention |
| HR / scheduling / payroll suite | **10%** | 28 pages, ~9,700 lines, 0 backend — UI shell only |
| Supplier / procurement cluster | **55%** | 16 of 18 pages wired; all target tables at 0 rows |
| Security / access control | **45%** | RLS solid; **no RoleGuard anywhere** |
| Navigation / reachability | **35%** | 95 routes, 11 in sidebar; booking queue unlinked; 5 misleading redirects |

### **OVERALL BUILD COMPLETION: ~38%**

Weighted toward the operational core (bookings, staffing, dispatch, payouts), which is where the build is thinnest.

### **OPERATIONAL READINESS: ~12%**

**Plainly: no. An operator cannot run a real event end to end today.**

The chain breaks at the third link:

```
received ──✅──> confirmed ──✅──> [ STAFFED ] ──❌ DOES NOT EXIST ──> dispatched ──❌──> completed(label only) ──> paid ──❌
```

Concretely, with today's code and data an operator can: receive a booking from the public site, mark deposit received, mark confirmed, and mark completed. They **cannot** find an available staffer for the date, assign anyone to the event, notify them, prevent a double-booking, record the work, pay the vendor, or pay the ambassador. There are 5 staff and 4 venues in the system to staff from, and 0 assignment records have ever been written.

The 12% reflects that booking intake genuinely works and lead acquisition genuinely works at scale — but neither connects to a fulfillment capability.

---

## SECTION 16 — PRIORITIZED TASK LIST TO 100%

Dependency-ordered. **[OWNER]** = business/data decision. **[DEV]** = engineering.

### CRITICAL (nothing downstream works without these)

1. **[OWNER] Resolve the four schema forks.** Decide, per entity, whether the canonical table is the `ut_partner_*` marketplace model or the working `event_halls` / `staff_members_ut` / `unforgettable_ambassadors` / `ut_event_bookings` model. Every task below depends on this answer. *Blocks everything.*
2. **[DEV] Build staff matching + dispatch.** New `ut_dispatch_requests`-style table (mirror the TopTier pattern), a matcher on role × location × date against `ut_partner_availability` + `ut_vendor_blocked_dates`, writes to `ut_staff_assignments`, a unique constraint or trigger preventing double-booking, and a booking-detail dispatch panel. *Depends on 1.*
3. **[DEV] Add RoleGuard to `/os/unforgettable/*` and `/uft/*`.** Wrap both route blocks; separate operator from the partner-facing `hall-dashboard` / `staff-dashboard` views. *Independent — ship immediately.*
4. **[DEV] Wire `UTPenthouse.tsx` to real queries or take it down.** Replace the 20+ hardcoded KPIs/funnel/alerts with `ut_partner_leads`, `ut_event_bookings`, `ut_partners` counts. Shipping a landing page that reports 94 onboarded partners when the table has 0 is worse than shipping a blank page. *Independent.*
5. **[DEV] Add the booking detail route** `event-bookings/:id` rendering `ai_plan`, quote linkage, assignments, payments, and the dispatch panel from task 2. *Depends on 2.*

### HIGH

6. **[DEV] Build the payment ledger.** Write `ut_payments` rows from `ut-stripe-webhook`; surface a reconciliation view against `ut_event_bookings.deposit_paid` / `stripe_payment_intent_id`. *Depends on 1.*
7. **[DEV] Wire vendor payouts end to end.** On booking `completed`, generate `ut_vendor_payments`; expose Connect onboarding status per vendor; make `payout-processor` reachable from `UTPayoutManager`. *Depends on 2, 6.*
8. **[DEV] Fix `UTPayoutManager.tsx`'s ambassador tab** — replace the hardcoded `pendingAmbassador = 0` (L29) and literal empty row (L57) with the real `ut_ambassador_payouts` query already used in `UTAmbassadorManagement`. *Small, independent.*
9. **[DEV] Fix sidebar reachability** — add `event-bookings`, `venues`, `staff-management`, `ambassadors`, `payout-manager`, `revenue-dashboard`, `event-calendar` to Layout.tsx; delete or relabel the 5 lying redirects (`vendors`/`rentals`/`party-bags`/`ai-builder`/`halls`). *Independent.*
10. **[DEV] Wire the territory/lead map.** `UTTerritoryControl` and `UTTerritoryIntelligence` (783 lines, 0 refs) already have `useUTTerritoryJobs` and `useUTPartnerLeads` available — connect them to the 465 jobs and 2,757 leads. *Independent, high value for existing data.*
11. **[OWNER] Decide the fate of the 28-page HR/scheduling suite** (~9,700 lines, 0 backend). Three options: wire it to `ut_staff`/`ut_staff_assignments`, delete it, or mark it explicitly as a prototype. Leaving mock-as-real in an operator console is an active liability. *Blocks 12.*

### MEDIUM

12. **[DEV] Wire the lead→partner conversion path**: outreach logging (`ut_outreach_logs`), `UnforgettableOnboarding` (0 refs today), and partner creation. Without it the scraper's 2,757 leads stay at 1 called. *Depends on 1, 11.*
13. **[DEV] Build the catalog.** Wire `UTProductEngine` (0 refs) and `UTMarketplaceControl` (0 refs, 45 lines) to `ut_listings`/`ut_products`; make the hub the single source the public site reads. *Depends on 1.*
14. **[DEV] Build rentals operator surface** — currently a redirect. `ut_partner_rental_*` tables exist and are empty.
15. **[DEV] Wire `UFTVerification`** (244 lines, 0 refs) to a real approval queue, or fold it into `UTVenuesManagement`/`UTStaffManagement` to remove the duplicate.
16. **[OWNER] Decide whether `/uft/*` and `/os/unforgettable/*` should both exist.** They are two operator consoles for one business, with duplicated ambassador, vendor, revenue and payout surfaces — and the `/uft` copies are consistently the mock ones (`UFTAmbassadors` 0 refs, `UFTRevenue` 0 refs, `UFTPayouts` 17 lines).
17. **[DEV] Implement the Dynasty take-rate engine** — populate `vendor_cost`/`gross_profit`/`net_profit`/`margin_percent` at booking creation; add a take-rate config surface. *Depends on 6.*

### LOW

18. **[DEV] Build `staff_applicants` intake** (table NOT FOUND) per the acquisition spec; wire `receive-ut-staff`.
19. **[DEV] Delete the orphaned `src/modules/unforgettable/index.ts`** route/sidebar registry — superseded by `AppRoutes.tsx`, pure drift.
20. **[DEV] Wire or remove** `UTAnalytics` (45 lines), `UTAutomation` (45), `UTIntelligence` (50), `UTShopDashboard` (43), `UTEmailSubscribers` (42), `UFTPayouts` (17) — six sub-50-line stubs occupying real navigation slots.
21. **[DEV] Build a UT↔TopTier seam** if cross-brand event/experience bundling is intended (currently no connection exists).
22. **[DEV] Review the single RLS policy on `ut_partner_leads`** guarding 2,757 rows of scraped business contact data.

---

## CLOSING ASSESSMENT (no flattery)

Unforgettable Times' hub has an impressive **surface area** — 111 pages, 131 tables, 43 edge functions — and an unimpressive **spine**. The parts that were fun to build (AI agents, supplier negotiation, growth simulators, virtual tours, 10 numbered "Floors") are built. The part the business actually needs — take a booking, find someone available, send them, confirm the work, pay everyone — has a working first step, a missing middle, and an unimplemented end.

Three findings deserve to be read twice:

- **Dispatch is 0%.** Not partial, not stubbed — the concept has no table usage, no page, and no function anywhere in the hub.
- **The landing page lies.** `UTPenthouse` reports 94 onboarded partners and 72 active listings against a database holding 0 of each.
- **The scraper works and nothing downstream can consume it.** 2,757 real leads, 1 phone call, 0 partners.

Fix the fork (task 1), gate the routes (task 3), stop the landing page from fabricating (task 4), then build dispatch (task 2). Those four unlock everything else.

---

**Audit file:** `docs/audits/UNFORGETTABLE_TIMES_OS_HUB_AUDIT.md`
