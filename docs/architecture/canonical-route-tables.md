# Canonical Route Tables

**Authority:** Session 7 Step 2 (2026-05-09)
**Status:** ACTIVE

## Source of Truth

- `routes` — canonical route container (25 rows)
- `route_stops` — canonical per-stop record (6 rows)

All new feature development MUST use these tables.

## Brand-Siloed (Do Not Consolidate)

- `gasmask_route_runs` — managed by gasmask-route-agent edge function
  for brand-specific automation workflows. Owns its own lifecycle.
  Not subject to this consolidation.

## Legacy (Do Not Write New Logic Against)

| Table | Rows | Status | Reason |
|-------|------|--------|--------|
| routes_generated | 4 | Legacy | Early AI-generated drafts, superseded |
| driver_routes | 2 | Legacy | Superseded by canonical routes |
| delivery_manifest | 0 | Unused | Never populated |

## Removed

- `route_plans` — never existed in DB. Was a ghost reference in
  `useRouteBuilder.ts`. Removed from code 2026-05-09 (Session 7 Step 1).

## Migration Policy

Per Dynasty OS Core principle, no destructive deletes. Legacy tables
retained for historical data preservation. New feature development
uses canonical tables only.

## Verification

First production write to canonical via the new path:
- `routes.id = 264e0f38-5839-496c-9dc8-75457fb2519c`
- Inserted Session 7 Step 1 test
- Confirms `saveRoute()` → `routes` table works end-to-end

## Consumers Tagged Legacy (2026-05-09)

`routes_generated`:
- src/components/store/RouteIntelligence.tsx
- src/components/store/AddToRouteModal.tsx
- src/pages/MyRoute.tsx
- src/pages/RouteOpsCenter.tsx
- src/pages/RouteOptimizer.tsx
- src/pages/delivery/DriverProfile.tsx

`driver_routes`:
- src/hooks/useDrillDownData.ts
- src/hooks/useGrabbaActions.ts
- src/components/grabba/ActionModals.tsx
- src/lib/drilldown.ts
- src/pages/grabba/GrabbaDeliveries.tsx
