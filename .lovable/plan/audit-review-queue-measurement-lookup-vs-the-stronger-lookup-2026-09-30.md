# Audit: Review Queue measurement lookup vs. the stronger lookup (read-only)

This audit changed nothing. Approving it only confirms the findings. The build proposal at the end runs only if you ask for it separately.

## 1. Where each system lives
**A. Review Queue "Re-run sourced lookup" (the weaker one)**
- Button: `src/pages/dynasty-direct/DynastyDirectCatalogReview.tsx:453-455` → `runSizing()` (218-230) → `invokePipeline({mode:'estimate_measurements'})` (194-199)
- Backend: `supabase/functions/dd-catalog-pipeline/index.ts:1253` → `runEstimateMeasurements` (548-615) → `_shared/sourcedSpecs.ts::lookupSourcedSpecs` (256)

**B. The stronger lookup**
- Client helper: `src/lib/dynastyDirect/shippingSpecs.ts::requestSpecSourcing` (46-68)
- Backend: `supabase/functions/dd-source-shipping-specs/index.ts` → `_shared/ddSpecSourcing.ts`
- Used by: Product Management (`ProductManagementPage.tsx:185`), Product detail "Find Shipping Specs" (`ProductDetailPanel.tsx:388`), and the Review Queue, but only after Publish (`DynastyDirectCatalogReview.tsx:311-318`)

## 2. Flow
```text
A: Re-run button -> runSizing -> dd-catalog-pipeline(estimate_measurements)
   -> SerpAPI (google_shopping, google_product, google web) JSON only
   -> regex over snippet/spec-panel text -> 2-source consensus
   -> dd_catalog_drafts.sourced_specs + measurements_estimate (+ prefill weight_oz/dimensions)
   -> Review card -> admin "Confirm" sets measurements_verified_at

B: Find Shipping Specs / post-publish -> requestSpecSourcing -> dd-source-shipping-specs (admin JWT)
   -> UPCitemdb barcode lookup + SerpAPI search
   -> fetches each candidate page (12s timeout, up to 600KB HTML)
   -> JSON-LD Product data first, then labelled text ("Package Dimensions", "Shipping Weight")
   -> verifyMatch (GTIN / MPN+brand / pack count) -> hostScore trust ranking
   -> confirmed | high_confidence | needs_review | not_found
   -> products_all dims + spec_source_ref; every attempt in dd_spec_sourcing_log
```

## 3. Sources (checked in the code)
| | A (Review Queue) | B (stronger) |
|---|---|---|
| SerpAPI | Yes (shopping, product, web) | Yes (organic, shopping) |
| Opens real product pages | No, snippets and search JSON only | Yes |
| Barcode service | None | UPCitemdb |
| AI/LLM for measurements | None | None |

Gemini is only used elsewhere, for label reading and photo candidates. Neither system has AI make up measurements.

## 4. Matching
- **A:** fuzzy title match on name and brand (`titleRelevance >= RELEVANCE_THRESHOLD`). It never checks UPC, GTIN, SKU or MPN. Pack count is only read from numbers in the listing title (`sourcedSpecs.ts:219-244`). No site trust ranking.
- **B:** `identifierKey` checks GTIN first, then SKU, then name. `verifyMatch` needs one of:
  - a GTIN match (JSON-LD, page text or URL)
  - an MPN/SKU match plus a brand match

  It rejects on pack-count mismatch and rejects case/carton sources for single units.
- **B site trust (`hostScore`):**
  - manufacturer 100, major US retailers 70, barcode databases 55, other US sites 40
  - foreign/country-code sites are rejected
  - marketplace listings (eBay, Etsy, AliExpress) are review-only
  - bonuses: GTIN +60, MPN +40, packaged +25, complete +20

## 5. Where measurements come from
- **A:**
  - Regex over search-snippet text.
  - Weight can be **estimated** as single-unit weight × pack count (`weight_basis: 'estimated_from_single_unit_weight'`). This caps confidence at medium, but still prefills `weight_oz`.
  - Dimensions are never multiplied.
- **B:**
  - Values are stated on the page, from JSON-LD or labelled spec text.
  - Package vs item is decided by the label wording.
  - Dimensions and weight from two different pages are combined only when both are strong, packaged and from trusted sites.
  - Only confirmed or high_confidence results are written automatically.
  - UPCitemdb dimensions count as not packaged, so they can never be applied automatically on their own.

## 6. Side by side
| | A: Review Queue | B: stronger |
|---|---|---|
| Search depth | Search snippets | Full pages |
| SKU/barcode match | None | GTIN, MPN, SKU |
| Pack count | Title parsing | Hard reject on mismatch |
| Case vs single unit | Title text only | Explicit reject |
| Confidence | low/medium/high | confirmed/high/needs_review/not_found |
| Provenance | sourced_specs blob | spec_source_ref + full attempt log |
| Fallback | Suggests the smallest box that fits | not_found, writes nothing |
| Works on | Drafts | Only `products_all` rows (hardcoded, index.ts:73,78) |

## 7. Anna Batch 1 (22 drafts)
- **B cannot run on them today.** It only reads and updates live catalog rows, and Anna's items are still drafts.
- **What B would use:** upc/gtin, supplier_sku, brand, product_name, size_or_count, package_text, flavor_or_variant, units_per_case/case_qty.
- **What Anna's rows have:** name, category, SKU-like item numbers (for example 9162920), cost and images. There is no barcode, no brand and no pack count.
- **Result:** even through B, most of her items would be matched by SKU or name only. Her item numbers are her own internal codes, so they won't match anything on the web. Unbranded glass is likely to come back not_found or needs_review. That is the correct outcome, not a failure.

## 8. Safety
- **A risks:**
  - It can match a similar but different product, because it never checks an identifier.
  - The estimated weight is prefilled.
  - A snippet from any site can be used.
- **B safeguards:**
  - GTIN or MPN is required before anything is applied automatically.
  - Case/pack rejection, foreign-site rejection and marketplace quarantine.
  - Package vs item detection and conflict detection.
- **B gaps:**
  - `verifyMatch` never checks `flavor_or_variant`, so a wrong flavor or variant can pass.
  - The package-label regex can misread unclear wording.
  - It doesn't compare photos.

## 9. Recommendation
- **A. Can the Review Queue reuse B?** Yes, but not as it stands. B is hardcoded to the live catalog table.
- **B. Smallest change:**
  - Add a draft mode (`draft_id`) to `dd-source-shipping-specs` that reads identifiers from `dd_catalog_drafts`.
  - Write B's result into the draft's existing `sourced_specs` shape.
  - Point `runSizing()` at it.
  - The existing card and Confirm button stay unchanged.
- **C. Missing capability:** a variant/flavor check in `verifyMatch`. It would also help if drafts carried a barcode, brand and pack count; spreadsheet imports currently don't fill these in.
- **D. When there's no exact verified match:**
  - Write nothing.
  - Show "not found" or "needs review" with the reason.
  - Don't prefill an estimated weight.
  - Keep manual measurement, or asking Anna, as the path forward.
- **E. Provenance to store and show:**
  - source URL and site name
  - what it matched on (GTIN, MPN or name)
  - package or item
  - the raw spec text as found
  - retrieval time, confidence and reason
  - a link to open the source page

## Limits
- I did not directly confirm whether `dd_catalog_drafts` has upc/gtin columns.
- I did not audit `dd-identify-product-photo` or `dd-price-intelligence` for this comparison.
