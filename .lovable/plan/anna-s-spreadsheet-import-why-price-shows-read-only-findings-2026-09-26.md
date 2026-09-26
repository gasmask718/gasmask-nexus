# Anna's spreadsheet import: why Price shows "—" (read-only findings)

## Answers to the four questions

1. **Which column does the preview's Price field read from?**
   The Raw Data Preview "Price" column reads `price` / `Price` / `retail_price` from the spreadsheet (`BulkUploadModule.tsx` line 125). The official DD template has **no such column** — its headers are `product_name, description, category, subcategory, sku, supplier_cost, inventory_qty, weight_oz, length_in, width_in, height_in, image_url`. So Price shows "—" for every template-based upload.

2. **Is supplier_cost actually being captured?**
   **Yes.** Line 129 maps `supplier_cost` (also accepts `cost`, `your_price`, `Cost`) into the parsed row, and line 321 sends it as `cost` when drafts are submitted. Anna's 5.00 / 25.00 / 22.00 values are in the parsed data — they just aren't displayed in the preview.

3. **Hidden from preview or genuinely missing?**
   **Hidden from the preview only.** The cost is captured and will be stored on the draft. This matches the intended design: suppliers provide their cost, and the **admin sets the retail price during review** (the screen text even says "Nothing goes live until we approve it and set the retail price").

4. **Is the template's supplier_cost column mapped correctly?**
   **Yes.** The mapping is correct; the confusion is purely cosmetic — the preview shows a "Price" column that template users can never fill.

## Optional fix (only if you approve)

Cosmetic change to `src/components/wholesaler-console/BulkUploadModule.tsx` only:
- In the Raw Data Preview table and the per-item cards, show **Cost** (from `supplier_cost`) instead of — or alongside — the empty "Price" column, so suppliers can verify their cost values before submitting.
- No changes to mapping, submission, drafts, review queue, or any data. No AI categorization run, no drafts created, nothing published.

If you'd rather leave it exactly as-is, no action is needed — the import is working correctly.
