

# Campaign Wizard: Default Name + Audience Table with Selection

## What Changes

### 1. Auto-generate default campaign name
On wizard load, generate a name like `CMPN-0001-OUTREACH` based on the count of existing campaigns in the database (+1). The name field will be pre-filled but editable. Format: `CMPN-{zero-padded sequence}-OUTREACH`.

### 2. Rebuild the Audience step (Step 1) with a selectable table
Replace the current "estimated count" display with:
- **Audience type selector**: Radio/select to pick "Prospects" (territory_addresses) or "Active Stores" (store_master) — one at a time
- **Search bar**: Filter by name, phone, address
- **Data table**: 25 rows per page, columns: Name, Phone, City, State
  - Checkbox per row + "Select All" checkbox in header (selects all on current page)
  - Server-side pagination with page controls
  - **Persistent selection**: Selected IDs are stored in a `Set<string>` state. Navigating pages does not clear previous selections. A badge shows total selected count.
- Data source:
  - "Prospects" queries `territory_addresses` (id, store_name, phone, city, state)
  - "Active Stores" queries `store_master` (id, store_name, phone, city, state)
- Switching audience type clears all selections

### 3. Wire selections to launch
On launch, instead of bulk-seeding from `v_callable_entities`, use the explicitly selected IDs to build the `outbound_call_queue` entries. Each selected row's phone/name is already in the table data.

## Technical Details

**Files modified**: `src/pages/communication/dialer/CampaignWizardPage.tsx` only.

**State additions**:
- `audienceType: 'prospects' | 'stores'`
- `selectedIds: Set<string>` — persists across page navigation
- `audiencePage: number`, `audienceSearch: string`

**Queries**:
- Campaign count query for auto-name: `SELECT count(*) FROM dialer_campaigns`
- Audience query with server-side pagination (25 per page) using `.range(from, to)` and `{ count: 'exact' }`
- Search uses `.or()` with `ilike` on name, phone, city

**Launch mutation update**: Filters selected records from the fetched audience data + selected IDs to build queue items.

