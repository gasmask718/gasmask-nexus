# Audit: How new products get into the Dynasty Direct catalog (read-only)

Nothing was changed, created, imported or published. Approving this runs nothing; it only confirms the findings.

## Verdict: A (with gates). Bulk import already exists, in two separate forms.
- **Admin CSV import** writes straight into the live catalog.
- **Supplier spreadsheet import** (CSV or Excel, with AI categorising) sends products to a review queue first.
- Products can also be added one at a time by form or by photo.
- Two database checks run on every insert and cannot be bypassed:
  - A self-serve supplier can never publish a product directly.
  - A product cannot go live when its margin is below the floor.

## 1. Adding one product at a time
| Path | Page | Required | What happens on save |
|---|---|---|---|
| Admin "Add Product" | `/dynasty-direct/products` (`ProductManagementPage.tsx`, `handleAdd` lines 201-289) | product_name, category. If a cost is given, a store or DTC price is also required | Inserted directly into `products_all`. Active if weight, length, width and height are all filled in. Otherwise saved as draft, and shipping specs are sourced automatically (`dd-source-shipping-specs`). An optional photo goes to the `product-images` bucket |
| Admin catalog wizard | `/dynasty-direct/catalog/onboard` (`DynastyDirectCatalogOnboard.tsx`) | photos, supplier, verified measurements, a valid category | Draft goes to `dd_catalog_drafts`. AI enhances the images and writes copy and pricing (`dd-catalog-pipeline`). The publish step inserts into `products_all` |
| Supplier Quick Add by Photo | `/portal/wholesaler/products` → onboard (`WholesalerCatalogOnboard.tsx`, `QuickAddCamera.tsx`) | recognised name, a hero photo that is not the label, verified measurements | Draft goes to `dd_catalog_drafts` as pending review. It is never added to the catalog directly |
| Supplier full form | same page, "Use the full form instead" | same as the wizard | Pending-review draft |

Admins approve drafts at `/dynasty-direct/catalog/review` (`DynastyDirectCatalogReview.tsx`, `approve()`). Approval calls `dd-catalog-pipeline` in publish mode (`runPublish`, lines 618-810), which inserts the product into `products_all`, adds a `marketplace_inventory` row and marks the draft published.

## 2. Bulk import
**A. Admin CSV: "CSV Template" / Bulk Import on `/dynasty-direct/products`** (`downloadCsvTemplate` lines 363-372, `handleCsvImport` lines 291-361)
- **Exact columns:** `product_name,category,brand,supplier_cost,store_price_a,dtc_price_b,inventory_qty,weight_oz,length_in,width_in,height_in,image_url`
- **Required:** product_name and category. Rows missing either are silently dropped.
- **Writes to:** `products_all` directly, 100 rows at a time.
  - Rows with complete shipping specs go live as active.
  - The rest are saved as drafts, and their specs are sourced automatically.
- **Images:** one URL per row, in `image_url`.
- **Variants:** not supported.
- **Caution:** the parser splits on every comma and does not handle quotes. A comma inside a name or description will shift the columns.

**B. Supplier spreadsheet: "Upload a spreadsheet instead" in the supplier portal** (`BulkUploadModule.tsx`)
- **Template (.xlsx):** `product_name, description, category, subcategory, sku, supplier_cost, inventory_qty, weight_oz, length_in, width_in, height_in, image_url`
- **Header matching is tolerant.** It also accepts name/title, price/retail_price and images/image, and several image URLs can be joined with `;`.
- **AI step:** categories and descriptions are filled in by the `ai-categorize-products` function. If that fails, it falls back to local rules.
- **Writes to:** `dd_catalog_drafts` with status pending_admin_review and source bulk_upload. An admin must approve each draft before it reaches the catalog.
- **Variants:** not supported.

**No outside API or import endpoint exists** for pushing products in from another system.

## 3. Backend
- **Tables:** `products_all` (the catalog), `dd_catalog_drafts` (the review queue), `marketplace_inventory`, `dd_inventory_adjustments`, `suppliers`, `wholesaler_profiles`. `product_variants` exists but no creation path fills it.
- **Functions:** `dd-catalog-pipeline` (enhance, stage, copy/pricing, publish), `ai-categorize-products`, `dd-source-shipping-specs`, `dd-auto-price`, `dd-process-image`, `dd-identify-product-photo` (only fills in existing products), `dd-catalog-source-chain`.
- **Database triggers on `products_all`:**
  - `dd_enforce_catalog_confirm_gate` forces an unconfirmed or self-serve product back to draft or pending review.
  - `dd_margin_guard` blocks an active product whose margin is below the floor.
  - `dd_sync_product_images` keeps the image fields in sync.
  - An inventory trigger keeps stock in sync with inventory adjustments.
- **Database trigger on drafts:** `dd_enforce_self_serve_review` stops non-admin users from publishing their own drafts.
- **Storage:** product photos are in `product-images`. Unfinished capture photos use `dd-capture-backup`, which was verified live earlier.

## 4. Data model (`products_all`)
- **Prices and costs:** supplier_cost (and its cents version), store_price_a, dtc_price_b, retail_price, store_price, wholesale_price, street_price.
- **Stock:** inventory_qty, low_stock_threshold.
- **Images:** images, image_urls, primary_image_url.
- **Category:** category, checked against the Dynasty Direct category list when a product is published.
- **Product details:** item_type, flavor_or_variant, size_or_count, package_text, units_per_case/case_qty.
- **Supplier links:** supplier_id → `suppliers`; wholesaler_id → `wholesaler_profiles`.
- **Source/provenance:** source_draft_id, upc, gtin, supplier_sku, spec_source, spec_source_ref, shipping_data_source, shipping_spec_status, specs_verified_at/by, confirmed_at/by, recognition.

## 5. Practical implication for Anna / Super City
- **Admin CSV** is the fastest way in, and new products go live immediately. The file needs a clean, deduped CSV with no commas inside fields and one image per row. Variants must be entered as separate products.
- **Supplier spreadsheet** is safer, because every product goes through admin review. It needs a supplier account for Anna's company, which does not exist yet.

## Limits
- Details come from the code and the migration history. I did not pull the live column list of the catalog table.
- I did not read `dd-process-image` and `dd-auto-price` line by line.
