## QA Audit — "GasMask Inventory Operations" Floor

**Overall status: NOT BUILT.** No artifacts for this floor exist in the codebase or database. All 5 checks fail. Nothing from a prior session appears to have landed.

### Findings

| # | Check | Status | Evidence |
|---|---|---|---|
| 1a | `store_inventory_leads` table exists with required columns | **FAIL** | `information_schema.columns` returns 0 rows for `store_inventory_leads`. Table does not exist. |
| 1b | RLS policies allow `Va` role read/update | **FAIL (N/A)** | No table → no policies. Cannot pass. |
| 2a | `GasMaskInventory.tsx` wired into routes + sidebar | **FAIL** | No file matching `GasMaskInventory*` anywhere in `src/`. `src/pages/gasmask/` contains only `DriverRoutePage`, `NoteCleanerPage`, `RouteEnginePage`, `StoreIntelligencePage`. No route or `AppSidebar` entry references it. |
| 2b | Caller ID dropdown ("BizText Line" vs "Ooma Line") | **FAIL** | No occurrences of `BizText` or `Ooma` anywhere in `src/`. No agent-facing outbound-number selector for this floor exists. (Generic `PhoneNumberSelector` exists for Brandaro, but is not wired here and doesn't include these labels.) |
| 3 | Disposition buttons ("Inventory Updated", "No Answer", "Call Back Later") wired to update `inventory_status` | **FAIL** | No component, handler, or mutation references `inventory_status` on `store_inventory_leads`. Nothing to wire. |

### Root cause
The floor was never scaffolded. There is no migration, no page, no route registration, no sidebar link, no disposition handler, no caller-ID UI.

### Recommended Build-Mode scope (for approval)
Before Leonora's shift, we would need to build, in one pass:

1. **Migration** — create `public.store_inventory_leads` with `id uuid pk`, `store_name text`, `phone text`, `inventory_status text` (enum-like: `pending | updated | no_answer | callback`), `notes text`, `last_called timestamptz`, plus `created_at`/`updated_at`. Include GRANTs (`authenticated`, `service_role`), enable RLS, and add policies: `SELECT`/`UPDATE` allowed when `has_role(auth.uid(), 'va')` (per project's `has_role`/`app_role` pattern).
2. **Page** — `src/pages/gasmask/GasMaskInventory.tsx`: queue list + active-call panel with the 3 disposition buttons wired to a Supabase `update({ inventory_status, last_called: now() })` mutation + `invalidateQueries`.
3. **Caller ID dropdown** — inline `<Select>` in the call panel with explicit options **"BizText Line"** and **"Ooma Line"** (values = the two Twilio/Ooma numbers; confirm actual E.164 numbers with user before wiring).
4. **Routing + sidebar** — register route in the appropriate router (likely under `/grabba/…` given GasMask sits there) and add a sidebar entry in `src/components/layout/AppSidebar.tsx` scoped to VA/admin roles.
5. **Seed** — optional: seed a handful of stores from `store_master` so Leonora has a live queue on shift start.

### Open questions before Build Mode
- **Caller ID numbers:** what are the actual E.164 numbers for "BizText Line" and "Ooma Line"? (Needed to populate the dropdown values.)
- **Queue source:** should the initial lead list be seeded from `store_master` (filtered how — no recent inventory update? active stores only?), or imported from a CSV?
- **Placement:** should this live under `/grabba/inventory-ops` (fits existing GasMask nav) or as its own top-level floor?

Awaiting answers + approval to switch to Build Mode.