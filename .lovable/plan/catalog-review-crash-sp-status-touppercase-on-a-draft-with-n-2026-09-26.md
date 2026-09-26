# Catalog Review crash: `sp.status.toUpperCase()` on a draft with no status

## Root cause (confirmed by code + data)

The crash is in `src/pages/dynasty-direct/DynastyDirectCatalogReview.tsx`:

- Line 376: `const sp = d.sourced_specs;`
- Line 522: `{sp && sp.status !== 'sourced' && (` — passes when `sp` is an object whose `status` is missing (`undefined !== 'sourced'` is true)
- Line 524: `sp.status.toUpperCase()` — crashes because `sp.status` is `undefined`

The offending row is **not one of Anna's 3 drafts**. It is an older test draft:

- `095e51e5-8c1d-44ec-ada3-9da25d17d219` — "TEST PRODUCT - DO NOT PUBLISH", status `pending_admin_review`
- Its `sourced_specs` is `{"external_id": "manual-test-001", "ingestion_source": "n8n_product_research"}` — an object with **no `status` key**, written by an old n8n research ingestion path, not by the spreadsheet importer.

Anna's 3 drafts (`9152985 9mm GLASS Water Pipe`, `9153240 Glass Water Pipe`, `9162920 Glass Hand Pipe`) all have `sourced_specs = NULL`, which the page handles fine (`sp` is null, the block is skipped).

## Answers

1. **Undefined value:** `sourced_specs.status` on draft `095e51e5…` ("TEST PRODUCT - DO NOT PUBLISH").
2. **Caused by Anna's test drafts?** No. Her drafts have `sourced_specs = NULL` and render safely.
3. **Field the page expects:** `dd_catalog_drafts.sourced_specs` (JSONB) with a `status` key (`sourced` / `needs_measurement` / `unavailable`).
4. **Pre-existing bug or introduced by the import?** Pre-existing. The page assumes any non-null `sourced_specs` object has a `status`; the old n8n-ingested test draft violates that assumption. The Anna import did not introduce it — it only made the review queue get opened.

## Fix (one file, frontend only)

In `DynastyDirectCatalogReview.tsx`, line 524, make the status render null-safe:

```tsx
{sp.status === 'needs_measurement' ? 'NEEDS MEASUREMENT' : String(sp.status ?? 'needs review').toUpperCase()}
```

Optionally also gate line 522 on `sp.status` being present (`sp && sp.status && sp.status !== 'sourced'`) so the warning box only renders when there is a real status to show.

## What does NOT change

- No data changes: the "TEST PRODUCT - DO NOT PUBLISH" draft stays as-is (it can be rejected later through the normal review UI once the page loads).
- No changes to Anna's drafts, the importer, the review queue logic, or any database object.
- No publish.

## Verification

- Typecheck clean.
- Load `/dynasty-direct/catalog/review` as owner: page renders, the malformed test draft shows a "NEEDS REVIEW" warning instead of crashing, Anna's 3 drafts appear normally.
