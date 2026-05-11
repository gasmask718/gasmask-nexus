# Canonical Date Formatting

**Authority:** Store Profile Quickview Fix (2026-05-11)
**Status:** ACTIVE

## Utility

All operator-facing date displays MUST use one of:

- `dynastyDate(value)` — smart: relative if <7d, `MMM d, yyyy` else
- `dynastyDateTime(value)` — adds time component
- `dynastyRelative(value)` — always relative (`3 days ago`)
- `dynastyDateAbsolute(value)` — always year-bearing absolute

Located at: `src/lib/dates.ts`

## Why

Distribution paused for multiple months. Operators see dates from 2024,
2025, 2026 mixed together. Showing `Jan 17` without a year causes operators
to mis-judge recency, leading to:

- Wrong pitch urgency
- Mis-calibrated reactivation strategy
- Eroded trust in dashboard data

## Exceptions

These files use `format()` with ISO-style strings (`yyyy-MM-dd`) for INPUT
values (date pickers, query parameters). These are CORRECT as-is and should
not be replaced with the utility:

- `AddToRouteModal`
- `ActionModals`
- `TubeCounterCard`

## Enforcement

In future code review:

- `format(date, 'MMM d')` without year → REJECT, use `dynastyDate`
- `format(date, 'MMM d, yy')` (2-digit year) → REJECT, use `dynastyDate`
- `format(date, 'MM/dd/yyyy')` → consider `dynastyDate` for consistency
- Other formats: consider if `dynastyDate`/`dynastyDateTime` would suit

---

# Canonical Inventory Source

**Authority:** Store Profile Quickview Fix (2026-05-11)

## Source of Truth

`store_tube_inventory.current_tubes_left` — operator-logged real inventory
(per-brand). Logged by bikers, drivers, and ambassadors during field visits.

## Consumers (now aligned)

- `v_store_tube_summary.current_inventory_count` — chip quickview, store
  directory cards (`Stores.tsx:1196`), and dependent views
  (`v_reactivation_targets`, `v_neighborhood_tube_intel`).
- `UnifiedTubeIntelligenceCard` — detail view
- `EditableTubeInventoryCard` — edit surface

## Update Paths

- Bikers/drivers/ambassadors: `EditableTubeInventoryCard`
- Visit forms: `useVisitProducts`
- Bland AI: `aiTasks.ts`
- Grabba console: `useGrabbaActions`, `useGrabbaData`

## Legacy / DO NOT USE for current inventory

- `v_store_tubes_on_hand` — derived from invoice deliveries, represents
  "total ever delivered IN," NOT current physical stock. Double-counts
  every delivered tube as if still on the shelf.
- `tube_inventory_ledger` — empty (0 rows) at fix time.
- `tube_sale_ledger` — invoice line-item plant log, not inventory truth.

## Migration

Single `CREATE OR REPLACE VIEW` rewired the `on_hand` CTE inside
`v_store_tube_summary` to `SUM(current_tubes_left) FROM store_tube_inventory
WHERE brand <> 'hotscolatti'`. No schema change, no UI churn — every
consumer of `current_inventory_count` repointed atomically.
