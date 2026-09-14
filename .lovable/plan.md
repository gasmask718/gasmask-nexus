# Nexus store experience — density cleanup (UI only)

Audit done first. No backend, table, route, RPC or business-logic changes anywhere.

## What the audit found

**Store account page (`/stores/:id`, 864 lines)** — one endless vertical page with 11 full-width sections stacked: Location map, Connected Stores, jump nav, Quick Actions, Escalation flags, Inventory & Sales, Contacts, Samples, Messages & Calls, Tasks, Orders & Finance, Relationship (4 inner tabs), Field Ops (5 inner tabs), Notes, plus an "Advanced & legacy" block with 7 more panels. The primary contact and Mark Handled Today sit in a thin strip that is easy to miss; phone/email only appear as small grey text; there is no single action row.

**Store list (`/stores`, 1432 lines)** — each card renders roughly 12 blocks: type badge, contact glance icons, payment badge, status badge, review badge, 2 icon buttons, full address, two phone rows, up to 6 contact badges, per-brand inventory badges, 4 operations badges, tags, a per-brand "Last Order Snapshot" grid, tube KPI badge, on-hand/sold/30d counters, inventory stamps, last visit/order stamps, reactivation triage, quick view. Scanning 500+ stores is slow.

**Sidebar (`Layout.tsx`)** — collapsible sections already exist, but all ~35 are force-opened on load, so hundreds of links render at once.

## Changes

### 1. Sidebar (`src/components/Layout.tsx`)
- Start with sections collapsed; open only the section containing the current route (plus remembering what the user opens during the session).
- Persist open sections in `localStorage` so the operator's layout survives reloads.
- No sections, links, routes or labels removed or renamed.

### 2. Store account header (`src/pages/StoreDetail.tsx`)
New compact header block at the top, built from existing data and components:
- Store name, address, store status
- Primary contact (existing `PrimaryContactInline`, inline-editable) with phone and email next to it
- Action row: Back, Mark Handled Today (existing component, unchanged logic), Call (existing ClickablePhone), Edit store (opens the existing edit path)
- One quiet status row: account status, relationship status, last activity, assigned rep/route where the data already loads

### 3. Store account information architecture
Same components, same props, regrouped into tabs instead of one column:
- **Overview** — location map, escalation flags, quick actions, relationship overview, connected stores
- **Contacts** — contacts section, communication preferences
- **Field & Route** — field ops group, visit history, review/sign-off, recon, street view, route intelligence
- **Tube Intelligence** — inventory & sales group, replenishment, samples, bag history
- **Commercial** — orders & finance, balance, invoices, per-SKU order history
- **Activity** — account activity table, notes, messages & calls, communication stats
- **Admin** — the existing "Advanced & legacy" panels

Nothing is deleted; everything moves into a tab. The caller variant keeps the same finance hiding rules.

### 4. Tube Intelligence card
Presentation only: clearer per-product row (name, ON/OFF switch, needs-order, samples), fewer competing badge colours. Toggle logic, queries and writes untouched.

### 5. Store list cards
Card keeps: name, city, primary contact + phone, status, Handled Today state, assigned route/rep if loaded, and an Open Account action. Inventory grids, per-brand last-order snapshot, tag walls, operations badges, reactivation triage and stamps move behind a per-card "More" expander on the same card — still one click, nothing lost. Filters, search, selection, dispatch and edit buttons and the existing `from` origin state all stay.

### 6. Visual hierarchy
Lighter borders, fewer badges, red reserved for real warnings, larger content width on laptop screens.

## Verification
Browser pass on a real test store: primary contact edit + refresh, Mark Handled Today + refresh + repeat click, per-product Tube toggles independent, return navigation from list/map/route, every section reachable, sidebar groups collapse/expand. Screenshots of `/stores` and `/stores/:id`.
