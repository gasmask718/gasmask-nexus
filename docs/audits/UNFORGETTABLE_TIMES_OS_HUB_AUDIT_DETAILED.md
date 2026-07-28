# UNFORGETTABLE TIMES — OS HUB DETAILED AUDIT (evidence-level)

Date: 2026-07-28
Scope: `/os/unforgettable/*`, `/uft/*`, `src/pages/os/unforgettable/**`, `src/hooks/useUnforgettable*`, `supabase/functions/ut-*`, `receive-ut-*`, `receive-event-booking`, all `public.ut_*` + UT-adjacent tables.
Method: direct file reads (`rg`/`sed`), live `psql` row counts against the project DB, route-table extraction from `src/routes/AppRoutes.tsx`.
Every claim below is tagged **[CODE]** (read in source), **[DB]** (live query result), or **[INFERENCE]**.

---

## 1 — FULL PAGE/ROUTE TABLE

### 1.1 Live sidebar registry — only 11 entries exist
**[CODE]** `src/components/Layout.tsx:439–453`, `unforgettableHub.items`:

| # | Path in sidebar | Label |
|---|---|---|
| 1 | `/os/unforgettable` | 🎉 Penthouse — Command Center |
| 2 | `/os/unforgettable/intelligence` | 🎯 Floor 1 — Lead Intelligence |
| 3 | `/os/unforgettable/outreach` | 📞 Floor 2 — Outreach Command |
| 4 | `/os/unforgettable/onboarding` | 📋 Floor 3 — Partner Onboarding |
| 5 | `/os/unforgettable/marketplace` | 🏪 Floor 4 — Marketplace Control |
| 6 | `/os/unforgettable/products` | 📦 Floor 5 — Product Engine |
| 7 | `/os/unforgettable/automation` | 🤖 Floor 6 — AI & Automation |
| 8 | `/os/unforgettable/analytics` | 📊 Floor 7 — Analytics |
| 9 | `/os/unforgettable/pricing-intelligence` | 💰 Floor 8 — Pricing Intelligence |
| 10 | `/os/unforgettable/event-spaces` | 🏛️ Floor 9 — Event Spaces |
| 11 | `/os/unforgettable/virtual-tours` | 📸 Floor 10 — Virtual Tours |

**[DB/CODE] Route count:** 105 routes are registered under `/os/unforgettable` in `src/routes/AppRoutes.tsx:3885–3990` (+ 10 under `/uft`). **94 of 105 UT hub routes are ORPHANED** — reachable by URL only, not present in `Layout.tsx`. Notably orphaned: `event-bookings`, `venues`, `staff/*` (10 routes), `scheduling/*`, `payroll/*`, `ambassadors`, `vendor-payments`, `payout-manager`, `revenue-dashboard`.

### 1.2 Every route (105) — status table

Legend for "Backend": table/function names read in the component file. Legend for status:
WORKING = real query + real rows; PARTIAL = real query, empty table; UI-ONLY = zero `supabase` references in file; EMPTY = renders but no data path; BROKEN = points at a missing/forked table.

| Route (`/os/unforgettable/…`) | Component file | In sidebar? | supabase refs **[CODE]** | Status | Backend |
|---|---|---|---|---|---|
| `` (index) | `UTPenthouse.tsx` | ✅ | **0** | **UI-ONLY (fabricated)** | none |
| `intelligence` | `UTIntelligenceCommandCenter.tsx` | ✅ | 0 | UI-ONLY | none |
| `territory` | `UTTerritoryControl.tsx` | ❌ | 0 | UI-ONLY | none |
| `territory-heatmap` | `UTTerritoryIntelligence.tsx` | ❌ | 0 | UI-ONLY | none |
| `places` | `UTPlacesLeadFinder.tsx` | ❌ | 7 | WORKING | `ut_partner_leads`, `ut-places-search` |
| `outreach` | `UTOutreachCommand.tsx` | ✅ | **0** | UI-ONLY | none |
| `communications` | `UnforgettableCommunications.tsx` | ❌ | 0 | UI-ONLY | none |
| `onboarding` | `UnforgettableOnboarding.tsx` | ✅ | **0** | UI-ONLY | none |
| `partners` | `partner/UTPartnerDashboard` | ❌ | — | PARTIAL | `ut_partner_profiles` (0 rows) |
| `marketplace` | `UTMarketplaceControl.tsx` | ✅ | **0** | UI-ONLY | none |
| `events` | `UTEventBuilder.tsx` | ❌ | **0** | UI-ONLY | none |
| `products` | `UTProductEngine.tsx` | ✅ | **0** | UI-ONLY | none |
| `suppliers` | `UTSupplierConsole.tsx` | ❌ | **0** | UI-ONLY | none |
| `automation` | `UTAutomation.tsx` | ✅ | **0** | UI-ONLY | none |
| `pricing-intelligence` | `PricingIntelligence.tsx` | ✅ | 3 | PARTIAL | `ut_category_pricing` (0) |
| `staff` | `UnforgettableStaff.tsx` | ❌ | 0 (via hook) | **MOCK-CAPABLE** | `useUnforgettableStaff` |
| `staff/new` | `UnforgettableStaffNew.tsx` | ❌ | 0 (hook) | PARTIAL | hook mutation |
| `staff/categories` | `UnforgettableStaffCategories.tsx` | ❌ | 0 (hook) | WORKING | `ut_staff_categories` (22) |
| `staff/:id` | `UnforgettableStaffProfile.tsx` | ❌ | 0 | PARTIAL | hook |
| `staff/:id/edit` | `UnforgettableStaffEdit.tsx` | ❌ | 0 | PARTIAL | hook |
| `staff/:id/venues` | `UnforgettableStaffVenues.tsx` | ❌ | 0 | UI-ONLY | none |
| `staff/:id/notes` | `UnforgettableStaffNotes.tsx` | ❌ | 0 | UI-ONLY | none |
| `staff/:id/call` | `UnforgettableStaffCall.tsx` | ❌ | 0 | UI-ONLY | none |
| `staff/:id/email` | `UnforgettableStaffEmail.tsx` | ❌ | 0 | UI-ONLY | none |
| `staff/:id/performance` | `UnforgettableStaffPerformance.tsx` | ❌ | 0 | UI-ONLY | none |
| `scheduling` | `UnforgettableScheduling.tsx` | ❌ | **0** | UI-ONLY | none |
| `scheduling/today` | `UnforgettableSchedulingToday.tsx` | ❌ | 0 | UI-ONLY | none |
| `scheduling/upcoming` | `UnforgettableSchedulingUpcoming.tsx` | ❌ | 0 | UI-ONLY | none |
| `scheduling/gaps` | `UnforgettableSchedulingGaps.tsx` | ❌ | 0 | UI-ONLY | none |
| `payroll` | `UnforgettablePayroll.tsx` | ❌ | **0** | UI-ONLY | none |
| `payroll/:staffId` | `UnforgettablePayrollDetail.tsx` | ❌ | 0 | UI-ONLY | none |
| `documents` | `UnforgettableDocuments.tsx` | ❌ | 0 | UI-ONLY | `ut_staff_documents` (0) not read |
| `documents/:id` | `UnforgettableDocumentDetail.tsx` | ❌ | 0 | UI-ONLY | none |
| `availability` | `UnforgettableAvailability.tsx` | ❌ | 0 | UI-ONLY | none |
| `performance` | `UnforgettablePerformance.tsx` | ❌ | 0 | UI-ONLY | none |
| `analytics` | `UTAnalytics.tsx` | ✅ | **0** | UI-ONLY | none |
| `ai-calling` | `UnforgettableAICalling.tsx` | ❌ | 0 | UI-ONLY | none |
| `ai-calling/:callId` | `UnforgettableAICallDetail.tsx` | ❌ | 0 | UI-ONLY | none |
| `dashboard` | `UnforgettableDashboard.tsx` | ❌ | **0** | UI-ONLY | none |
| `customer-service` | `UnforgettableCustomerService.tsx` | ❌ | 0 | UI-ONLY | none |
| `media` | `UnforgettableMedia.tsx` | ❌ | 0 | UI-ONLY | none |
| `media/:id` | `UnforgettableMediaDetail.tsx` | ❌ | 0 | UI-ONLY | none |
| `hall-dashboard` | `UTHallOwnerDashboard.tsx` | ❌ | 10 | PARTIAL | `event_halls` (4) |
| `staff-dashboard` | `UTStaffMemberDashboard.tsx` | ❌ | 10 | PARTIAL | `staff_members_ut` (5) |
| `venues` | `UTVenuesManagement.tsx` | ❌ | 6 | **WORKING** | `event_halls` (4 rows) |
| `event-bookings` | `UTEventBookings.tsx` | ❌ | 5 | **WORKING** | `ut_event_bookings` (3 rows) |
| `leads` | `UTLeadIntelligence.tsx` | ❌ | 9 | **WORKING** | `ut_partner_leads` (2,757) |
| `outreach-engine` | `UTOutreachEngine.tsx` | ❌ | 4 | PARTIAL | `ut_outreach_logs` (0) |
| `automation-runs` | `UTAutomationRuns.tsx` | ❌ | 6 | PARTIAL | `ut_automation_runs` (0) |
| `ambassador-finder` | `UTAmbassadorFinder.tsx` | ❌ | 9 | PARTIAL | `ut_ambassador_prospects` (0) |
| `growth-engine` | `UTGrowthEngine.tsx` | ❌ | 16 | PARTIAL | `ut_growth_reports` (0) |
| `biz-owner-outreach` | `UTBizOwnerOutreach.tsx` | ❌ | 4 | PARTIAL | `ut_business_requests` (0) |
| `customer-acquisition` | `UTCustomerAcquisition.tsx` | ❌ | 4 | PARTIAL | `ut_leads` (0) |
| `pricing-engine` | `UTPricingEngine.tsx` | ❌ | 11 | PARTIAL | `ut_vendor_pricing` (8) |
| `growth-simulator` | `UTGrowthSimulator.tsx` | ❌ | **0** | UI-ONLY | none |
| `brand-kit` | `UTBrandKitManager.tsx` | ❌ | 4 | PARTIAL | `ut_brand_kits` (0) |
| `supplier-manager` | `UTSupplierManager.tsx` | ❌ | 5 | PARTIAL | `ut_suppliers` (0) |
| `branding-pipeline` | `UTBrandingPipeline.tsx` | ❌ | 5 | PARTIAL | `ut_branding_requests` (0) |
| `biz-owner-dashboard` | `UTBizOwnerDashboard.tsx` | ❌ | 4 | PARTIAL | `ut_business_requests` (0) |
| `quiz-results` | `UTQuizResults.tsx` | ❌ | 3 | PARTIAL | `ut_quiz_results` (0) |
| `consultations` | `UTConsultations.tsx` | ❌ | 4 | PARTIAL | `ut_business_consultations` (0) |
| `kit-orders` | `UTKitOrders.tsx` | ❌ | 4 | PARTIAL | `ut_kit_orders` (0) |
| `daily-summary` | `UTDailySummary.tsx` | ❌ | 6 | PARTIAL | mixed, mostly empty |
| `event-calendar` | `UTEventCalendar.tsx` | ❌ | 2 | PARTIAL | `ut_events` (0) |
| `vendor-payments` | `UTVendorPayments.tsx` | ❌ | 3 | **EMPTY** | `ut_vendor_payments` (0) |
| `ambassador-leaderboard` | `UTAmbassadorLeaderboard.tsx` | ❌ | 2 | PARTIAL | `ut-get-ambassador-leaderboard` |
| `campaign-performance` | `UTCampaignPerformance.tsx` | ❌ | 3 | PARTIAL | `ut_campaigns` (5) |
| `shop-dashboard` | `UTShopDashboard.tsx` | ❌ | **0** | UI-ONLY | none |
| `product-organizer` | `UTProductOrganizer.tsx` | ❌ | **0** | UI-ONLY | none |
| `email-subscribers` | `UTEmailSubscribers.tsx` | ❌ | **0** | UI-ONLY | none |
| `revenue-dashboard` | `UTRevenueDashboard.tsx` | ❌ | 3 | **EMPTY** | `ut_revenue_snapshots` (0) |
| `payout-manager` | `UTPayoutManager.tsx` | ❌ | 3 | **EMPTY** | `ut_ambassador_payouts` (0) |
| `ai-brain` | `UTAIBrain.tsx` | ❌ | 2 | PARTIAL | `ut-ai-brain` |
| `performance-insights` | `UTPerformanceInsights.tsx` | ❌ | 3 | PARTIAL | empty tables |
| `rfq-engine` | `UTRFQEngine.tsx` | ❌ | 6 | PARTIAL | `ut_rfq_requests` (0) |
| `shipping-tracker` | `UTShippingTracker.tsx` | ❌ | 5 | PARTIAL | `ut_shipments` (0) |
| `supplier-finder` | `UTSupplierFinder.tsx` | ❌ | 3 | PARTIAL | `ut_suppliers` (0) |
| `supplier-inbox` | `UTSupplierInbox.tsx` | ❌ | 14 | PARTIAL | `ut_supplier_messages` (0) |
| `supplier-decision` | `UTSupplierDecisionEngine.tsx` | ❌ | 9 | PARTIAL | `ut_supplier_risk_profiles` (0) |
| `supplier-command` | `UTSupplierCommandDashboard.tsx` | ❌ | 8 | PARTIAL | empty supplier tables |
| `negotiation-agent` | `UTNegotiationAgent.tsx` | ❌ | 5 | PARTIAL | `ut-ai-negotiation` |
| `negotiation-dashboard` | `UTNegotiationDashboard.tsx` | ❌ | 2 | PARTIAL | `ut_supplier_negotiations` (0) |
| `supplier-inbox-v2` | `UTSupplierInboxV2.tsx` | ❌ | 8 | PARTIAL | `ut_supplier_threads` (0) |
| `auto-outreach` | `UTAutoOutreach.tsx` | ❌ | 5 | PARTIAL | `ut_outreach_sequences` (0) |
| `shipping-quotes` | `UTShippingQuotes.tsx` | ❌ | 5 | PARTIAL | `ut_shipping_quotes` (0) / `ut_shipping_rates` (3) |
| `auto-finder` | `UTAutoFinder.tsx` | ❌ | 6 | PARTIAL | `ut_partner_leads` |
| `category-domination` | `UTCategoryDomination.tsx` | ❌ | **0** | UI-ONLY | none |
| `global-supplier-control` | `UTGlobalSupplierControl.tsx` | ❌ | **0** | UI-ONLY | none |
| `event-spaces` | `UTEventSpaces.tsx` | ✅ | **0** | UI-ONLY | none |
| `virtual-tours` | `UTVirtualTours.tsx` | ✅ | 68 | **WORKING (shell data)** | `ut_virtual_tour_requests_pub` (0) |
| `platform-stats` | `UTPlatformStats.tsx` | ❌ | 5 | PARTIAL | `ut-get-platform-metrics` |
| `ambassadors` | `UTAmbassadorManagement.tsx` | ❌ | 23 | **WORKING** | `unforgettable_ambassadors` (4) |
| `business-requests` | `UTBusinessRequests.tsx` | ❌ | 7 | EMPTY | `ut_business_requests` (0) |
| `business-quotes` | `UTBusinessQuotes.tsx` | ❌ | 8 | EMPTY | `ut_business_quotes` (0) |
| `business-products` | `UTBusinessProducts.tsx` | ❌ | 4 | EMPTY | `ut_products` (0) |
| `business-packages` | `UTBusinessPackages.tsx` | ❌ | 4 | EMPTY | `ut_business_packages` (0) |
| `halls`,`vendors`,`rentals`,`party-bags`,`ai-builder` | `<Navigate>` redirects | ❌ | — | REDIRECT-ONLY | `AppRoutes.tsx:3978–3982` — `vendors` redirects to `/os/unforgettable/staff-management`, **which is not a registered route → 404** (BROKEN) |

**[CODE] `/uft/*` (separate console, 10 routes, none in Layout.tsx):** `/uft/dashboard`, `/revenue`, `/vendors`, `/ambassadors`, `/launch`, `/verification`, `/payouts`, `/suppliers`, `/recruiting`, `/ambassador-recruiting` — files `src/pages/uft/UFT*.tsx`. All 10 orphaned from the sidebar.

**Counts:** 105 UT hub routes; **34 pages contain zero `supabase` references (UI-ONLY)**; 11 in sidebar; 94 orphaned; 1 broken redirect.

---

## 2 — FULL TABLE INVENTORY (live counts, RLS)

**[DB]** All rows below are live `count(*)` results. **RLS is ON (`rowsecurity = t`) for every table listed.**

### Non-empty (14 tables)
| Table | Rows | Real or seed | Read by | Written by |
|---|---|---|---|---|
| `ut_partner_leads` | **2,757** | Real (scraper) | `UTLeadIntelligence`, `UTPlacesLeadFinder`, `UTAutoFinder` | `ut-lead-scraper`, `ut-places-search` |
| `ut_territory_jobs` | **465** | Real | `UTTerritoryControl` (not wired) | `ut-run-territory-job` |
| `ut_state_coverage` | 50 | Seed (50 states) | territory pages | seed |
| `ut_staff_categories` | 22 | Seed | `UnforgettableStaffCategories` | hook mutations |
| `ut_staff_category_kpis` | 22 | Seed | none found | trigger `auto_create_staff_category_kpi` |
| `ut_product_categories` | 18 | Seed | `UTProductOrganizer` (UI-only) | — |
| `ut_profiles` | 15 | Real/mixed | partner pages | onboarding |
| `ut_automation_schedule` | 9 | Seed | `UTAutomation` (UI-only) | — |
| `ut_vendor_pricing` | 8 | Seed | `UTPricingEngine` | `ut-pricing-engine` |
| `ut_campaigns` | 5 | Seed | `UTCampaignPerformance` | — |
| `staff_members_ut` | **5** | Real | `UTStaffManagement`, `UTStaffMemberDashboard` | `receive-ut-staff` |
| `event_halls` | **4** | Real | `UTVenuesManagement`, `UTHallOwnerDashboard` | `receive-ut-venue` |
| `unforgettable_ambassadors` | **4** | Real | `UTAmbassadorManagement` | `receive-ut-ambassador`, `submit-ut-ambassador` |
| `ut_lead_sources` / `ut_kit_weights` / `ut_shipping_rates` | 4 / 3 / 3 | Seed | various | — |
| `ut_event_bookings` | **3** | Real | `UTEventBookings` | `receive-event-booking` |
| `ut_ambassador_insights` / `ut_promotions` / `ut_staff` / `ut_staff_payments` | 1 each | Seed/test | limited | — |

**[DB] `ut_event_bookings` status breakdown:** `pending_payment` = 2, `deposit_received` = 1. **Zero bookings past deposit. Zero confirmed, staffed, completed, or paid.**

### EMPTY — 0 rows (86 tables, all UT core commerce)
`ut_bookings`, `ut_orders`, `ut_customers`, `ut_payments`, `ut_events`, `ut_event_staff`, `ut_event_builds`, `ut_event_packages`, `ut_event_requests`, `ut_staff_assignments`, `ut_staff_documents`, `ut_vendors`, `ut_vendor_payments`, `ut_vendor_blocked_dates`, `ut_venue_spaces`, `ut_suppliers`, `ut_supplier_*` (9 tables), `ut_partners`, `ut_partner_profiles`, `ut_partner_bookings`, `ut_partner_venue_profiles`, `ut_partner_venue_spaces`, `ut_partner_venue_packages`, `ut_partner_venue_availability`, `ut_partner_venue_media`, `ut_partner_rental_profiles`, `ut_partner_rental_items`, `ut_partner_rental_packages`, `ut_partner_rental_reservations`, `ut_partner_rental_item_media`, `ut_partner_food_profiles`, `ut_partner_food_media`, `ut_partner_food_availability`, `ut_partner_creative_*` (5), `ut_partner_services`, `ut_partner_service_packages`, `ut_partner_menus`, `ut_partner_menu_items`, `ut_partner_media`, `ut_partner_packages`, `ut_partner_analytics`, `ut_partner_availability`, `ut_partner_custom_requests`, `ut_partner_onboarding`, `ut_products`, `ut_listings`, `ut_listing_wizard`, `ut_rental_inventory`, `ut_catering_menus`, `ut_quotes`, `ut_quote_requests`, `ut_reviews`, `ut_sample_reviews`, `ut_leads`, `ut_recruiting_leads`, `ut_ambassador_payouts`, `ut_ambassador_referrals`, `ut_ambassador_prospects`, `ut_revenue_snapshots`, `ut_shipments`, `ut_shipping_quotes`, `ut_rfq_requests`, `ut_rfq_supplier_responses`, `ut_kit_orders`, `ut_brand_kits`, `ut_branding_requests`, `ut_business_requests`, `ut_business_quotes`, `ut_business_packages`, `ut_business_consultations`, `ut_quiz_results`, `ut_automation_runs`, `ut_outreach_log`, `ut_outreach_logs`, `ut_outreach_sequences`, `ut_growth_reports`, `ut_ai_*` (5), `ut_gscs_*` (2), `ut_category_*` (5), `ut_pub_*` (4), `ut_va_tasks`, `ut_user_favorites`, `ut_procurement_approvals`, `ut_domination_categories`, `ut_reorder_rules`, `ut_generated_packages`, `ut_package_items`, `ut_product_needs`, `ut_virtual_tour_requests_pub`, `event_staff`, `rental_partners`.

**Critical empties:** `ut_bookings` = 0, `ut_payments` = 0, `ut_staff_assignments` = 0, `ut_event_staff` = 0, `ut_vendors` = 0, `ut_vendor_payments` = 0, `ut_ambassador_payouts` = 0, `rental_partners` = 0.

### Table fork **[CODE + DB]**
Two parallel schemas exist for the same concepts and the hub reads the *older* one:
- Venues: hub reads `event_halls` (4 rows) — the newer `ut_partner_venue_profiles` is 0 rows.
- Staff: hub reads `staff_members_ut` (5) — `ut_staff` has 1 row.
- Vendors: `ut_vendors` (0) is what the Stripe Connect function targets; no UI writes it.
- Rentals: `rental_partners` (0) is the write target of `receive-ut-rental`; `ut_partner_rental_profiles` (0) is the newer schema. **Neither has data, and no hub page reads either.**

---

## 3 — FABRICATED KPIs (every one, with file + line + value)

### 3.1 `src/pages/os/unforgettable/UTPenthouse.tsx` — **0 supabase references in the entire 293-line file [CODE]**. Every number on the hub landing page is a string literal.

`KPI_CARDS` (lines 14–22):
| Line | Label | **Hardcoded value** | Hardcoded sublabel |
|---|---|---|---|
| 15 | Total Leads | `'2,847'` | `'+312 this week'` |
| 16 | Contacted | `'1,204'` | `'42% contact rate'` |
| 17 | Interested | `'387'` | `'32% interest rate'` |
| 18 | Onboarded | `'94'` | `'24% conversion'` |
| 19 | Active Listings | `'72'` | `'12 pending review'` |
| 20 | Conversion Rate | `'3.3%'` | `'Lead → Listing'` |

`FUNNEL` (lines 24–31): `New Leads 1643 (100%)`, `Contacted 1204 (73%)`, `Interested 387 (24%)`, `Onboarded 94 (6%)`, `Live Listing 72 (4%)` — all literals.

`ALERTS` (lines 43–48) — fabricated operational alerts that an operator would act on:
- L44 `'8 vendors stuck in onboarding > 7 days'`
- L45 `'143 leads not contacted in 48+ hours'`
- L46 `'12 listings blocked by marketplace gate'`
- L47 `'3 callback leads overdue'`

**Reality check [DB]:** `ut_partner_leads` = 2,757 (not 2,847 — close enough to look plausible, which makes it more dangerous). "Onboarded 94": `ut_partner_onboarding` = **0 rows**. "Active Listings 72": `ut_listings` = **0 rows**. "12 listings blocked": there are no listings at all. "8 vendors stuck in onboarding": `ut_vendors` = **0 rows**. Every alert is fiction.

### 3.2 Other dashboards with no data path (all numbers on-screen are literals) **[CODE — 0 supabase refs]**
`UTAnalytics.tsx`, `UnforgettableDashboard.tsx`, `UTIntelligenceCommandCenter.tsx`, `UTTerritoryControl.tsx`, `UTTerritoryIntelligence.tsx`, `UTMarketplaceControl.tsx`, `UTProductEngine.tsx`, `UTSupplierConsole.tsx`, `UTAutomation.tsx`, `UTEventBuilder.tsx`, `UTGrowthSimulator.tsx`, `UTShopDashboard.tsx`, `UTEmailSubscribers.tsx`, `UTCategoryDomination.tsx`, `UTGlobalSupplierControl.tsx`, `UTEventSpaces.tsx`, `UTOutreachCommand.tsx`, `UnforgettablePayroll.tsx`, `UnforgettableScheduling.tsx` (+ 3 sub-pages), `UnforgettablePerformance.tsx`, `UnforgettableAvailability.tsx`, `UnforgettableCommunications.tsx`, `UnforgettableMedia.tsx`, `UnforgettableDocuments.tsx`, `UnforgettableCustomerService.tsx`, `UnforgettableAICalling.tsx`, `UnforgettableOnboarding.tsx`, `UTProductOrganizer.tsx`.
**34 pages total.**

### 3.3 Synthetic staff generator **[CODE]**
`src/hooks/useUnforgettableStaff.ts:92–137` — `generateMockStaff()` fabricates **25 staff members** with invented names (Maria Rodriguez, Carlos Martinez…), `(555)` phones, `@unforgettable.com` emails, and **`Math.random()` performance metrics**: `events_completed: Math.floor(Math.random()*50)+5`, `rating: 4 + Math.random()`, `total_earnings: Math.floor(Math.random()*15000)+2000` (L129–131). Gated by `useSimulationMode()` (L4, L140, L145). **[INFERENCE]** When simulation mode is on, the staff roster, ratings and lifetime-earnings figures are random per render-cycle — that is fabricated payroll data.

---

## 4 — BOOKING PIPELINE, STAGE BY STAGE

| Stage | Real code? | Function / table | Evidence |
|---|---|---|---|
| **Received** | ✅ REAL | `supabase/functions/receive-event-booking/index.ts:59` → insert `ut_event_bookings` | **[CODE]** + **[DB]** 3 rows exist |
| **Quoted / priced** | ⚠️ PARTIAL | `ut-generate-event-plan`, `ut-pricing-engine`, `ut_quotes` (0 rows) | function exists, no output persisted |
| **Payment intent** | ⚠️ FORKED | `ut-process-booking-payment/index.ts:43,56` inserts `ut_pub_events` + `ut_bookings`, updates `ut_event_builds`; `ut-create-checkout` uses `ut_orders`/`ut_customers`/`ut_event_requests` | **[CODE]** — these functions write **`ut_bookings` (0 rows)**, not `ut_event_bookings` (the table the hub reads). Two disjoint booking systems. |
| **Confirmed** | ⚠️ CODE-ONLY | `ut-stripe-webhook/index.ts:29` sets `ut_bookings.status='confirmed'` | **[DB]** `ut_bookings` = 0 rows → this path has never fired |
| **Staffed** | ❌ **MISSING** | `ut_staff_assignments` (0), `ut_event_staff` (0) | no writer found anywhere |
| **Dispatched** | ❌ **MISSING** | no dispatch table, no function | see §5 |
| **Completed** | ❌ MISSING | no check-in/out writer (`ut_staff_assignments.check_in_time` column exists, unused) | **[DB]** column exists, table empty |
| **Paid (customer)** | ⚠️ | `ut-verify-payment`, `ut-process-refund` exist; `ut_payments` = 0 | never exercised |
| **Paid (vendor/staff)** | ❌ | `ut_vendor_payments` = 0, `ut_staff_payments` = 1 | see §6 |

**Where the pipeline stops being real:** immediately after intake. Live data reaches `ut_event_bookings` and stops at `deposit_received` (1 row). The payment functions write to a **different table family** (`ut_bookings` / `ut_orders`), so even a successful Stripe payment would not update the record the hub displays. **This is the single most damaging seam in the system.**

---

## 5 — STAFF MATCHING / DISPATCH — confirmed 0%

**What exists [CODE/DB]:**
- Table `ut_staff_assignments` — schema is well designed and complete: `id, staff_id, event_id, role_for_event, assignment_date, start_time, end_time, status, check_in_time, check_out_time, hours_worked, rate_applied, payment_status, amount_due, notes`. **0 rows. No INSERT found in `src/**` or `supabase/functions/**`.**
- Table `ut_event_staff` — 0 rows. **One read only:** `src/hooks/useUnforgettableStaffTabs.ts:260` (`.from('ut_event_staff')`). No write.
- Table `event_staff` — 0 rows. Read/write in `src/hooks/useEventInventory.ts:55,69,85` (list/insert/delete) — a generic inventory CRUD, **not matching logic**, and not wired to any UT hub route.
- `src/config/unforgettableStaffConfig.ts` — `STAFF_ROLES` registry with `defaultCategory: 'event_staff'` on ~14+ roles (L328–557). This is the **role taxonomy only**; it contains no matching function.
- `ut_staff_categories` (22 rows) + `ut_staff_category_kpis` (22 rows) — taxonomy and KPI definitions, unused by any matcher.

**What is absent (searched `src/` + `supabase/functions/` for `match*staff`, `assign*staff`, `dispatch`):**
- ❌ No `match-staff` / `ut-match-staff` edge function. **not found**
- ❌ No dispatch table (no `ut_dispatch*` table exists in the DB).
- ❌ No availability check against `ut_partner_availability` (0 rows) or `UnforgettableAvailability.tsx` (0 supabase refs).
- ❌ No geo/date/role scoring anywhere. The only `dispatch` string match in the whole UT page tree is `UTOutreachCommand.tsx` (a UI-only page).
- ❌ No staff notification/accept-decline flow. `UnforgettableStaffCall.tsx` and `UnforgettableStaffEmail.tsx` have **0 supabase references**.

**Verdict: dispatch = 0% built. Confirmed.**

**To build (minimum viable):** (1) `ut-match-staff` edge function taking `booking_id` → reads `ut_event_bookings.event_date/city`, `staff_members_ut` (role, location, status), `ut_partner_availability`, excludes conflicting `ut_staff_assignments`; (2) writes candidate rows to `ut_staff_assignments` with `status='offered'`; (3) `ut-dispatch-notify` (SMS/email) + accept/decline endpoint flipping `status` to `confirmed`/`declined`; (4) check-in/out mutations populating `check_in_time`/`hours_worked`/`amount_due`; (5) a real Dispatch Board UI (does not exist).

---

## 6 — PAYMENTS / PAYOUTS / COMMISSIONS

### Customer payment **[CODE]**
- `ut-process-booking-payment/index.ts:14–16` — requires `STRIPE_SECRET_KEY`, `apiVersion 2023-10-16`. **[INFERENCE]** live vs test depends entirely on which key is in the vault; the code has no mode assertion and no test-key guard.
- Platform split hardcoded at L64–65: `platform_fee = price * 0.15`, `vendor_payout = price * 0.85`. **[CODE]** 15% is a literal in the function, not a config table.
- `ut-create-checkout/index.ts:27,39,53,108` — writes `ut_orders`, `ut_customers`, `ut_event_requests`. **[DB]** all three = **0 rows** → never successfully completed.
- `ut-stripe-webhook/index.ts` — handles `payment_intent.succeeded` (L26–32), `payment_intent.payment_failed` (L48–50), `account.updated` (L53–57), `transfer.created` (L61–64). All write `ut_bookings` / `ut_vendors`, **both 0 rows → no webhook has ever landed a UT row.**
- `ut-verify-payment`, `ut-process-refund` exist as files; `ut_payments` = 0.

### Vendor/staff payouts
- Connect onboarding: `ut-stripe-connect-onboard/index.ts:18–30` — reads `ut_vendors`, calls `stripe.accounts.create`, stores `stripe_connect_id`. **[DB] `ut_vendors` = 0 rows → onboarding has never been run for a UT vendor; every call would 404 on `.single()`.**
- `payout-processor/index.ts` — this is the **shared/global** processor (`payout_batches` L53, `payout_batch_items` L80, real `https://api.stripe.com/v1/transfers` POST at L204, `payout_attempts` logging L197/229/244). It has a dry-run branch emitting `status: "would_pay"` (L191). It is **not UT-specific** and no UT page invokes it. `ut_vendor_payments` = 0, `ut_ambassador_payouts` = 0 → **UT payouts are bookkeeping-only today; zero transfers.**
- `UTPayoutManager.tsx` and `UTVendorPayments.tsx` read empty tables → both render empty states permanently.

### Commissions
- `ut-track-ambassador-sale/index.ts:27–43,78` — **real code**: tier-based rate (`order_amount * tierData.rate`), writes commission row, increments `total_earned`, sends an SMS (L70). **[DB]** `ut_ambassador_referrals` = 0 and `ut_ambassador_payouts` = 0 → **it has never fired in production.**
- Dynasty-cut / house commission: **not found.** No function, no table, no column computing a Dynasty share on UT revenue. The only split is the hardcoded 15% platform fee in `ut-process-booking-payment`.

---

## 7 — CATALOG (the "130+ roles / vendors / venues / rentals")

**[DB] Real counts:**
| Catalog | Table | Rows |
|---|---|---|
| Staff role taxonomy | `ut_staff_categories` | **22** (not 130) |
| Staff role definitions in code | `src/config/unforgettableStaffConfig.ts` `STAFF_ROLES` | ~40+ role keys **[CODE]** — code constant, **not in DB** |
| Actual staff people | `staff_members_ut` | **5** |
| Vendors | `ut_vendors` | **0** |
| Suppliers | `ut_suppliers` | **0** |
| Venues | `event_halls` | **4** |
| Venues (new schema) | `ut_partner_venue_profiles` | **0** |
| Rentals | `rental_partners` / `ut_partner_rental_items` | **0 / 0** |
| Services | `ut_partner_services` | **0** |
| Products | `ut_products` | **0** |
| Listings | `ut_listings` | **0** |
| Packages | `ut_event_packages` / `ut_partner_packages` | **0 / 0** |
| Product categories | `ut_product_categories` | 18 (seed) |

**Verdict:** there is no catalog. The "130+ roles" figure corresponds to nothing in the DB — the closest artifacts are 22 seeded categories and a ~40-role TypeScript constant. The sellable inventory (vendors, rentals, services, products, listings, packages) is **entirely 0 rows**.

**Hub vs public site:** forked. The hub reads `event_halls` / `staff_members_ut`; the newer `ut_partner_*` schema (intended for the public marketplace) is empty and unread by the hub. **[INFERENCE]** whichever surface the public site queries, the two will not agree.

---

## 8 — PUBLIC SITE ↔ HUB CONNECTION

**Same Supabase project** — the ingestion functions live in this repo and write this DB. **[CODE]** The seam is five `receive-*` edge functions:

| Function | Writes | Rows today **[DB]** |
|---|---|---|
| `receive-event-booking/index.ts:59` | `ut_event_bookings` | **3 — WORKING** |
| `receive-ut-staff/index.ts:33,46` | `staff_members_ut` | 5 |
| `receive-ut-venue/index.ts:32,45` | `event_halls` | 4 |
| `receive-ut-rental/index.ts:33,46` | `rental_partners` | **0** |
| `receive-ut-ambassador/index.ts:40,61` | `unforgettable_ambassadors` | 4 |

**Disconnects (evidence):**
1. **Inbound works, outbound doesn't.** Public bookings land in `ut_event_bookings` and `UTEventBookings.tsx` displays them ✅. But there is **no function or view exposing the hub catalog to the public site** — and the catalog is empty anyway (§7).
2. **Payment writes bypass the intake table.** `receive-event-booking` writes `ut_event_bookings`; `ut-process-booking-payment` writes `ut_bookings` (0 rows) and `ut_pub_events` (0 rows). A public booking that pays will never flip status on the record the operator sees.
3. `receive-ut-rental` has run 0 times (target table empty) → rental partners cannot enter the system.

---

## 9 — SECURITY

- **Route guarding [CODE]:** all 105 `/os/unforgettable/*` routes and all 10 `/uft/*` routes sit under `<Route element={<ProtectedLayout />}>` (`AppRoutes.tsx:3868`, `:3884`), and `ProtectedLayout` (L1245–1257) wraps children in `<RoleRouteGuard>`. So authentication + generic role gating is present. **There is no per-page UT role check** — no page in `src/pages/os/unforgettable/` imports `RoleRouteGuard` or an equivalent. **[INFERENCE]** Any user who clears the generic guard can reach payroll (`/payroll`), payouts (`/payout-manager`), vendor payments, and full customer PII on `/event-bookings`.
- **Partner/owner dashboards share the admin shell:** `UTHallOwnerDashboard` (`hall-dashboard`) and `UTStaffMemberDashboard` (`staff-dashboard`) are admin-hub routes with no ownership scoping visible in the route table — **[INFERENCE]** relies entirely on RLS being correct on `event_halls` / `staff_members_ut`.
- **RLS [DB]:** `rowsecurity = true` on **every** UT-prefixed table plus `event_halls`, `staff_members_ut`, `event_staff`, `unforgettable_ambassadors`. No UT table is RLS-off. Policy *correctness* was not evaluated in this pass — flagged as follow-up.
- **Secrets:** `STRIPE_SECRET_KEY` is read only via `Deno.env.get` inside edge functions (`ut-process-booking-payment:14`, `ut-create-checkout:62`, `ut-stripe-connect-onboard:12`, `payout-processor:35`). **No secret found in client code.** ✅
- **PII exposure:** `ut_event_bookings` holds `name, email, phone, budget, stripe_payment_intent_id` and is rendered in full on an unguarded-by-role page. `staff_members_ut` / mock staff include `dob`, home address, emergency contacts (`useUnforgettableStaff.ts:110–135`) — visible to any hub-authorized user.

---

## 10 — DEAD vs REAL ACTIONS

**Wholly dead surfaces (0 supabase refs — every button, filter, tab and "Save"/"Send"/"Run" on these pages is inert):**
`UTPenthouse` (6 Quick Action buttons at L33–40 navigate only; 4 Alert "action" links point at UI-only pages), `UTOutreachCommand` (call/SMS actions dead), `UnforgettableOnboarding` (approve/reject dead), `UTMarketplaceControl` (listing approve/block dead), `UTProductEngine`, `UTAutomation` (run-automation dead), `UTAnalytics`, `UTEventBuilder` (build/save event dead), `UTSupplierConsole`, `UTIntelligenceCommandCenter`, `UTTerritoryControl`, `UTTerritoryIntelligence`, `UnforgettableScheduling` + 3 sub-pages (assign/schedule dead), `UnforgettablePayroll` + detail (run-payroll dead), `UnforgettableAvailability`, `UnforgettablePerformance`, `UnforgettableCommunications`, `UnforgettableDocuments` + detail (upload dead), `UnforgettableMedia` + detail, `UnforgettableCustomerService`, `UnforgettableAICalling` + detail (start-call dead), `UnforgettableStaffCall` (call button dead), `UnforgettableStaffEmail` (send dead), `UnforgettableStaffNotes`, `UnforgettableStaffVenues`, `UnforgettableStaffPerformance`, `UTShopDashboard`, `UTProductOrganizer`, `UTEmailSubscribers`, `UTCategoryDomination`, `UTGlobalSupplierControl`, `UTEventSpaces`, `UTGrowthSimulator`, `UnforgettableDashboard`.

**Real, wired actions (confirmed writes/invokes):**
- `UTEventBookings.tsx` — reads/updates `ut_event_bookings` (5 supabase refs).
- `UTVenuesManagement.tsx` — CRUD on `event_halls` (6 refs).
- `UTStaffManagement.tsx` — CRUD on `staff_members_ut` (6 refs).
- `UTAmbassadorManagement.tsx` — 23 refs, invokes `approve-ut-ambassador` / insights functions.
- `UTLeadIntelligence.tsx` (9), `UTPlacesLeadFinder.tsx` (7 — invokes `ut-places-search`), `UTAutoFinder.tsx` (6).
- `UTVirtualTours.tsx` — 68 refs (heaviest wired page), but target table `ut_virtual_tour_requests_pub` = 0 rows.
- `UTGrowthEngine.tsx` (16), `UTSupplierInbox.tsx` (14), `UTPricingEngine.tsx` (11) — wired to **empty** tables → buttons execute but produce/return nothing.

**Broken:** `/os/unforgettable/vendors` → `<Navigate to="/os/unforgettable/staff-management">` (`AppRoutes.tsx:3979`) — that path is **not registered** → 404.

---

## 11 — SCORECARD

Build % = code exists. Operational % = would work for a real event today with real data.

| Area | Build % | Operational % | Justification |
|---|---|---|---|
| Catalog (vendors/venues/rentals/services) | 35% | **3%** | 4 venues, 0 vendors, 0 rentals, 0 services, 0 listings, 0 packages; two forked schemas (§7) |
| Vendor management | 25% | **0%** | `ut_vendors` = 0; Connect onboarding would fail on `.single()`; no vendor UI writes the table |
| Booking management | 55% | **20%** | Intake real (3 rows) + list UI real; payment functions write a different table family; 0 rows past `deposit_received` (§4) |
| Staff matching / dispatch | **0%** | **0%** | No matcher, no dispatch table, no assignment writer; `ut_staff_assignments`/`ut_event_staff` = 0 (§5) |
| Payments / payouts | 45% | **5%** | Stripe code real and complete-looking, but `ut_bookings`/`ut_orders`/`ut_payments`/`ut_vendor_payments` all 0 → never executed end to end (§6) |
| Ambassador | 60% | **15%** | 4 ambassadors, real mgmt UI + commission function, but 0 referrals and 0 payouts — commission code has never fired |
| Acquisition (leads/territory) | **80%** | **65%** | 2,757 real leads, 465 territory jobs, working scraper + Places search. Strongest area by far. |
| Dashboards / reporting | 30% | **0%** | Penthouse and 33 other pages are 100% literals; every headline KPI is fabricated (§3) |
| Security | 55% | 40% | Auth + generic RoleRouteGuard present; no per-page role scoping; RLS on everywhere but policies unverified; PII broadly visible |
| **OVERALL** | **~40%** | **~13%** | Acquisition is genuinely live; everything downstream of a lead — catalog, booking fulfilment, staffing, money — is empty or unwired |

---

## 12 — DEPENDENCY-ORDERED TASK LIST TO 100%

### CRITICAL — blocks running one real event end to end

1. **[DEV] Unify the booking table.** Pick `ut_event_bookings` as canonical. Rewrite `ut-process-booking-payment` (currently writes `ut_bookings`/`ut_pub_events`), `ut-create-checkout` (`ut_orders`), and `ut-stripe-webhook` (L29/50/64) to read/write `ut_event_bookings.status` + `stripe_payment_intent_id`. *Blocks 2,3,5,6.*
2. **[OWNER] Confirm Stripe mode.** Verify `STRIPE_SECRET_KEY` is a live key and webhook endpoint is registered for `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `transfer.created`. *Blocks 3.*
3. **[DEV] End-to-end payment test** on a real `ut_event_bookings` row: intent → paid → `status='confirmed'` → row visible in `UTEventBookings.tsx`. *Depends 1,2.*
4. **[DEV] Build `ut-match-staff` edge function** — input `booking_id`; scores `staff_members_ut` by role (`ut_staff_categories`), city/state, `event_date`; excludes conflicts in `ut_staff_assignments`; writes candidates with `status='offered'`. *Depends 1.*
5. **[DEV] Build dispatch loop** — `ut-dispatch-notify` (SMS/email offer) + public accept/decline endpoint flipping `ut_staff_assignments.status`; escalation on no-response. *Depends 4.*
6. **[DEV] Build Dispatch Board UI** at `/os/unforgettable/dispatch` (does not exist) showing bookings × assignment status; register it in `Layout.tsx`. *Depends 4,5.*
7. **[DEV] Check-in/out + completion** — mutations writing `check_in_time`, `check_out_time`, `hours_worked`, `amount_due`; flips booking to `completed`. *Depends 5.*
8. **[DEV] Kill or replace fabricated Penthouse KPIs** (`UTPenthouse.tsx:14–48`). Replace all 6 KPI cards, 5 funnel stages and 4 alerts with live counts (`ut_partner_leads`, `ut_event_bookings`, `ut_partner_onboarding`, `ut_listings`) — or ship an explicit "No data" state. An operator acting on "8 vendors stuck in onboarding" when `ut_vendors` = 0 is the top real-world risk. *No dependencies — do immediately.*
9. **[DEV] Fix broken redirect** `AppRoutes.tsx:3979` → `/os/unforgettable/staff-management` (404). Point at `/os/unforgettable/staff`.

### HIGH

10. **[DEV] Resolve the schema fork** — decide `event_halls` vs `ut_partner_venue_profiles`, `staff_members_ut` vs `ut_staff`, `rental_partners` vs `ut_partner_rental_profiles`; migrate the 4+5 real rows; delete the losing tables. *Blocks 11,12.*
11. **[OWNER] Load the catalog** — real vendors into `ut_vendors` (0), rentals (0), services (0), packages (0). Nothing downstream is sellable until this exists.
12. **[DEV] Vendor onboarding UI** that actually inserts `ut_vendors`, then wire `ut-stripe-connect-onboard` (currently guaranteed to fail on an empty table). *Depends 10,11.*
13. **[DEV] Wire vendor/staff payouts** — connect `UTPayoutManager`/`UTVendorPayments` to `payout-processor` (`payout_batches`/`payout_batch_items`) with a dry-run gate. *Depends 12, 7.*
14. **[DEV] Delete or disable `generateMockStaff()`** (`useUnforgettableStaff.ts:92–137`) for any non-simulation environment; random ratings/earnings must never render alongside real staff.
15. **[DEV] Per-page role guards** on `/payroll`, `/payout-manager`, `/vendor-payments`, `/event-bookings`, `/documents`, `hall-dashboard`, `staff-dashboard`.
16. **[DEV] RLS policy review** on `ut_event_bookings`, `staff_members_ut`, `event_halls`, `unforgettable_ambassadors` — confirm partner/staff dashboards cannot read other owners' rows.

### MEDIUM

17. **[DEV] Register the ~20 genuinely useful orphaned routes** in `Layout.tsx:439–453` (`event-bookings`, `venues`, `staff`, `scheduling`, `payroll`, `ambassadors`, `leads`, `payout-manager`, `revenue-dashboard`) — 94/105 routes are currently unreachable via the UI.
18. **[DEV] Wire the 34 zero-supabase pages or remove them.** Shipping 34 fake consoles inflates perceived completeness and creates 34 dead-button surfaces.
19. **[DEV] Ambassador commission activation** — wire `ut-track-ambassador-sale` into the confirmed-payment path so `ut_ambassador_referrals` starts populating. *Depends 3.*
20. **[OWNER/DEV] Define the Dynasty cut.** Currently only a hardcoded 15% platform fee (`ut-process-booking-payment:64`). Move to a config table and add the Dynasty split — **currently not found anywhere.**
21. **[DEV] Quotes pipeline** — `ut_quotes`/`ut_quote_requests` (0) have no writer; `ut-send-quote-notification` has nothing to send.
22. **[DEV] Decide the fate of `/uft/*`** (10 orphaned routes, separate console duplicating vendors/ambassadors/payouts/suppliers).

### LOW

23. **[DEV] Consolidate duplicate tables** `ut_outreach_log` vs `ut_outreach_logs` (both 0).
24. **[DEV] Consolidate `UTSupplierInbox` vs `UTSupplierInboxV2`**, `UTNegotiationAgent` vs `UTNegotiationDashboard`.
25. **[DEV] Reviews/virtual tours** — `UTVirtualTours.tsx` is the most-wired page (68 refs) against a 0-row table; either seed it or deprioritize.
26. **[DEV] Prune the ~86 empty `ut_*` tables** that no code reads, to reduce schema noise.

---

## Bottom line

**Acquisition is real** (2,757 leads, 465 territory jobs, working scraper). **Intake is real** (3 bookings). **Everything between "a lead exists" and "an event happened and everyone got paid" is either empty, forked onto a second unused schema, or a hardcoded string.** The most urgent item is not a feature — it is item 8: the hub's landing page reports six KPIs, five funnel stages and four operational alerts that are all invented, several describing entities (vendors, listings, onboarding records) of which the database contains exactly zero.
