
# Phase 1-4 Execution Plan: Data Integrity through Scale

This is a 4-phase sequential plan that follows the principle: **Data Integrity -> Core UI Fixes -> CRM Sync -> Automation**. Each phase must complete before the next begins.

---

## Phase 1: Data Integrity & Core Logic

### 1A. Tube Logic Matrix Verification

**What is missing**: No automated verification that `invoice_line_items.computed_tubes_total` matches `tube_sale_ledger` deltas after finalization and voiding.

**Why it matters**: If the math is wrong, inventory counts, payouts, and future automation all fail silently.

**Work**:
- Create a read-only SQL diagnostic view `v_tube_integrity_check` that joins `invoice_line_items` (finalized invoices) against `tube_sale_ledger` entries and flags mismatches
- Create a lightweight admin-only `TubeIntegrityPanel` component that displays the check results (pass/fail per invoice)
- Run the verification query against live data to identify any existing mismatches
- No fixes to the RPCs unless mismatches are found

**Files to touch**:
- New migration: `v_tube_integrity_check` view
- New component: `src/components/admin/TubeIntegrityPanel.tsx`
- Wire into existing admin diagnostics page

**What NOT to touch**: `finalize_invoice`, `void_invoice` RPCs (frozen unless mismatch found)

**Completion**: View returns 0 mismatched rows across all finalized invoices.

---

### 1B. Invoice Product Rendering Fix

**What is missing**: The `CreateStoreInvoiceModal` already filters by `CANONICAL_BRAND_IDS` and fetches active, non-deleted products. However, if product data is incomplete (missing `is_active` flags or `brand_id` assignments), products won't appear.

**Why it matters**: Operators cannot create invoices if the product dropdown is empty.

**Work**:
- Audit `products` table: count active products per canonical brand
- If products are missing `brand_id` or `is_active = true`, fix with data UPDATE statements (not schema changes)
- Verify the product selector renders all active products for each of the 4 brands
- Confirm `is_simulation = false` filter is applied where needed

**Files to touch**: None (data fix only, via SQL insert tool)

**Completion**: All 4 brand dropdowns show their active products in the invoice modal.

---

### 1C. Loose Tube / Fractional Pricing

**What is missing**: The invoice UI supports `box`, `unit`, and `pack` sale units, but `price_per_tube` (loose tube pricing) may not be populated for all products.

**Why it matters**: Operators selling individual tubes get $0 pricing if the field is empty.

**Work**:
- Audit `products` table for rows where `price_per_tube IS NULL` but `price_per_box > 0` and `units_per_box > 0`
- Backfill `price_per_tube = ROUND(price_per_box / units_per_box, 2)` for those rows
- Verify the UI correctly loads `price_per_tube` when `sale_unit = 'unit'`

**Files to touch**: None (data backfill via SQL)

**Completion**: Every active product has a non-null `price_per_tube` value.

---

### 1D. Payment Status Cleanup

**What is missing**: The system already enforces `pay_upfront` and `bill_to_bill` as the Two-Tier Payment Standard via `BrandPaymentQuickView` and `useStoreBrandRelationships`. However, legacy data or UI remnants of Net 7 / Net 14 / COD may exist.

**Why it matters**: Operators see inconsistent payment labels if legacy values remain in the database.

**Work**:
- Audit `store_brand_relationships` and `store_master` for any payment values outside `pay_upfront` / `bill_to_bill`
- If found, normalize them via UPDATE statements
- Verify no UI component renders Net 7 / Net 14 / COD options

**Files to touch**: None expected (data cleanup only)

**Completion**: Zero rows contain payment types other than `pay_upfront` or `bill_to_bill`.

---

## Phase 2: Unblocking the Frontend UI

### 2A. Store Directory Pagination

**What is missing**: The `Stores.tsx` page fetches ALL 2,909 stores in a while-loop with 1,000-row pages, loading contacts and tags for each batch. This is slow but functionally working. The real issue is rendering performance with ~3K cards.

**Why it matters**: The page becomes unresponsive when rendering thousands of store cards simultaneously.

**Work**:
- Replace the "fetch all then paginate in-memory" pattern with server-side pagination using `.range()` and `count: 'exact'`
- Use the existing `DataTablePagination` component (already imported in Stores.tsx)
- Default page size: 50 stores, with options for 25/50/100
- Move search filtering to the Supabase query (`.ilike()`) instead of client-side

**Files to touch**:
- `src/pages/Stores.tsx` (refactor query + rendering)

**What NOT to touch**: Store creation, store detail, contacts, tags logic

**Completion**: Store directory loads in under 2 seconds with paginated results.

---

### 2B. Address Schema Normalization

**What is missing**: `store_master` uses `address`, `city`, `state`, `zip` columns. The frontend maps these to `address_street`, `address_city`, `address_state`, `address_zip`. Currently 1,762/2,909 stores have addresses, 1,451 have cities. No dedicated structured columns exist in `store_master`.

**Why it matters**: Address data is already split into separate columns (`city`, `state`, `zip`) in the database. The mapping layer in `Stores.tsx` already handles this. The real gap is the 1,147 stores missing address data entirely.

**Work**:
- No schema migration needed (columns already exist as `address`, `city`, `state`, `zip`)
- Create a diagnostic query to identify stores with missing city/state that have a raw `address` string
- If parseable addresses exist, backfill city/state via UPDATE statements
- Verify territory filters work correctly with the existing column structure

**Files to touch**: None (data quality fixes only)

**Completion**: City/state coverage improves from ~50% to ~80%+ of stores.

---

### 2C. Excel Export Limit Fix

**What is missing**: The `excelExportService.ts` hard-limits queries to 500 rows for stores and companies, 1,000 for orders. With 2,909 stores, exports are incomplete.

**Why it matters**: Leadership gets partial data in exports, leading to bad decisions.

**Work**:
- Implement paginated fetching in `exportFullOSToExcel()` and `exportGrabbaToExcel()` (same while-loop pattern already used in `Stores.tsx`)
- Source stores from `store_master` (canonical table) instead of `stores` view
- Source orders from `invoices` (canonical, per the "Invoices are Orders" law) instead of `wholesale_orders`
- Set ceiling at 10,000 rows per table
- Add progress toast updates during export

**Files to touch**:
- `src/services/excelExportService.ts`

**What NOT to touch**: Export triggers, download logic, audit logging

**Completion**: Export includes all 2,909 stores and all invoices.

---

### 2D. UI Data Corrections (Brand Colors + Last Order in Directory)

**What is missing**:
- Brand hex colors in notes/badges may not match canonical brand config
- Store directory cards do not show "Last Order Date" or "Quantity/Size" inline

**Why it matters**: Visual consistency and operational speed (drivers/bikers need order history at a glance).

**Work**:
- Verify brand colors in `grabbaSkyscraper.ts` match the `brands` table `color` column; update DB data if mismatched
- Add Last Order Date + quantity summary to store directory cards using the existing `useLastOrderSnapshotBatch` hook (already imported in `Stores.tsx`)
- Surface the data that's already being fetched but may not be rendered in the card UI

**Files to touch**:
- `src/pages/Stores.tsx` (render last order data in cards)

**What NOT to touch**: KPI badge logic, LOS calculation, brand config

**Completion**: Every store card shows last order date and quantity when data exists.

---

## Phase 3: CRM vs. Portal Synchronization

### 3A. Driver & Biker Profile Upgrades

**What is missing**: CRM profiles have the Activity tab (Phase 10A) but lack operational data mirrors: pinned notes, route history summaries, and payment context visible at a glance.

**Work**:
- Add a read-only "Ops Context" card to Driver/Biker profiles showing:
  - Last store visited (from `route_stops`)
  - Recent delivery count (last 7/30 days)
  - Any flagged notes from the store they're visiting
- Source all data from existing views/tables (no new queries to build)
- Maintain governance banner

**Files to touch**:
- `src/pages/delivery/DriverProfile.tsx`
- `src/pages/delivery/BikerProfile.tsx`
- New: `src/components/profile/OpsContextCard.tsx`

**Completion**: Admin sees operational context in driver/biker profiles without switching to portal.

---

### 3B. Ambassador Profit Tracking (Read-Only)

**What is missing**: Ambassadors cannot see retail profit minus wholesale cost per product/brand in their profile or portal.

**Work**:
- Create a read-only `AmbassadorProfitSummary` component that computes margin from `invoice_line_items` where the ambassador is attributed (via `store_master.assigned_ambassador_id`)
- Use `v_invoice_line_items_safe` to respect financial data isolation (cost/profit hidden from non-finance roles)
- Admin-only visibility per the Financial Data Isolation Standard
- Governance banner: "This data is descriptive only"

**Files to touch**:
- New: `src/components/ambassador/AmbassadorProfitSummary.tsx`
- `src/pages/profile/AmbassadorProfilePage.tsx` (add panel)

**Completion**: Admin can see ambassador-attributed revenue and margin in the profile.

---

### 3C. Ambassador Invite Request Workflow

**What is missing**: The invite system exists (Phase 8) but ambassadors may be generating invites without admin approval.

**Work**:
- Verify the existing invite flow enforces admin approval before token generation
- If the ambassador portal has a direct "Invite" button, gate it behind an "Request Invite" action that creates a pending approval record
- Admin approves in the Security Console, which triggers token generation
- No changes to the invite redemption edge function

**Files to touch**:
- Ambassador portal invite UI (if ungated)
- Potentially `src/pages/security/` approval surface

**Completion**: No invite token is generated without admin approval.

---

### 3D. Wholesaler CRM View Separation

**What is missing**: The wholesaler profile already has dual engines (Supply + Marketplace) per the architecture standard. Verify the separation is complete.

**Work**:
- Audit `WholesalerSupplyTab` and marketplace tabs to confirm clean separation
- Verify no supply data leaks into marketplace views or vice versa
- This is primarily a verification task, not a build task

**Files to touch**: None expected (audit only)

**Completion**: Supply and marketplace tabs are confirmed isolated.

---

### 3E. Influencer Contact Fields

**What is missing**: Influencer profiles may lack Telephone, DOB (masked), and Neighborhood fields.

**Work**:
- Check if the `influencers` table has `phone`, `date_of_birth`, and address/territory fields
- If missing from schema, add via migration (nullable columns only)
- Surface in the Influencer profile using the existing `useUnifiedProfileView` masking logic (Month/Year for DOB, masked phone)
- Connect promo video analytics if the data source exists

**Files to touch**:
- Migration (if columns missing)
- `src/pages/profile/InfluencerProfilePage.tsx`

**Completion**: Influencer profiles display masked phone, DOB, and derived neighborhood.

---

## Phase 4: AI Automation & Scale

### 4A. Tier 1 Cold Outreach Architecture

**What is missing**: No automated voice calling system exists. This requires Twilio + text-to-speech integration.

**Work**:
- Verify Twilio credentials are configured (TWILIO_ACCOUNT_SID currently starts with "US" not "AC" -- this is a known issue per memory)
- Design the outreach edge function architecture (draft-first policy applies)
- Create an `outbound-voice-call` edge function that:
  - Accepts a store phone number + script template
  - Generates a draft call record (NOT auto-dialed)
  - Requires human approval before execution
- Connect AWS Polly or use Twilio's built-in TTS for voice synthesis
- All calls generate drafts per the Draft-First Communication Policy

**Files to touch**:
- New edge function: `supabase/functions/outbound-voice-call/index.ts`
- New UI: Admin call queue management page
- Secrets: AWS Polly credentials (if used)

**Completion**: Admin can queue and approve outbound calls; no auto-dialing.

---

### 4B. Automated SMS/Email Workflows

**Work**:
- Build templated SMS drafts using existing Twilio integration
- All messages are drafts requiring human approval (Draft-First Policy)
- Create a `draft-bulk-sms` edge function
- Admin UI for template management and batch approval

**Files to touch**:
- New edge function: `supabase/functions/draft-bulk-sms/index.ts`
- New: Template management UI components

**Completion**: Bulk SMS drafts can be created and approved by admin.

---

### 4C. AI Data Auditing

**Work**:
- Create a read-only AI audit function that compares `store_master` notes against `invoices` payment status
- Flag discrepancies (e.g., note says "paid $500" but invoice shows unpaid)
- Results displayed in an admin-only audit dashboard
- No automated corrections -- human review only

**Files to touch**:
- New edge function: `supabase/functions/ai-audit-notes/index.ts`
- New: `src/components/admin/AuditDiscrepancyPanel.tsx`

**Completion**: Admin can trigger an audit and review flagged discrepancies.

---

## Execution Sequence

```text
Phase 1 (Data Integrity)
  1A: Tube integrity verification view + panel
  1B: Product data audit + backfill
  1C: Loose tube pricing backfill
  1D: Payment status normalization
  
Phase 2 (Frontend Unblock)
  2A: Store directory server-side pagination
  2B: Address data quality backfill
  2C: Excel export pagination fix
  2D: Last order date in store cards
  
Phase 3 (CRM Sync)
  3A: Driver/Biker ops context cards
  3B: Ambassador profit summary (admin-only)
  3C: Invite approval gate verification
  3D: Wholesaler separation audit
  3E: Influencer contact fields
  
Phase 4 (AI Automation)
  4A: Voice outreach architecture (draft-first)
  4B: Bulk SMS drafting
  4C: AI note auditing
```

## Risk Notes

- **Twilio SID**: The current `TWILIO_ACCOUNT_SID` starts with "US" (API Key SID), not "AC" (Account SID). This must be corrected before Phase 4A can proceed.
- **V1 Lock**: Phases 1-2 are hardening/fixes (allowed under V1 lock). Phases 3-4 require Phase 11+ authorization per the lock declaration.
- **Draft-First Policy**: All Phase 4 automation must generate human-reviewable drafts, never auto-execute.
