

# Territory Map: Store Name First + Formatted Details

## Problem
The map markers and slide-out panel currently show `full_address` as the primary label. The `store_name` field exists in `territory_addresses` but isn't being queried or displayed.

## Changes

### File: `src/components/territory/TerritoryMapView.tsx`

**1. Add `store_name` to the query (line 144)**
Add `store_name` to the select fields and the `TerritoryAddress` interface.

**2. Update marker popups (line 351-353)**
Change from showing `full_address` as the bold title to:
- Bold: `store_name` (fallback to "Unknown Store")
- Subheader: `full_address`
- Third line: status + discovered_by (properly formatted)

**3. Update slide-out panel list items (lines 445-471)**
Restructure each address card:
- **Primary line**: `store_name` (bold, truncated)
- **Secondary line**: `full_address` with MapPin icon (muted, smaller)
- **Details row**: `address_type` badge, `discovered_by` with Eye icon, date added
- **Right side**: status badge + verified_sells_grabba indicator (unchanged)

**4. Update search filter (line 197-201)**
Also search against `store_name` so users can find stores by name.

No database changes needed -- `store_name` already exists in the schema.
