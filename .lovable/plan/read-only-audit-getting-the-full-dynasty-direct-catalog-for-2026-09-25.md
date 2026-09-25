# Read-only audit: getting the full Dynasty Direct catalog for the Anna / Super City dedupe

Nothing was changed, imported or published. Approving this runs nothing. It only confirms the findings. The read-only catalog file (dd_catalog_for_dedupe.csv, 14 non-deleted products) was already produced in the previous step.

## A. Is this the Dynasty Direct wholesaler OS/catalog?
Yes, partly. This app is the Dynasty OS / GasMask command center. It contains:
- the Dynasty Direct admin hub (`/dynasty-direct/*`)
- the supplier portal (`/portal/wholesaler/*`)
- 63 `dd-` backend functions

The public shopping site is a separate project with its own backend.

## B. Catalog tables
| Table | Purpose | Important columns |
|---|---|---|
| products_all | Dynasty Direct catalog: 45 rows (14 live, 31 deleted) | id (PK), product_name, brand, category, item_type, flavor/variant, size/count, package text, unit_type, case qty, supplier_id, wholesaler_id, supplier_cost, store price, DTC price, retail_price, inventory_qty (a stored number, not calculated), status, primary_image_url, image_urls, images, upc/gtin/supplier_sku (empty on every row), created_at/updated_at |
| product_variants | Variants (sku, attributes, prices, stock) | 0 rows |
| suppliers | Supplier name, country, contact | linked by products_all.supplier_id (not a declared link) |
| wholesaler_profiles | Supplier portal accounts | linked by products_all.wholesaler_id (not a declared link) |
| products_public | Read-only view of active products for the shop | 1 row |
| dd_catalog_drafts / dd_capture_backup | Photo captures that have not been finalized | not part of the catalog |
| dd_store_inventory, dd_purchase_orders | Store-level stock and purchase orders | secondary |

The catalog does not store currency, MOQ or case pricing, stock location, or variant images.

## C. Existing export mechanisms
- **Pricing page:** `/dynasty-direct/pricing`, "Export CSV" button, admin/owner only.
  - **Includes:** name, category, cost, store price, DTC price, margins, market retail, price ceiling and status.
  - **Covers:** all non-deleted products, narrowed by the category filter on screen. No row cap.
  - **Missing:** supplier, stock, images, IDs and codes.
- **Product Management page:** its "CSV Template" button downloads an empty import template. It is not an export. The upload next to it inserts products, so don't use it.
- **Generic export tools:** exportUtils has a 10,000-row cap, and there are Floor/CRM exports. None of them read products_all.
- **No backend function or RPC exports the catalog.**

## D. Fields needed for a complete export
Read all products_all rows where status is not deleted, joined to suppliers and wholesaler_profiles by ID, with the columns listed above.

## E. Recommended approach
Use the one-time read-only query export that is already done (dd_catalog_for_dedupe.csv).

Before comparing:
- Drop the "[QA TEST]" rows.
- Match on name, brand, flavor, size and package. There are no barcodes or SKUs to match on.

Optional: I can save the 31 deleted rows as a separate file.
