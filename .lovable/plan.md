

# Live Map Upgrade: All Stores + Better Pins + Rider Locations

## What Changes

### 1. Geocode All 2,850+ Remaining Stores
The `batch-geocode-stores` edge function currently caps at 200 stores per run. It needs to be updated to handle all remaining stores (2,843 without coordinates out of 2,959 total).

- Increase the query limit from 200 to 1000
- The frontend geocode button will need to be invoked multiple times (or we auto-loop), but each run processes up to 1000 stores in batches of 50 with rate-limit pauses
- The Geocode button should always be visible (not just when `totalStores === 0`) so ops can re-run for newly added stores

### 2. Redesign Store Pin to Classic Map Pin Shape
Replace the current small amber dot with a proper teardrop/map-pin SVG marker. This is the classic pin design users expect on maps.

- Use an inline SVG for the pin shape (teardrop with circle top) in amber/gold color
- Size: roughly 24px tall, visible but not overwhelming
- Remove all hover animations (`mouseenter`/`mouseleave` scale transitions) as requested
- Keep the click-to-popup behavior

### 3. Redesign Store Popup Card
Replace the current raw HTML popup with a cleaner, more structured layout:

- Store name (bold) with status badge (colored pill)
- 2-line postal address (Street / City, State ZIP)
- Phone number
- Health score as a small progress indicator
- Store type label
- "View Profile" link to `/stores/:id`
- Better spacing, font hierarchy, and dark-theme-friendly styling

### 4. Plot Live Rider (Driver/Biker) Locations with Target Lines
Currently workers already render as circle markers. The upgrade:

- Draw a dashed line from each worker's live GPS position to their current target stop (the next pending stop on their active route)
- This visually connects the rider to where they're heading
- Line style: dashed, color-matched to the worker's role color, semi-transparent
- Only draw the line if the worker has an active route with a pending stop that has coordinates
- Lines update automatically as worker locations and route data refresh

## Technical Details

### Files to Modify

**`supabase/functions/batch-geocode-stores/index.ts`**
- Change `.limit(200)` to `.limit(1000)` to process more stores per invocation

**`src/components/livemap/MapCanvas.tsx`**
- Replace amber dot element with SVG teardrop pin for store markers
- Remove `mouseenter`/`mouseleave` hover animation listeners
- Redesign popup HTML with cleaner card layout
- Add worker-to-target-stop dashed line rendering using Mapbox `addSource`/`addLayer` with `line-dasharray`
- Match each worker to their active route's next pending stop for the line endpoint

**`src/components/livemap/MapFiltersBar.tsx`**
- Remove the condition `stats.totalStores === 0` from Geocode button so it's always available

**`src/components/livemap/LiveMapLegend.tsx`**
- Update store legend entry to show the new pin shape instead of the amber dot

### Worker-to-Target Line Logic
```text
For each worker with an active route:
  1. Find route where route.assigned_to === worker.worker_id
  2. Find the first stop with status !== 'completed' (next target)
  3. If target stop has store coordinates, draw dashed line from [worker.lng, worker.lat] to [stop.store.lng, stop.store.lat]
  4. Color the line to match worker role (blue for driver, cyan for biker)
  5. Clean up and redraw lines on every worker/route data refresh
```

### Pin SVG Design
A classic teardrop map pin rendered as an inline SVG element, amber-colored with white center dot, approximately 24x32px.

### Performance
- Viewport culling remains in place (only in-bounds stores render)
- 500-marker cap stays
- Debounced viewport updates stay at 300ms
- Worker target lines use Mapbox native layers (GeoJSON sources) for performance

