# GasMask — P0 Verification & Assignment Plan (READ-ONLY)

**Date:** 2026-09-11 · **Builds on:** `docs/audits/GASMASK-BLOCKERS-OWNER-AUDIT-2026-09-11.md` (not re-run)
**Scope:** verification + assignment plan only. No fixes, no migrations, no tables, no portals, no outreach. No write test was executed.
**Backend:** `qalaaroashbggynpvqct` · counts taken 2026-09-11.

### Language corrections applied to the prior audit
- Replace "nothing has ever been used" with **"current operational use is unproven / inactive"**. Historical evidence exists: 14 store visits ever, 2 dialer attempts ever, 12 field captures ever (most recent **2026-09-09**), 0 visits and 0 deliveries in the last 30 days.
- Replace "missing entirely" for POG/planogram, partner buy-in and sales-agent flow with **"documented/spec'd elsewhere but no implementation found in the inspected GasMask app."** Repo-wide search returned no GasMask-scoped implementation; this statement is about implementation, not about whether a spec exists.

---

# P0-1 — CAPTURED STORES NOT VISIBLE TO DRIVER

### Write path (verified)

| | Finding |
|---|---|
| Entry point | Floating "Capture new store" button, `src/pages/portal/DriverPortal.tsx:65-71`. **Not a route** — it opens a `Sheet` modal in place (`:73-90`) on `/portal/driver`. |
| Component | `src/components/store/StoreCaptureForm.tsx` (imported `DriverPortal.tsx:29`) |
| Call made | Plain `supabase.from('stores').insert(...)` — `StoreCaptureForm.tsx:209-213`. **No RPC, no edge function.** `grep "rpc("` in that file returns nothing. |
| Destination | `public.stores` |
| Fields written (`:186-207`) | `name, type, address_street, address_city, address_state, phone, primary_contact_name, notes, lat, lng, storefront_photo_url, status:'prospect', approval_status:'approved', captured_by_user_id, captured_at, captured_role, approved_by_user_id, approved_at, connected_group_id` |
| Not written | `business_id` (never set), `address_zip`, `email`, any route/assignment link |
| Approval | Hard-coded `'approved'` with the acting user as approver (`:200-205`) — no review gate |

### Hidden second step (found only in the live database, not in migrations)

`public.stores` has an `AFTER INSERT` trigger `sync_stores_trigger` → `sync_store_to_store_master()`. It inserts into `store_master` **with the same id**, copying only:

`id, store_name, address, city, state, zip, is_simulation`

It does **not** copy `phone`, `primary_contact_name`, `notes`, `lat`, `lng`, `storefront_photo_url`, or `business_id`. (`store_master` has **no latitude/longitude columns at all** — verified against its full column list; coordinates exist only on `stores`.)

### Read path (verified)

| Screen | Query | Filter |
|---|---|---|
| `StoreListPage.tsx:48-64` | `from('store_master')`, `.order('store_name').limit(50)` | "Only mine" → `.in('id', my_field_store_ids())` |
| `useMyAssignedRoutes.ts:60-96` (drives `MyDayDashboard` + `AssignedRoutesPage`) | `routes` → `route_stops` → `from('store_master').in('id', storeIds)` | `routes.assigned_to = user`, active/dated statuses |
| `MyDayDashboard.tsx:104-118` | `field_submissions` join `store:store_master(store_name)` | `submitted_by_user_id = user` |

`my_field_store_ids()` (live definition) returns store ids from exactly four sources: an active `ambassador_assignments` row, `store_master.assigned_ambassador_id`, an active `driver_assignments` row, or a `route_stops` row on a route assigned to the user within 30 days.

### ROOT CAUSE

**The store does persist and does reach `store_master` — but it arrives unassigned and stripped of its contact and location data, so no driver-facing screen can surface it.**

Three concrete failures, all confirmed against the 4 live field-captured stores:

1. **No assignment is created.** Capture writes zero `route_stops`, zero `ambassador_assignments`, and no `assigned_ambassador_id`. All 4 live captures return `assignments: 0`; 3 of 4 return `route_stops: 0`. `my_field_store_ids()` therefore excludes them, so "My stores", My Day and Assigned Routes cannot show them. The only place they exist is the unfiltered store list — alphabetically ordered and capped at 50 rows out of 1,699, i.e. effectively invisible unless the driver searches the exact name.
2. **Phone is dropped by the sync trigger.** All 4 captured `store_master` rows have `phone = NULL`, even where the driver typed one into `stores.phone`. Call and Text on those stores are dead by construction — `StoreCallTextButtons` correctly disables with no phone.
3. **`business_id` is never set.** 2 of 4 captured `store_master` rows have `business_id = NULL`, which breaks VA/business tenancy scoping (existing standing rule: every new `store_master` row needs a `business_id`).

Note there is **no duplicate-record risk from the trigger itself** — it reuses the `stores.id` as the `store_master.id` and upserts `ON CONFLICT (id)`. This id-sharing is also what makes `route_stops.store_id → stores(id)` and `store_visits.store_id → store_master(id)` interoperate at all; the two different foreign-key targets happen to line up only because of this trigger.

### EXACT FIX SURFACE

Three surfaces, in dependency order. All are edits to existing code — no new table, no new portal.

1. `sync_store_to_store_master()` (live DB function, no migration file exists for it — the fix must first capture it into a migration): carry `phone`, `owner_name`/`contact_name`, `notes`, `photo_url`, and `business_id` through to `store_master`.
2. `src/components/store/StoreCaptureForm.tsx:186-213`: set `business_id` on the `stores` insert, and after a successful insert create the driver's link to the store (the smallest correct option is an active `driver_assignments` row for `captured_by_user_id`, which `my_field_store_ids()` already honours — this needs no schema change).
3. Decide whether `store_master` needs coordinate columns, or whether every map surface should join back to `stores.lat/lng`. This is an architecture decision, not a patch, and it is shared with P0-3.

### ACCEPTANCE TEST (not yet run)

Using one authorised test store, signed in as a real driver on `/portal/driver`:

1. Capture the store with a name, full street/city/state, a phone number and GPS allowed.
2. **Persists:** exactly one new `stores` row and exactly one `store_master` row, sharing the same id. Re-query by id — no second row under either table, and no second row after capturing the same store again (the upsert must hold).
3. **Appears in the canonical workflow:** without searching, the store is visible in the driver's "My stores" list, and visible in whichever of My Day / Assigned Routes the assignment model puts it in.
4. **No duplicate:** count of `store_master` rows matching that name = 1.
5. **Actions still work:** Call and Text are enabled on that store (phone carried through) and Directions opens the correct destination (coordinates resolvable).
6. `business_id` is non-null on the new `store_master` row, and a VA scoped to a different business cannot see it.

---

# P0-2 — 78 AMBASSADORS / 2 LOGINS

### Verified counts

| Metric | Value |
|---|---|
| Ambassador records (all) | 79 |
| Active records | 78 |
| Active records with a login (`user_id`) | **2** |
| Active records with **no** login | **76** |
| Distinct `user_id` values across the whole table | 3 |
| Active records with an email on file | **2** (1 distinct address) |
| Active records with a phone on file | 65 |
| Active records with a name | 76 |
| Active records with `previous_user_id` set (login previously unlinked) | **66** |

### ROOT CAUSE — correction to the earlier finding

**This is not credential sharing.** Distinct `user_id` count (3) equals the number of records that have one, so no two ambassador records point at the same login. The real situation is:

**76 of 78 active ambassadors have no login at all.** They are roster records, not accounts. 66 of them carry `previous_user_id` — they were deliberately unlinked at some point (`login_unlinked_at` / `login_unlink_reason` columns exist for exactly this), which matches the earlier "shared login" symptom: before the unlink, records were pointing at a small number of shared identities.

### NUMBER AFFECTED

- **76** active ambassadors need an account provisioned.
- **74** of those cannot be invited today: only 2 active records have an email address, and the invite flow needs a reachable contact. 65 have a phone, and the existing invite function can send by SMS — so the practical split is **65 reachable by SMS**, **2 by email**, and **at least 11 with no usable contact channel on file**.

### Security / operational impact

- No ambassador can sign in, so nothing they do is attributable to a person; `my_field_store_ids()` returns nothing for them, meaning route and store scoping is inert for the whole roster.
- Because the records are unlinked rather than shared, there is **no current live credential-sharing exposure** — the exposure is historical and already remediated by the unlink. The present risk is operational (no one can work) plus the audit gap on anything done before the unlink.
- No credentials were read or displayed during this verification.

### REUSE OPTION — a complete flow already exists; build nothing new

The per-ambassador invite→login pipeline is already implemented end to end:

- Tables/RPCs: `ambassador_invites`, `create_ambassador_invite`, `validate_ambassador_invite`, `accept_ambassador_invite`, `revoke_ambassador_invite` (migration `20260209184910_*`, current version `20260822222430_*:141-231`).
- Delivery: `supabase/functions/send-ambassador-invite/index.ts` — sends the link by SMS and/or email, building `/invite/ambassador/{token}`.
- Accept page: `src/pages/invite/AmbassadorInviteAccept.tsx` — signs the user up, then calls `accept_ambassador_invite`, which stamps `ambassadors.user_id` and inserts the `ambassador` role.
- Owner-approval layer already in place upstream: `ambassador_invite_requests` + `src/pages/security/AmbassadorRequests.tsx`.
- Usage to date: **1** invite ever created, **2** invite requests. The pipeline is built and unused, not missing.

**Smallest reuse path:** collect/confirm contact details for the 76, then drive the existing `send-ambassador-invite` function record by record. The only thing standing between today and working logins is contact data and an owner's go-ahead — not engineering.

### OWNER SKILLSET NEEDED

Operations/data, not engineering: someone who can confirm the real person behind each of the 76 records, supply a phone or email, and shepherd acceptances. Engineering is needed only if a batch-send screen is wanted over one-at-a-time sends.

### ACCEPTANCE TEST

1. Pick 2 ambassadors with a phone on file. Send each an invite through the existing flow.
2. Each accepts on their own device; each ends up with their own `user_id` stamped on their own ambassador record, and an `ambassador` role row.
3. Signed in, each sees only their own assigned stores/routes and cannot see the other's.
4. Distinct `user_id` count rises by exactly 2; no record ends up sharing a `user_id` with another.

No accounts were created during this verification.

---

# P0-3 — STORES WITHOUT MAP LOCATION

### Definition used

"No map location" = `stores.lat IS NULL OR stores.lng IS NULL`. There are **zero** rows with `0,0` placeholder coordinates, so stale/zero coordinates are not a category here.

### ROOT CAUSE BREAKDOWN — the 962 figure needs qualifying

| Bucket | Rows |
|---|---|
| Total rows missing coordinates (all of `stores`, including deleted) | **962** |
| — of which **soft-deleted** (`deleted_at` set) | **671** |
| — **live** rows actually missing coordinates | **291** |

Of the 291 live rows:

| Cause | Rows | Fixable how |
|---|---|---|
| Street + (city or zip) present → geocodable as-is | **175** | Automatic |
| Street present but no city and no zip | **3** | Manual review |
| **No street address at all** | **113** | Manual review — nothing to geocode |
| Marked test data | 1 | Ignore |

By store status, the gap is almost entirely prospects: **286 of 1,472** `prospect` rows and **5 of 221** `reactivation_target` rows lack coordinates. **Every** live store in `active`, `revenue_active` or `engagement_active` status already has coordinates. So this does not block the current revenue book; it blocks prospecting and coverage mapping.

There is also a structural issue, shared with P0-1: **`store_master` has no coordinate columns at all.** The driver's canonical table cannot hold a map location; anything map-related must join back to `stores`. Fixing the 291 does not by itself put pins on a `store_master`-driven screen.

### EXISTING REUSABLE COMPONENT — do not build another

Four geocoders already exist. The right one for this job:

- **`supabase/functions/batch-geocode-stores`** — Mapbox, batch, up to 1,000 rows per run, already targets exactly the right set (rows with null coordinates) and writes straight to `stores.lat`/`stores.lng`. This is a direct fit; no new function is needed.
- `supabase/functions/resolve-geo` — single/array, multi-entity, same write target. Useful for one-offs.
- `ut-geocode-backfill` (Google Places, writes to `ut_partner_leads`) and `phase-b-geocode` (Google, writes to `address_extraction_staging`) belong to other pipelines — do not repoint them.

No scheduled job runs any of them; all are invoked manually. Nothing was triggered during this verification, and no paid geocoding was run.

### ROWS THAT CAN BE FIXED AUTOMATICALLY

**175** live rows — one run of `batch-geocode-stores`, well under its 1,000-row cap.

### ROWS NEEDING MANUAL REVIEW

**116** live rows (113 with no street address, 3 with street only). These need someone to source an address before any geocoder can help.
**671** soft-deleted rows should be excluded from the scope entirely rather than geocoded.

### ACCEPTANCE TEST

1. Re-count live rows missing coordinates before the run; expect 291.
2. Run `batch-geocode-stores` once against live, non-test rows only.
3. Expect ≈175 rows to gain coordinates; live rows missing coordinates drops to ≈116, all of them address-less.
4. Spot-check 5 newly geocoded stores: the coordinates land on the right block, and the Directions link on the driver screen opens the correct destination.
5. No soft-deleted row is written to, and no row that already had coordinates is overwritten.

---

# OWNERSHIP

| | P0-1 Capture → driver visibility | P0-2 Ambassador logins | P0-3 Map locations |
|---|---|---|---|
| **Required skill** | Backend/data: Postgres trigger + React form; understands the `stores`/`store_master` id-sharing contract | Operations/data admin; no engineering unless a batch UI is wanted | Ops running an existing job + someone to source ~116 addresses |
| **Current confirmed owner** | None documented | None documented | None documented |
| **Overlapping assignment** | None. Territory promotion (`request_store_promotion` / `approve_store_promotion`) is a *different* pipeline sourced from `territory_addresses` — do not merge the two | Overlaps the standing roadmap blocker; it is diagnosed, not owned | Overlaps the open geocoding backlog item on the roadmap |
| **Recommended assignment** | **OWNER NEEDED** — recommend Nicole once her access is confirmed | **CHING DECISION REQUIRED** first (who is really on the roster and how to reach them), then ops execution | **OWNER NEEDED** for the run; **CHING DECISION REQUIRED** on whether ~116 address-less prospects are worth sourcing |
| **Dependency** | Nicole's Cloud access. The `store_master` coordinate decision is shared with P0-3 and should be settled once | Contact details for 76 people; 74 have no email on file | Mapbox usage on `batch-geocode-stores`; P0-1's coordinate decision |
| **Definition of done** | A driver captures a store and sees it in their own working list the same session, with working Call/Text/Directions, one record only, and a non-null `business_id` | Every active ambassador who should be working has their own login and sees only their own work; no record shares a `user_id` | Live stores missing coordinates = only those with no usable address, and that remainder has a decision attached |
| **QA** | **PAUL / COORDINATION-QA** on all three acceptance tests | | |

### Do NOT reassign — already covered elsewhere

- **Dynasty Connect lead-to-dialer gap** — diagnosed twice (`dc-lead-to-dialer-bridge-audit-2026-09-07.md`, `dynasty-connect-lead-flow-audit-2026-09-07.md`). Needs a decision and a caller, not another investigation.
- **Shared ingestion handoff recovery** — Nicole is the documented pending-access owner (`SHARED-INGESTION-HANDOFF-RECOVERY-2026-09-10.md`). Loading her with P0-1 competes with this; Ching should sequence them.
- **Recruiting search/ingest automation** — Gerson owns SEARCH → INGEST → QUALIFY. Nothing in this plan touches it.
- **Store-count reconciliation, legacy `/delivery/*` retirement, placeholder biker pages, mobile layout QA, dead `SIMULATION_*` files** — already itemised as P1/P2 in the base audit. Do not promote them into the P0 lane.

---

# FINAL OUTPUT

## 1. P0 order of execution

1. **P0-1** — capture → driver visibility. It is a code fix with a known root cause, it unblocks the pilot, and it forces the `store_master` coordinate decision that P0-3 also needs.
2. **P0-2** — ambassador logins. Blocked on Ching's roster answer, so start the question now and run it in parallel; execution needs no engineering.
3. **P0-3** — map locations. Smaller and less urgent than first reported (291 live rows, not 962; no revenue-active store is affected), and its automatic half is one run of an existing job.

## 2. Who needs assignment

- P0-1: **one backend/data owner** — none exists today. Nicole is the fit, subject to her access and her existing ingestion assignment.
- P0-2: **Ching's decision first**, then an ops person to run the existing invite flow.
- P0-3: **one ops owner** to run the existing job; Ching to decide on the ~116 address-less prospects.
- All three: **Paul** on coordination and QA of the acceptance tests.

## 3. Exact first task per P0

- **P0-1:** capture the live `sync_store_to_store_master()` function into a migration file (it exists only in the database today), then extend it to carry `phone`, contact name, notes, photo and `business_id`.
- **P0-2:** produce the roster reconciliation — for each of the 76 login-less active ambassadors, the real person and one reachable phone or email. No accounts until that list exists.
- **P0-3:** dry-run `batch-geocode-stores` scoped to live, non-test rows and confirm it selects ≈175 rows before writing anything.

## 4. Acceptance test per P0

As written in each section above: P0-1 = capture one authorised test store and see it in the driver's own list with working Call/Text/Directions and no duplicate; P0-2 = two ambassadors accept their own invites and see only their own work; P0-3 = live rows missing coordinates falls from 291 to ≈116, all address-less, with five spot-checked pins correct.

## 5. Copy-ready update for Ching

> GasMask — we checked the three big ones properly. Two of them are smaller than they looked, and one is worse.
>
> **1. Stores added in the field.** The store does save, and it does reach the main store list — but it arrives with no driver attached to it, and the phone number the driver typed in gets dropped along the way. So the driver can't find the store afterwards unless he searches the exact name, and he can't call it. That's the real problem, and it's a fix in our code, not a rebuild. Nobody is assigned to it — we need one person for this.
>
> **2. The 78 ambassadors.** Correction to what we said before: they are not sharing logins. 76 of them simply have no login at all — most were deliberately unhooked at some point. The invite system to give each person their own login is already built and works; it has only ever been used once. The blocker is that we only have an email address for 2 of them and a phone for 65. We need your list of who's really on the roster and how to reach them — after that this is an admin job, not a build job.
>
> **3. Missing map locations.** Better than reported: 962 counted deleted records too. The real number is 291, and every store that's actually doing business already has its location. Of the 291, about 175 can be fixed automatically with a tool we already have. The other 116 have no street address on file at all — somebody has to go find those addresses, and you should tell us whether they're worth chasing.
>
> On current use: the field app isn't proven in use rather than never used — 14 store visits ever, the most recent store captured on 9 September, but nothing at all in the last 30 days. One real driver running one full day through it would tell us more than any further checking.
>
> Please don't reassign the Dynasty Connect leads or the ingestion handoff — those already have people and diagnoses attached.

---

*Read-only. No code, schema, data, accounts, or geocoding jobs were changed or triggered.*
