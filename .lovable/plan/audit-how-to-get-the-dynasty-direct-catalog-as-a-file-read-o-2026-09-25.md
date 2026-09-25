# Audit: How to get the Dynasty Direct catalog as a file (read-only, nothing changed)

Nothing was exported, changed or published. Approving this does not run anything. The one next step I suggest (Option 3) is a read-only query that only runs if you ask for it.

## What the catalog actually holds today
- **Table:** `products_all` holds 45 rows in total.
- **Status breakdown:** 31 deleted, 11 draft, 2 inactive and 1 active.
- **Real, non-deleted catalog:** 14 products.
- **Product codes:** none. All 45 rows have empty `upc`, `gtin` and `supplier_sku`, and there is no SKU column on the product itself.
- **Consequence for the dedupe:** matching against the supplier catalog can only use name, brand, flavor/variant, size/count and package text. It cannot match on barcodes.
- **Variants:** a `product_variants` table exists (sku, variant name, attributes, prices, stock), but it has 0 rows.
- **Suppliers:** products link to a supplier through `supplier_id`, which points to `suppliers` (name, country, contact). Only 2 distinct suppliers are used.
- **Wholesalers:** products link through `wholesaler_id`, which points to `wholesaler_profiles`. 5 distinct wholesalers are used.
- **Declared links:** the database declares none of these links; they only work because the IDs happen to match.
- **Images:** `primary_image_url`, `image_urls` and `images`. All 45 rows have at least one image field filled.

## Export options found

1. **Pricing page, "Export CSV" button** (`/dynasty-direct/pricing`, admin/owner only; code in `PricingPage.tsx`, function `exportCsv`)
   - **Format:** CSV, built in the browser from `products_all`.
   - **Columns:** product name, category, cost, store price, DTC price, both margins, market average retail, price ceiling, status.
   - **Which products:** every product except deleted ones, narrowed by the category filter currently on screen. No row limit.
   - **Not included:** variants, supplier, stock, images, IDs and codes.
   - **Safety:** download only. Safe to run.

2. **Product Management page, "CSV Template" button** (`/dynasty-direct/products`)
   - This downloads an **empty** import template. It is not an export.
   - The CSV upload next to it **inserts** products. Do not use it.
   - The page itself loads up to 1,000 products with supplier, cost, prices, stock and dimensions, but it has no export button.

3. **No dedicated catalog, inventory or supplier export exists.**
   - The general tools (`exportUtils.ts`, 10,000-row cap; the CRM/Floor export pages; the Dropbox export) are not connected to `products_all`.
   - No backend function lists or exports the catalog. `dd-catalog-pipeline` and `dd-catalog-source-chain` process drafts; they do not export.
   - Read-only views that do exist:
     - `products_public`: active products only, currently 1 row.
     - The storefront hook `useDynastyDirectProducts`.

## Recommended data source for dedupe
Run a one-time read-only query on `products_all` (all rows except deleted), joined to `suppliers` and `wholesaler_profiles` by ID, and save the result as a CSV file for you. It changes nothing.

Suggested columns: id, product_name, brand, category, item_type, flavor_or_variant, size_or_count, package_text, unit_type, case_qty/units_per_case, supplier name, supplier_cost, store_price_a, dtc_price_b, retail_price, inventory_qty, status, primary_image_url, image_urls, upc/gtin/supplier_sku (empty today), created_at.

Optionally, I can include the 31 deleted rows in a separate file.
