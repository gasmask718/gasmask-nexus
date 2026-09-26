# Plan: Backfill source data on Anna's 3 catalog drafts

## Goal
Add the preserved-source fields (`source_description`, `source_product_name`, `source_raw_data`) to the `copy` JSONB of Anna's 3 existing drafts, which were submitted before the preservation change existed.

## What the drafts currently hold (verified)
| Draft | Product | Cost | AI description present |
|---|---|---|---|
| e7ebc686… | 9162920 Glass Hand Pipe | 5 | yes |
| cd69ab04… | 9153240 Glass Water Pipe | 25 | yes |
| 734b3de3… | 9152985 9mm GLASS Water Pipe | 22 | yes |

All three: supplier = Anna (cf342a81…), status pending_admin_review, no weight/dimensions, one image each (Shopify CDN links), category "Other" (AI guess).

## Backfill per draft (one data update, no schema change)
- `source_product_name` = the current product_name (the AI did not rename these — the draft title matches the spreadsheet name exactly).
- `source_raw_data` = reconstructed spreadsheet row in the official DD template shape, using verified values: product_name, supplier_cost, image_url (from input_photos), plus the template's other columns (description, category, subcategory, sku, inventory_qty, weight_oz, length_in, width_in, height_in) as empty where the draft shows they were empty. A `reconstructed: true` marker is included so nobody mistakes it for the byte-original row.
- `source_description` = **not recoverable** — Anna's original description text was overwritten by AI and never stored. It will be set to null with a `source_description_note: "original description not recoverable — draft predates source preservation"`. If you have her spreadsheet, send it and I'll fill in the real text instead.

## What does NOT change
- Active descriptions (AI text in short/long_description), costs, categories, images, status, supplier — all untouched.
- No approvals, rejections, publishes, or deletions. No code changes.

## Verification
- Re-run the same read-only check: all 6 fields populated (source_description null-with-note unless you provide the spreadsheet).
