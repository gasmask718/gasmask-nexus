
# Live Map Upgrade: Store Pins + Delivery Assignment Details

## Current State
- `/live-map` route renders `LiveMapCommandCenter` which shows active routes, worker locations, and alerts
- The `stores` table has `lat`/`lng` columns but **zero stores have coordinates populated**
- `store_master` has no lat/lng columns at all
- The `geo_identities` table exists with a `resolve-geo` edge function, but only 1 record exists
- The existing `MapCanvas` component renders route stops and worker markers

## What Needs to Happen

### 1. Batch Geocode Stores (Database + Edge Function)
Since no stores have coordinates, we need to geocode them before they can appear on the map.

- Create a new edge function `batch-geocode-stores` that:
  - Queries stores with addresses but no lat/lng
  - Uses Mapbox Geocoding API to resolve coordinates
  - Updates `stores.lat` and `stores.lng` columns
  - Processes in batches of 50 to respect rate limits
- Add a "Geocode Stores" admin action button on the Live Map page to trigger this
- Also update the store creation/update flow to auto-geocode new stores via the existing `resolve-geo` function

### 2. Add Store Pins to MapCanvas with Viewport-Based Rendering
Modify `MapCanvas.tsx` to accept and render store markers efficiently:

- Add a new `stores` prop to `MapCanvas` with `{id, name, lat, lng, address_street, address_city, phone, status, health_status, type}`
- Listen to the map's `moveend` event to get current viewport bounds
- On each viewport change, filter stores to only those within the visible bounds
- Render only in-bounds stores as small dot markers (smaller than route stops/workers)
- On pin click, show a popup card with: store name, address (2-line postal format), phone, status badge, health status, and a "View Profile" link to `/stores/:id`
- Clear and re-render store markers on viewport change (debounced ~300ms)

### 3. Connect Delivery Assignment Details to Sidebar
Enhance the existing sidebar in `LiveMapCommandCenter`:

- Expand the route cards to show:
  - Assignee name and role
  - Route date and territory
  - Stop completion progress bar
  - Each stop's store name, status (completed/pending/skipped), and arrival time
  - Total estimated duration and distance
- When a route is selected, the `RouteDrawer` already handles detailed view -- ensure it shows all stop details with store addresses
- Add delivery assignment stats to the header stats panel: total assigned, in-progress, completed today

### 4. Wire Store Data into LiveMapCommandCenter
- Add a new query in `LiveMapCommandCenter` to fetch all stores with lat/lng coordinates from the `stores` table
- Pass stores down to `MapCanvas` as a new prop
- Add a "Stores" toggle in the filter bar to show/hide store pins
- Add store count to the stats panel

## Technical Details

### Files to Create
- `supabase/functions/batch-geocode-stores/index.ts` -- batch geocoding edge function

### Files to Modify
- `src/components/livemap/MapCanvas.tsx` -- add store pins with viewport culling, click popups
- `src/pages/delivery/LiveMapCommandCenter.tsx` -- add store query, pass to MapCanvas, add toggle + stats
- `src/components/livemap/MapFiltersBar.tsx` -- add "Show Stores" toggle
- `src/components/livemap/LiveMapLegend.tsx` -- add store pin legend entry

### Viewport Culling Logic (Performance)
```text
map.on('moveend') --> get bounds --> filter stores within bounds --> render only visible pins
```
- Debounce the moveend handler by 300ms
- Cap rendered markers at ~500 to prevent DOM overload
- Use smaller markers (10px dots) for stores vs route stops (16-24px)

### Store Popup on Click
```text
+---------------------------+
| Store Name           [badge]
| 123 Main St
| Brooklyn, NY 11201
| Phone: (555) 123-4567
| Health: Active
| [View Profile ->]
+---------------------------+
```

### Geocoding Strategy
- The `batch-geocode-stores` function uses the same Mapbox token already configured (`VITE_MAPBOX_PUBLIC_TOKEN`)
- Processes stores in chunks, updating `stores.lat` and `stores.lng` directly
- Returns count of successfully geocoded stores
- Can be re-run safely (skips stores already geocoded)
