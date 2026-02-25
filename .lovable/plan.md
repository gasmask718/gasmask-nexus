

# Mapbox Territory Map Integration for /territory

## Overview
Replace the "Map view coming soon" placeholder on the `/territory` page with a fully functional Mapbox map that displays territory outlines (boroughs). Clicking a territory polygon reveals a slide-out panel listing all stores within that territory, fetched from the database.

## Architecture

```text
/territory (TerritoryOverview.tsx)
  |
  +-- viewMode === 'list'  -->  existing KPI cards + table
  |
  +-- viewMode === 'map'   -->  NEW TerritoryMapView component
                                  |
                                  +-- Mapbox GL map (dark style)
                                  |     - Borough polygon outlines (from territories.ts)
                                  |     - Store markers (lat/lng from stores table)
                                  |     - Click polygon --> select territory
                                  |
                                  +-- Slide-out panel (right side)
                                        - Territory name + store count
                                        - Searchable/filterable store list
                                        - Store details: name, address, status, phone, health
```

## Data Flow

1. **Territory Polygons**: Use existing `src/components/map/territories.ts` which already has GeoJSON-ready coordinates for Bronx, Brooklyn, Queens, Manhattan, Staten Island.

2. **Store Data**: Query `stores` table filtered by geographic bounding box of the selected territory:
   - `stores.lat` / `stores.lng` for map pins
   - `stores.address_city` for territory grouping (Brooklyn, Bronx, etc.)
   - Include: name, status, address, phone, health_score, last_visit_date

3. **Territory-to-Stores mapping**: When a user clicks a territory polygon, filter stores where `address_city` matches the borough name (with fallback logic for "New York" mapping to Manhattan).

## Implementation Steps

### Step 1: Create `TerritoryMapView` component
**File**: `src/components/territory/TerritoryMapView.tsx`

- Initialize Mapbox GL map with dark-v11 style, centered on NYC
- Add territory polygons as a GeoJSON fill+line layer (reusing `territories.ts` data)
- Color-code polygons by territory with hover opacity effect
- Fetch all geocoded stores from `stores` table (lat/lng not null)
- Render store markers on the map with status-coded colors (green=active, amber=prospect, red=inactive)
- On territory polygon click: set `selectedTerritory` state, filter stores by matching `address_city` to borough name
- Display a slide-out right panel with the filtered store list (searchable table with name, address, status, health, phone, last visit)
- On clicking a store row, fly the map to that store's coordinates and open its popup

### Step 2: Update `TerritoryOverview.tsx`
- Import and render `TerritoryMapView` when `viewMode === 'map'`
- Remove the toast placeholder ("Map view coming soon")
- Pass `cityFilter` and `stateFilter` props so the map respects existing filters

### Step 3: Borough-to-city mapping
Create a mapping object to handle city name variations in the database:
- "Brooklyn" --> `address_city IN ('Brooklyn', 'brooklyn')`  
- "Manhattan" --> `address_city IN ('Manhattan', 'New York')`
- "Queens" --> `address_city IN ('Queens', 'Jamaica', 'Ridgewood', 'Far Rockaway', 'South Richmond Hill', 'Forest Hills', 'Glendale', 'Middle Village', 'Hollis')`
- "Bronx" --> `address_city IN ('Bronx')`
- "Staten Island" --> `address_city IN ('Staten Island')`

This ensures clicking a territory polygon captures all stores belonging to that borough, even when `address_city` uses a neighborhood-level name.

## Technical Details

- **Mapbox Token**: Already available via `VITE_MAPBOX_PUBLIC_TOKEN` env variable
- **Store query**: `supabase.from('stores').select('id, name, lat, lng, status, address_street, address_city, address_state, phone, health_score, last_visit_date').not('lat', 'is', null).not('lng', 'is', null).is('deleted_at', null)`
- **No database changes needed** -- all data already exists
- **Performance**: Stores query limited to geocoded records (~1,852 stores), well within limits
- **Map interactions**: Cursor changes on hover, polygon opacity increases, click selects territory and opens panel

