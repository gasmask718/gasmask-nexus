# Highway Hub + Dynasty Direct Hub (Map + CRM)

Two new hub sections in the OS sidebar: a Highway hub (map + CRM for licensed cannabis dispensary leads) and a Dynasty Direct hub (map + CRM for wholesaler recruitment). GasMask's existing territory floor is untouched.

Leads in these hubs are internal intelligence only. No bulk-inserts into any platform table; the Highway handoff stays a human workflow.

## Confirmed current state

- `public.leads`: 128,568 rows, 81,518 with coordinates, 262 rows with `lead_type = 'wholesaler'` (the only two lead types are `retail_store` and `wholesaler`). It has **no** `business` column yet.
- Consumers of `public.leads` verified: one edge function (`twilio-lookup`, filters on `verify_status`/`category`) and one aggregate view (`v_lead_reach`, groups by state/tier/lead_type/category). Neither filters on `business`. `dp_leads` reads a different schema (`partners.leads`); `DPRecruitment.tsx` uses the external DP client, not this table.
- `uq_leads_addr` on `addr_key` is a **partial** unique index (`WHERE addr_key <> ''`), so it is not a safe PostgREST/`ON CONFLICT` target for address-less rows.
- None of the 14 phone numbers in the 17 named wholesaler contacts appear in the existing 262 wholesaler rows — they are genuinely new entries, not a subset.
- No `hw_*` tables exist. The `dd_*` tables that exist are unrelated wholesaler-portal tables; `dd_wholesaler_stages` and `dd_outreach_log` are new.
- The Highway CSVs (`master_leads_all.csv`, `call_list_export.csv`) are not present in the project or uploads. Per your answer, Highway ships with an empty table and gets loaded later.
- A shared `GeoMapView` map component already exists (Mapbox based) and is reused.

## Step 1 — Schema

- Add `business text default 'gasmask'` to `public.leads`; tag `lead_type = 'wholesaler'` rows as `dynasty_direct`, everything else `gasmask`.
  - This is additive tagging on a brand-new column, not a move: no existing query, view, function, or RLS policy filters `leads` on `business`, so no lane loses those 262 rows. `v_lead_reach` and `twilio-lookup` keep seeing every row exactly as today. A separate `dd_wholesalers` table is therefore not needed.
  - The tagging is re-derivable at any time from `lead_type`, so it is reversible, not a one-way flip.
- New Highway tables: `hw_leads`, `hw_lead_stages`, `hw_outreach_log`, `hw_team_members`, with the dedupe unique index on `(state, business_name, phone)`.
- New Dynasty Direct tables: `dd_wholesaler_stages`, `dd_outreach_log` referencing `public.leads(id)`.
- RLS as specified: authenticated read on `hw_leads` / `hw_team_members`; stage + outreach rows are **strictly own-rows** (`auth.uid() = team_member`) for read and insert. GRANTs to `authenticated` and `service_role` only, no anon.
- Note on the consequence you chose: each person's kanban shows only the activity they logged themselves; teammates' touches are invisible.

## Step 2 — Data

- Seed the 17 named wholesalers from the spec into `public.leads` with `lead_type = 'wholesaler'`, `source = 'manual'`, tier 1, `business = 'dynasty_direct'`.
  - Dedupe does **not** use `ON CONFLICT (addr_key)` — that index is partial and most of these rows have no address. The seed matches on last-10-normalized `phone_e164` first, then on `lower(business_name) + state` for the phone-less entries (Billz GA, Kesey NJ), and inserts only what is missing. Re-running the seed inserts zero rows.
- `hw_leads` stays empty; a documented one-time CSV import path is included so the rows can be loaded later without code changes.


## Step 3 — Maps

Both maps use the existing shared map component with URL-synced filters and viewport-limited, clustered loading (server-side bounding-box queries) so 85k+ pins never load at once.

- `/highway/map` — pins from `hw_leads` (color by bucket, truck icon when `already_delivers`), filters for state / bucket / delivery / license status / medical / source / has phone-email-license, side panel with all fields, "Open in CRM" deep link, export-visible CSV, `/highway/map/lead/:id` deep link. Renders an explicit empty state until the CSV is loaded.
- `/dynasty-direct/map` — two toggleable layers (retail `gasmask`, wholesaler `dynasty_direct`), 4-tier state choropleth, filters for tier / state / category / lead type / verify status, side panels, state drill-down, `/dynasty-direct/map/wholesaler/:id` deep link.
- The retail layer is **strictly read-only**: `SELECT` on `public.leads WHERE business = 'gasmask'` only. No update, delete, promotion, or re-tagging from any map or CRM surface, and the choropleth is a per-state `count(*)` aggregate query — no row writes. All Dynasty Direct pipeline state lives in `dd_wholesaler_stages` / `dd_outreach_log`, never in `leads`. GasMask territory pages are untouched. The one exception, which is a new insert and never an edit, is the manual "add wholesaler" form in Step 4.


## Step 4 — CRMs

- `/highway/crm` — 9-stage kanban (new → outreach → contacted → qualified → demo → negotiation → signed → onboarded → lost), drag-drop writes a stage row plus an outreach-log entry, filter bar, `/highway/crm/mine` and `/highway/crm/team`, lead detail with timeline and log-call/email/stage actions, onboarded-stage handoff banner ("send digest email, do not bulk-insert"), call-list CSV export.
- `/dynasty-direct/crm` — 6-stage kanban (identified → contacted → negotiated → contracted → active → inactive), wholesaler detail with timeline, per-state coverage cards flagging uncovered Tier 1 states, manual add-wholesaler form.

## Step 5 — Sidebar

Add "Highway Hub" (Territory Map, Lead CRM) and "Dynasty Direct" (Wholesaler Map, Wholesaler CRM) sections to `src/components/Layout.tsx`, after the GasMask section. Existing entries unchanged.

## Technical notes

- Files follow the spec's structure: `src/pages/highway/*`, `src/pages/dynasty-direct/*`, `src/components/highway/*`, `src/components/dynasty-direct/*`, `src/lib/hwLeads.ts`, `src/lib/ddLeads.ts`, plus route registration in `AppRoutes.tsx`.
- Map queries are paged by viewport bounds with a hard result cap and clustering; the choropleth uses a per-state aggregate query, not raw rows.
- Two migrations: Highway schema, then Dynasty Direct schema + `leads.business`.

## Out of scope

No cannabis order management, driver dispatch, or payments; no writes to Highway's platform tables; no changes to GasMask territory, `stores` / `store_master`, UT, TopTier, BrightSun, or Surplus Funds.
