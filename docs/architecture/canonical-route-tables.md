# Canonical Route Tables

**Authority:** Session 7 Step 2 (2026-05-09) · Updated Phase 6 (2026-05-30)
**Status:** ACTIVE

## Source of Truth

- `routes` — canonical route container
- `route_stops` — canonical per-stop record

All route reads and writes MUST use these tables. The `source` enum distinguishes origin:

| `source` value   | Origin                                      |
|------------------|---------------------------------------------|
| `manual`         | Admin-built routes                          |
| `optimizer`     | Auto-optimizer output                       |
| `gasmask_agent`  | gasmask-route-agent edge function           |
| `grabba_biker`   | Grabba biker delivery routes                |

### Universal Assignment Target

`routes.assigned_to = person.user_id` for ALL assignee types
(driver, biker, ambassador). Portals filter by `assigned_to = auth.uid()`.
Prerequisite: the assignee must have a provisioned auth account
(`user_id IS NOT NULL` on their role row).

Role-specific assignment tables (`driver_assignments`, etc.) remain as
secondary metadata but are not the source of truth for "who owns this
route".

## Legacy / Deprecated (Do Not Write — Reads Only For Historical Data)

Per Dynasty OS no-destructive-migration policy, these tables are retained
for historical preservation but receive no new writes:

| Table                  | Status     | Replaced By                                  |
|------------------------|------------|----------------------------------------------|
| `gasmask_route_runs`   | LEGACY     | `routes` WHERE `source='gasmask_agent'`      |
| `biker_routes`         | LEGACY     | `routes` WHERE `source='grabba_biker'`       |
| `routes_generated`     | LEGACY     | `routes` (canonical)                         |
| `driver_routes`        | LEGACY     | `routes` (canonical)                         |
| `delivery_manifest`    | UNUSED     | n/a — never populated                        |

The `gasmask-route-agent` edge function was rewritten in Phase 3 to write
to canonical `routes` + `route_stops`. The one historical
`gasmask_route_runs` row was migrated in Phase 2
(route `d0e11cf3-4bc5-42a5-b08c-743a047739e2`); its stops were backfilled
into `route_stops` in Phase 4.5 (1 of 3 stops resolved; 2 await store
creation for dangling triggers).

`biker_routes` has 0 rows and 0 active writers as of Phase 5 (2026-05-30).

## Removed

- `route_plans` — never existed in DB. Ghost reference in
  `useRouteBuilder.ts`. Removed 2026-05-09 (Session 7 Step 1).

## Migration Policy

No destructive deletes. Legacy tables retained for historical data
preservation. All new feature development uses canonical tables only.

## Remaining Legacy Consumers (READ-ONLY)

`gasmask_route_runs` — no active app reads (edge function rewritten).

`biker_routes` — read-only:
- `src/services/excelExportService.ts` (bulk export — historical)
- `src/config/floorExportConfig.ts` (export config — historical)
- `src/hooks/useDataHealing.ts` (data heal scan)
- `src/hooks/useInsightPanel.ts` (insight panel)
- `src/components/system/MissingLinksPanel.tsx` (orphan scan)
- `src/lib/commands/CommandEngine.ts` (proxy metric — flagged for migration)
- `supabase/functions/gdrive-backup/index.ts` (backup snapshot)

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
