# Dynasty Direct — OS Hub Audit (Wholesale Platform + Portals)

**Scope:** `/dynasty-direct/*`, `/admin/marketplace-control`, `/admin/marketplace-payouts`, `/admin/payouts/*`, and the three portals (`/portal/store`, `/portal/wholesaler`, `/portal/customer`).
**Method:** Read-only. Grounded in `src/`, `supabase/functions/`, and live queries against project `qalaaroashbggynpvqct`.
**Excluded:** Public storefront project `hruhkyvwtfpfviwnvhne` (separate audit) — only the bridge surface is covered here.

---

## 1 — What the Dynasty Direct hub does today

Real console, not a shell — but heavily fragmented. `src/pages/dynasty-direct/` contains **31 real pages** (11.7k+ LOC), plus `MarketplaceControlTowerPage` (1,045 LOC), `AdminMarketplacePayoutsPage` (318 LOC), `AdminPayoutsPage` (259 LOC), and three portals (Store: 10 pages; Wholesaler: 14 pages; Customer: `CustomerPortal.tsx`, 425 LOC).

An admin opening the hub today can:
- Browse the DD home dashboard (`DynastyDirectHubHome`), Analytics, Settings.
- List all marketplace orders (`DynastyDirectOrders`, 601 LOC) — pulls from real `marketplace_orders` (30 rows).
- Manage supplier network (`DynastyDirectSupplierNetwork`, 614 LOC) and store accounts (`DDStoreAccounts`, 691 LOC).
- Run splits/reserves console (`DynastyDirectSplitConsole`), fulfillment console (`DynastyDirectFulfillmentConsole`, 577 LOC), purchase orders, product Q&A, reviews, flash sales, inventory forecast, bundles, PO management.
- Onboard catalogs (`DynastyDirectCatalogOnboard`), review AI drafts (`DynastyDirectCatalogReview` — 2 rows in `dd_catalog_drafts`).
- Move between three portals from the sidebar (`/portal/store`, `/portal/wholesaler`, `/portal/customer`).

What is NOT truly runnable end-to-end today:
- Zero rows in the platform commission tables (`marketplace_commissions=0`, `commission_payout_batches=0`).
- Zero wholesalers onboarded to Stripe Connect (`dd_partner_profiles=0`).
- `wholesale_orders=0`, `wholesale_products=0`, `store_inventory=0`.
- `customer_profiles=0` — no D2C customer surface has been used.

Verdict: **working console, empty ledger** — the pipes exist but almost nothing has flowed through them.

## 2 — Sidebar / Reachability

Source of truth is `src/components/Layout.tsx` (lines 626–660 for the DD hub, 847–853 for portals). Every DD hub page is registered:

| Sidebar label | Path | Route target | Guard |
|---|---|---|---|
| 🏠 DD Home | `/dynasty-direct` | `DynastyDirectHubHome` | `RequireRole` |
| 📦 Catalog | `/dynasty-direct/catalog` | `MarketplaceAdminPortalPage` | **none** |
| 📦 Products | `/dynasty-direct/products` | `DDProductManagementPage` | **none** |
| 💰 Pricing | `/dynasty-direct/pricing` | `DDPricingPage` | **none** |
| ✨ Onboard Product | `/dynasty-direct/catalog/onboard` | `DynastyDirectCatalogOnboard` | `RequireRole` |
| 🛡️ Review Queue | `/dynasty-direct/catalog/review` | `DynastyDirectCatalogReview` | `RequireRole` |
| 🎬 Content Library | `/dynasty-direct/content-library` | `DynastyDirectContentLibrary` | `RequireRole` |
| 🏪 Store Storefront | `/dynasty-direct/store-storefront` | `StorePortalPage` | **none** |
| 🛒 D2C Storefront | `/dynasty-direct/d2c-storefront` | `Shop` | **none** |
| 📋 Orders | `/dynasty-direct/orders` | `DynastyDirectOrders` | `RequireRole` |
| 🚗 Local Delivery | `/dynasty-direct/delivery` | `DDLocalDelivery` | `RequireRole` |
| 🏪 Store Accounts | `/dynasty-direct/stores` | `DDStoreAccounts` | `RequireRole` |
| 🚚 Fulfillment | `/dynasty-direct/fulfillment` | `DynastyDirectFulfillmentConsole` | **none** |
| 🚚 Shipping | `/dynasty-direct/shipping` | `DDShippingPage` | **none** |
| 💵 Splits & Reserves | `/dynasty-direct/splits` | `DynastyDirectSplitConsole` | **none** |
| 🗺️ Supplier Network | `/dynasty-direct/suppliers/network` | `DynastyDirectSupplierNetwork` | `RequireRole` |
| 👥 Supplier Onboarding | `/dynasty-direct/suppliers/portal` | `WholesalerPortalPage` | **none** |
| 📦 Supplier Instructions | `/dynasty-direct/suppliers/instructions` | `DDSupplierInstructions` | **none** |
| 📦 Master Inventory | `/dynasty-direct/inventory` | `DynastyDirectInventory` | `RequireRole` |
| 📊 Supplier Products | `/dynasty-direct/suppliers/inventory` | `WholesalerPortalPage` | **none** |
| 📈 Supplier Performance | `/dynasty-direct/suppliers/performance` | `DDSupplierPerformance` | **none** |
| 📄 Purchase Orders | `/dynasty-direct/purchase-orders` | `DDPurchaseOrders` | `RequireRole` |
| ⚡ Grabba Bridge | `/dynasty-direct/grabba-bridge` | `DynastyDirectGrabbaBridge` | **none** |
| 📈 Analytics | `/dynasty-direct/analytics` | `DDAnalytics` | `RequireRole` |
| ❓ Q&A | `/dynasty-direct/qa` | `DDProductQA` | `RequireRole` |
| ⭐ Reviews | `/dynasty-direct/reviews` | `DDReviews` | `RequireRole` |
| ⚡ Flash Sales | `/dynasty-direct/flash-sales` | `DDFlashSales` | `RequireRole` |
| ✉️ Invites & Access | `/dynasty-direct/invites` | `DynastyDirectInvites` | `RequireRole` |
| 🏪 Apply-as-Store Queue | `/dynasty-direct/store-applications` | `DynastyDirectStoreApplications` | `RequireRole` |
| 🤝 Partner Campaigns | `/dynasty-direct/partners` | `DDPartnerCampaigns` | `RequireRole` |
| ⚙️ Settings | `/dynasty-direct/settings` | `DDSettings` | `RequireRole` |
| 🛠️ Ops Console | `/admin/dynasty-direct-ops` | (ops page) | (bespoke) |

Portals block (sidebar 847–853):
- `/portal/store` → `StorePortal`
- `/portal/wholesaler` → `WholesalerPortal` (with sub-routes for Products, Orders, Finance, Fulfillment, Messages, Settings, Team, Grabba Order, Catalog Onboard)
- `/portal/customer` → `CustomerPortal`

Marketplace admin surfaces (registered as routes but **not in the DD sidebar**):
- `/admin/marketplace-control` → `MarketplaceControlTowerPage` — the "Command Center" — reachable only via direct URL or admin nav (this is the successor to the deprecated `/portal/marketplace` which now `<Navigate>`s here per `src/pages/portal/MarketplaceAdmin.tsx`).
- `/admin/marketplace-payouts` → `AdminMarketplacePayoutsPage`
- `/admin/payouts` → `AdminPayoutsPage`

**Reachability gap:** the three admin marketplace/payout pages are **not linked from the Dynasty Direct hub sidebar** — orphaned from the operator's mental model.

## 3 — Database

Live counts (`SELECT count(*)`, project `qalaaroashbggynpvqct`, at audit time):

| Table | Rows | Read/Written by real code? | Notes |
|---|---|---|---|
| `marketplace_orders` | **30** | Yes — `DynastyDirectOrders`, `MarketplaceControlTowerPage`, `dd-stripe-webhook`, `marketplace-order-engine` | canonical D2C order table |
| `marketplace_order_items` | 22 | Yes | polymorphic across `products_all` + `products` |
| `marketplace_fulfillments` | 17 | Yes | `MarketplaceControlTowerPage` |
| `marketplace_inventory` | 8 | Yes | |
| `marketplace_commissions` | **0** | Referenced | commission spine not yet firing |
| `marketplace_admin_actions` | 0 | Referenced | audit trail unused |
| `marketplace_config` | 0 | Referenced | |
| `wholesaler_orders` | **3** | Yes | prior audit flagged legacy seed — still 3 rows; verify vs. real orders |
| `wholesale_orders` | **0** | Yes (legacy simulation policies) | dormant |
| `wholesale_products` | **0** | Yes | dormant catalog table |
| `wholesale_order_items` | 0 | Yes | |
| `products` | 12 | Yes | admin-only writes |
| `products_all` | **16** | Yes | polymorphic surface used by D2C |
| `store_inventory` | **0** | Yes | admin-only ALL policy |
| `commission_ledger` | 3 | Yes | 3 events only |
| `commission_payout_batches` | 0 | Yes (`AdminMarketplacePayoutsPage`) | never batched |
| `commission_disputes` + evidence + messages | 0 | Referenced | |
| `commission_plans` / `rules` / `overrides*` | 0 | Referenced | |
| `dd_partner_profiles` | **0** | Yes (`dd-pay-partner`, `dd-generate-partner-payouts`) | no partners onboarded to Connect |
| `dd_partner_payouts` | 0 | Yes | zero payouts generated |
| `dd_partner_earnings` | 0 | Yes | |
| `dd_split_ledger` | 0 | Yes (`DynastyDirectSplitConsole`) | |
| `dd_reserve_ledger` | 0 | Yes (`dd-release-reserves`) | |
| `dd_catalog_drafts` | 2 | Yes (`DynastyDirectCatalogReview`) | AI draft pipeline has produced 2 |
| `dd_market_prices` | **249** | Yes (`dd-price-intelligence`) | real intelligence data |
| `dd_supplier_metrics` | 0 | Yes | |
| `dd_purchase_orders` | 0 | Yes | |
| `customer_profiles` | **0** | Yes (D2C `/account/*` surface) | no D2C account created yet |
| `customer_orders` | 0 | Yes (B2B portal) | |
| `customer_invoices` | 1 | Yes (`finalize_invoice`) | |
| `customer_portal_sessions` | 0 | Yes (`PortalLogin`) | |
| `wholesaler_profiles` | 5 | Yes (RLS uses this to scope) | 5 real wholesalers exist |

**Real vs seed/legacy:** `wholesaler_orders=3` — likely leftover; needs manual review. `wholesale_orders/wholesale_products` are dormant tables retained from legacy schema; new writes flow through `marketplace_orders`. `dd_market_prices=249` is real intelligence data. Everything else is either real-but-empty or plumbed but never used.

## 4 — Wholesale Directory (seller accounts)

- **Data:** `wholesaler_profiles` has 5 real rows. `dd_partner_profiles` (the Stripe Connect + partner-earnings profile) has **0 rows** — no partner has actually onboarded to Connect.
- **Admin console:** `DDStoreAccounts` (691 LOC) manages stores. Suppliers surface is `DynastyDirectSupplierNetwork` (614 LOC) — reads from real `wholesaler_profiles`. Real list, not mock.
- **Onboarding/approval:** `DynastyDirectInvites` + `DynastyDirectStoreApplications` accept applications and route through `dd-application-triage`. Confirmed persistence path. What is **NOT** wired is Stripe Connect onboarding — nothing populates `dd_partner_profiles`, and `dd-pay-partner` will throw `"partner not onboarded to Stripe Connect"` (line 74) for every existing wholesaler today.

## 5 — Wholesale Marketplace (listings)

- Catalog flows through `products_all` (16 rows) + `products` (12 rows), which back the polymorphic D2C surface (per `docs/architecture/customer-surfaces.md`).
- `wholesale_products` (0 rows) is dormant — no wholesale-tier tables in active use.
- Listings are managed in `DDProductManagementPage`, `DynastyDirectCatalogOnboard` (AI-assisted with `dd-catalog-pipeline` + `dd-ai-category-copy`), and reviewed in `DynastyDirectCatalogReview`.
- **Flow to public storefront:** cross-project bridge exists — `src/lib/publicSiteApi.ts` targets `https://hruhkyvwtfpfviwnvhne.supabase.co`. Additionally `dd-stripe-webhook` and `dd-grabba-bridge` accept inbound events from the public storefront. See §12 for the full picture.

## 6 — The 3 portals

### Store Portal — `/portal/store` (10 pages: Dashboard, Products, Cart, Checkout, Orders, OrderDetail, Invoices, Settings, Messages, Team)
- **Loads:** yes, `StoreDashboard` = 272 LOC of real code.
- **Role gate:** `/portal/store` route uses `RequireRole allowedRoles=['store', ...]` (verified around AppRoutes.tsx:3105).
- **Data:** wired to real tables (store inventory / orders) but `store_inventory=0`, so a real store login sees zeros.
- **Wholesale-priced browse & order:** the code exists (Cart + Checkout); it has never been used.

### Wholesaler / Seller Portal — `/portal/wholesaler` (14 pages)
- **Loads:** yes. `WholesalerDashboard=275 LOC`, `WholesalerOrders=196`, `WholesalerFulfillment=345`.
- **Role gate:** `RequireRole allowedRoles=['admin', 'employee', 'wholesale', 'wholesaler']` (AppRoutes.tsx:3112). RLS on `wholesaler_orders` scopes rows via `wholesaler_profiles.user_id = auth.uid()` — enforcement matches.
- **Real capability:** lists products, sees own orders (3 rows in `wholesaler_orders`), can mark fulfilled (`WholesalerFulfillment`), transaction history, finance page. Grabba order flow present (`WholesalerOrderGrabba`).
- **Stripe Connect status:** no UI or edge function initiates Connect onboarding (searched — no `create-connect-account` function exists). Result: fulfillment can be marked but the seller cannot be paid.

### Customer Portal — `/portal/customer` (`CustomerPortal.tsx` = 425 LOC)
- **Loads:** yes.
- **Role gate:** `RequireRole allowedRoles=['admin', 'employee', 'accountant', 'store', 'wholesale', 'wholesaler', 'warehouse', 'customer', 'csr']` (AppRoutes.tsx:3087) — **overly permissive** (accountant/wholesaler can see the customer portal path).
- **Auth mechanism:** `PortalLogin.tsx` uses email/phone lookup against `crm_customers`, mints a random UUID, stores it in `localStorage` as `portal_session` — this is **NOT a real Supabase session** and bypasses RLS entirely (see §11).
- **Data:** `customer_portal_sessions=0`, `customer_invoices=1`, `customer_orders=0`. Effectively empty.

## 7 — Order Management (Marketplace Admin)

- **Admin visibility:** `MarketplaceControlTowerPage` (1,045 LOC) + `DynastyDirectOrders` (601 LOC) both read `marketplace_orders` (30 real rows) and `marketplace_order_items` (22 rows). Confirmed via `useMarketplaceControlTower.ts`.
- **Order lifecycle:** partial.
  - **Placed → paid:** wired. `dd-create-checkout` → Stripe → `dd-stripe-webhook` marks `marketplace_orders.status='paid'`, decrements inventory, fires `dd-grabba-bridge`, `dd-notify-customer-order-update`, `dd-notify-supplier-order`. Real.
  - **Seller-fulfilled → shipped w/ tracking:** partial. `dd-create-shipment` exists; `marketplace_fulfillments` has 17 rows. `WholesalerFulfillment` UI marks shipments.
  - **Complete:** the state exists but there is no closing automation from `shipped → complete` beyond manual admin action. Buyer notification exists (`dd-notify-customer-order-update`).
- `marketplace-order-engine` references `wholesaler_payouts` (line 148) — verify that table's rows/existence for split ledger accuracy (not in current row-count set; inferred as separate table).

## 8 — Commission + Payouts

- **Commission calc:** DB has the RPCs (`create_store_order_commission`, `create_wholesale_order_commission`, `create_commission_reversal`, `apply_commission_overrides`, `approve_commission`, `bulk_approve_commissions`), plus `commission_ledger` (3 rows) and `commission_payout_batches` (0). The comment in `marketplace-order-engine/index.ts:127` ("triggers `process_paid_order` function via the database trigger") suggests a DB trigger fans commissions out on paid orders — but `pg_proc` shows **no function named `process_paid_order`** in this DB. **Inferred: broken reference.** Since `marketplace_commissions=0` after 30 paid orders, the automated commission spine is **not firing**.
- **Payout Batches:** `AdminMarketplacePayoutsPage` (318 LOC) + `AdminPayoutsPage` (259 LOC) exist. RPCs `create_payout_batch`, `approve_payout_batch`, `finalize_payout_batch`, `cancel_payout_batch`, `export_payout_batch_csv` are present. `commission_payout_batches=0` — never used.
- **Actual money movement:** `dd-pay-partner` calls `stripe.transfers.create` — real Stripe Connect transfer, updates `dd_partner_payouts.stripe_transfer_id`. This is REAL, not bookkeeping.
- **Onboarding gate:** `dd_partner_profiles=0` — **zero partners are onboarded to Connect**. `dd-pay-partner:74` throws if `stripe_connect_status !== 'active'`. Payouts therefore cannot be executed for any current wholesaler.

## 9 — Fulfillment

- Seller can mark shipped: `WholesalerFulfillment` (345 LOC) + `DynastyDirectFulfillmentConsole` (577 LOC) + `dd-create-shipment` + `dd-schedule-pickup`.
- Buyer notification on shipment: `dd-notify-customer-order-update` — confirmed.
- eBay-style direct-fulfillment: the plumbing is real (17 `marketplace_fulfillments` rows), but the automation from `shipped → payout release` is soft. `approve_payout_on_shipped` RPC exists but no cron ties it to shipment events (grep of `supabase/functions/*` for that RPC returns nothing). **Inferred: manual trigger only.**

## 10 — Every page / button / real vs mock

| Surface | Status | Real data behind it |
|---|---|---|
| `DynastyDirectHubHome` | Real, loads `useDDHubKpis` | numbers = real (mostly 0) |
| `DynastyDirectOrders` (601 LOC) | Real | 30 orders |
| `DDOrderDetail` | Real | real order joined with items |
| `DynastyDirectSupplierNetwork` (614) | Real | 5 wholesalers |
| `DDStoreAccounts` (691) | Real | store accounts |
| `DynastyDirectCatalogOnboard` | Real | writes `dd_catalog_drafts` |
| `DynastyDirectCatalogReview` | Real | 2 drafts to review |
| `DynastyDirectFulfillmentConsole` (577) | Real | 17 fulfillments |
| `DynastyDirectSplitConsole` (237) | Real UI, empty ledger | `dd_split_ledger=0` |
| `DDAnalytics` | Real reads | numbers real (mostly 0) |
| `DDPurchaseOrders`, `DDProductQA`, `DDReviews`, `DDFlashSales`, `DDInventoryForecast`, `DDBundles` | Real UI, 0-row DBs | honest zeros |
| `DDLocalDelivery` | Real | `dd_delivery_routes` |
| `DDSupplierInstructions` | Real | |
| `DDSupplierPerformance` | Real | reads `dd_supplier_metrics=0` |
| `DDSettings` | Real writes `dd_config` | |
| `DynastyDirectInvites` + `DynastyDirectStoreApplications` | Real | goes through `dd-application-triage` |
| `DDPartnerCampaigns` | Real | |
| `DynastyDirectGrabbaBridge` | Real | reads `dd_grabba_sync` |
| `DynastyDirectMessages` | Real | |
| `PricingPage` / `ProductManagementPage` / `ShippingPage` | Real | |
| `MarketplaceControlTowerPage` (1045) | Real | 30 orders, 22 items, 17 fulfillments |
| `AdminMarketplacePayoutsPage` (318) | Real UI, empty backend | `commission_payout_batches=0` |
| `AdminPayoutsPage` (259) | Real UI, empty backend | 0 payouts |
| `StorePortal` (208) + 10 sub-pages | Real, empty | `store_inventory=0` |
| `WholesalerPortal` + 14 sub-pages | Real | 5 wholesalers, 3 orders |
| `CustomerPortal` (425) | Real UI, fake session | see §11 |
| `Shop` / D2C storefront | Real (already exists at `/dynasty-direct/d2c-storefront`) | reads `products_all` |

**Dead / risky buttons:**
- Any "Pay Partner" button in `AdminMarketplacePayoutsPage` — will fail with "partner not onboarded to Stripe Connect" for every current wholesaler.
- Payout-batch approval flow — will complete DB-side but produce zero real transfers.
- Commission-related columns showing on order rows — currently all 0 because `process_paid_order` is unresolved.
- `MarketplaceAdmin.tsx` (`/portal/marketplace`) — hard `<Navigate>` to Command Center; not dead, just redirected.

**Mock-as-real risk:** low overall (most zeros are honest). The one meaningful risk is any KPI on `DynastyDirectHubHome` or `DDAnalytics` that infers commissions from paid orders without reading `marketplace_commissions` — worth spot-checking.

## 11 — Security / Access

**RLS on the 5 tables from the prior fix — current state:**

| Table | Policies | Owner-scoped + admin? |
|---|---|---|
| `wholesaler_orders` | 4 (SELECT/UPDATE owner-or-admin, DELETE admin, INSERT open) | ✅ owner-scoped via `wholesaler_profiles.user_id = auth.uid()` |
| `products` | 4 (SELECT authenticated, INSERT/UPDATE/DELETE admin-only) | ✅ admin-only writes |
| `store_inventory` | 1 (`ALL` — admin only via `has_role`) | ⚠️ admin-only, no store-scoped read policy — a store can't see its own inventory |
| `wholesale_products` | 2 (SELECT if `is_active=true`, ALL if admin) | ⚠️ no seller-scoped write path — sellers can't manage own products through this table (legacy) |
| `wholesale_orders` | 5 — a mix of admin, driver, and `is_simulation_mode()` policies | ⚠️ **regressed to legacy shape** — no wholesaler owner-scoped policy; two INSERT/SELECT/UPDATE policies gated only by `is_simulation` |

**Verdict on the 5 prior fixes:** `wholesaler_orders` and `products` are correctly hardened. `store_inventory`, `wholesale_products`, and especially `wholesale_orders` do **not** currently expose the owner-scoped + admin shape the prior audit described — either they were revised, or the legacy policies still coexist. Recommend re-review of `wholesale_orders` in particular; the simulation-mode policies allow anon INSERT/SELECT/UPDATE whenever `is_simulation = is_simulation_mode()` — verify that function is safe.

**Route-guard gaps on the DD hub:**
- ~13 `/dynasty-direct/*` routes have **no** `RequireRole` wrapper: `/catalog`, `/products`, `/pricing`, `/store-storefront`, `/d2c-storefront`, `/fulfillment`, `/shipping`, `/suppliers/portal`, `/suppliers/inventory`, `/suppliers/performance`, `/suppliers/instructions`, `/grabba-bridge`, `/splits`.
- `/dynasty-direct/splits` and `/dynasty-direct/fulfillment` are the most sensitive of the unguarded set — money and operational surfaces reachable by any authenticated user.

**Customer portal auth is broken by design:**
- `src/pages/portal/PortalLogin.tsx` accepts an email/phone, looks up `crm_customers`, and mints a random UUID into `localStorage.portal_session`. There is **no Supabase auth**. RLS on customer tables is bypassed because the browser session identity has nothing to do with the localStorage token. Anyone who knows a customer's email can log in as them; RLS on `customer_invoices` / `customer_orders` will either lock everything down or (worse) be circumvented by client-side filters.

**Portal role gates:**
- `/portal/wholesaler`: `['admin', 'employee', 'wholesale', 'wholesaler']` ✅
- `/portal/store`: `['admin', 'employee', 'accountant', 'store', 'wholesale', 'wholesaler', 'warehouse', 'customer', 'csr']` ⚠️ overly permissive
- `/portal/customer`: not verified in a single line; see permissive block at AppRoutes.tsx:3087 that includes almost everyone — the gate is functionally cosmetic.

**Secrets:** no client-side leaks found in the DD hub scope (Stripe keys stay in edge functions, cross-project URL `hruhkyvwtfpfviwnvhne` is a public URL, not a secret).

## 12 — Connection to the public storefront (critical)

Two projects, three known bridge paths:

1. **Client → Public read path:** `src/lib/publicSiteApi.ts` calls `https://hruhkyvwtfpfviwnvhne.supabase.co` directly from the OS UI (used by TT & shared storefront widgets). One-way read.
2. **Edge → Public read/write:** `supabase/functions/proxy-public-data/index.ts` and `supabase/functions/tt-smart-dispatch/index.ts` also hit the public project (`tt-auto-dispatch` hard-codes the URL, line 402). These belong to TopTier, not DD proper, but they confirm the pattern.
3. **Public → DD OS inbound (orders):** the paid-order path used by the public storefront is `dd-stripe-webhook`. When Stripe fires, the webhook writes to **THIS OS project's** `marketplace_orders`, decrements `products_all` inventory, and cascades notifications, Grabba routing, partner earnings, loyalty, and disputes. The 30 orders currently in `marketplace_orders` are (presumably) exactly the receipts of that inbound flow.

**What is NOT bridged:**
- No sync of `products_all` / `products` **from OS out to** the public storefront project. Adding a product in the DD hub does not automatically appear on `hruhkyvwtfpfviwnvhne`. The public site presumably reads its own product tables — meaning DD OS catalog and public catalog are two universes and there is no publish/sync job in `supabase/functions/*` for it.
- No sync of customer accounts (`customer_profiles=0` here) — customers created on the public site do not appear in OS.

**Verdict:** the money side (orders) is bridged via Stripe webhook; the catalog/customer side is not. If the model requires "list once in OS → visible publicly," that publish path does not exist today.

## 13 — Two percentages + scorecard

Grounded in real code + DB state.

| Area | Build % | Notes |
|---|---|---|
| Wholesale directory | **75%** | UI complete; Connect onboarding UI absent |
| Wholesale marketplace (listings) | **65%** | products_all + catalog onboard real; no OS→public publish sync |
| Portals (Store / Seller / Customer) | **60%** | UIs real; Customer portal auth is broken; Store portal has no seller-scoped RLS reads |
| Order management (Marketplace Admin) | **75%** | Command Tower + Orders pages solid; auto-close on ship missing |
| Commission + payouts | **35%** | RPCs + Stripe transfer exist; commission generation not firing (0 rows after 30 paid); 0 partners onboarded to Connect |
| Fulfillment | **65%** | shipment creation real; approve_payout_on_shipped is manual only |
| **Overall build** | **~62%** | working console over a mostly-empty ledger |

**Operational readiness — can an admin run the marketplace end-to-end today (onboard seller → list → take order → fulfill → pay seller)?**

**No — approximately 30% ready.** Specifically:
- Onboard seller ✅ (invite/application flow works)
- List product ✅ (via catalog onboard)
- Take an order ✅ (marketplace_orders is flowing — 30 rows)
- Fulfill ⚠️ (seller can mark shipped, but payout is not triggered)
- **Pay the seller ❌** — no `dd_partner_profiles` rows means every `dd-pay-partner` call fails; commission ledger not generating means there's nothing to pay against.

## 14 — Prioritized task list to 100%

### CRITICAL (blocks going live)

1. **[dev]** Fix `CustomerPortal` auth — replace `localStorage.portal_session` with real Supabase email/OTP or magic-link auth. Current implementation is an unauthenticated pretend-session.
2. **[dev]** Wire commission generation. The `process_paid_order` DB function referenced by `marketplace-order-engine/index.ts:127` does not exist — either create it (calling `create_store_order_commission` / `create_wholesale_order_commission` per order type) or attach an explicit trigger on `marketplace_orders.status='paid'` → commission RPCs.
3. **[dev]** Add Stripe Connect onboarding surface in the Wholesaler Portal (new page + `create-connect-account` edge function) that populates `dd_partner_profiles.stripe_connect_status`. Without this, every `dd-pay-partner` call fails.
4. **[owner]** Once #3 ships, each existing wholesaler must complete Connect onboarding via the new flow. Provide Stripe live keys if not already set.
5. **[dev]** Re-review `wholesale_orders` RLS — remove the `is_simulation`-only INSERT/SELECT/UPDATE policies or confirm `is_simulation_mode()` cannot be spoofed from the client.
6. **[dev]** Add `RequireRole` wrappers to `/dynasty-direct/splits`, `/dynasty-direct/fulfillment`, `/dynasty-direct/products`, `/dynasty-direct/pricing`, `/dynasty-direct/shipping`, `/dynasty-direct/grabba-bridge`, `/dynasty-direct/catalog`, `/dynasty-direct/suppliers/portal`, `/dynasty-direct/suppliers/inventory`, `/dynasty-direct/suppliers/performance`, `/dynasty-direct/suppliers/instructions`, `/dynasty-direct/store-storefront`. Scope: `['admin', 'owner', 'employee']`.

### HIGH

7. **[dev]** Tighten `/portal/customer` role gate to `['customer', 'admin', 'owner', 'csr']` — remove `wholesale/wholesaler/accountant/warehouse/store/employee` from that list.
8. **[dev]** Add store-owner-scoped RLS SELECT policy on `store_inventory` so stores can read their own rows via the Store Portal (currently admin-only ALL).
9. **[dev]** Auto-trigger `approve_payout_on_shipped` on `marketplace_fulfillments` insert/update — either as DB trigger or scheduled cron on `dd_partner_earnings`.
10. **[dev]** Publish path OS → public storefront: choose a sync model (edge function push on catalog change, or shared table via cross-project proxy) so `/dynasty-direct/products` writes surface on `hruhkyvwtfpfviwnvhne`.
11. **[dev]** Link `/admin/marketplace-control`, `/admin/marketplace-payouts`, `/admin/payouts` into the Dynasty Direct sidebar block — currently orphaned from the operator mental model.
12. **[dev]** Audit `wholesaler_orders=3` — confirm those are real orders or purge as legacy seed per prior audit note.

### MEDIUM

13. **[dev]** Wire buyer-side "order complete" automation once shipment tracking marks delivered (webhook from carrier or manual `dd-create-shipment` follow-up).
14. **[dev]** Populate `commission_plans` + `commission_rules` with actual DD split rates so `apply_commission_overrides` has data to work against.
15. **[dev]** Add customer↔OS sync so accounts made on the public storefront populate `customer_profiles` here.
16. **[owner]** Confirm the storefront project actually posts to `dd-stripe-webhook` for the OS project (verify webhook secret binding on `hruhkyvwtfpfviwnvhne` side).

### LOW

17. **[dev]** Replace hard-coded `hruhkyvwtfpfviwnvhne` URLs in TT edge functions with env-var so the bridge is configurable.
18. **[dev]** Remove or archive dormant `wholesale_products` / `wholesale_orders` tables once §5 confirms nothing writes them (or add clear "legacy" comment on both).
19. **[dev]** Purge the deprecated `/portal/marketplace` redirect once no external link points to it.

---

**File location:** `docs/audits/DYNASTY_DIRECT_OS_HUB_AUDIT.md`

**Inferences flagged in-line:** `process_paid_order` missing (marked "inferred: broken reference"), auto-close on shipment (marked "inferred: manual trigger only"), `wholesaler_payouts` table (marked "inferred as separate table"). Every other claim is grounded in file paths, DB row counts, or RLS query output.
