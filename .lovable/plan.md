

# Four-Engine Production Governance Deployment

## Strategic Sequence
All four engines are interdependent but will be built in the recommended governance-first order:
1. Hard Gate Override Enforcement (control)
2. Alert Engine (awareness)  
3. Auto-Draft Production Batches (automation)
4. Executive War Room Dashboard (clarity)

---

## Engine 1: Hard Gate Override Enforcement

### Database Migration
- Add columns to `production_demand_overrides`: `deviation_pct numeric`, `is_high_override boolean DEFAULT false`
- The table already exists with `brand`, `recommended_lbs`, `actual_lbs`, `override_reason`, `acknowledged_by`, `batch_id` -- we just extend it

### Hook: `useDeviationGate.ts`
- New hook that accepts `proposedLbs` and `brand`
- Fetches `recommended_lbs_to_produce` from `v_inventory_coverage_intelligence` for that brand
- Calculates `deviation_pct = ABS(proposed - recommended) / recommended * 100`
- Returns `{ deviationPct, recommended, requiresOverride: deviation > 20, isHighOverride: deviation > 35 }`

### UI Intercept in `DailyBatchEntry.tsx`
- Before `handleCreateBatch` fires, call the deviation gate
- If `deviation > 20%`: show a blocking `AlertDialog` modal with:
  - Deviation percentage display
  - `override_reason` textarea (min 20 chars validated)
  - Acknowledgement checkbox: "I understand this overrides demand intelligence"
  - Both must be completed to proceed
- On confirm: insert into `production_demand_overrides`, then proceed with batch creation
- If `deviation <= 20%`: batch creates normally (no gate)

### Override Audit Panel: `OverrideAuditPanel.tsx`
- New component showing 30-day override stats: total overrides, avg deviation %, top managers by count
- Simple trend line (recharts) of override frequency
- Gated to admin/manager via `useProductionRBAC`

### Executive Flag
- When `deviation > 35%`: set `is_high_override = true` in the override record
- These will surface in the War Room (Engine 4) under a dedicated high-override alert

---

## Engine 2: Automated Alert Engine

### Database Migration
- Create `system_alerts` table:
  - `id`, `alert_type` (stockout_critical, supplier_low, production_risk, demand_accelerating, high_override), `brand`, `severity` (warning, critical), `message`, `recommended_action`, `dashboard_link`, `resolved boolean DEFAULT false`, `resolved_at`, `resolved_by`, `created_at`
  - `throttle_key text` + unique constraint on `(throttle_key, DATE(created_at))` to enforce 24h dedup per brand+type
- RLS: authenticated read; insert via edge function service role

### Edge Function: `production-alert-engine/index.ts`
- Invoked via cron (nightly or on-demand)
- Queries `v_inventory_coverage_intelligence` for `risk_level = 'critical'`
- Queries supplier efficiency scores < 40
- Queries `production_demand_overrides` for `deviation_pct > 35` in last 24h
- Queries demand acceleration (14d velocity > 30d velocity * 1.20)
- For each triggered condition:
  - Check `system_alerts` for existing throttle_key on same date -- skip if exists
  - Insert alert row
  - (Future: Slack/SMS/Email hooks can be wired to this table -- connectors checked at that time)

### Alert History Panel: `AlertHistoryPanel.tsx`
- Read-only panel: severity badge, type, brand, timestamp, resolved status
- Admin can mark alerts as resolved
- Accessible from executive navigation

---

## Engine 3: Auto-Draft Production Batches

### Database Migration
- Add columns to `production_batches`:
  - `generated_by_system boolean DEFAULT false`
  - `system_generation_note text`

### Edge Function: `auto-draft-batches/index.ts`
- Scheduled via pg_cron at 2 AM daily
- Queries `v_inventory_coverage_intelligence` for brands where `recommended_lbs_to_produce > 0 AND risk_level IN ('red', 'critical')`
- For each qualifying brand:
  - Insert into `production_batches` with `status = 'draft'`, `generated_by_system = true`, `tobacco_lbs = recommended_lbs`, `system_generation_note = 'Auto-Drafted from Demand Intelligence'`
  - Uses first active office as `office_id` (or configurable default)
- Inserts a `system_alerts` row of type `auto_draft_created` for visibility

### UI Treatment in `DailyBatchEntry.tsx`
- Auto-drafted batches display a distinct badge: "System Draft"
- Manager actions: Approve (move to open), Modify (edit lbs, then approve), Delete
- Modifications and deletions are logged to `production_demand_overrides` for audit

### Executive Metric
- Track in the War Room: auto-drafts accepted / modified / rejected ratios

---

## Engine 4: Executive War Room Dashboard

### New Page: `ProductionWarRoom.tsx`
A single-page consolidated view with four zones:

**Top KPI Bar** (6 metrics):
- Global Conversion Baseline (from `production_conversion_baseline`)
- Avg Supplier Efficiency (from supplier scorecard views)
- Total Days of Coverage (weighted avg across brands)
- Production Risk Score (composite from alert counts + critical SKUs)
- Procurement Needed Next 30d (sum from coverage intelligence)
- Override Rate 30d (count from `production_demand_overrides`)

**Left Panel -- Demand Risk**:
- Brands sorted by `risk_level` with coverage bars and accelerating/declining icons
- Reuses `CoverageBar`, `RiskBadge`, `DemandTrend` from `SalesVelocityPanel`

**Center Panel -- Production Health**:
- Rolling 30-batch yield trend (recharts line chart from `production_batches` approved data)
- Active variance alerts (from existing variance system)
- Office comparison (bars by office conversion ratio)

**Right Panel -- Procurement and Suppliers**:
- Supplier ranking cards (from `SupplierYieldRankingPanel` data)
- Procurement needed lbs per brand
- Raw inventory health bars
- Stability scores

**Alert Banner (Top)**:
- If any `system_alerts` with `resolved = false` and `severity = 'critical'` exist: red pulsing banner
- Also surfaces high overrides (`is_high_override = true` in last 7 days)

### Routing
- Page at `/portals/production/war-room`
- Added to Layout sidebar under Production section
- Gated to admin tier via `useProductionRBAC`

---

## Technical Summary

| Artifact | Type |
|---|---|
| 1 SQL migration | Schema: `system_alerts` table, `production_batches` columns, `production_demand_overrides` columns |
| `useDeviationGate.ts` | Hook |
| `OverrideAuditPanel.tsx` | Component |
| `AlertHistoryPanel.tsx` | Component |
| `ProductionWarRoom.tsx` | Page + Component |
| `production-alert-engine/index.ts` | Edge Function |
| `auto-draft-batches/index.ts` | Edge Function |
| Modified: `DailyBatchEntry.tsx` | Override gate + system draft badges |
| Modified: `Layout.tsx`, `AppRoutes.tsx` | Routing for war room + alert history |
| Modified: `production/index.ts` | Exports |

