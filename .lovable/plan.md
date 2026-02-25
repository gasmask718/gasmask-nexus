

# Cross-Database Duplicate Check + Paginated Search Results

## Overview
Two changes to the territory ingestion flow at `/territory/ingestion`:
1. When ingesting Yelp results, also check the `stores` table (Store Directory) for duplicates -- not just `territory_addresses`. Surface matches through the existing DuplicateResolutionModal.
2. Increase the Yelp search cap from 20 to 300 results and add pagination below the results grid.

---

## Change 1: Store Directory Duplicate Check

### How it works now
- `ingestSelected()` in `YelpBusinessSearch.tsx` checks `territory_addresses` by `full_address` match
- Duplicates go through `DuplicateResolutionModal`

### What changes

**`YelpBusinessSearch.tsx` -- `ingestSelected()` function**

After checking `territory_addresses`, also query the `stores` table:

```
SELECT id, name, address_street, address_city, address_state, address_zip
FROM stores
WHERE deleted_at IS NULL
```

Match logic: compare the Yelp business address against `stores` by building a comparable address string from `address_street, address_city, address_state, address_zip`. Also do a fuzzy name match (case-insensitive `name` comparison).

For any matches found in `stores`, create `DuplicateRecord` entries with a source indicator so the user sees "Already in Store Directory" vs "Already in Territory".

**`DuplicateResolutionModal.tsx` -- Update interface**

Extend `existingRow` to include an optional `source` field (`'territory' | 'store_directory'`). Display a badge showing which database the duplicate was found in. When the source is `store_directory`, the available actions are limited to `skip` and `add` (since we don't want to update/delete records in the `stores` table from the territory ingestion flow).

### Matching strategy
- Primary: exact `full_address` match against territory_addresses (existing)
- Secondary: match against stores where `address_street` + `address_city` matches, OR store `name` matches the Yelp business name (case-insensitive)
- Both checks run in parallel before showing the modal

---

## Change 2: Search Cap 20 to 300 + Pagination

### Edge function (`yelp-business-search/index.ts`)
- The Yelp API allows max 50 per request, with an `offset` parameter for pagination
- Update the `search` action to accept an `offset` parameter
- Keep `limit` at 50 per request (Yelp max)

### Frontend (`YelpBusinessSearch.tsx`)
- Add state: `searchOffset`, `totalResults`, `currentPage`
- On initial search: fetch first 50 results, store `total` from Yelp response (capped at 300)
- Add a pagination bar below the results grid using the existing `DataTablePagination` component
- Page size fixed at 50 (Yelp page size)
- When user clicks next page, fire another search with `offset = page * 50`
- Accumulate or replace results per page (replace is simpler -- show current page only)
- "Select All" applies only to current page; ingestion works on all selected across pages (track selections by Yelp business ID across pages)

---

## Technical Details

### Files modified:
1. **`supabase/functions/yelp-business-search/index.ts`** -- Add `offset` parameter to search action
2. **`src/components/territory/YelpBusinessSearch.tsx`** -- Add stores check in `ingestSelected()`, add pagination state and controls, increase cap
3. **`src/components/territory/DuplicateResolutionModal.tsx`** -- Add `source` field to `existingRow`, show source badge, restrict actions for store_directory matches

### No database migration needed
- Only reading from existing `stores` table
- No schema changes required
