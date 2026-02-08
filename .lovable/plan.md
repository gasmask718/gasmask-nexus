# Floor 6 — Manufacturing OS Upgrade Plan

## Status: Phase 5 Complete — All Phases Done
## Last Updated: 2026-02-08

---

## Architecture Overview

Floor 6 controls the lifecycle: **Raw Materials → Tubes → Boxes → Distribution**

### Existing Foundation
- 14 production tables (batches, outputs, offices, workers, attendance, closeouts, costs, history, benchmarks, communication log)
- Manufacturing OS portal (`/portals/production`) with 8 tabs
- Worker View (`/portal/production`) — read-only with mock data
- 1,285-line hooks file (`useProductionPortal.ts`)
- 20+ components in `src/components/production/`

### Three-Plane Alignment
- **Execution Plane**: Worker View (read-only tasks, controlled log submission)
- **Command Plane**: Manufacturing OS (batch management, inventory gates, approvals)
- **Intelligence Plane**: AI predictions, margin analytics, supply forecasting

---

## Phase 1: Raw Material Intake + Inventory State Machine ← CURRENT

### Objective
Track raw material receipts with supplier/cost data. Implement a state machine on production batches that gates inventory flow from raw input to office distribution.

### Database Changes

#### New Table: `production_raw_materials`
Tracks inbound material receipts with supplier, cost, and quantity.

#### New Column on `production_batches`: `inventory_state`
Values: raw | in_production | boxed | approved | sent_to_office

#### New Table: `production_inventory_transitions`
Immutable audit log for every state change on a batch.

### Frontend Changes
1. New "Inventory" tab in Manufacturing OS
2. Raw material intake form
3. Batch state pipeline visualization
4. State transition buttons with manager approval gates
5. Hard gate enforcement for CRM/distribution

### Files to Create/Modify
- Migration SQL
- `src/hooks/useRawMaterials.ts`
- `src/hooks/useInventoryState.ts`
- `src/components/production/RawMaterialIntake.tsx`
- `src/components/production/InventoryPipeline.tsx`
- `src/components/production/BatchStateControls.tsx`
- `src/pages/portals/ProductionPortalPage.tsx` — Add Inventory tab

---

## Phase 2: Cost Engine + Margin Tracking

### Objective
Calculate true cost-per-box by aggregating material costs, labor hours, and configurable overhead.

### Key Deliverables
- `production_batch_costs` table (batch_id → material + labor + overhead)
- `v_production_margin_analysis` view
- Cost breakdown panel on batch detail
- Margin analytics (admin/manager gated)
- Low-margin alerts

---

## Phase 3: Worker Submission Flow (Pending Review)

### Objective
Replace mock data in Worker View. Workers submit lbs/tubes/boxes/defects as pending_review records requiring manager approval.

### Key Deliverables
- `production_worker_submissions` table
- Approval trigger → auto-creates batch outputs
- Worker View with real data + submission forms
- Approval queue in Manufacturing OS

---

## Phase 4: AI Supply Prediction

### Objective
Predict reorder dates for consumables using batch velocity + sales + lead times.

### Key Deliverables
- `production_supply_predictions` table
- `production_supplier_lead_times` table
- AI prediction panel with explainable outputs
- Configurable thresholds

---

## Phase 5: Production RBAC Hardening ✅ COMPLETE

### Objective
Enforce production_admin / production_manager / production_worker roles server-side.

### Key Deliverables
- ✅ DB functions: `has_production_manager_role`, `is_production_worker`
- ✅ `production_access_denials` audit table with RLS
- ✅ Hardened RLS on: batch_costs, overhead_config, supplier_lead_times, supply_predictions, worker_submissions, raw_materials
- ✅ Finance-gated cost/margin visibility (has_finance_access + elevated roles only)
- ✅ Frontend RBAC hook (`useProductionRBAC`) with tier system (admin/manager/worker/none)
- ✅ `ProductionRBACGate` component wrapping sensitive tabs
- ✅ Conditional tab visibility (Costs, Forecasts, Submissions hidden for lower tiers)
- ✅ Access denial audit logging on unauthorized view attempts

---

## Dependencies
```
Phase 1 (State Machine) → Phase 2 (Costs need states)
Phase 1 → Phase 3 (Submissions need states)
Phase 2 + 3 → Phase 4 (AI needs cost + velocity data)
All → Phase 5 (RBAC hardens everything)
```

---

## Previous Plan (CRM Customization) — Archived

### Completed
- Fixed CRM import to use brand_crm_contacts
- Created crm_import_logs and brand_kpi_overrides tables
- PLAYBOXXX social/country fields
- KPI edit modal
- Store reference filtering for non-store businesses
