# Store Profile P1 Consolidation

## Goal
Turn the existing Store Profile into a coherent management page while preserving all current actions, data sources, permissions, and the verified P0 inventory behavior.

## Implementation

1. **Create reusable Store Profile section shells**
   - Add lightweight presentation components for titled sections, responsive action rows, tabs, and collapsible advanced content.
   - Keep existing feature components mounted inside these shells so their hooks and mutations remain unchanged.

2. **Build a concise Store Overview**
   - Replace the fragmented header/quick-stats presentation with one executive overview containing store identity, address, canonical primary contact, overall Store Health Score, relationship status, last contact, last order, balance, and payment terms.
   - Label each signal by meaning: `Overall Store Health`, `Relationship Status`, and brand-level health only inside `Brand Relationships`.
   - Remove the redundant raw `health_status` badge from the primary view without changing its stored value.

3. **Consolidate Quick Actions**
   - Reuse the existing call, text, invoice, inventory, route/visit, follow-up, and interaction handlers/modals.
   - Present them as one responsive action row directly below the overview; do not duplicate handler logic.

4. **Recompose the primary sections in the requested order**
   - **Inventory & Sales:** retain `UnifiedTubeIntelligenceCard` as the canonical editable inventory surface and its existing sold/on-hand table; keep bags historical/velocity information in a secondary tab; move field-delivery inventory and product catalog to clearly labeled secondary tabs/collapsibles; remove the duplicate bottom inventory card from the primary page.
   - **Contacts:** use `StoreContactsSection` as the single people/contact surface; keep store address/general phone editing in the overview and stop separately rendering the overlapping contact summary list.
   - **Tasks & Follow-ups:** group route-backed field requirements with opportunities/follow-ups using tabs for open/scheduled/completed views while preserving the distinct underlying workflows and actions.
   - **Orders & Finance:** group balance/payment summary, the single `Last Order · Line Items` instance, sell-through, and invoice history; retain Refresh, Bulk Add, Create Invoice, and invoice actions.
   - **Relationship & Communication:** group Brand Relationships, cadence, communication stats, AI recommendation/health, preferences, and account briefing into Overview, Communication, AI Insights, and Preferences tabs.
   - **Field Ops & Compliance:** group visit history, field submissions, stickers/compliance, route intelligence, review/sign-off, recon, and related operational intelligence; retain critical warnings outside collapsed content.
   - **Notes & Activity:** provide one tabbed area for Notes, Interactions, Field Activity, and legacy/system context. Existing note add/edit/delete, authorship, timestamps, source labels, detail modals, and field links remain intact; avoid rendering note records in two simultaneous surfaces.

5. **Preserve lower-priority information without extending the page wall**
   - Move storefront preview, CRM intelligence, connected stores, expansion, performance/calls/revenue analytics, product catalog, and danger-zone controls into clearly labeled secondary tabs or collapsible panels.
   - Keep critical escalation/action-needed warnings visible near the top.

6. **Refactor the shared registry safely**
   - Convert `SharedStoreCoreIntelligence` from a fixed long sequence into grouped exports/compositions that both Store Profile entry points can reuse.
   - Verify the Grabba Store Master profile remains functional and does not lose shared sections.

## Technical constraints
- Frontend/presentation changes only; no migrations, schema, RLS, database writes, or live mutations.
- No changes to invoice/order calculations, health formulas, AI logic, contact compliance, or permissions.
- Canonical inventory remains `store_tube_inventory_status`; no active `store_tube_inventory` read/write will be introduced.
- Existing components and handlers remain authoritative; wrappers only control placement, labels, tabs, and collapse state.
- Responsive tabs/actions will wrap or horizontally scroll without clipping; dense tables retain horizontal overflow on mobile.

## Verification
- Run focused TypeScript checks and existing relevant tests.
- Inspect the Store Profile in the live preview at desktop and mobile widths without triggering mutations.
- Confirm only one last-order line-item panel, one primary contacts list, one primary inventory surface, and one notes/activity area render.
- Confirm health labels distinguish overall score, relationship status, and brand relationship.
- Confirm action buttons open their existing dialogs/providers without submitting.
- Confirm RAMMI displays `Tubes On Hand: 28`, `Bags On Hand: 10`, and never `38 Total Tubes`.
- Search changed runtime paths to confirm no retired inventory table reference was added.
