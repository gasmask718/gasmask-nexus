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

## Phase 6: Worker Pay System ✅ COMPLETE

### Objective
Production-grade payroll ledger: batch-based earnings, grouped payouts, worker pay transparency.

### Key Deliverables
- ✅ `production_worker_earnings` ledger table (pending → approved → paid lifecycle)
- ✅ `production_worker_payments` payout table (grouped, reconciled)
- ✅ `pay_type` + `pay_rate` columns on `production_workers`
- ✅ `create_earning_from_submission()` DB function (SECURITY DEFINER)
- ✅ Auto-earning on submission approval (integrated into useReviewSubmission)
- ✅ Worker Pay Dashboard (read-only: today/week/unpaid/paid, earnings + payment history)
- ✅ Admin Payroll panel (balances, approve, pay, audit log, CSV export)
- ✅ RBAC-gated Payroll tab in Manufacturing OS (manager+)
- ✅ "My Pay" tab in Worker Portal
- ✅ RLS: managers read all office data, workers read only own via people.owner_id

---

## Dependencies
```
Phase 1 (State Machine) → Phase 2 (Costs need states)
Phase 1 → Phase 3 (Submissions need states)
Phase 2 + 3 → Phase 4 (AI needs cost + velocity data)
All → Phase 5 (RBAC hardens everything)
Phase 3 + 5 → Phase 6 (Pay needs submissions + RBAC)
```

---

## Previous Plan (CRM Customization) — Archived

### Completed
- Fixed CRM import to use brand_crm_contacts
- Created crm_import_logs and brand_kpi_overrides tables
- PLAYBOXXX social/country fields
- KPI edit modal
- Store reference filtering for non-store businesses

---

# Phase 2.5 — Field Execution Memory Enforcement Layer

## Status: SAVED — Awaiting activation command
## Last Updated: 2026-02-10

## Context

We have already implemented a Delivery Memory Snapshot panel that is:
- Read-only
- Auto-generated
- Rendered at the top of every delivery / visit task
- Derived from existing tables (invoices, store_contacts, store_notes, delivery_checklists)
- Designed to prevent field teams from "walking in blind"

This prompt defines the next three enforcement layers that sit after the snapshot, without altering or destabilizing the existing system.

---

## 1️⃣ Quick Capture Enforcement (Post-Task Intelligence Lock)

### Objective
Prevent loss of critical on-site knowledge after a delivery or checkup is completed.

### Rule
A delivery / visit task CANNOT be marked complete unless a structured "Field Outcome Capture" is submitted.

### Required Fields (forced modal)
- **Who did you speak to?** — Select from existing store_contacts OR create new contact inline (name + role minimum)
- **What happened?** (enum) — Order placed | Payment collected | Payment refused | Not available | Issue / conflict
- **Payment taken?** — Yes / No; if yes: amount + method
- **Notes** (free text) — Required if anything unusual occurred

### Data Handling
Writes to:
- `store_notes` (timestamped, author-tagged)
- `delivery_checklists.outcome_summary`

Updates:
- `store_contacts.last_interaction_at`
- `store_contacts.last_interaction_notes`

### Enforcement
- "Complete Task" button is disabled until submission
- No silent completion allowed

---

## 2️⃣ Pinned "Do Not Forget" Notes (Persistent Memory Flags)

### Objective
Ensure critical context is never buried in history.

### Feature
- Notes can be marked as `pinned = true`
- Pinned notes always appear in the Delivery Memory Snapshot ABOVE regular recent notes
- Stay visible until manually resolved

### Examples
- "Owner only pays on Fridays"
- "Do NOT leave product with staff"
- "Shorted us last order — verify counts"

### Rules
- Pinned notes require explicit "Resolve" action (logged: who, when, reason)
- Pinned notes appear across: Delivery tasks, Store profile, Biker/driver action lists

---

## 3️⃣ Escalation Flags (Pattern-Based Warnings)

### Objective
Surface risk patterns early without automating punishment.

### Flag Conditions (derived, not manual)
- Store unpaid > X days AND visited ≥ 2 times
- Store marked "unresponsive" across ≥ 3 interactions
- Repeated "payment refused" outcomes
- Repeated short orders / disputes

### Behavior
- Read-only, visual (badge / warning strip), non-blocking
- Placement: Delivery Memory Snapshot, Store directory KPI card, Ambassador/biker action lists

### Governance
- Flags NEVER auto-punish or auto-change store status
- Flags exist for awareness + decision-making only

---

## 4️⃣ Architectural Constraints (Non-Negotiable)
- ❌ No new payment system introduced
- ❌ No auto-deletion or auto-escalation
- ❌ No AI-generated outcomes
- ❌ No silent data writes
- ✅ All enforcement is human-driven
- ✅ All writes are auditable
- ✅ Existing tables are reused where possible
- ✅ New tables only if strictly required

---

## Build Order
1. **Quick Capture Enforcement** ← Build first
2. **Pinned Notes**
3. **Escalation Flags**
