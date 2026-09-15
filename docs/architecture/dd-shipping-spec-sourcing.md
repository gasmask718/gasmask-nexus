# Dynasty Direct — automatic shipping-spec sourcing

Fills missing packaged weight/dimensions on PHYSICAL products from the open web,
with provenance, so nobody has to research products by hand.

## Identifiers used (existing columns, strongest first)

`gtin`/`upc` → `supplier_sku`/`sku` (+ `brand`) → `brand` + `product_name` +
`size_or_count`/`package_text`/`flavor_or_variant`. Pack context comes from
`units_per_case` / `case_qty`.

## Flow

Entry paths (Add Product, Bulk Import, Catalog wizard publish, Product detail
"Find Shipping Specs") all call one service: `src/lib/dynastyDirect/shippingSpecs.ts`
→ edge function `dd-source-shipping-specs` → `_shared/ddSpecSourcing.ts`.

Skips: non-physical `item_type`, complete specs, `shipping_spec_locked`
(manual override), rechecked within 24h (unless `force`).

## Sources

1. UPCitemdb trial API (structured, key-free, never auto-applies alone)
2. SerpAPI Google results (US-locale) — manufacturer sites score 100, major
   retailers 70, barcode DBs 55, other 40. Non-US TLDs rejected outright.
   Auction/marketplace hosts (eBay, Etsy, AliExpress…) are review-only.
3. Extraction: JSON-LD product → labelled spec text ("Package Dimensions",
   "Shipping Weight") → plain-text identifiers. Search snippets are used when
   the page itself is bot-blocked.

## Exact matching

Strong = GTIN last-12 match (page text or URL digits) OR model/SKU match where
the SKU is an MPN field, or appears in title/URL **with a brand match** (stops
"fits model X" accessory listings). Pack-count mismatch and case-pack sources
for single units are hard rejections.

## Confidence

- `confirmed` — strong ID, packaged dims + weight, corroborated (2 sources or
  manufacturer page). Auto-applied, `shipping_verified = true`.
- `high_confidence` — strong ID + packaged specs from one trusted source, or
  composed from two exact-match trusted sources (dims from one, packaged weight
  from the other). Auto-applied, not marked verified.
- `needs_review` — conflicts, item (not package) dimensions, partial specs, weak
  identifier, or marketplace-only source. Candidates shown in the panel.
- `not_found` — nothing trustworthy. No values written, ever.

## Units

Normalised to ounces and inches on save (lb/g/kg, cm/mm/ft). Raw source text is
kept in provenance.

## Provenance (`spec_source_ref`)

source_url, source_name, matched_on, identifier_key, packaged_dimensions,
retrieved_at, confidence, reason, raw spec text, plus `weight_from`/`dims_from`
when composed. Full per-attempt history in `dd_spec_sourcing_log` (admin-only).

## Bulk import

Rows missing specs import as Drafts with status `sourcing` and are queued in
batches of 4; one unresolved product never fails the import.

## Shipping calculator

Unchanged. It reads `weight_oz`/`length_in`/`width_in`/`height_in`; products
without them still quote on the clearly-labelled conservative fallback parcel,
and `dd_require_shipping_dimensions()` keeps them out of Active.
