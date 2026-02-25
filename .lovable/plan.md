

# Switch /territory Map & Table to Territory Addresses (Ingested Data)

## Overview
Replace the data source on the `/territory` page from the `stores` table (active CRM stores) to the `territory_addresses` table (ingested discoveries from Yelp, AI, imports). Both the Mapbox map markers and the slide-out panel/table will now show only ingested territory addresses.

## What Changes

### 1. TerritoryMapView.tsx -- Switch data source
- **Query**: Replace `stores` table query with `territory_addresses` query:
  ```
  territory_addresses: id, full_address, city, state, zip, latitude, longitude,
  discovery_status, discovered_by, address_type, notes, verified_sells_grabba,
  last_checked_at, created_at
  ```
  - Filter: `latitude` and `longitude` not null
- **Markers**: Color-code by `discovery_status` instead of store status:
  - `new` = Blue
  - `verified` = Green
  - `rejected` = Red
  - `pending_visit` = Amber
- **Slide-out panel**: Show territory address details (full address, discovery status, discovered by, notes, verified sells grabba, last checked date) instead of store fields
- **Borough filtering**: Use `city` column from `territory_addresses` with the same `BOROUGH_CITY_MAP` logic

### 2. TerritoryStoresTable.tsx -- Switch data source
- **Query**: Replace `store_master` with `territory_addresses`
- **Columns**: Full Address, City/State, Discovery Status, Discovered By, Address Type, Verified Sells Grabba, Last Checked, Notes
- **Filters**: Status filter uses `discovery_status` values instead of store status
- Rename component title from "Stores in Territory" to "Ingested Addresses"

### 3. Interface updates
- Replace `StoreRecord` interface with `TerritoryAddress` interface matching the new columns
- Update status color helpers and badge variants for discovery statuses

## Technical Details
- No database changes needed -- `territory_addresses` already has all required columns including `latitude`/`longitude` for map pins
- The `BOROUGH_CITY_MAP` logic stays the same since `territory_addresses.city` uses the same borough/city naming
- Popup and fly-to-store interactions remain identical, just pointed at new coordinates

