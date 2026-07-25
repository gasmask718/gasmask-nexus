# Dynasty Direct OS HUB — UI/UX + Completeness Audit

Environment: Lovable e9aba3c3, Supabase `qalaaroashbggynpvqct`.
Read-only. Complements the functional audit (`DYNASTY_DIRECT_OS_HUB_AUDIT.md`).
Bar: "an admin can run this marketplace efficiently and sellers can self-serve."

---

## SECTION 1 — HUB USABILITY / DESIGN (admin operator view)

**Verdict: Clean shell, cluttered surface. Navigable, but flat.**

- Landing (`src/pages/dynasty-direct/DynastyDirectHubHome.tsx:1-218`) is genuinely
  well-designed for a hub home: 4 sections (Commerce / Network / Growth / System),
  tile cards, live KPI badges with `tone: 'cta' | 'warn' | 'critical'`, empty-state
  copy that tells the operator what to do ("Seed first order", "Invite first
  supplier"). This is above average for the codebase.
- But: the hub has **~31 pages** (`src/pages/dynasty-direct/*.tsx`) and only ~18
  are surfaced on the home tile grid. The other ~13 (Bundles, FlashSales,
  InventoryForecast, LocalDelivery, PartnerCampaigns, ProductQA, PurchaseOrders,
  Reviews, StoreAccounts, SupplierInstructions, SupplierPerformance, Pricing,
  ProductManagement, Shipping detail pages) are reachable only via the sidebar
  in `Layout.tsx:626-660`. There is **no in-hub second-level nav** — an operator
  going from Orders to Supplier Performance has to cross the whole sidebar.
- The Command Tower (`src/pages/admin/marketplace-control/MarketplaceControlTowerPage.tsx`)
  and the DD hub landing are **two different at-a-glance surfaces** with
  overlapping KPIs. Operators will not know which is authoritative.
- Design consistency: hub pages use the polished `DDShell` + `DDPageHeader` +
  `DDAlertBar` pattern. Portals use a different `HudCard/HudMetric` cyan-neon
  system. Admin/Command Tower uses raw shadcn `Card`. **Three visual languages,
  same product.**
- Speed test — "find & pay a seller for order X": Orders page → click order →
  Split Console (separate page, `DynastyDirectSplitConsole.tsx`, 237 LOC) →
  Payouts (separate). At least 3 hops with no breadcrumb trail.

**Design maturity: solid B for the landing, C- for cross-page flow.**

---

## SECTION 2 — DATA PRESENTATION

**`DynastyDirectOrders.tsx` (601 LOC) is the strongest page:**

- Sortable/filterable/searchable: ✅ search box + 4 filter selects (payment,
  fulfillment, supplier, date-range 7/30/90) + client-side stats bar (Total,
  Unpaid, Pending Fulfillment, Revenue).
- Pagination: ❌ hard cap `.limit(500)` (line ~104), no page controls.
- Unpaid rows bolded per pattern comment. Good.
- Side sheet for detail with items, fulfillments, shipping labels, carrier
  deep-links (UPS/USPS/FedEx/DHL). Print label wired.

**Where presentation collapses:**

- `DynastyDirectSplitConsole.tsx` shows split rows without tying back to the
  order in-page — operator sees splits with no context of which order failed.
- `DDStoreAccounts.tsx` (691 LOC) is a mega-page — dense, no tabs, unclear
  primary action.
- **Empty-state honesty gap.** The functional audit found
  `marketplace_commissions=0` and `commission_payout_batches=0` after 30 paid
  orders. Yet the Splits/Payouts UIs just render "no rows" — they do **not**
  tell the operator "the commission spine has not fired; investigate the
  webhook." This is the single biggest UX lie in the hub: **zero rows read as
  quiet health when it is a broken pipe.**
- Mock/placeholder shown as real: `CustomerPortal.tsx` renders "Rewards Points"
  and "Available Deals" HudMetric cards with value `"—"` but no `ComingSoon`
  label wrapping the number itself — a customer glancing at the card sees two
  live-looking KPIs.

---

## SECTION 3 — THE 3 PORTALS UX

### STORE portal (`src/pages/portal/StorePortal.tsx`, 208 LOC + `PortalStore.tsx`)

- Wholesale browsing exists but there is **no MOQ, no qty tier ladder, no
  wholesale-vs-retail toggle** in the store-facing catalog reads. Store buyers
  see the same product cards as D2C.
- Rating: **rough**. Functional for view, weak for B2B ordering ergonomics.

### SELLER / WHOLESALER portal (`src/pages/portal/wholesaler/*`, 14 files, ~3.0k LOC)

- Nav shell (`WholesalerPortal.tsx`, 243 LOC) is complete: Dashboard, Products,
  Orders, Fulfillment, Finance, Inventory, Messages, Settings, Team.
- **Missing UX pieces for self-serve:**
  - `WholesalerProductForm.tsx` (357 LOC) has NO image upload — only a "Preview"
    card with a placeholder `<Package>` icon. Products go live without photos.
  - Only ONE `description` textarea. Spec calls for BOTH customer + wholesale
    descriptions — the schema/UI do not surface a second field.
  - No category picker — only `brand_id`. Products cannot be classified.
  - No SKU / barcode field visible.
  - `WholesalerFulfillment.tsx` (345 LOC) has ship-with-tracking flow but
    tracking is a **free-text input** — no carrier auto-detect, no EasyPost
    integration inside the portal itself.
  - `WholesalerFinance.tsx` (210 LOC) shows earnings but no payout-schedule
    breakdown, no Stripe Connect status line-item, no 1099 export.
  - `WholesalerCatalogOnboard.tsx` is only 113 LOC — a stub, not a wizard.
- Rating: **working shell, incomplete self-serve.** A seller cannot realistically
  onboard and start selling without operator help.

### CUSTOMER portal (`src/pages/portal/CustomerPortal.tsx`, 425 LOC)

- Visually the strongest of the three (HUD system, animated cards, order
  expand/collapse, address list, shipping-cost/tax/subtotal breakdown).
- **But the auth is the fake shell the functional audit flagged.**
  `PortalLogin.tsx` (context lines 30-59) looks up a customer row by email/phone
  and mints a `crypto.randomUUID()` session token in `localStorage` — no
  password, no OTP, no rate-limit. Anyone who knows a customer's email can log
  in as them.
- Two "Coming Soon" KPI tiles (Rewards, Deals) render live-looking cards.
- Rating: **pretty, unsafe.**

---

## SECTION 4 — SELLER ONBOARDING UX

**Verdict: does not exist as a linear flow.**

- No page named "SellerOnboarding" / "SellerApplication" / "SellerWizard" in
  either `src/pages/dynasty-direct/` or `src/pages/portal/wholesaler/`.
- `WholesalerCatalogOnboard.tsx` (113 LOC) is catalog-only, not seller-onboard.
- `WholesalerStripeConnectCard.tsx` exists (component) but is not stitched
  into a step-by-step wizard.
- Application intake for sellers is not surfaced — `DynastyDirectStoreApplications`
  is the STORE-buyer apply queue, not seller.

**What good looks like** (recommended UX):
```
Step 1 — Apply (public)      → creates wholesaler_application row
Step 2 — Approved email      → magic link to /portal/wholesaler/setup
Step 3 — Business profile    → name, EIN, address, contact
Step 4 — Payouts (Stripe)    → Connect Express onboarding
Step 5 — First product       → guided WholesalerProductForm
Step 6 — Go-live checklist   → payout ready ✓, ≥1 product ✓, shipping origin ✓
```
Current: **step 1 missing, step 2 missing, step 3 partial (`WholesalerSettings`),
step 4 component exists but not surfaced as gate, step 5 form works, step 6 missing.**

---

## SECTION 5 — RATE MANAGEMENT UX

**Verdict: does not exist for the marketplace.**

- `rg` for `commission.*rate|RateEditor|rate.*override` under DD paths returns
  only affiliate/ambassador rate pages (`DynastyDirectAffiliates.tsx`) and
  TopTier partner commissions — **nothing marketplace-scoped.**
- `DDSettings.tsx` (293 LOC) contains system settings, not rate matrices.
- The Split Console shows the effect of a rate but has no controls to edit it.

**What good looks like:**
```
Rate list      — Platform | Category | Seller | Order-override rows
Edit modal     — new %, effective_from date, note
Margin preview — "at 12% you keep $360 on avg last-30-day order mix"
Change history — who/when/what, revert
```
None of this exists.

---

## SECTION 6 — CATALOG / LISTING MANAGEMENT UX

| Capability | Admin | Seller |
|---|---|---|
| Add product | `ProductManagementPage.tsx` present | `WholesalerProductForm.tsx` present |
| Upload multiple images | ❌ not in form | ❌ not in form |
| Customer description | ✅ single field | ✅ single field |
| Wholesale description | ❌ | ❌ |
| Category picker | ❌ (brand only) | ❌ (brand only) |
| Price / MOQ | Retail/Store/Wholesale prices ✅, MOQ ❌ | same |
| Weight for shipping | ✅ (`weight_oz`, dims panel) | ✅ |
| Stock qty | ✅ | ✅ |
| Category-tree management UI | ❌ not found under DD | — |
| Bulk import (CSV/XLSX) | `DynastyDirectCatalogOnboard.tsx` supports AI onboard but no bulk UI in seller portal | one-at-a-time |

**Biggest miss: no image upload path in the seller product form.** This alone
makes seller self-serve impossible.

---

## SECTION 7 — ORDER & FULFILLMENT OPS UX

- Admin order search / filter / per-supplier view: **strongest UX in the hub**
  (`DynastyDirectOrders.tsx`).
- Per-order commission/split view inside the order sheet: ❌ — splits live on a
  separate page.
- Seller ship-with-tracking flow: works (`WholesalerFulfillment.tsx`) but
  free-text carrier/tracking, no shipping label buy inside the portal.
- Customer-facing tracking: order sheet on CustomerPortal shows tracking chip
  but no tracking URL rendering pipeline confirmed for seller-entered tracking.
- Refund/return UI for admin: **not found.** `rg refund|return` under
  `src/pages/dynasty-direct/` returns nothing. No return-authorization surface,
  no split-reversal action.

---

## SECTION 8 — SECURITY VISIBLE IN UX

- ~13 unguarded `/dynasty-direct/*` routes (functional audit) means anyone with
  a logged-in Supabase user can hit `/dynasty-direct/splits` or
  `/dynasty-direct/fulfillment`. **UX confusion:** a store user landing in the
  admin fulfillment console sees supplier PII and payout math that isn't
  theirs. No "you don't have access" screen renders — the page just loads.
- Customer portal fake-auth (Section 3) means Customer A can view Customer B's
  invoices/addresses by typing B's email. This is a **UX-visible** security
  hole because it happens in the login form.
- No visual role badge / "acting as" chip in the hub header — an operator with
  admin + wholesaler roles cannot tell which lens they are in.

---

## SECTION 9 — SCORECARD + PRIORITIZED TASK LIST

### Scorecard

| Dimension                                    | Score |
|----------------------------------------------|-------|
| Hub design maturity (look & feel)            | **70%** |
| Operator completeness (run marketplace e2e)  | **35%** |
| Store portal UX                              | **35%** |
| Seller portal UX                             | **55%** |
| Customer portal UX (visual)                  | **70%** |
| Customer portal UX (safe & real)             | **20%** |
| **Overall UX/completeness**                  | **~45%** |

### CRITICAL (broken capability, not polish)

1. **Seller onboarding wizard** — build the 6-step flow (Section 4). Without
   it, sellers cannot self-serve at all.
2. **Product image upload** in `WholesalerProductForm.tsx` + admin
   `ProductManagementPage.tsx` — multi-image, drag-drop, primary/gallery.
3. **Rate management UI** for marketplace commissions (Section 5).
4. **Refund / return / split-reversal UI** for admin.
5. **Empty-state honesty**: when `marketplace_commissions.count === 0` but
   `marketplace_orders where payment_status='paid' > 0`, render a red banner
   on Splits + Payouts: "Commission engine has not run — check
   `marketplace-order-engine` webhook." Right now zero rows read as calm.
6. **Kill fake customer auth** — replace `PortalLogin.tsx` localStorage
   session with Supabase magic-link / OTP.
7. **Role-guard the ~13 unguarded `/dynasty-direct/*` routes** — visible via
   wrong-user-lands-here UX symptom.

### HIGH (self-serve gaps)

8. Dual descriptions (customer + wholesale) — schema + form fields.
9. Category picker in product forms + category-tree management page.
10. MOQ + qty-tier ladder on wholesale product form and store-portal catalog.
11. Order sheet: inline "splits & payouts" panel — no page hop.
12. Seller Stripe Connect status pinned to portal top-bar with clear
    "not-onboarded → onboard now" CTA.
13. Bulk product import (CSV/XLSX) inside seller portal.
14. Pagination on `DynastyDirectOrders` (current `limit(500)` hard cap).

### MEDIUM (usability polish)

15. Consolidate visual language — pick DDShell OR HudCard, not both across DD.
16. Add breadcrumbs + in-hub secondary nav (Orders ⇄ Splits ⇄ Payouts).
17. Merge/relate DD Landing KPIs with Marketplace Command Tower — one truth.
18. `DDStoreAccounts.tsx` (691 LOC) — split into tabs.
19. Coming-soon KPIs on CustomerPortal: hide the number, not just tag it.
20. Seller fulfillment: carrier auto-detect from tracking pattern, EasyPost
    label buy in-portal.

### LOW (nice-to-have)

21. "Acting as" role chip in the hub header.
22. Global command-K search across orders / products / sellers.
23. Saved filter presets on the Orders page.
24. 1099 export for sellers.
25. Dark-mode audit — the HudCard cyan works, DDShell shadcn drifts.

---

## Bottom line

The hub landing and the Orders page prove the team can build a good operator
console. Everything else is either a mega-page dump, a shell portal, or a
missing capability. An admin can *look* at the marketplace efficiently; they
cannot yet *run* it end-to-end, and a new seller cannot get from "sign up" to
"first sale" without human help.
