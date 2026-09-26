# Audit: Shipping size & weight → "Re-run sourced lookup" (read-only findings + proposal)

Nothing was changed. Sections 1–4 describe the system as it works today. Section 5 is a proposal to approve or reject.

## 1. What happens when the button is clicked

```text
Review card button → runSizing()                       (DynastyDirectCatalogReview.tsx ~L218)
  → dd-catalog-pipeline  mode: 'estimate_measurements'  (index.ts runEstimateMeasurements ~L548)
      → resolvePackCount()        (_shared/packCount.ts)   works out how many units ship
      → lookupSourcedSpecs()      (_shared/sourcedSpecs.ts) runs the web search and matching
      → suggestBox()              (dd_box_sizes)            only runs when the result is incomplete
  → writes dd_catalog_drafts.sourced_specs + measurements_estimate
    and prefills weight_oz / dimensions ONLY from sourced values
    (never sets measurements_verified_at)
```

- **Name sent to the search:** `recognition.product_name`, then `copy.title`, then `product_name`. Brand comes from `recognition.brand_visible`.
- **Pack count sources, in order:** a human-entered pack count, then label `units_per_case`, then the "6ct / 20 count" style text in `recognition.size_or_count`, `recognition.package_text` or `label_extraction.*`. The product name and the spreadsheet row are never read.

## 2. Services and models used

- **Search provider:** SerpAPI only (Google, US locale), key resolved by `resolveSerpApiKey`. It uses three engines: `google_shopping` (listings), `google_product` (the spec panel for a listing) and `google` (organic results, answer box, knowledge graph).
- **AI:** no AI model runs anywhere in this path. Extraction is deterministic regex: `WEIGHT_RE`, plus `DIMS_RE` for "L x W x H unit". The code comment says so deliberately: "No LLM guesses".
- **Database:** reads `dd_catalog_drafts` (recognition, label_extraction, pack_count) and `dd_box_sizes`. Writes only `dd_catalog_drafts`.
- **Not used here:** the separate `dd-source-shipping-specs` service (`_shared/ddSpecSourcing.ts`) is a stronger engine. It does GTIN/UPC/SKU matching, fetches pages, reads JSON-LD, uses UPCitemdb, scores manufacturer and retailer sources, and has confirmed / high_confidence tiers. It is wired to the live products table (Add Product, Bulk Import, Product detail), not to the catalog review queue. Photo identification (`dd-identify-product-photo`, Gemini) likewise feeds only that other engine.

## 3. Matching logic

- **Product identity:** `titleRelevance()` in `_shared/marketPrice.ts` is a token-overlap score: the share of query words, minus stop words, that appear in the result title (plus the snippet for web results). A result is accepted at 0.6 or above (`RELEVANCE_THRESHOLD`). It uses no barcode, SKU, model number, brand check or image check.
- **Quantity / pack size:** `classifyQuantity()` reads the source listing title only:
  - an explicit count that matches the draft's pack → `pack_match`
  - any other explicit count → `count_mismatch`
  - words like "single", "each", "1 ct", "1 pc" → `single_unit`
  - no count at all → `count_unknown`
- **Individual vs box, display or case:** there is no separate packaging model. It relies on `parseExplicitUnitCount` on the title plus the draft's pack count. Words like "display", "case" or "box" with no number are not understood on their own.
- **Selection rules when the pack count is known:**
  - Weight: same-quantity sources first. Otherwise a single-unit weight × the pack count, labelled as an estimate that excludes packaging.
  - Dimensions: same-quantity sources only. They are never multiplied up from a single unit.
  - A ±10% agreement check (`consensus`) picks the value most sources agree on.
- **Selection rules when the pack count is unknown:** it takes whatever values agree and marks them `unverified_quantity`.
- **Status:** `sourced` needs both weight AND dimensions. Anything less is `needs_measurement` plus a suggested box.

## 4. Searches, fallback chain, and why Batch 1 failed

**Search order.** Every step is SerpAPI and only strings are searched:
1. Shopping search for the name, top 2 relevant listings → their spec panels.
2. Only if the pack count is known: 2 case-style Shopping queries.
3. A web search for "{name} item weight dimensions", if anything is still missing.
4. Only if the pack count is known: a web search for "{name} {N} count case weight dimensions".
5. Otherwise: needs_measurement plus the smallest box from `dd_box_sizes` that can carry the weight.

There is no AI fallback, no page fetching (only SerpAPI snippets and panels), no manufacturer-site crawl, no barcode lookup, and no second provider.

**Batch 1 results (Anna's 25 drafts, read from the database):**
- **25 of 25** are `needs_measurement`. `target_units` is null on all 25, and all 25 have no `recognition` and no `label_extraction`.
- **14 drafts:** no search result reached the 0.6 relevance bar ("no relevant listings or pages found").
- **4 drafts found a weight but no dimensions.** Example: 18mm Male Flower Glass Bowl, "Net weight: 45g" from made-in-china.com, marked `unverified_quantity`.

**Root causes, in order of impact:**
1. **The pack count is always unknown for spreadsheet imports.** `resolvePackCount` only reads photo recognition and label data, and spreadsheet drafts have neither. Titles like "Pumpkin 2-Part Herb Grinder **6ct Display**" and "Clickit Guitar Lighter **20ct Display**" state the count, but the product name is never parsed. That rules out the case-query steps (2 and 4) and same-quantity matching entirely.
2. **Dimensions are rarely published** for generic glass, grinders and lighters. The dimensions regex also needs a unit after the third number, so formats like "Length: 5 in" or "5 inch tall" are missed. The result is weight without dimensions, which the rule turns into needs_measurement.
3. **Generic, unbranded names** fail token relevance. Retail titles add or rename words, so relevance falls below 0.6 and 14 drafts got zero sources.
4. **Only snippets are read.** Pages are never opened, so specs lower down a product page are invisible.
5. **The stronger engine** (`ddSpecSourcing`: page fetch, JSON-LD, source trust scoring) is not connected to the review queue.
6. **The display is misleading:** "no complete same-quantity match" is printed for every non-sourced status (review page ~L524), even when the pack count is simply unknown.

## 5. Proposed implementation (needs your approval; nothing built yet)

Principles are unchanged: nothing publishes without a human confirmation, dimensions are never multiplied up, and every value keeps its source link.

1. **Pack count from the name and the spreadsheet.** Extend `resolvePackCount` to parse `product_name`, `copy.title`, `copy.source_product_name` and `copy.source_raw_data` ("6ct Display", "20ct", "Box of 12"). The source is recorded as `name_text` and shown on the card, so an admin can correct it with the existing pack-count field. This alone unlocks case queries and same-quantity matching for the display items.
2. **Packaging-type classifier.** Add a small deterministic step (single / pack / box / display / case / tray) that reads the title and source row. It gets its own recorded field, so "display" with no number is recognised and triggers a pack-count prompt instead of silently matching single-unit results.
3. **Reuse the stronger engine as tier 2.** When `lookupSourcedSpecs` has no complete match, call the existing `ddSpecSourcing` page-fetch path (JSON-LD, "Package Dimensions" and "Shipping Weight" labels, manufacturer and US-retailer trust scoring, marketplace review-only, foreign storefront rejection) with the draft's name, brand and pack count. This avoids building a second engine.
4. **Wider dimension parsing.** Handle labelled single values (Length / Width / Height / Diameter, one unit at the end, "5 inch tall") and combine them into L×W×H only when all three come from the same page and the same quantity.
5. **Optional AI extraction tier, off by default.** Send fetched page text (not search guesses) to `openai/gpt-6-astra` through the Lovable AI Gateway with a strict schema. It returns only values it can quote word for word, with the quote and the stated quantity, and they are then re-checked by the same regex and quantity rules. The AI can never fill in a missing value.
6. **Result tiers shown on the card:**
   - `sourced` (same quantity, both values): unchanged, one-click confirm.
   - `partial`: for example, a weight found with dimensions missing. The weight is prefilled and the admin enters only L×W×H.
   - `needs_measurement`: suggested box, as today.
   - The misleading "same-quantity" wording is fixed so it states the real reason, e.g. "pack size unknown" or "no dimensions published".
7. **Bulk "Run sourced lookup for all pending" per supplier.** It uses the existing one-at-a-time invoke, is rate-limited against the SerpAPI quota, and shows progress. Useful for Anna's 25.
8. **Future, separate:** the "Request measurements from supplier" return path proposed in the previous audit, for items the web cannot resolve.

**Expected effect on Batch 1:** step 1 should give the ~6 "Nct Display" items a real pack count. Steps 3–4 should recover dimensions where retailer pages publish them. Generic glass items will likely still need a hand measurement, or measurements from Anna herself (step 8).

## Technical references
- `src/pages/dynasty-direct/DynastyDirectCatalogReview.tsx`: `runSizing` ~L218, the status banner ~L524, confirm-sourced ~L246
- `supabase/functions/dd-catalog-pipeline/index.ts`: `runEstimateMeasurements` L548–616, the publish gate in `runPublish` ~L618
- `supabase/functions/_shared/sourcedSpecs.ts`: `lookupSourcedSpecs`, `classifyQuantity`, `consensus`, `suggestBox`, `WEIGHT_RE` / `DIMS_RE`
- `supabase/functions/_shared/packCount.ts`: `resolvePackCount`
- `supabase/functions/_shared/marketPrice.ts`: `titleRelevance`, `RELEVANCE_THRESHOLD = 0.6`, `parseExplicitUnitCount`
- The engine that is not used here: `supabase/functions/_shared/ddSpecSourcing.ts` via `dd-source-shipping-specs`
