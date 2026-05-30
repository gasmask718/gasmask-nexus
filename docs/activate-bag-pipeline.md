# Activate Bag Pipeline — Dev Spec (Deferred)

**Status:** Architecture is built and dormant. Activate when bags become a meaningful revenue line.

## Current state (as of 2026-05-30)

The bag tracking system is a **first-class parallel** to the tube system in the schema, but no production data flows through it yet.

### What already exists

- **Discriminator** — `products.track_by` column. Currently set:
  - `GasMask Bags` (sku `GA-BA-4VLF`, product_id `170adb8f-…`) → `track_by = 'bags'`
  - All 8 other canonical SKUs → `track_by = 'tubes'`
- **Ledgers** (mirror the tube ledgers):
  - `bag_sale_ledger` (cols: `store_id`, `product_id`, `product_name`, `brand_id`, `bags_delta`, `source`, `created_at`) — **empty**
  - `bag_inventory_ledger` (with `bags_delta`) — **empty**
- **Views** (read paths already built):
  - `v_store_bags_on_hand` — current on-hand by store
  - `v_bags_sold_per_store_per_day` (sums `bag_sale_ledger.bags_delta` where `source='invoice_finalized'`)
  - `v_bags_sold_per_invoice`
  - `v_bags_sold_per_brand_per_day`
  - `v_bag_reorder_alerts`
  - `v_tube_bag_ratio_per_store` (`total_bags_sold`, `total_tubes_sold`, `bags_to_tubes_ratio_percent`)
- **UI consumers** (limited):
  - `src/components/inventory/StoreInventoryOnHand.tsx` — reads `v_store_bags_on_hand`
  - `src/components/inventory/TubeBagRatioCard.tsx` — reads `v_tube_bag_ratio_per_store`
  - `src/pages/os/warehouse/tabs/InventoryIntelligenceTab.tsx`

### What does NOT yet flow through the bag pipeline

- `finalize_invoice` (RPC) writes **only** to `tube_sale_ledger`, never to `bag_sale_ledger`, regardless of `track_by`.
- Store profile, Tube Inventory card, hero KPI strip, Lifetime / Prior Month / Last 30d chips, neighborhood rollup, and Orders Requested table **all read tube-only** (`v_store_tube_kpi`, `tube_sale_ledger`).
- Net effect: `GasMask Bags` line items currently land in tube-side rollups because the brand string `gasmask` is treated identically to the other tube SKUs. Counts are technically wrong (bags are not tubes), but consistently so — no daylight between data sources.

## Activation steps (when ready)

### 1. Wire `finalize_invoice` to split bag vs tube writes

In the `finalize_invoice` RPC, for each line item:
- Look up `products.track_by` for the line's `product_id`.
- If `track_by = 'bags'`, append a row to `bag_sale_ledger` (`bags_delta`, `source='invoice_finalized'`, full provenance).
- Otherwise (existing behavior), append to `tube_sale_ledger`.
- Both ledgers MUST be append-only with a compensating reversal row on invoice void (no mutate-in-place).

### 2. Dedicated Bags section on the store profile

Add a new section below (or beside) `StoreKPIBadge` on `StoreDetail` that reads:
- `v_store_bags_on_hand` for current on-hand by SKU
- `v_bags_sold_per_store_per_day` for trailing windows
- `v_bag_reorder_alerts` for an inline "needs reorder" pill

Mirror the existing tube UI: lifetime / prior month / last 30d chips, same color status logic, same date formatting (`MMM d, yyyy`).

### 3. Split the Tube Inventory card into two sections

Refactor `src/components/store/StoreKPIBadge.tsx` so the per-brand rows are grouped by `track_by`:
- **Tubes** (8 SKUs) — current behavior, sourced from `v_store_tube_kpi`
- **Bags** (1 SKU today: `GasMask Bags`) — sourced from `v_store_bags_on_hand` + the bags-sold views

Use the same `groupKeyFor()` dedup pattern. Continue to read `track_by` from a single SKU catalog query (cache the catalog at module level).

### 4. Backfill `bag_sale_ledger`

One-shot migration:

```sql
INSERT INTO public.bag_sale_ledger
  (store_id, product_id, product_name, brand_id, bags_delta, source, created_at)
SELECT
  i.store_id, ili.product_id, ili.product_name, lower(ili.brand),
  ili.quantity, 'invoice_backfill', i.created_at
FROM public.invoices i
JOIN public.invoice_line_items ili ON ili.invoice_id = i.id
JOIN public.products p ON p.id = ili.product_id
WHERE p.track_by = 'bags'
  AND i.payment_status IN ('paid','partial')
  AND i.store_id IS NOT NULL;
```

After backfill, re-derive `v_store_bags_on_hand` (it already reads the ledger; no view changes needed).

### 5. Remove the dual-counting once activated

After steps 1–4 ship and are verified, audit every consumer of `v_store_tube_kpi` / `tube_sale_ledger` and exclude `track_by='bags'` SKUs so a bag sale doesn't double-count as a tube sale. Easiest path: filter inside the view definitions on `track_by != 'bags'` joined against `products`.

## When to activate

- Bags become a SKU line you actually invoice routinely (not a one-off).
- A field rep or owner has asked "how many bags did we sell at store X" more than once.
- Reorder cadence for `GasMask Bags` diverges meaningfully from tubes (different supplier lead time, different margin, different velocity).

Until then, the dormant pipeline is fine. The schema is ready; the UI is not. Don't activate piecemeal — steps 1–5 ship together or not at all to avoid a window where bags double-count.
