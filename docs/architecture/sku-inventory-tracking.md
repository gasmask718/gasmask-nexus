# SKU-Level Inventory Tracking

**Authority:** Session 8 Migration (2026-05-11)
**Status:** ACTIVE

## Single Source of Truth

All inventory data flows from `store_tube_inventory` keyed by `product_id`. The brand string field is retained for backwards compatibility but no longer used for lookups.

## Canonical SKU Catalog

9 SKUs in `src/lib/inventory/skuDisplay.ts`:

- `CANONICAL_TUBE_SKUS` array
- Each has `product_id`, `display` name, `parent_brand`, `order`
- `inventory_keys` field removed (was legacy brand-string alias mapping)

## Surfaces Using Canonical 9 SKUs

- Tube Intelligence section (entry)
- Stock Breakdown chip (read)
- Lifetime by SKU chip
- Prior Month by SKU chip
- Last 30 Days by SKU chip

All surfaces show identical SKU vocabulary and inventory counts.

## Writers Save product_id

All writers persist `product_id` to `store_tube_inventory`:

- `UnifiedTubeIntelligenceCard`
- `EditableTubeInventoryCard`
- `UpdateInventoryModal`
- `useVisitProducts`
- `aiTasks` (Bland AI — uses `brandToDefaultProductId` helper)
- `useGrabbaActions` / `useGrabbaData`

## Cache Invalidation

`invalidateStoreInventoryQueries` in `src/lib/inventory/invalidation.ts` invalidates all SKU-related caches on every write. Updated keys include:

- `store-inventory-by-brand`
- `store-tube-summary`
- `store-lifetime-by-sku`
- `store-sold-by-sku-window`
- `store-recent-invoices-sku`

## Historical Backfill Note

17 pre-migration inventory rows were provisionally mapped:

- `gasmask` + `gasmasktubes` (11 rows, 342 tubes) → GasMask Tubes Box
- `grabba` (3 rows, 55 tubes) → Grabba R Us
- `hotmama` (3 rows, 29 tubes) → Hot Mama

These categorizations will be naturally corrected as operators verify inventory through Tube Intelligence during normal field operations.

## Future Work (Backlog)

- Operator UI for bulk SKU reclassification (if needed after field operations reveal patterns)
- SKU-level velocity tracking
- SKU-level replenishment recommendations
- SKU-level margin and pricing analysis
