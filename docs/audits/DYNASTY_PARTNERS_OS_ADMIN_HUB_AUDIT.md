# Dynasty Partners — OS Admin/Operator Hub Audit (`/admin`)

Scope: Dynasty OS Lovable project `e9aba3c3-110f-4e7c-87db-ffe37388dcf6`, Supabase `qalaaroashbggynpvqct`. `/admin` operator floor only. Read-only. Every claim grounded in code (`src/pages/admin/dp/*`, `src/components/admin/dp/DPAdminLayout.tsx`, `src/lib/dpClient.ts`, `src/routes/AppRoutes.tsx`, `src/components/Layout.tsx`) or live DB (`partners.*`, `public.dp_*`, `pg_namespace`).

---

## SECTION 1 — What the hub does today

Route `/admin` → `DPAdminLayout` → Outlet. Layout gates access with `useDPAdminStatus()` (checks `partner_admins` for the current auth user), shows an impersonation banner if `?as=<partner_id>` is in the URL, then renders a sidebar with 10 nav entries. All admin pages read through `dp()` which maps `dp().from("<table>")` → `supabase.from("dp_<table>")` (auto‑updatable views in `public`, one per `partners.*` table). Writes go through the same views except `CreatePartner` and one branch of `DPPartners.suspend` which use `dpWrite()` = `supabase.schema("partners")`.

Real walk today: David logs in → `useDPAdminStatus` returns `admin` (1 row in `partners.partner_admins`) → dashboard loads → every counter renders `$0.00` / `0` because the underlying `partners.*` tables are effectively empty (see §2). The plumbing works; there is nothing to operate on.

## SECTION 2 — PGRST106 resolved? (definitive)

**Resolved for reads. Resolved for writes on the covered columns. Partial for writes to columns not projected by the dp_* views.**

Evidence:
- `partners` schema is NOT in PostgREST's exposed list. `partners.*` tables are unreachable directly via the Data API — `supabase.schema("partners")` (`dpWrite`) still yields PGRST106 for anything the wrapper views don't cover. Grants exist (`GRANT USAGE ON SCHEMA partners TO anon, authenticated, service_role`) but exposure is a separate PostgREST config flag and was never flipped.
- The blocker was worked around, not fixed: 17 auto‑updatable views `public.dp_*` were created; `information_schema.views` shows every one `is_insertable_into=YES`, `is_updatable=YES`. `src/lib/dpClient.ts` rewrites every read/write through those views. `DP_READ_ONLY = false`. The `SchemaNotExposedBanner` component still exists and its inline copy still tells the user to expect PGRST106 on writes.
- Admin auth check itself uses `dp().from("partner_admins")` → `public.dp_partner_admins`, so login/gating works without schema exposure.
- Only genuine PGRST106 remaining surfaces: `CreatePartner.tsx` and `DPPartners.suspend` call `dpWrite().from("partners")` directly against `partners.partners`. Those will fail until schema exposure or until they are rewritten to use `dp().from("partners")` (which hits `public.dp_partners`).

Net: **the hub is no longer blocked by PGRST106 in practice** because everything routes through public wrapper views, but two write paths (`CreatePartner`, one admin suspend) still assume the schema is exposed and will error at first use.

## SECTION 3 — Route health check

Registered in `src/routes/AppRoutes.tsx` (lines 1394–1408) as children of `<Route path="/admin" element={<DPAdminLayout />}>`. Sidebar entries live in `src/components/Layout.tsx` lines 226–234 (admin sidebar list under `adminOnly: true`).

| Route | Component | Loads | Data source | Notes |
|---|---|---|---|---|
| `/admin` | `DPDashboard` | ✅ | `dp().partners / mrr_subscriptions / sales / commission_splits / add_ons` | All KPIs are real queries; all currently return 0 because underlying tables are empty |
| `/admin/partners` | `DPPartners` | ✅ | `dp().partners` + `dp().ambassadors` | Bulk suspend uses `dp()`; single‑row suspend uses `dpWrite()` (will PGRST106) |
| `/admin/create-partner` | `CreatePartner` | ✅ | `dpWrite().partners.insert` | **Will PGRST106** — writes direct to `partners.partners` |
| `/admin/mrr` | `DPMrr` | ✅ | `dp().mrr_subscriptions / partners` | View is real; empty because `mrr_subscriptions` is 0 rows and no Stripe sync writes into it |
| `/admin/platforms` | `DPPlatforms` | ✅ | `dp().platforms / sales / ambassadors / commission_splits / campaigns` | 8 platforms seeded (verified); all downstream counts 0 |
| `/admin/financials` | `DPFinancials` | ✅ | `dp().partners / mrr / add_ons / payouts / commission_splits` | Static footer explicitly says "wire `stripe-balance` backend function" — that function does not exist in `supabase/functions/` |
| `/admin/controls` | `DPControls` | ✅ | `dp().<table>` on each tab; mutations flip a `status` column | Pause/Resume writes go through views (should work); "Hold Payouts" writes `status='failed'` to a non‑existent payout row today |
| `/admin/activity` | `DPActivity` | ✅ | `dp().activity_log` | Real query, 0 rows |
| `/admin/recruitment` | `DPRecruitment` | ✅ | `dp().outreach_messages / leads / campaigns` | Read‑only analytics; no "run recruitment" control |
| `/admin/manual` | `DPManual` | ✅ | `dp().partners / platforms / ambassadors / partner_platforms / sales` + `supabase.auth.resetPasswordForEmail` | Insert paths go through views; auth reset is real |
| `/admin/notifications` | `DPNotifications` | ✅ | `dp().notifications / partners` | Broadcast insert goes through view |

Sidebar reachability confirmed in `Layout.tsx` (not `osNavigation.ts`); all 9 non‑dashboard entries flagged `adminOnly: true`. No console errors found in code paths — dp client always returns a supabase query builder even for unmapped tables (`dp_<name>` fallback).

## SECTION 4 — Partner management

`DPPartners.tsx` lists all rows of `partners.partners` with joined ambassador counts, filters by tier/status, bulk suspend/reactivate, per‑row suspend, and a link to the impersonation banner (`?as=<id>`).

- Query is real and correctly scoped (RLS bypass via admin implied by the wrapper views' `security_invoker` behavior — not verified in this pass; see follow‑ups).
- `partners.partners` currently has **0 rows** (`SELECT count(*) FROM partners.partners` = 0). Admin sees an empty table.
- Bulk suspend uses `dp()` (view path — works). Single suspend uses `dpWrite()` (schema path — PGRST106 until exposure). Inconsistent, needs unifying.
- `CreatePartner.tsx` is the only creation surface; it inserts directly to `partners.partners` via `dpWrite`. **Non‑functional today.**

## SECTION 5 — MRR / financials

`DPMrr` queries `mrr_subscriptions` for active + past_due, sums monthly cents, and joins partner display info. `DPFinancials` computes entry‑fee revenue, MRR, add‑on revenue, payout totals, Dynasty share.

- All numbers are real DB reads — but `mrr_subscriptions` has 0 rows, so every panel renders zero. **No writer populates `mrr_subscriptions`.** There is no `stripe-subscription-webhook` for Dynasty Partners; the closest is `brandaro-stripe-webhook` / `dd-stripe-webhook` / `va-stripe-checkout`, none of which target `partners.mrr_subscriptions`.
- The "Live Stripe balance" panel in `DPFinancials` is a static placeholder that literally instructs to wire `stripe-balance` — that function does not exist.
- **Verdict:** structure real, ledger empty, no Stripe sync wired. Numbers are honest zeros, not mocks.

## SECTION 6 — AI recruitment control

`DPRecruitment.tsx` is **analytics only**: filters by channel/platform and reports send/delivery/read/reply/failure counts pulled from `outreach_messages`, plus qualification funnel from `leads` and CAC from `campaigns.spent_cents / ambassadors_created`.

- No "start campaign", "generate outreach batch", "attach persona" or any invoke() of a recruitment edge function. Grep of `supabase/functions/` shows no `dp-recruit-*` or `partners-*` function.
- `partners.leads`, `partners.outreach_messages`, `partners.campaigns`, `partners.ambassadors` are all 0 rows.
- **Verdict:** dashboard shell over an unimplemented recruitment engine. The read side is wired; the write/run side does not exist. This is the widest gap given "core service partners pay for."

## SECTION 7 — Payout management

`DPFinancials` shows payout roll‑ups. `DPControls.HoldPayouts` lists `payouts WHERE status IN ('scheduled','processing')` and flips to `failed` with reason "Held by admin".

- No "process payout" button and no Stripe Connect invoke for partners. The four Stripe Connect functions in the tree (`dd-stripe-connect-*`, `ut-stripe-connect-onboard`) belong to Dynasty Direct and UFT, not Dynasty Partners.
- `payout-processor` and `dd-pay-partner` exist but target `dd_*` tables, not `partners.payouts`.
- `partners.payouts` has 0 rows; `partners.commission_splits` has 0 rows.
- **Verdict:** bookkeeping table exists, no writer, no payer. Not a real payout system — it is a kill switch over a table nothing populates.

## SECTION 8 — Platforms / Controls / Notifications / Manual

- **Platforms** — Real. 8 platforms seeded; sums are real (all 0). No platform CRUD in this page (add/edit platform not exposed).
- **Controls** — Real. Kill switches flip `status` on `partners/campaigns/ambassadors/platforms` via the view. Writes work assuming the underlying view forwards them to the base table (need runtime confirmation on RLS pass‑through under `security_invoker`).
- **Notifications** — Real broadcast: builds N `notifications` rows and inserts through `dp_notifications`. No delivery channel (in‑app only; no push/email/SMS fan‑out function).
- **Manual** — Assign partner to platform, log ambassador sale (recomputes commission pool at insert time from `platforms.commission_pool_rate`), and trigger a Supabase password reset email. All real writes through views except sale insert into `sales` which relies on the DB trigger `trg_sales_commission_split` to fan out to `commission_splits` — trigger existence confirmed in `docs/architecture/dynasty-partners-schema.md`.

## SECTION 9 — Every page / button / real vs mock

| Page | Element | Real / Mock / Dead |
|---|---|---|
| Dashboard | Partner count, MRR MRR, entry fees MTD, sales MTD, Dynasty share MTD | **Real (all 0)** |
| Dashboard | Add‑on breakdown | Real (0) |
| Partners | Rows, filters, bulk suspend | Real; will function once partners exist |
| Partners | Per‑row Suspend | **Real path but PGRST106** (`dpWrite`) |
| Create Partner | Submit | **Broken** (`dpWrite`, PGRST106) |
| MRR | Active/past‑due tables, totals | Real (0) |
| MRR | Cancel / dunning actions | **Not present** |
| Platforms | List + rollups | Real (8 platforms, 0 downstream) |
| Platforms | Add/Edit/Deactivate | **Not present** |
| Financials | Entry fees, MRR, add‑ons, payouts (in/out), Dynasty share | Real (0) |
| Financials | "Live Stripe balance" panel | **Static text pretending to be a placeholder for a function that doesn't exist** — not mock as real, but flag it |
| Controls | Pause partners/campaigns/ambassadors/platforms | Real |
| Controls | Hold Payout | Real write; queue empty |
| Activity | Log stream | Real (0) |
| Recruitment | All KPI cards, per‑channel table | Real (0) |
| Recruitment | Start / run / retry actions | **Not present** |
| Manual | Assign partner→platform | Real |
| Manual | Log ambassador sale | Real (relies on DB trigger) |
| Manual | Reset password email | Real (Supabase Auth) |
| Notifications | Broadcast to tier | Real insert |
| Notifications | Delivery beyond in‑app | **Does not exist** |

No number in this hub is a fabricated mock. Everything is a real query returning honest zeros. The only "mock as real" risk is the Financials "Live Stripe balance" copy, which implies an integration that has never been built.

## SECTION 10 — Security / access

- `<Route path="/admin" element={<DPAdminLayout />}>` is registered **outside** `<Route element={<ProtectedLayout />}>` (AppRoutes.tsx line 1394 vs 1413). Auth + admin gate is done **inside** `DPAdminLayout` (`useAuth` + `useDPAdminStatus`). Not `RoleGuard` — a bespoke check against `partners.partner_admins` via `dp().from("partner_admins")`.
- Behavior: unauthenticated → `<Navigate to="/auth" />`. Signed‑in non‑admin → dead‑end "Admin access required" panel with a session refresh button. Signed‑in admin → hub. Schema unreachable → separate "Backend setup pending" panel (not currently triggered because views cover the admin check).
- Gate is functionally equivalent to a `RoleGuard` for this hub, but bypasses the project‑wide `RoleGuard` / `RequireRole` pattern used everywhere else — inconsistent with the codebase's own standards and skipped by any future audit that greps for `RoleGuard`.
- `partners.partner_admins` currently has **1 row** — the single admin. Any additional admin must be inserted via SQL (`INSERT INTO partners.partner_admins (user_id) VALUES (...)`); there is no admin‑management UI. Not a bug, but worth noting.

## SECTION 11 — Percentages + scorecard

Build completion (code exists and wires to real tables):

| Area | Build % |
|---|---|
| Partner management (list/filter/suspend) | 80% (missing consistent write path, no create partner working) |
| MRR / financials | 60% (views built, zero writers, no Stripe sync, no balance function) |
| AI recruitment | 20% (read dashboard only, no engine, no run controls, no persona/campaign CRUD) |
| Payouts | 25% (bookkeeping table + kill switch, no processor, no Connect wiring for partners) |
| Platforms / controls / notifications / manual | 75% (real reads/writes, missing CRUD on platforms and delivery on notifications) |
| **Overall build** | **~55%** |

Operational readiness (can David actually run the licensing program from here today?):

- Can he see partners? Only after inserting rows via SQL, because Create Partner is broken.
- Can he see MRR/financials? Only if something writes to `mrr_subscriptions` — nothing does.
- Can he run recruitment? No — there is no engine.
- Can he pay a partner? No — there is no processor, no Stripe Connect binding for Dynasty Partners.
- Can he suspend/hold/broadcast? Yes.

**Operational readiness: ~15%. State: working operator shell over an unpopulated backend, no longer blocked by PGRST106 thanks to the dp_* view workaround, but blocked on missing writers (Stripe sync, recruitment engine, payout processor) and two remaining `dpWrite` calls that will PGRST106 on first use.**

## SECTION 12 — Prioritized task list to 100%

### CRITICAL

1. **[Dev]** Rewrite `CreatePartner.tsx` and `DPPartners` single‑row suspend to use `dp()` (public view) instead of `dpWrite()`. Without this, `/admin/create-partner` is dead and admins cannot seed a single partner. `src/pages/admin/dp/CreatePartner.tsx:82`, `src/pages/admin/dp/DPPartners.tsx:100`.
2. **[Owner]** Confirm whether wrapper‑view writes actually pass through to `partners.*` under RLS at runtime for the admin session. If they silently no‑op (RLS on base tables blocks INSERT/UPDATE for authenticated), all "real writes" in §9 are actually broken. Test with a real INSERT via `/admin/manual` (Assign partner→platform) once step 1 lands.
3. **[Owner]** Decide the long‑term stance: expose `partners` to PostgREST (single dashboard toggle) and delete the dp_* view layer, or keep the views and finish covering every write column. Current split‑brain (writes via views + occasional `dpWrite`) is the root cause of #1.

### HIGH

4. **[Dev + Owner]** Stripe subscription writer → `partners.mrr_subscriptions`. New edge function `dp-stripe-webhook` (mirrors `brandaro-stripe-webhook` pattern). Owner supplies price IDs and webhook secret. Without this, MRR and Financials are permanently zero.
5. **[Dev]** Build the recruitment engine skeleton — at minimum a `dp-recruit-run` edge function invoked from `DPRecruitment` (Start button) that inserts a `campaigns` row and enqueues `outreach_messages` per persona. Without this the "core service" is UI only.
6. **[Dev]** Payout processor for `partners.payouts` (Stripe Connect or manual bank export). New function `dp-pay-partner`. Wire a "Process now" button in `DPControls.HoldPayouts` / new `DPPayouts` page.
7. **[Dev]** Add `RoleGuard`/`RequireRole` wrapper around `<Route path="/admin">` so the admin gate is consistent with the rest of the codebase, even though `DPAdminLayout` already checks. Belt‑and‑braces on the hub that gates payouts.

### MEDIUM

8. **[Dev]** Delete or wire the "Live Stripe balance" placeholder in `DPFinancials` (build `stripe-balance` function or remove the copy — leaving it as a text stub is misleading in an operator surface).
9. **[Dev]** Platform CRUD on `/admin/platforms` (currently read‑only over 8 seeded rows).
10. **[Dev]** Notification delivery beyond in‑app (email/SMS fan‑out on broadcast insert, otherwise the button is a diary entry).
11. **[Dev]** Admin management UI (add/remove rows in `partner_admins`) — today it is SQL only.

### LOW

12. **[Dev]** Remove `SchemaNotExposedBanner` component from the tree; it references a fixed blocker and is not rendered anywhere I could find, but the copy will mislead if it resurfaces.
13. **[Dev]** Consolidate the read path (`dp()`) and write path so a single call site style covers both — the current two‑client model (`dp` + `dpWrite`) is the source of the drift in step 1.

---

Grounded artifacts referenced:
- Code: `src/routes/AppRoutes.tsx` (1227–1408), `src/components/Layout.tsx` (226–234), `src/components/admin/dp/DPAdminLayout.tsx`, `src/lib/dpClient.ts`, `src/pages/admin/dp/*.tsx`, `src/components/admin/SchemaNotExposedBanner.tsx`.
- DB: `SELECT count(*)` across `partners.*` (see §2), `information_schema.views` for dp_* auto‑updatability, `pg_namespace.nspacl` for schema grants.
- Functions listing: `supabase/functions/` (no `dp-*` or `partners-*` present; nearest neighbors are `dd-*`, `ut-*`, `brandaro-*`, `bulk-import-partners`).
