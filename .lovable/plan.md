

# Phase 2.5 -- Layer 3: Read-Only Escalation Flags

## Overview

This layer adds computed, read-only warning signals derived from existing data (delivery_checklists.outcome_summary, invoices, store_contacts). Flags are never stored, never trigger actions, and disappear naturally when conditions clear. They surface in three locations: the Delivery Memory Snapshot, the field Store List, and the Store Profile.

## Step 0: UI Verification Gate

Before any new code, we confirm all existing layers render:
- **Delivery Memory Snapshot** -- rendered in `DeliveryTaskCard.tsx` line 100
- **Pinned Notes** -- rendered inside the snapshot via `PinnedNotesSnapshotPanel` (line 50 of `DeliveryMemorySnapshot.tsx`) and in `StoreDetail.tsx` via `PinnedNotesSection`
- **Quick Capture Enforcement** -- gated via `FieldOutcomeCaptureModal` (lines 225-232 of `DeliveryTaskCard.tsx`), "Complete Visit" button disabled until modal submitted

All three are structurally in place. Any rendering issues will be fixed before proceeding.

---

## Step 1: New Hook -- `useEscalationFlags`

**File**: `src/hooks/useEscalationFlags.ts`

A single hook that accepts a `storeId` and derives flags at query time from existing tables. No new database tables or views needed.

**Data sources queried (parallel fetch)**:
1. `delivery_checklists` where `store_id = X` and `completed_at >= 30 days ago` -- extract `outcome_summary->>'outcome_type'` values
2. `invoices` where `store_id = X` and `payment_status != 'paid'` and `deleted_at IS NULL` -- for overdue payment duration

**Flag definitions (constants, easily tunable)**:

| Flag | Condition | Severity |
|------|-----------|----------|
| Repeated Payment Refusal | >= 2 `payment_refused` outcomes in 30 days | high |
| Unresponsive Store | >= 3 `not_available` outcomes in 30 days | medium |
| High Visits / Low Orders | >= 3 visits with no `order_placed` outcome | medium |
| Dispute Pattern | >= 2 `issue_conflict` outcomes in 30 days | high |

**Output shape**:
```typescript
interface EscalationFlag {
  flag_type: string;
  label: string;
  severity: 'low' | 'medium' | 'high';
  occurrences: number;
}
```

Cached with 60s staleTime. No writes. Pure derivation.

**Batch variant**: `useEscalationFlagsBatch(storeIds: string[])` for directory-level rendering -- single query, grouped by store_id.

---

## Step 2: Escalation Flag Badge Component

**File**: `src/components/delivery/EscalationFlagBadge.tsx`

A small, reusable visual component that renders a single flag as an icon + text badge. Severity maps to color (high = red, medium = amber, low = muted). Read-only, no click actions.

**File**: `src/components/delivery/EscalationFlagsPanel.tsx`

A panel component that renders all active flags for a store. Used inside the Delivery Memory Snapshot as a warning strip below pinned notes but above payment recall.

---

## Step 3: Surface in Delivery Memory Snapshot

**File modified**: `src/components/delivery/DeliveryMemorySnapshot.tsx`

Add `EscalationFlagsPanel` between the Pinned Notes panel and the Last Visit line. Only renders if flags exist. Visual style: subtle warning strip with icons, not blocking.

---

## Step 4: Surface in Field Store List

**File modified**: `src/components/portal/field/StoreListPage.tsx`

Use `useEscalationFlagsBatch` for all visible store IDs. For each store card row, render a compact `EscalationFlagBadge` (highest-severity flag only) next to existing badges. Tooltip shows full flag list on hover/tap.

---

## Step 5: Surface in Store Profile

**File modified**: `src/pages/StoreDetail.tsx`

Add `EscalationFlagsPanel` near the top of the store profile page, after pinned notes. Read-only, same visual treatment as the snapshot version.

---

## What This Does NOT Do

- No new database tables or migrations
- No stored flags or judgments
- No status changes to stores
- No blocking of any workflow
- No notifications or automation
- No AI decisions
- Flags disappear automatically when the pattern clears (rolling 30-day window)

## Files Summary

| Action | File |
|--------|------|
| Create | `src/hooks/useEscalationFlags.ts` |
| Create | `src/components/delivery/EscalationFlagBadge.tsx` |
| Create | `src/components/delivery/EscalationFlagsPanel.tsx` |
| Modify | `src/components/delivery/DeliveryMemorySnapshot.tsx` |
| Modify | `src/components/portal/field/StoreListPage.tsx` |
| Modify | `src/pages/StoreDetail.tsx` |

No database migrations required. All data is derived from existing `delivery_checklists.outcome_summary` JSONB and `invoices` tables.

