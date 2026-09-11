# GasMask — Ching Brooklyn Field Execution Readiness

**Date:** 2026-09-12 · **Scope:** Ching's weekend Brooklyn field run only.
**Backend:** qalaaroashbggynpvqct (Nexus)

## 1. Current state (traced before any change)

| Capability | Status before | Evidence |
|---|---|---|
| Ching field identity | WORKING | auth `6019a316-…` linked to active ambassador `ching` (`903ecd8b-…`), admin retained |
| Brooklyn assignments | WORKING | 985 active assignments, 5 held ownership conflicts untouched |
| Ambassador map | **BROKEN** | `AmbassadorStoreMap` fetched coordinates with one `.in()` of 985 ids — URL overflow, no pins |
| Route list / create / add stop | **BROKEN** | `useAmbassadorRoutes` selected `stores.store_name` + `address/city/state`, none of which exist → routes query returned 400 and the page showed "no routes" |
| Start address on a route | NOT IMPLEMENTED | `routes` had no start columns |
| Practical sequencing / reroute | NOT IMPLEMENTED | only a legacy driver-wide `route-optimizer-engine` on `routes_generated` with flat 5km/30min estimates |
| Check-in / visit capture | WORKING (not linked from route) | `StoreVisitEngine` at `/ambassador/visit/:storeId` |
| Stop completion persistence | WORKING | `route_stops.status` update |
| Stray Queens assignment | REMOVED | `7792a59f-…` deactivated (not owner-approved Brooklyn scope) |

## 2. What was changed (minimum for the acceptance path)

- **Migration:** `routes.start_address`, `start_lat`, `start_lng`, `sequence_stale`, `optimized_at`.
- **New function `field-route-optimize`** (deployed): caller must be the route assignee or owner/admin;
  geocodes the start address with Mapbox; nearest-neighbour + 2-opt over the Mapbox **driving matrix**;
  writes `planned_order` on canonical `route_stops`; keeps completed/skipped stops at the tail;
  optional `autoFill` builds a route from the assignee's nearest assigned stores (max 40).
  Straight-line fallback is reported honestly as `routingMode`, never presented as road timing.
- **UI:** `FieldRouteStartCard` on `/ambassador/routes` — start address, "Set start & reorder stops",
  "Build optimized route" (when empty), stale-order warning, ETA/distance badge.
- **Route stop rows:** Directions, Store profile, **Check in** (→ `/ambassador/visit/:storeId`), Complete.
- **Fixes:** ambassador route query columns (`name`, `address_street/city/state`), stops sorted by
  planned order, map coordinate fetch chunked at 150 ids, clustering above 150 pins.

No second route system was created. `routes` + `route_stops` remain canonical.

## 3. Verification (live, Ching's own account)

- Test route `432e841e-…` created, auto-filled 8 nearest Brooklyn stores from
  "1200 Flatbush Ave" → `mapbox_driving_matrix`, 8 stops, ~8 min / 1.3 km.
- Start changed to "Coney Island Ave & Ave U" → resequenced, new order persisted in `route_stops`
  (verified in the database, not only in the response).
- `/ambassador/routes` rendered the route, ordered stops, stop map (8 mapped), no console errors.
- Check in opened the real store visit screen with live memory; **no visit or delivery was submitted**.
- Dashboard map: **976 mapped, 9 need geocoding** (was empty before the chunk fix).
- Test route and its 8 stops deleted afterwards.

## 4. Known limits (must be said out loud)

- Mapbox matrix caps at 25 coordinates: the nearest 24 stops are road-optimized, any beyond are
  appended by straight-line distance and reported as `appendedBeyondMatrixLimit`.
- Auto-fill is capped at 40 stops per route — deliberate, a day's work, not the 985-store book.
- 9 of Ching's assigned stores still have no coordinates and cannot be sequenced or mapped.
- The "Available Stores" picker still shows only the first 10 assigned stores (unchanged this pass);
  auto-fill is the practical path for building a day.
- 5 held Brooklyn ownership conflicts remain unassigned pending Ching's decision.
- Ambassador invite emails still fail with provider HTTP 403 — irrelevant to Ching (account active).
- 1,305 pre-existing database linter findings were reported by the migration and left untouched.
