
# Add Store Name Column + Source Filter to Territory Page

## Overview
The `territory_addresses` table currently has no `store_name` column. Store names are buried inside the `notes` field (e.g., "OSM: StoreName | phone" or "Yelp: StoreName | Rating..."). This plan adds a proper `store_name` column, updates all ingestion paths to populate it, and adds a source filter to the territory table.

## Database Changes

### Migration: Add `store_name` column to `territory_addresses`
```sql
ALTER TABLE territory_addresses ADD COLUMN store_name TEXT;
```

Also backfill existing records by parsing the `notes` field:
- For Yelp records (`discovered_by = 'yelp'`): Extract name before the first `|` from notes (strip "Yelp: " prefix if present from edge function ingestion, or just take before first `|` for YelpBusinessSearch client-side ingestion)
- For OSM records (`discovered_by = 'openstreetmap'`): Extract name between "OSM: " and first `|` or `[`

### Update `ingest_territory_addresses` RPC
Add `store_name` to the INSERT statement so CSV imports can also include a store name.

## Edge Function Changes

### `ingest-openstreetmap/index.ts`
Add `store_name: tags.name` to the insert payload (line 274-286). The OSM `tags.name` already contains the business name -- currently it's only written into notes.

### `ingest-yelp/index.ts`
Add `store_name: biz.name` to the insert payloads in both the neighborhood-scoped loop (line 281-293) and the city-wide fallback loop (line 373-384).

## Frontend Changes

### `YelpBusinessSearch.tsx` -- `buildRecords` function
Add `store_name: b.name` to the record object built at line 100-112. This ensures client-side Yelp ingestion (individual business selection) also writes the store name.

### `TerritoryStoresTable.tsx` -- Add store_name column + source filter
1. Add `store_name` to the query select clause
2. Add "Store Name" as the first column before "Full Address"
3. Replace the current "Notes" column with "Store Name" (notes still accessible elsewhere)
4. Add a **Source filter** dropdown next to the existing Status filter with options: All Sources, Yelp, OpenStreetMap, Google Places, CSV/Import
5. Filter logic: match `discovered_by` values (`yelp`, `openstreetmap`, `google_places`, `import`)
6. Include store_name in the search filter logic

### `TerritoryMapView.tsx` -- Show store_name
1. Add `store_name` to the query select clause
2. Show store name in marker popups (before full_address)
3. Show store name in the slide-out panel list items as a bold title above the address
4. Include store_name in search filtering

## Technical Details
- The `store_name` column is nullable TEXT -- no constraints needed since not all records will have names (e.g., CSV imports without name data)
- Backfill SQL uses string parsing to extract names from existing notes, covering both Yelp and OSM patterns
- No breaking changes -- all existing functionality continues to work
- The source filter uses `discovered_by` which already exists on all records
