

# Plan: Fix Missing Delivery Trajectories on Live Map

## Problem
The delivery trajectory lines are not appearing because the assigned worker (Biker "Beans") has no valid GPS location -- only `(0, 0)` login pings which are correctly filtered out. The code requires a worker position on the map to draw a line from worker to destination, so when no GPS exists, nothing renders.

## Solution
Two changes to ensure delivery destinations and paths always appear:

### 1. Show Destination Pins Even Without Worker Location (MapCanvas.tsx)
Currently the code skips the entire task rendering if `worker` is not found on the map. We will split the logic:
- **Always** render the destination pin/marker for active delivery tasks (so admins see where deliveries are headed)
- **Only** draw the trajectory line when a worker location exists

### 2. Use Store (Pickup) Location as Fallback Origin (useLiveMapData.ts)
When no worker GPS location is available, use the store's coordinates as a fallback to draw a "pickup -> delivery" trajectory. This gives dispatchers visual context even when the worker is offline/no-GPS.

Changes:
- In `useLiveDeliveryTasks`, also fetch the store's `lat`/`lng` from the `stores` table and include `pickup_lat`/`pickup_lng` on `LiveDeliveryTask`
- In `MapCanvas.tsx`, when drawing trajectory lines: if worker location is missing but pickup coordinates exist, draw the line from pickup to destination instead

---

## Technical Details

### File 1: `src/hooks/useLiveMapData.ts`
- Update `LiveDeliveryTask` interface to add `pickup_lat` and `pickup_lng` fields
- In `useLiveDeliveryTasks`, after resolving biker/driver info, also fetch store coordinates:
  - Get `store_id` from the joined `store_orders`
  - Fetch `lat`/`lng` from the `stores` table for those store IDs
  - Map pickup coordinates onto each task result

### File 2: `src/components/livemap/MapCanvas.tsx`
- In the `drawDeliveryLines` function (around line 463):
  - Move destination pin rendering OUTSIDE the `if (!worker) return` guard so pins always show
  - For the trajectory line: use `worker.lng/lat` if available, otherwise fall back to `task.pickup_lng/pickup_lat`
  - Only skip the line entirely if NEITHER worker location NOR pickup location exists

### Files Changed (2 files)
1. `src/hooks/useLiveMapData.ts` -- add pickup coordinates to delivery task data
2. `src/components/livemap/MapCanvas.tsx` -- always show destination pins; use pickup location as fallback for trajectory lines

