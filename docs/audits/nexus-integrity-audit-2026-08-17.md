# GasMask Nexus — Platform Integrity & Operational Audit

Date: 2026-08-17 (UTC)
Method: read-only SQL, source reads, log queries. Zero paid API calls. The only
writes made in this pass are the tier-1 money-path fixes listed in §7.

---

## 1. Executive dashboard

### 🟢 Working — verified

| Area | Evidence |
|---|---|
| Surplus Funds pool classification | `sf_pool_map` = 39 sources; `surplus_funds_leads` has **0 NULL pools** and **0 unmapped lead sources** across 26k+ rows. The `BEFORE INSERT` trigger is holding; no insert rejections observed. |
| SBO scheduling | Crons 24, 25, 101, 104, 110, 121 all `succeeded` in the last 24h — job 110 ran 72/72, 101 twice, 121 eight times, 0 failures. |
| SBO Telegram intake | `sbo_capper_picks` growing again; latest row 2026-08-17 11:41 UTC (2,614 total). The 2026-08-09 stall has cleared. |
| Shared-code mirror | `supabase/functions/_shared/errText.ts` and `src/lib/errText.ts` are byte-identical; `prebuild` runs `sync-errtext --check` plus sidebar-route and public-view-grant gates, so drift fails the build. |
| Log truncation | `errText` caps at 2,000 chars and appends `… [truncated, N chars total]`; it is wrapped so it can never throw inside a catch. |
| UT Stripe webhook | Handlers are keyed on `stripe_payment_intent_id`, so a Stripe replay re-runs the same idempotent `UPDATE`. Money-path writes already read `{ error }` and throw only where a retry repairs the state. |
| Edge traffic health | Last 24h of `function_edge_logs`: single-digit 5xx across all functions; the busiest function ran 17 calls with 0 errors. |

### 🟡 Degraded / at risk

| Area | Finding |
|---|---|
| **SBO prop matching** | **1.0% coverage** — only 26 of 2,614 picks carry `matched_prop_id` (5 of 305 in the last 14 days). Root cause is upstream of the matcher, see §4. |
| Unread writes (real number) | The ticket's grep reported 1,038; a per-call-site scan finds **2,063** genuinely unchecked `insert/update/upsert/delete` sites (the doc's grep counts lines, and the codebase has grown). Inventory: `docs/audits/nexus-unread-writes-inventory.csv`. Hot spots: `src/pages` 290, `src/hooks` 164, `src/components` 121, `src/services` 57; worst edge functions `brandaro-auto-build` 29, `predictive-dialer-engine` 25, `brandaro-auto-striker` 19. |
| Browser error visibility | `errText` is imported by only **13 files** in `src/`, against 2,063 unchecked write sites. No literal `[object Object]` producers were found in toast `description:` fields, but most write failures never reach a toast at all — they are silent, not ugly. |
| Route guard density | `src/routes/AppRoutes.tsx` declares **1,414 routes** with 259 `ProtectedRoute` usages and only 6 `RoleRouteGuard` usages. Authentication is broadly enforced; **role**-level separation is not, and needs a per-route sweep. |
| Status vocabulary drift | Of ~60 `ut_*` tables carrying a `status` column, only two are enum-backed (`ut_listings.status → ut_listing_status`, `ut_staff.status → ut_staff_status`). Everything else is free text, so a typo silently produces an empty filter rather than an error. `ut_partner_leads` currently holds only `new` (45,915) and `needs_enrichment` (85), so no live leak — but nothing prevents one. |
| Accumulator columns | `dd_campaigns.total_orders/total_revenue/total_commission` and `dd_partner_wholesaler_links.total_*` are incremented read-modify-write inside the webhook. Concurrent orders on one campaign will lose an increment. Same class as the already-ticketed ambassador totals defect. |
| Edge function name mapping | `function_edge_logs` exposes only `function_id` UUIDs, not names, so a name-by-name PROVEN/UNPROVEN table cannot be produced from analytics alone. Traffic shape is healthy; the per-function classification needs a UUID→name map to complete. |

### 🔴 Broken / critical (fixed this pass — §7)

| Area | Finding |
|---|---|
| **`dd-pay-partner` double-payout** | The `status: 'processing'` claim write was unread, so a failed lock did not stop the transfer; `stripe.transfers.create` carried **no idempotency key**; and the post-transfer `status: 'paid'` write was unread. A retry after money moved could pay a partner twice. |
| **`dd-refund-order` double-refund** | The post-refund `payment_status: 'refunded'` write was unread. A lost write leaves the order reading `paid`, inviting an admin to refund the same order again. |
| **`dd-stripe-webhook` paid-order loss** | The `marketplace_orders → paid` write was unread. A lost write leaves a paid order stuck at `pending` with no signal anywhere. |
| **Silent commission loss** | `dd_partner_earnings` inserts were unread in both branches — a failed insert means a partner is never paid and nothing logs it. |

---

## 2. Financial order of operations

Twelve functions create Stripe intents/sessions. Spot checks confirm the DB row
precedes the charge on the Dynasty Direct path (`dd-stripe-webhook` resolves an
existing `marketplace_orders` row and returns early if absent). The known
exception remains `ut-process-booking-payment`, already ticketed in
`docs/architecture/known-issues-payment-intent-before-rows.md` — unchanged here.

Idempotency: only 18 functions reference an idempotency key at all, and before
this pass **none of the Stripe money-movers did**. `dd-pay-partner` now does.
`dd-refund-order`, `ut-process-booking-payment` and the Brandaro checkout family
still do not — see the action plan.

---

## 3. Surplus Funds

Healthy. `sf_pool_map` covers every active source, the trigger classifies on
ingest, and `pool` is NOT NULL with no default with zero violations. No action.

---

## 4. SBO AI Engine — prop matching root cause

Not a matcher bug. Two upstream gaps, measured over the last 14 days:

- **Extraction gaps:** of 305 picks, only **77 have `player_name`**, 124 have
  `prop_type`, 148 have `line`. A pick with a NULL player cannot match anything.
- **Sport mismatch:** recent picks are Soccer and Tennis; `sbo_player_props`
  holds 6,623 rows for the same window that are MLB-shaped. Joining on
  `lower(trim(player_name))` + `game_date` yields only **44 candidate rows** —
  so the matcher's theoretical ceiling is ~14%, and it achieved 5.

The cron succeeding is therefore accurate: it has almost nothing to match. Fixing
coverage means fixing extraction field-fill and adding non-MLB prop sources, not
touching the matching logic.

---

## 5. Code maintenance

Mirror sync and truncation caps are enforced and passing. No action.

---

## 6. Auth

`/auth` renders and `INITIAL_SESSION` fires cleanly with no runtime errors in the
console. `AuthContext` retries `getSession` three times with an 8s timeout and
falls back to an explicit offline screen rather than an infinite spinner, and
clears tokens that are malformed or expired beyond the 7-day refresh window.
`RBAC DEBUG` logging fires on every render for signed-out users — noisy but
harmless; worth gating behind a dev flag.

---

## 7. Fixes applied in this pass (tier 1 only)

1. `dd-pay-partner`: conditional claim (`.neq('status','paid').select()`) that
   aborts when the lock is not won; `idempotencyKey: dd-payout-<id>` on the
   transfer; all post-transfer writes read `{ error }`, log `MONEY SENT but …`,
   and are reported via `bookkeeping_error` in a 200 response — never a throw
   after money moves. Also removed dead unreachable code.
2. `dd-refund-order`: post-refund write now read and surfaced as
   `bookkeeping_error` with an explicit "do not refund again" instruction; still
   returns 200 so a retry cannot double-refund.
3. `dd-stripe-webhook`: the mark-paid write now throws so Stripe retries (safe —
   the `payment_status === 'paid'` guard makes the replay a no-op).
4. `dd-stripe-webhook`: both `dd_partner_earnings` inserts log `COMMISSION LOST`
   on failure; deliberately not thrown, because replay would double-insert.

Everything else below is proposed, not applied.

---

## 8. Prioritized action plan

**Critical — financial / data loss**
1. Add idempotency keys to the remaining Stripe money-movers:
   `dd-refund-order`, `ut-process-booking-payment`, `payout-processor`,
   `va-create-pay-session`, and the Brandaro checkout family.
2. Fix `payout-processor` (3 unread writes, including the `succeeded` marker) the
   same way `dd-pay-partner` was fixed.
3. Replace read-modify-write accumulators (`dd_campaigns.total_*`,
   `dd_partner_wholesaler_links.total_*`, ambassador totals) with SQL views or
   atomic RPC increments.
4. Sweep the remaining ~40 unchecked writes in `stripe|payout|refund|invoice`
   files listed in the CSV.

**High — API and pipeline reliability**
5. Fix SBO extraction field-fill so `player_name`/`prop_type`/`line` populate,
   then add non-MLB prop sources; re-measure `matched_prop_id` coverage.
6. Build the `function_id → function name` map and finish the per-function
   PROVEN / UNPROVEN / FAILING classification.
7. Add spend caps to the AI/API callers that lack them (only Google Places has a
   metered cap today).

**Medium — correctness**
8. Convert high-traffic `ut_*` status columns to enums, starting with
   `ut_bookings`, `ut_payments`, `ut_partner_leads`.
9. Work the unread-write inventory by tier: paid path → gates a later read →
   telemetry (log only) → analytics (leave unread, documented).

**Low — UX polish**
10. Route `errText` through the shared toast helper so write failures surface as
    readable messages instead of silence.
11. Add `RoleRouteGuard` to admin/OS route groups that currently only check
    authentication.
12. Gate the `RBAC DEBUG` console logging behind a dev flag.
