# Dynasty Clipper Nation — OS Floor (Admin/Operator Console) Audit

Scope: `/os/clipper-nation/**` inside the Dynasty OS project (Supabase `qalaaroashbggynpvqct`). Read-only. Grounded in real code + DB. Does **not** cover the public/clipper-facing site.

---

## 1. What the floor actually does today

Opening `/os/clipper-nation` as admin renders **8 real pages** wired to real tables in the same Supabase project. It is *not* a mock/UI-only shell — every page except two (Analytics, Conversions in terms of underlying data volume) issues live Supabase queries against `clipper_*` tables. However, the DB is effectively empty: 2 clippers, 8 campaigns, 0 submissions, 0 earnings, 0 payouts, 0 socials, 0 assignments, 0 conversions. So admins see a working operator UI drawing zeros from live tables.

Real actions available: approve/reject/suspend clippers, create/edit/publish/pause campaigns, approve/reject submissions, assign campaigns, invoke real `clipper-payout` edge function.

## 2. Data connection (critical)

**Same Supabase project as the (assumed) clipper-facing site.** All floor code reads/writes the OS project's `clipper_*` tables via the shared `@/integrations/supabase/client`. There is **no cross-project bridge, no sync job, no separate `VITE_*_CLIPPER_*` env var**. This is the correct pattern *if* the clipper portal writes to the same project; if the portal actually writes elsewhere, the floor sees nothing (not confirmed here — portal audit needed).

**Schema drift check:** the 8 tables (`clipper_accounts`, `clipper_campaigns`, `clipper_submissions`, `clipper_earnings`, `clipper_payouts`, `clipper_social_accounts`, `clipper_assignments`, `clipper_conversions`) all exist and match column names referenced in the floor code (verified: `full_name`, `brand_name`, `dynasty_business`, `base_rate_per_1k`, `commission_rate`, `views`, `status`, `payout_method`, `stripe_connect_onboarded`, etc.). No drift found in the OS-side floor.

**Missing table:** no `clipper_applications` table exists. Application intake/approval flow (see §4) is absent — the "approve clippers" verb happens directly on `clipper_accounts.status`.

## 3. Reachability

**Reachable.** `src/components/Layout.tsx:587-597` registers a `clipper-nation` sidebar group with all 8 items (Dashboard, Clippers, Campaigns, Submissions, Analytics, Conversions, Payouts, Settings). Line 878 includes it in the OS hub visibility set. All 8 routes are wired in `src/routes/AppRoutes.tsx:2277-2284`. Not orphaned.

## 4. Application approval

**Not built as a dedicated flow.** No `clipper_applications` table, no dedicated `ClipperApplications.tsx` page. `ClipperClippers.tsx` treats `clipper_accounts.status` as the approval state (approve/reject/suspend buttons directly mutate the row via `update({ status })`). If the public site writes new signups as `status='pending'` into `clipper_accounts`, this works end-to-end; otherwise there is no intake surface here. Inferred, not confirmed for the public-site side.

## 5. Campaign manager

**Built + wired.** `ClipperCampaigns.tsx` (572 LOC): reads `clipper_campaigns`, computes assignment/submission aggregates, has a full create/edit modal with brand name, `dynasty_business` selector, `commission_rate`, `base_rate_per_1k`, brief, raw footage URLs. Publish/pause toggle mutates `status`. Real inserts/updates persist. There is no separate "push to clipper portal" step — campaigns are visible to any client reading `clipper_campaigns` (assumed to be the portal).

## 6. Clip review / content approval

**Built + wired.** `ClipperSubmissions.tsx` reads `clipper_submissions` joined to `clipper_accounts` and `clipper_campaigns` (brand, business, base_rate, commission_rate). Approve/reject flip `status` on the row; a DB trigger `trg_clipper_submission_on_approve` is referenced in a code comment as the mechanism that creates the matching `clipper_earnings` row (existence of trigger not verified in this audit — inferred from code comment). Platform + business filters present. Real, but with **0 rows** in DB.

## 7. Clipper roster & performance

**Built + wired for what exists in DB; social metrics not populated.** `ClipperClippers.tsx` (638 LOC) lists clippers, opens a drawer with `clipper_social_accounts`, `clipper_assignments`, `clipper_earnings`, active campaigns, and can assign a campaign (insert into `clipper_assignments`). `total_views` / `total_earnings` come from `clipper_accounts` aggregate columns — those are only updated by `sync-clipper-metrics` edge function which is gated on `PHYLLO_CLIENT_ID` / `PHYLLO_SECRET`. Those vault secrets **could not be verified from this session** (vault schema not readable), but `sync-clipper-metrics` returns 503 without them. No cron for `sync-clipper-metrics` was verifiable (cron schema not readable from this role). **Inferred not-scheduled** — flag as gap.

## 8. Payout management

- **Balances owed:** `ClipperPayouts.tsx` reads `clipper_earnings` and groups by clipper — real calculation.
- **Execute payout:** the "Pay Now" button calls `supabase.functions.invoke("clipper-payout", …)`. `supabase/functions/clipper-payout/index.ts` is a real implementation: verifies balance from `clipper_earnings status='approved'`, routes to Stripe Connect / Wise / PayPal based on `clipper_accounts.payout_method`, and (per the code loaded) executes real transfers. Wise/PayPal base URLs point to **sandbox** (`api.sandbox.transferwise.com`, `api-m.sandbox.paypal.com`) — not production yet.
- **Minimum:** enforced $50.
- **Weekly automated trigger:** not found. No cron entry visible; no scheduler file for `clipper-payout`. All payouts are admin-initiated.

## 9. Analytics / monitoring

**Real, not mocked.** `ClipperDashboard.tsx` aggregates 6 head-count/sum queries against `clipper_accounts` / `clipper_submissions` / `clipper_payouts` / `clipper_earnings`. Platform breakdown, leaders, and recent submissions all query the DB. `ClipperAnalytics.tsx` (293 LOC) reads submissions + active clippers with joins. Numbers are honest zeros today, not fabricated.

## 10. Page-by-page status

| Path | Purpose | Reachable | Status |
|---|---|---|---|
| `/os/clipper-nation` | Dashboard KPIs, leaders, recent | ✅ | FULLY WIRED (0-data) |
| `/os/clipper-nation/clippers` | Roster, drawer, approve/assign | ✅ | FULLY WIRED |
| `/os/clipper-nation/campaigns` | CRUD campaigns | ✅ | FULLY WIRED |
| `/os/clipper-nation/submissions` | Review clips, approve/reject | ✅ | FULLY WIRED (depends on trigger for earnings) |
| `/os/clipper-nation/analytics` | Platform + performance | ✅ | FULLY WIRED |
| `/os/clipper-nation/conversions` | `clipper_conversions` view | ✅ | FULLY WIRED (0 rows, source pipeline not verified) |
| `/os/clipper-nation/payouts` | Balances + Pay Now | ✅ | FULLY WIRED (sandbox Wise/PayPal) |
| `/os/clipper-nation/settings` | Config placeholders | ✅ | PARTIAL — settings labelled placeholder in-code |

## 11. Buttons / controls

| Control | Real? | Notes |
|---|---|---|
| Clippers → Approve / Reject / Suspend | ✅ | UPDATE `clipper_accounts.status` |
| Clippers → Assign Campaign | ✅ | INSERT `clipper_assignments` |
| Campaigns → Create / Edit / Publish / Pause | ✅ | INSERT/UPDATE `clipper_campaigns` |
| Submissions → Approve / Reject (+ reason) | ✅ | UPDATE + comment says trigger creates earning (unverified) |
| Payouts → Pay Now | ✅ | Invokes `clipper-payout` edge fn; Stripe live, **Wise/PayPal sandbox** |
| Settings → payout automation toggle | ❌ | Explicit "Both settings are placeholders" comment |
| Settings → Phyllo connect link | ⚠️ | External link only; no in-app connect flow |
| Weekly auto-payout | ❌ | Not scheduled / not found |
| Application-form intake queue | ❌ | Not built (no `clipper_applications` table) |

## 12. Real vs mock

Every number and list on every page originates from a live Supabase query — **nothing is hardcoded or mocked**. The risk is the opposite: zeros displayed as honest zeros. The only "fake" surface is `ClipperSettings.tsx`, which explicitly labels itself as placeholder for the payout automation toggle.

## 13. Wiring map

- Frontend → OS Supabase (same project) → `clipper_*` tables. Clean.
- Frontend → Edge fn `clipper-payout` → Stripe/Wise/PayPal.
- Edge fn `sync-clipper-metrics` → Phyllo → writes back to `clipper_submissions` + `clipper_accounts` aggregates. **Not invoked from the floor UI; no cron verifiable.**
- Edge fn `clipper-connect-onboard` exists (Stripe Connect onboarding) — inferred to be called from the clipper portal, not the OS floor.
- Edge fn `clipper-approved-email` exists — inferred triggered on submission approval (not verified).
- **No floating views** on the OS floor.

## 14. Security / access

**Not admin-gated.** `src/routes/AppRoutes.tsx:2277-2284` mounts all 8 clipper-nation routes with **no `RoleGuard` / `ProtectedRoute` wrapper** and no `allowedRoles` check. Compare against other sensitive floors that use `<RoleGuard>`. Any authenticated user who knows the URL can reach the operator console (RLS on tables will still enforce data access, but the UI itself — including destructive buttons and the `clipper-payout` invoke — is exposed). This is a **security gap**.

RLS on the tables themselves was not enumerated in this pass (out of scope for read-only floor audit).

## 15. Percentages + scorecard

| Area | Build % | Notes |
|---|---|---|
| Data connection | 100 | Same-project, no drift |
| Application approval | 40 | No intake table; approve verb only |
| Campaign manager | 100 | Full CRUD, publish/pause |
| Clip review | 90 | UI complete, earnings trigger unverified |
| Roster + metrics | 65 | Roster full; Phyllo sync unscheduled |
| Payout management | 70 | Real payouts; sandbox Wise/PayPal; no weekly auto |
| Analytics | 100 | Fully wired |
| Access control | 20 | No RoleGuard on routes |

**Overall build completion: ~75%** (weighted; most surfaces BUILT+WIRED, application intake + Phyllo scheduling + payout automation missing).

**Operational readiness: ~45%.** An admin CAN: create campaigns, approve/reject clippers, approve submissions, and click Pay Now against the real payout function. An admin CANNOT reliably: process a real production Wise/PayPal payout (sandbox URLs), see live social metrics (Phyllo unscheduled/unconfirmed secrets), rely on weekly auto-payouts, or trust that non-admins can't reach the console.

**Verdict:** Real working operator console with meaningful gaps — not an empty shell. The plumbing is there; production readiness is blocked by (a) route auth, (b) Phyllo scheduling + secret confirmation, (c) Wise/PayPal production URLs, (d) missing application intake table if the portal expects one.

## 16. Prioritized task list to 100%

### CRITICAL
1. **Admin-gate `/os/clipper-nation/**`** — wrap the 8 routes in `RoleGuard` (owner/admin) in `AppRoutes.tsx`. Prevents non-admins from invoking `clipper-payout`.
2. **Confirm clipper-portal writes into this same Supabase project.** If portal uses a different project, this floor sees nothing real — need cross-project bridge or migration.
3. **Verify `PHYLLO_CLIENT_ID` / `PHYLLO_SECRET`, Stripe Connect keys, Wise/PayPal keys are populated in vault** (not confirmable from this session — needs owner access).

### HIGH
4. **Flip `clipper-payout` Wise/PayPal base URLs to production** (currently `sandbox.transferwise.com` / `api-m.sandbox.paypal.com`) once keys are live.
5. **Schedule `sync-clipper-metrics` via pg_cron** (e.g. daily at 09:00 UTC) so `clipper_accounts.total_views` / earnings reflect reality.
6. **Verify the `trg_clipper_submission_on_approve` trigger exists** and writes into `clipper_earnings`; if missing, add it — otherwise "approve" is decorative.
7. **Build application intake:** either add a `clipper_applications` table + `ClipperApplications.tsx` review queue, or confirm the portal writes `status='pending'` into `clipper_accounts` and add a "Pending" filter default on `ClipperClippers.tsx`.

### MEDIUM
8. **Weekly auto-payout cron** — call `clipper-payout` per eligible clipper meeting the $50 minimum on a fixed weekday.
9. **Replace placeholders in `ClipperSettings.tsx`** with real config rows (min payout, auto-payout toggle) persisted to a settings table.
10. **In-app Phyllo connect UX** rather than only an outbound link.

### LOW
11. Empty-state copy on dashboard/analytics so 0-data reads as "waiting on portal traffic" instead of blank cards.
12. Document the `dynasty_business` enum values (drift between `ClipperSubmissions.tsx` BUSINESS_BADGE and `ClipperConversions.tsx` BUSINESS_BADGE — different keys included).

---

Grounded observations only. Where unable to verify (vault contents, cron schedule, trigger existence, portal Supabase project ID), explicitly labelled **not confirmed** / **inferred**.
