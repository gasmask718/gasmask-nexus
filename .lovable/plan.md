

# Harden Auto-Reserve Engine: Product-Specific Velocity + Survival Floor

## Overview
Upgrade the `auto-reserve-materials` edge function from "good enough" to production-grade by eliminating the approximate `/2` velocity split, enforcing minimum survival coverage, adding real divergence detection, tiered buffer alerts, and full run auditability.

## Database Changes (3 migrations)

### Migration 1: Update `v_sku_sales_velocity` view to include `product_type`
The current view groups velocity by `brand` only. We need to join `invoice_line_items.product_id` to `products.track_by` so velocity data carries a `product_type` column (tubes/bags). This is the root fix -- without it, the edge function has no way to split velocity accurately.

```sql
CREATE OR REPLACE VIEW v_sku_sales_velocity AS
-- Same CTE structure but joins products table to get track_by as product_type
-- Groups by (brand, product_type) instead of just brand
```

The `v_inventory_coverage_intelligence` view that depends on this will also need updating to include `product_type`.

### Migration 2: Create `product_velocity_ratio_baseline` table
Stores the historical baseline ratio of bags-to-tubes velocity per office for divergence detection.

- `id` (uuid, PK)
- `office_id` (uuid, FK to production_offices)
- `baseline_ratio` (numeric) -- bags_velocity / tubes_velocity
- `last_updated_at` (timestamptz)
- RLS: authenticated read/write

### Migration 3: Create `allocation_run_logs` table
Full audit trail for every nightly allocation run.

- `id` (uuid, PK)
- `office_id` (uuid)
- `total_lbs` (numeric)
- `total_reserved` (numeric)
- `unallocated_pct` (numeric)
- `divergence_ratio` (numeric, nullable)
- `alerts_fired` (integer)
- `survival_floor_enforced` (boolean)
- `run_timestamp` (timestamptz, default now())
- RLS: authenticated read, service role write

## Edge Function Changes: `auto-reserve-materials/index.ts`

### Section 1: Remove velocity split
Replace the `velocity.reduce(...) / 2` approximation with proper grouping:

```typescript
const dailyUnitsByProduct: Record<string, number> = { tubes: 0, bags: 0 };
for (const v of velocity || []) {
  const type = v.product_type;
  if (type && dailyUnitsByProduct.hasOwnProperty(type)) {
    dailyUnitsByProduct[type] += Number(v.avg_daily_velocity_30d) || 0;
  }
}
```

Then in the product loop: `const dailyUnits = dailyUnitsByProduct[productType] || 0;`

### Section 2: Hard minimum coverage floor
Define `MIN_SURVIVAL_DAYS = 20`. After proportional scaling, enforce:

```typescript
const survivalFloor = dailyLbsUsage * MIN_SURVIVAL_DAYS;
if (scaledLbs < survivalFloor) scaledLbs = survivalFloor;
```

If total after floor enforcement exceeds `totalLbs`, fire a CRITICAL alert (`inventory_insufficient_survival_floor`) instead of silently violating the floor.

### Section 3: Real divergence detection
After velocity is grouped, compute `bagsVelocity / tubesVelocity` ratio. Compare against `product_velocity_ratio_baseline` table. If deviation exceeds 25%, fire a warning alert (`demand_divergence_detected`). Update baseline ratio on each run.

### Section 4: Tiered buffer alerts
Replace the single `<10%` check with three tiers:
- `< 15%` -- severity: `warning`
- `< 8%` -- severity: `high`
- `< 5%` -- severity: `critical`

### Section 5: Guard against negative/NaN
Add `if (autoLbs < 0 || isNaN(autoLbs)) autoLbs = 0;` before writing. Guard all division operations with `NULLIF`-style checks (`denominator || 1`).

### Section 6: Audit logging
At the end of each office loop iteration, insert a row into `allocation_run_logs` with all computed metrics for full traceability.

## Files Modified
- `supabase/functions/auto-reserve-materials/index.ts` -- full rewrite of allocation logic
- 3 database migrations (view update, 2 new tables)

## No Frontend Changes
This is purely backend hardening. The existing production dashboard and alert surfaces will automatically surface the new alert types.

