# GasMask OS — Sprint Execution Plan

## Scope Summary

This plan covers all actionable items from the master checklist, organized into 3 implementation sprints. Items already complete are excluded.

---

## What Is Already Done (No Work Needed)


| Item                          | Evidence                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| 10-Point Tube Ledger Audit    | `v_tube_integrity_check` view + `TubeIntegrityPanel` live                                                 |
| Void Logic (reverse deltas)   | `void_invoice` RPC posts compensating ledger entries                                                      |
| Loose Tube Schema             | `price_per_tube` column exists; invoice snapshots both prices                                             |
| Payment Status Lockdown       | `BrandPaymentQuickView` restricted to `pay_upfront` / `bill_to_bill`                                      |
| Store Pagination              | `.range()` pagination in `Stores.tsx` and `GrabbaCRM.tsx`                                                 |
| Switch Tubes Feature          | `store_tube_inventory_status` + `UnifiedTubeIntelligenceCard` + `useStoreTubeSwitches`                    |
| Template Manager              | `TemplatesLibrary` with full CRUD on `communication_templates`                                            |
| VIP AI Calling (ElevenLabs)   | `twilio-elevenlabs-bridge` fully wired                                                                    |
| Enterprise Fulfillment Guards | All 4 DB triggers deployed (shipment guard, immutable tracking, inventory decrement, negative protection) |
| Store Notes Section           | Uses modal-based add/edit with explicit Save — compliant with draft pattern                               |


---

## Sprint 1: Data Integrity and Quick Wins

### 1.1 Address Data Cleanup Migration

**Problem**: Legacy `store_master` records may have `address` populated but `city`/`state` columns NULL.

**Action**: Create a SQL migration that parses "City, State ZIP" patterns from the `address` column into the structured `city`, `state`, and `zip` columns where they are currently NULL.

```text
Migration logic:
  - Split address on commas
  - Extract last segment as "State ZIP"
  - Extract second-to-last segment as City
  - Only update rows where city IS NULL AND address IS NOT NULL
  - Flag unparseable addresses with address_country = 'NEEDS_REVIEW'
```

### 1.2 Notes Field Audit (Draft Pattern Compliance)

**Problem**: Need to verify no remaining note textareas mutate the database on every keystroke.

**Action**: Audit `CustomerNotesSimpleEditor`, `EntityNotesSection`, `BrandScopedNotesSection`, and `PinnedNotesSection`. From the code review:

- `CustomerNotesSimpleEditor` -- already uses local state + Save button (compliant)
- `StoreNotesSection` -- uses modal-based add/edit (compliant)
- `PinnedNotesSection` -- uses local state + Pin button (compliant)

**Remaining**: Scan for any inline note `textarea` in store detail pages or CRM profiles that calls a mutation `onChange`. Fix any found to use `draftNotes` + Save button.

### 1.3 Export Limit Hardcoding

**Problem**: `exportUtils.ts` has no row limit -- it exports whatever array is passed.

**Action**: Add a `MAX_EXPORT_ROWS = 10000` constant and slice the data array before export, with a toast warning if truncated.

**File**: `src/utils/exportUtils.ts`

---

## Sprint 2: New Surfaces (Wholesaler + AI Note Audit)

### 2.1 Wholesaler Transaction History Page

**Purpose**: Show wholesalers their purchase/invoice history with Dynasty (buying from us).

**New file**: `src/pages/portal/wholesaler/WholesalerTransactionHistory.tsx`

**Implementation**:

- Query `invoices` table filtered by `entity_type = 'wholesaler'` and `entity_id = wholesaler.id`
- Display a table with: Invoice ID, Date, Line Items summary, Total, Payment Status
- Include date range filter and CSV export
- Follow existing wholesaler portal patterns (back arrow, card layout)

### 2.2 Wholesaler Inventory Workflow Page

**Purpose**: Show wholesalers their current product inventory levels and sell-through.

**New file**: `src/pages/portal/wholesaler/WholesalerInventoryWorkflow.tsx`

**Implementation**:

- Query `products_all` filtered by `owner_id = wholesaler.user_id`
- Show product cards with: Name, SKU, Current Qty, Low Stock badge, Last Updated
- Include restock alerts for items below `min_reorder_qty`
- Show basic sell-through trend (orders fulfilled vs inventory remaining)

### 2.3 Route and Navigation Wiring

**Files to modify**:

- `src/routes/AppRoutes.tsx` -- add `/portal/wholesaler/transactions` and `/portal/wholesaler/inventory` routes
- `src/pages/portal/wholesaler/index.ts` -- export new pages
- `src/pages/portal/wholesaler/WholesalerDashboard.tsx` -- add navigation links to Quick Actions

### 2.4 AI Note Audit Panel

**Purpose**: Surface store notes that mention orders/deliveries but have no matching invoice.

**New file**: `src/components/diagnostics/NoteAuditPanel.tsx`

**Implementation**:

- Query `audit_flags` where `flag_type = 'MISSING_INVOICE'` joined with `audit_note_events`
- Display as a table: Store Name, Note Date, Note Excerpt, Confidence, Status
- Include a "Run Audit" button that invokes the `audit-note-parser` edge function
- Add to the Module Diagnostics page alongside `TubeIntegrityPanel`

**File to modify**: `src/pages/ModuleDiagnosticsPage.tsx` -- import and render `NoteAuditPanel`

---

## Sprint 3: AI and Telephony

### 3.1 Live Handoff Trigger

**Problem**: The `twilio-elevenlabs-bridge` currently just passes TwiML from ElevenLabs to Twilio with no handoff logic.

**Important architectural note**: The bridge function receives a Twilio webhook (form-encoded POST) and returns TwiML. It does NOT have access to real-time conversation transcripts. The handoff must be implemented as an **ElevenLabs client tool** configured in the ElevenLabs agent dashboard.

**Action**:

1. Create a new edge function `call-live-handoff` that:
  - Accepts `{ call_sid, handoff_number, conversation_id }` 
  - Uses Twilio API to update the live call with a `<Dial>` to the configured number
  - Logs the handoff event to `manual_call_logs` with `handoff_triggered_at`
2. Add a database migration to add `handoff_triggered_at` and `handoff_target_number` columns to `manual_call_logs`
3. The ElevenLabs agent must be configured (in the ElevenLabs web UI) with a client tool named `transfer_to_human` that calls this edge function

**Files**:

- `supabase/functions/call-live-handoff/index.ts` (new)
- Database migration for `manual_call_logs` columns

### 3.2 Bulk AI Calling (AWS Polly)

**Problem**: No batch outbound campaign engine exists.

**Action**: Create `supabase/functions/outbound-campaign-manager/index.ts` that:

- Accepts a list of store IDs and a script template
- Iterates through stores, calling `place-outbound-call` for each
- Supports AWS Polly Neural TTS for script-based calls
- Enforces Draft-First policy: campaigns must be approved before execution
- Logs each call attempt to a `campaign_call_queue` table

**Prerequisites**: Verify `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` secrets are configured. If not, request them before proceeding.

**Files**:

- `supabase/functions/outbound-campaign-manager/index.ts` (new)
- Database migration for `campaign_call_queue` table

### 3.3 RPA/Scraper Activation

**Status**: Out of scope for this sprint. RPA scrapers require external service integration (Yelp API keys, proxy infrastructure) and are classified as Phase 5. Will be addressed after telephony is hardened.

---

## Technical Details

### Database Migrations Required

1. **Address cleanup**: UPDATE `store_master` SET city/state/zip from parsed `address` WHERE city IS NULL
2. **Manual call logs columns**: ADD `handoff_triggered_at` (timestamptz), `handoff_target_number` (text)
3. **Campaign queue table**: CREATE TABLE `campaign_call_queue` (id, campaign_id, store_id, status, call_sid, created_at, completed_at)

### Files Created (New)


| File                                                           | Purpose                   |
| -------------------------------------------------------------- | ------------------------- |
| `src/pages/portal/wholesaler/WholesalerTransactionHistory.tsx` | Invoice history view      |
| `src/pages/portal/wholesaler/WholesalerInventoryWorkflow.tsx`  | Inventory management view |
| `src/components/diagnostics/NoteAuditPanel.tsx`                | Missing invoice detector  |
| `supabase/functions/call-live-handoff/index.ts`                | Twilio call transfer      |
| `supabase/functions/outbound-campaign-manager/index.ts`        | Batch calling engine      |


### Files Modified


| File                                                  | Change                                      |
| ----------------------------------------------------- | ------------------------------------------- |
| `src/utils/exportUtils.ts`                            | Add 10,000 row limit                        |
| `src/routes/AppRoutes.tsx`                            | Add wholesaler transaction/inventory routes |
| `src/pages/portal/wholesaler/index.ts`                | Export new pages                            |
| `src/pages/portal/wholesaler/WholesalerDashboard.tsx` | Add nav links                               |
| `src/pages/ModuleDiagnosticsPage.tsx`                 | Add NoteAuditPanel                          |


### Build Order

```text
Sprint 1 (Quick wins):
  1. Address cleanup migration
  2. Export limit hardcode
  3. Notes field final audit

Sprint 2 (New surfaces):
  4. WholesalerTransactionHistory page
  5. WholesalerInventoryWorkflow page
  6. Route wiring + nav updates
  7. NoteAuditPanel + Diagnostics integration

Sprint 3 (Telephony — requires secrets check):
  8. call-live-handoff edge function
  9. manual_call_logs migration
  10. outbound-campaign-manager edge function
  11. campaign_call_queue migration
```

Make sure touse this logic to split the address column, to ensure that no data will be wiped out. i dont want to wipe out datas.  
  
-- Migration: Sprint 1.1 Address Cleanup

UPDATE store_master

SET 

    -- Extract City (Second to last segment)

    city = TRIM(SPLIT_PART(address, ',', (CARDINALITY(STRING_TO_ARRAY(address, ',')) - 1))),

    

    -- Extract State (Last segment, removing the ZIP)

    state = TRIM(SPLIT_PART(TRIM(SPLIT_PART(address, ',', CARDINALITY(STRING_TO_ARRAY(address, ',')))), ' ', 1)),

    

    -- Extract ZIP (Last part of the last segment)

    zip = CASE 

            WHEN address ~ '[0-9]{5}$' THEN RIGHT(address, 5) 

            ELSE NULL 

          END

WHERE city IS NULL 

  AND address IS NOT NULL 

  AND address LIKE '%,%';

-- Flag addresses that don't fit the pattern for manual review

UPDATE store_master 

SET address_country = 'NEEDS_REVIEW' 

WHERE city IS NULL AND address IS NOT NULL;  
  
Your "Sprint 1" Deployment Checklist

As Lovable works, check these off to ensure the system is stable:

- **[ ] Migration Success:** Check the `store_master` table in Supabase. You should see the `city` and `state` columns populating.
- **[ ] Export Hardcode:** Open `src/utils/exportUtils.ts` and verify the `MAX_EXPORT_ROWS = 10000` constant is present.
- **[ ] Notes Audit:** Go to any store profile, type a few words in the notes, and verify that **nothing** happens until you click the **Save** button.