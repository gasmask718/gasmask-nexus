# Store Capture System

**Authority:** Session 8 Migration (2026-05-11)

**Status:** ACTIVE

**Scope:** Field-operator store discovery + owner approval workflow

## Overview

Field operators (ambassadors, drivers, bikers) capture new stores from their portals with photo + GPS + structured data. Captures enter a pending review queue where owner/admin approves or rejects. Owner captures auto-approve.

This pattern multiplies store-discovery velocity by ~130x (one owner → 130+ field scouts).

## Architecture: Branch A — Extended Stores Table

Pending captures live in the main `stores` table with `approval_status='pending'`. Once approved, status becomes 'approved' and store type defaults to 'prospect'.

This pattern was chosen over a separate `pending_stores` table because:

- Reuses all existing store RLS policies
- No mirror-table or cross-FK complexity
- Promotion to active is a single UPDATE, not DELETE+INSERT
- Matches existing 15-value store_status enum pattern

## Schema Additions

`stores` table now includes:

| Column | Type | Purpose |
|--------|------|---------|
| `captured_by_user_id` | UUID FK | Who captured this |
| `captured_at` | timestamptz | When captured |
| `captured_role` | app_role | What role captured it |
| `approval_status` | text | pending / approved / rejected |
| `approved_by_user_id` | UUID FK | Who approved/rejected |
| `approved_at` | timestamptz | When reviewed |
| `rejection_reason` | text | Why rejected |
| `storefront_photo_url` | text | Public URL of photo |

Default: `approval_status='approved'` (protects legacy 2,507 rows from being hidden by global filters).

Index: `idx_stores_approval_pending` on `(captured_at DESC) WHERE approval_status='pending'` for fast queue queries.

## Storage Bucket

`storefront-captures` Supabase Storage bucket:

- Public read (photos display in queue UI)
- File size: 5MB max
- MIME types: image/jpeg, image/png, image/webp
- Path: `{captured_role}/{user_id}/{timestamp}.{ext}`

### RLS Policies

- SELECT: public read
- INSERT: roles driver, biker, ambassador, owner, admin
- DELETE: roles owner, admin only

## Entry Points

### 1. ConnectStoresModal — "+ Add New Store"

File: `src/components/store/ConnectStoresModal.tsx`

Inline form opens when owner clicks "+ Add New Store" at bottom of store search. New store auto-connects to current store group via `connected_group_id`.

For owner role: captures auto-approve, store goes live immediately.

### 2. Ambassador Portal FAB

File: `src/pages/ambassador/AmbassadorDashboard.tsx`

Floating action button bottom-right, fixed position.

Opens Sheet with StoreCaptureForm.

### 3. Driver Portal FAB

File: `src/pages/portals/DriverPortalPage.tsx`

Same pattern as Ambassador.

### 4. Biker Portal FAB

File: `src/pages/portals/BikerPortalPage.tsx`

Same pattern as Ambassador.

All three portal FABs route captures to pending review queue (no auto-approve).

## Shared Component: StoreCaptureForm

File: `src/components/store/StoreCaptureForm.tsx`

Single source of truth for capture UX. Used by all entry points.

### Features

- Auto-captures GPS on mount via `navigator.geolocation`
- Native camera input via `capture="environment"`
- 5MB photo upload to storefront-captures bucket
- Store type dropdown (bodega, smoke_shop, gas_station, wholesaler, other)
- Required fields: name, address
- Optional: phone, owner_name, notes, photo
- Role detection via useUserRole()
- Auto-approve logic: owner/admin → approved; all others → pending

### Props

- `onCaptured?: (storeId, autoApproved) => void`
- `onCancel?: () => void`
- `defaultName?: string`
- `defaultAddress?: string`
- `connectedGroupId?: string | null` (for Connect modal context)

## Auto-Approval Rules

| Captured Role | approval_status | status |
|---------------|-----------------|--------|
| owner | approved | prospect |
| admin | approved | prospect |
| ambassador | pending | pending |
| driver | pending | pending |
| biker | pending | pending |

## Admin Approval Queue

Route: `/admin/captures`

File: `src/pages/admin/PendingCaptures.tsx`

Access: owner/admin only (via RequireRole guard)

### Sidebar

"📸 Pending Captures" in Security & Governance section.

Badge shows live count of pending (refreshes every 30s).

### Review Workflow

1. Owner sees photo, address, GPS map link, captured-by, notes
2. Owner CORRECTS TYPE in dropdown (workaround for TRG-001 — see known-issues.md)
3. Approve → status='prospect', type=corrected_type, approval_status='approved'
4. Reject → approval_status='rejected', rejection_reason=text

## Global Query Filters (Phase 7)

All operator-facing store list queries filter by `.eq('approval_status', 'approved')` to prevent pending captures from appearing in:

- Route optimizer
- Grabba command center / inventory
- Live map / dispatch
- Company profiles
- Communication insights
- Portal wholesale
- Tube territory
- Drill-down data / insight panels
- AI engine / AI tasks
- Connected stores / neighborhood snapshots

### Intentional Exclusions

Filters NOT applied to:

- Single-ID lookups (specific store known)
- .in() joins (filtered upstream)
- Insert/update paths (filter inapplicable)
- Admin diagnostic tooling:
  * MissingLinksPanel
  * DataConsistencyDashboard
  * DataHealing
  * YelpBusinessSearch dedup
  These need full visibility for data integrity work.

## Cache Invalidation

After approve/reject:

- `pending-captures` (queue list)
- `pending-captures-count` (sidebar badge)

After capture from Connect modal:

- `stores-for-connection`
- `connected-stores`
- `stores`

## Known Issues

See `docs/architecture/known-issues.md` → TRG-001 for the trigger pair that downgrades store type on round-trip. Workaround: owner corrects type during approval queue review.

## Future Work

- Trigger fix for TRG-001 (~30-60 min dedicated maintenance session)
- Duplicate detection at capture time (radius + name similarity)
- Photo OCR for auto-extracting store names
- Operator capture leaderboard (ambassador metric)
- Bulk approve for trusted operators (after track record established)
- Migration off Gmail SMTP to Resend/SendGrid for transactional email

## Pattern Established

This system establishes the "FIELD CAPTURE → REVIEW QUEUE → APPROVED ACTIVE" pattern, reusable for any future field-captured data:

- Store captures (this system)
- Contact captures (future)
- Visit photo evidence (future)
- Inventory adjustment confirmations (future)
- Any operator-submitted data needing review

The verification flag pattern (TRG-001 workaround via type dropdown) extends this with "system suggests, operator confirms" — applicable to any LLM/automation ingestion path.
