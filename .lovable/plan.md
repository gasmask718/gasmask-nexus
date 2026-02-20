
# Tube Switch Intelligence Layer

## Overview
A new read-only analytics and manual logging module for tracking old tube replacements at stores. This lives inside the existing Tube Intelligence section of the Store Profile and follows the "truth layer" philosophy -- no automation, no inventory mutation, no triggers.

## Database

### New Table: `store_tube_switches`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | Default `gen_random_uuid()` |
| store_id | uuid (FK to store_master) | NOT NULL |
| old_tube_batch_id | uuid | Nullable reference |
| old_tube_type | text | e.g. "GasMask Bags", "Hot Mama" |
| estimated_old_tube_quantity | integer | How many old tubes were present |
| switch_reason | text (check constraint) | One of: damaged, outdated_branding, product_upgrade, compliance, performance_issue, other |
| switched_quantity | integer | How many were actually replaced |
| switched_by_user_id | uuid | NOT NULL, references auth.users |
| notes | text | Nullable free-text |
| territory | text | Optional, derived |
| verified | boolean | Default false |
| created_at | timestamptz | Default now() |

### RLS Policies
- **SELECT**: Authenticated users with admin/va/ambassador/driver/biker roles (via existing `has_role` or equivalent pattern)
- **INSERT**: Restricted to admin, va, ambassador, biker roles only
- No UPDATE/DELETE policies (immutable logging)
- No public access

## New Files

### 1. `src/hooks/useStoreTubeSwitches.ts`
- `useStoreTubeSwitches(storeId)` -- fetches all switch records for a store, ordered by `created_at DESC`
- `useLogTubeSwitch()` -- mutation to insert a new record into `store_tube_switches`
- Derived analytics computed client-side:
  - **Switch Status Badge**: Green (no outstanding) / Yellow (partial) / Red (switch required) based on comparing `estimated_old_tube_quantity` vs `switched_quantity` across recent records
  - **Total Switches (Lifetime)**: Count of all records
  - **Last Switch Date**: Most recent `created_at`
  - **Switch Frequency (Last 90 Days)**: Count of records in last 90 days
  - **Outstanding Switch Estimate**: Sum of `estimated_old_tube_quantity - switched_quantity` where positive

### 2. `src/components/store/TubeSwitchPanel.tsx`
A Card component containing:

- **Governance Banner**: "Tube Switch records are informational and do not trigger automated inventory, dispatch, or financial changes."
- **Status Badge Row**: Switch status (Green/Yellow/Red), Old Tube Estimate, Total Switches, Last Switch Date, 90-Day Frequency
- **"Log Tube Switch" Button**: Opens a Dialog modal with form fields:
  - Old Tube Type (dropdown of brand names)
  - Estimated Old Quantity (number input)
  - Quantity Replaced (number input)
  - Reason (dropdown: damaged, outdated_branding, product_upgrade, compliance, performance_issue, other)
  - Notes (textarea)
  - Mark as Verified (toggle)
- **Switch History Table**: Scrollable list of past switch events showing date, type, quantities, reason, and verified status
- Toast notifications on successful log or error

## Modified Files

### `src/components/store/SharedStoreCoreIntelligence.tsx`
- Import and render `TubeSwitchPanel` directly after `UnifiedTubeIntelligenceCard` (line 91), keeping it within the "Inventory Intelligence" section
- Pass `storeId` prop

## What This Does NOT Touch
- No changes to inventory engine, orders, delivery, production, or finance
- No edge functions created or modified
- No triggers or background jobs
- No modifications to `UnifiedTubeIntelligenceCard`

## Reversibility
Remove by:
1. Dropping `store_tube_switches` table
2. Deleting `TubeSwitchPanel.tsx` and `useStoreTubeSwitches.ts`
3. Removing the single import/render line from `SharedStoreCoreIntelligence.tsx`

Zero dependency impact.

## Navigation
Visible on any store profile page at `/stores/:id` -- scroll to the Inventory Intelligence section, directly below the existing Tube Intelligence card.
