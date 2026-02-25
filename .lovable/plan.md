
# Product-Aware Box Conversion Engine — HARDENED

## Architecture

Two-layer conversion model:
- **Layer 1:** lbs → product_output_units (tubes or bags)  
- **Layer 2:** product_output_units → boxes (100 units = 1 box)

### Precision Model
- `boxes_full` = floor(units / 100) — for packaging/shipments
- `units_remainder` = units % 100 — tracked, never lost
- `boxes_equivalent` = units / 100.0 — used for ALL yield math, variance, baselines

### Time Model
- `production_time_minutes` — gross time
- `changeover_minutes` — setup time when switching product types
- `net_production_minutes` = gross - changeover — used for time/unit, time/box calculations
- Both gross and net snapshots stored at approval

### Approval Guardrails
- product_units_produced > 0
- production_time_minutes > 0
- boxes_equivalent > 0
- product_type required

### Baselines
- Grouped by: office_id + product_type + shift_label (optional)
- Uses boxes_equivalent for box-level baselines
- Separate time baselines: baseline_time_per_unit, baseline_time_per_box

## Database Columns Added
- `boxes_full` (generated stored)
- `units_remainder` (generated stored)
- `boxes_equivalent` (generated stored)
- `changeover_minutes` (integer, default 0)
- `net_production_minutes` (generated stored)
- `time_per_unit_net_snapshot`, `time_per_box_net_snapshot`
- `shift_label` on production_conversion_baseline

---

# Product-Reserved Material Pools (IMPLEMENTED)

## Architecture

Logical raw material allocation so tubes and bags maintain independent coverage floors while sharing the same physical tobacco inventory.

### Tables
- `raw_material_inventory` — single source of truth for physical tobacco per office
- `raw_material_allocations` — logical reservation per office + product_type
- `raw_allocation_overrides` — audit trail for manual override changes
- `v_material_allocation_overview` — computed view with unallocated buffer

### Auto-Reservation Engine
- Edge function `auto-reserve-materials` calculates demand-based reservations
- Uses velocity data + baseline_units_per_lb per product_type
- Proportional scaling when total demand > available inventory
- Fires "Raw Buffer Risk" alert when unallocated < 10%

### Draft Enforcement
- `useAllocationCheck` hook validates proposed lbs against unallocated buffer
- Batch creation blocked if proposed_lbs > unallocated_lbs
- Warning displayed inline in tobacco input field

### Manual Override
- Executive can adjust manual_reserved_lbs per product_type
- All overrides logged to raw_allocation_overrides with reason + user

### UI
- `RawAllocationPanel` in Inventory tab shows:
  - Total LBS, Tubes Reserved, Bags Reserved, Unallocated Buffer, Coverage Status
  - Auto vs Manual breakdown
  - Override history log
  - Set Inventory + Auto-Reserve buttons

## Still Available for Future
- War Room product toggle
- Demand integration per product_type
- Procurement forecasting per product baseline
- Demand divergence auto-adaptive allocation (60-day growth curves)
- Per-shift baseline auto-calculation when enough data exists
