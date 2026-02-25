
# Product-Aware Box Conversion Engine (Tubes + Bags) — COMPLETED

## Architecture

Two-layer conversion model:
- **Layer 1:** lbs → product_output_units (tubes or bags)  
- **Layer 2:** product_output_units → boxes_produced (auto: floor(units ÷ 100))

The **box** is the economic unit. The **product unit** (tube or bag) captures yield physics.

## What Was Built

### Database Migration
- `boxes_produced` now auto-calculated via trigger: `floor(product_output_units / 100)`
- Added `conversion_boxes_per_lb_snapshot`, `time_per_box_snapshot` to `production_batches`
- Added `baseline_time_per_box` to `production_conversion_baseline`
- Updated snapshot trigger to capture both unit and box level ratios at approval
- Backfilled existing tube records: `product_output_units = boxes_produced * 100`
- Recreated `v_tobacco_conversion_intelligence` with both layers: units_per_lb, boxes_per_lb, time_per_unit, time_per_box

### Hooks Updated
- `useConversionIntelligence` — tracks both unit and box level stats, time_per_box, fastest/slowest by box
- `useConversionBaseline` — includes baseline_time_per_box
- `useInventoryState` — validation now checks product_output_units (boxes auto-derived)

### UI Components Updated
- `DailyBatchEntry` — Product Type dropdown, Product Units Produced input, auto-calculated Boxes display, real-time two-layer conversion preview (units/lb, boxes/lb, lbs/unit, lbs/box)
- `BatchStateControls` — Approval dialog shows full two-layer conversion summary with boxes
- `ConversionIntelligencePanel` — Shows both units/lb and boxes/lb KPIs, batch table with both layers, time/box
- `ProductionEfficiencyPanel` — Time intelligence now uses time/box as primary metric with unit-level secondary

## Still Available for Future
- War Room product toggle (Section 9)
- Demand integration per product_type (Section 7)
- Procurement forecasting per product baseline (Section 8)
- Raw material allocation discipline (product-reserved pools)
- Changeover/setup time tracking between product types
