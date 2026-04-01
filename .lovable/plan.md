
## 🔍 Audit Results
- `ut_supplier_negotiations` already exists with full schema (29 cols) — NO recreation needed
- All 6 pages exist — will UPGRADE, not rebuild
- 3 new tables needed, 1 table extension needed

## Phase 1: Database Foundation (Migration)
**Extend `ut_suppliers`** with: risk_score, verification_status, avg_response_time, avg_shipping_delay, dispute_count, successful_orders, failed_orders, communication_score, branding_score

**Create `ut_supplier_risk_profiles`**: supplier_id, risk_score, risk_level, flagged_issues_count, delay_probability, quality_risk, communication_risk

**Create `ut_sample_reviews`**: supplier_id, quality_score, branding_accuracy, packaging_score, notes, approved

**Create `ut_procurement_approvals`**: rfq_id, supplier_id, approved_by, approval_status, notes

## Phase 2: Supplier Inbox Upgrade
- AI suggested replies panel
- Unread priority sorting
- Mark as urgent / assign to team member
- Conversation tagging
- Generate Negotiation Reply / Counter Offer / Close Deal buttons
- Connect to AI edge function for message generation

## Phase 3: AI Negotiation Agent
- Negotiation panel inside Inbox
- Generate First Message / Counter Offer / Shipping Negotiation / Close Deal
- Pulls RFQ data, compares offers, tracks savings
- Uses existing `ut_supplier_negotiations` table

## Phase 4: Supplier Risk AI
- Risk score display (0-100, color coded)
- Auto-analysis of pricing anomalies, slow replies, shipping delays
- Flag/Pause/Block supplier actions
- Writes to `ut_supplier_risk_profiles`

## Phase 5: Decision Engine Upgrade
- Add Recommended/Cheapest/Fastest/Lowest Risk rankings
- Risk score penalty factor
- "Approve Supplier & Proceed" button → writes to `ut_procurement_approvals`

## Phase 6: Shipping Intelligence Upgrade
- Air vs Sea vs Express comparison UI
- Landed cost calculator with duty estimates
- Per-unit landed cost breakdown

## Phase 7: Order Handoff System
- Auto-create order record when supplier approved
- Link to RFQ, assign supplier, create shipment entry

## Phase 8: Command Dashboard Upgrade
- KPI cards: avg risk, negotiation savings %, response time, top suppliers, delayed shipments, unread conversations
- Alert system: no response >48h, overdue shipments, high-risk supplier, missing quotes

## Phase 9: Automation Rules (Edge Function)
- Auto-resend if no response
- Auto-block high-risk suppliers
- Auto-alert on delays
- Auto-preferred on good performance
- Log savings on negotiation improvements

## Phase 10: Approval Safety System
- Pre-order checklist UI (supplier approved, risk checked, shipping reviewed, branding reviewed)
- Final approval gate

## Phase 11: Learning System
- Post-order performance updates
- Actual vs expected cost/shipping tracking
- Quality outcome logging
- Auto-adjust rankings and risk scores
