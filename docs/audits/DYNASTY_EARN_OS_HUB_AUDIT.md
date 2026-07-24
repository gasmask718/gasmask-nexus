# MASTER AUDIT #2 — Dynasty Earn OS HUB (Admin / Operator Console)

Scope: `src/pages/os/dynasty-earn/**`, `src/lib/dynastyEarnClient.ts`, `src/components/Layout.tsx`,
`src/routes/AppRoutes.tsx`, Dynasty OS Supabase (`qalaaroashbggynpvqct`) `dynasty_earn_*`
tables, `supabase/functions/**`.
Method: read-only inspection of source, DB via `psql`, edge-function directory.

---

## SECTION 1 — WHAT THE HUB ACTUALLY DOES TODAY

Files (all present, all lazy-registered in `AppRoutes.tsx` lines 1043-1050, 2267-2274):

| Route | File | LOC |
|---|---|---|
| `/os/dynasty-earn` | `DynastyEarn.tsx` | 520 |
| `/os/dynasty-earn/earners` | `EarnEarners.tsx` | 396 |
| `/os/dynasty-earn/brands` | `EarnBrands.tsx` | 238 |
| `/os/dynasty-earn/programs` | `EarnPrograms.tsx` | 278 |
| `/os/dynasty-earn/commissions` | `EarnCommissions.tsx` | 235 |
| `/os/dynasty-earn/campaigns` | `EarnCampaigns.tsx` | 377 |
| `/os/dynasty-earn/payouts` | `EarnPayouts.tsx` | 301 |
| `/os/dynasty-earn/settings` | `EarnSettings.tsx` | 227 |

Every page imports `earnDb` from `src/lib/dynastyEarnClient.ts` and — before rendering any
data — checks `if (!earnDb)` / `isEarnConnected()`. When `earnDb` is null the page short-
circuits to an amber "Connect Dynasty Earn database" banner and renders no data.

`earnDb` is constructed only if BOTH `VITE_DYNASTY_EARN_SUPABASE_URL` and
`VITE_DYNASTY_EARN_SUPABASE_KEY` are present at build time (see
`src/lib/dynastyEarnClient.ts:20-24`).

Result of `grep VITE_DYNASTY_EARN .env .env.example`: **no matches**. Neither variable is
defined. Therefore in the current build **`earnDb === null` on every page load** and the
entire hub is stuck on the connection banner.

Plain language: right now an admin opening the hub sees eight pages that each say "Connect
Dynasty Earn database." Zero real data, zero actions available. The pages themselves are
built out (real queries, real mutations wired in code) — they simply have no database to
talk to.

---

## SECTION 2 — DATA CONNECTION (the critical question)

Public Dynasty Earn site: Supabase project **`ciouiczwspwfgtecivfo`** (per header comment
in `src/lib/dynastyEarnClient.ts:12-14`).
Dynasty OS: Supabase project **`qalaaroashbggynpvqct`**.

Connection design (as coded):
- The hub uses a **separate `createClient(EARN_URL, EARN_KEY)`** pointed directly at the
  public Earn project. Cross-project read/write via the browser using that project's
  publishable anon key. No shared views, no server-side sync, no edge-function bridge.
- Tables the hub expects on the Earn project: `earners`, `brands` (dashboard) /
  `brand_accounts` (EarnBrands, EarnCampaigns), `programs` / `earn_programs`,
  `commissions`, `payouts`, `brand_campaigns`, `earn_settings`.
  Note the drift: dashboard reads `brands` and `programs`; sub-pages read `brand_accounts`
  and `earn_programs`. At least one of these will 404 against whatever the public project
  actually has. **Inferred, not confirmed** — this project cannot introspect the public
  project's schema.

Connection reality:
- `VITE_DYNASTY_EARN_SUPABASE_URL` and `VITE_DYNASTY_EARN_SUPABASE_KEY` are **not set**
  in `.env` or `.env.example`. `earnDb` is `null`. The hub sees nothing.
- No edge function in `supabase/functions/` proxies the Earn project (searched;
  none found).
- The OS-side project has legacy `dynasty_earn_*` tables in its own `public` schema:
  `dynasty_earn_affiliates`, `dynasty_earn_commissions`, `dynasty_earn_links`,
  `dynasty_earn_notifications`, `dynasty_earn_payouts`, `dynasty_earn_programs`. All are
  **empty (row count = 0)**. `dynasty_earn_brands` does not exist. **The hub does not
  read from any of these** (`rg dynasty_earn_ src/pages/os/dynasty-earn` → no matches).

**Bottom line — flagged loudly:** the hub has **no working connection to the public
Dynasty Earn database**. Two possible corrections (both currently absent):
1. Set the two `VITE_DYNASTY_EARN_SUPABASE_*` env vars to the public project's URL +
   anon key. Then the hub queries cross-project directly.
2. Build an edge-function bridge on OS that reads from the Earn project with a service
   role and exposes it to the admin.

Neither exists. This is CRITICAL #1.

---

## SECTION 3 — EARNER MANAGEMENT

`EarnEarners.tsx`:
- **List:** `earnDb.from('earners').select(...)` — real query, would populate a real
  table if `earnDb` were live. Search box (name/email) is client-side filter.
- **Approve / suspend:** `earnDb.from('earners').update({ status: next }).eq('id', id)`
  — real UPDATE. Persists to the Earn project when connected.
- **View an earner's referrals/sales/commissions:** partial — the file pulls
  `commissions` for the selected earner but there is no dedicated per-earner drill-down
  page; it renders inline.

Status today: UI-COMPLETE, WIRES-COMPLETE, but **not visible** because `earnDb === null`.

---

## SECTION 4 — BRAND MANAGEMENT

`EarnBrands.tsx`:
- Reads `brand_accounts`, joins a `brand_campaigns` count. Real queries.
- Does **not** query subscription tier / MRR / churn columns anywhere. There is no
  `$499–$1,499/mo tier` display, no "who's paying / who's churned" view, no revenue-
  from-brands number. Any subscription / churn UI would be **MISSING**, not just
  disconnected.
- Approve / suspend brand: not present in this file (searched for `update(`). Read-only
  list + drawer.

Status: PARTIAL — list works when connected, subscription/revenue/lifecycle features not
built.

---

## SECTION 5 — COMMISSION & PAYOUT OPERATIONS

`EarnCommissions.tsx`:
- Reads `commissions` list.
- **Approve:** `update({ status: 'approved' }).eq('id', c.id)` — real.
- **Mark paid:** `update({ status: 'paid' })` on the commission, then reads the
  `earners` row and writes back `total_earnings = old + amount`. This is a client-side
  read-modify-write with no transaction / no RPC — race-condition prone but functional.
- No proof the amount is computed from real sales — the row is trusted as-is. There is
  no sales-→commission compute path in this repo.

`EarnPayouts.tsx`:
- Reads `payouts` list, filters by tab (pending/processing/paid/failed).
- **Move to processing / mark failed:** real UPDATE.
- **Mark paid:** UPDATE `{ status:'paid', reference:'<manual Stripe/PayPal id>',
  processed_at }`. Reference is a free-text field the admin pastes in.
- **No Stripe / PayPal API call anywhere.** Money movement is **manual outside the
  system**; the hub only records what the admin claims happened. Placeholder in the
  input literally reads `"e.g. Stripe tr_xxx / PayPal batch id"`.

Status: BUILT-NOT-WIRED (to a payment processor). Bookkeeping works; disbursement is
manual.

---

## SECTION 6 — PLATFORM MONITORING / STATS

`DynastyEarn.tsx` dashboard runs 6 parallel counts:
- earners count, brands count, programs count, sum of `commissions.amount` where
  status='paid', count of active campaigns, count of pending payouts.
- Recent applications (earners/brands/programs merged & sorted client-side), top
  earners by `total_earned`, programs list.

All values are pulled from the Earn project via `earnDb`. **No hardcoded / mock
numbers found** in the dashboard file. Behavior: when `earnDb` is null (today) the
component returns the amber banner before any of the state ever renders — so today the
stats show as nothing at all, not fake zeros.

Missing: MRR is listed in the audit brief but is **not computed anywhere** in
`DynastyEarn.tsx`. There is no subscription table read, no ARR/MRR calc.

---

## SECTION 7 — EVERY HUB PAGE / SUB-VIEW

Sidebar registration (`src/components/Layout.tsx:573-583`): the whole `dynasty-earn`
group is registered and appears in `src/components/Layout.tsx:878` in the top-level
order array. **Reachable in OS sidebar — not orphaned.**

| Path | Purpose | In sidebar | Status |
|---|---|---|---|
| `/os/dynasty-earn` | Overview stats, recent apps, top earners, programs | ✅ | UI-ONLY today (banner). Wired if `earnDb` were set. |
| `/os/dynasty-earn/earners` | List earners, approve/suspend, per-earner commissions | ✅ | Same — full wiring, no DB. |
| `/os/dynasty-earn/brands` | Read-only brand list + campaign count drawer | ✅ | PARTIAL even if wired: no subscription/tier/MRR/approve/suspend. |
| `/os/dynasty-earn/programs` | List `earn_programs`, edit commission_rate, toggle active, insert program | ✅ | Full wiring, no DB. |
| `/os/dynasty-earn/commissions` | Ledger + approve + mark-paid (updates earner total) | ✅ | Full wiring, no DB. No source-of-truth compute. |
| `/os/dynasty-earn/campaigns` | List `brand_campaigns`, status toggle, insert campaign | ✅ | Full wiring, no DB. |
| `/os/dynasty-earn/payouts` | Payout queue, mark processing/paid/failed with manual ref | ✅ | Bookkeeping only. No money movement. |
| `/os/dynasty-earn/settings` | Key/value `earn_settings` upsert (commission rates, min payout, etc.) | ✅ | Full wiring, no DB. |

Also present but **not wired to any route**: `AdminControlTab.tsx`,
`BrandDealExchangeTab.tsx`, `TalentManagementTab.tsx`, `_EarnStub.tsx`. **Orphaned
components** — no route imports them and `rg` finds no reference outside their own file.

---

## SECTION 8 — EVERY BUTTON / CONTROL

Assuming `earnDb` is connected, every mutation below is a real Supabase call and will
persist. Every one is dead today because `earnDb === null`.

| Page | Control | Real action? |
|---|---|---|
| Earners | Approve / Suspend | ✅ `earners.update({status})` |
| Earners | Search | client filter only |
| Brands | Approve/Suspend | ❌ **not present** |
| Brands | Row click → drawer | reads `brand_campaigns` count only |
| Programs | Edit commission rate | ✅ `earn_programs.update({commission_rate})` |
| Programs | Toggle active | ✅ `earn_programs.update({is_active})` |
| Programs | Create program | ✅ `earn_programs.insert(...)` |
| Commissions | Approve | ✅ `commissions.update({status:'approved'})` |
| Commissions | Mark paid | ✅ commissions UPDATE + earners `total_earnings` RMW (**not transactional**) |
| Campaigns | Toggle status | ✅ `brand_campaigns.update({status})` |
| Campaigns | Create campaign | ✅ `brand_campaigns.insert(...)` |
| Payouts | Move to processing | ✅ `payouts.update({status:'processing'})` |
| Payouts | Mark failed | ✅ `payouts.update({status:'failed'})` |
| Payouts | Mark paid (with reference) | ⚠️ ledger-only; **no Stripe/PayPal call** |
| Settings | Save | ✅ `earn_settings.upsert(...)` |
| Dashboard | (no interactive controls) | — |

Dead-today count (blocked by `earnDb===null`): **all 15**.

---

## SECTION 9 — REAL DATA vs MOCK

Scanned every page for hardcoded numbers / mock arrays. Findings:
- **No mock data anywhere.** Skeleton placeholders in DynastyEarn (`Array.from({length:5})`)
  render grey shimmer bars; they are not fake numbers presented as real.
- **Everything is real-source-if-connected.** Nothing is fabricated.
- Two source-of-truth gaps still count as "not real":
  1. Dashboard **MRR is not computed** at all — brief mentions MRR, code does not read
     any subscription table.
  2. Commission ledger **trusts the `amount` column** as-is; there's no code path in
     this hub that computes commissions from sales.

So today the risk is not "mock shown as real" — the risk is "nothing shown at all" while
the audit brief lists things that also aren't built (MRR, brand tier/churn, per-earner
sales drill-down).

---

## SECTION 10 — WIRING MAP

Frontend ↔ backend within the hub:
- `DynastyEarn.tsx` → `earnDb`.{ `earners`, `brands`, `programs`, `commissions`,
  `campaigns`, `payouts` }.
- `EarnEarners.tsx` → `earners`, `commissions`.
- `EarnBrands.tsx` → `brand_accounts`, `brand_campaigns`.
- `EarnPrograms.tsx` → `earn_programs`.
- `EarnCommissions.tsx` → `commissions`, `earners` (RMW).
- `EarnCampaigns.tsx` → `brand_campaigns`, `brand_accounts`.
- `EarnPayouts.tsx` → `payouts`.
- `EarnSettings.tsx` → `earn_settings`.

Hub ↔ public site data:
- Intended: cross-project browser client to `ciouiczwspwfgtecivfo` via the two
  `VITE_DYNASTY_EARN_SUPABASE_*` env vars.
- Actual: **env vars missing → `earnDb=null` → zero connection.**
- OS project's own `dynasty_earn_*` tables (empty) are **not read by any hub page**.
- No edge function bridges the two projects.
- Schema drift risk: dashboard reads `brands` + `programs`; sub-pages read
  `brand_accounts` + `earn_programs`. Once connected, at least one of these will fail
  and require reconciliation. **Inferred, not confirmed.**

Disconnects:
- Hub ↔ public DB: missing.
- Payouts ↔ Stripe/PayPal: missing (manual reference only).
- Commissions ↔ sales compute: not present in this repo.
- Dashboard ↔ MRR source: not present.

---

## SECTION 11 — SECURITY / ACCESS

- Route wrapper (`AppRoutes.tsx:2267-2274`): the `/os/dynasty-earn/**` routes are
  siblings of other `/os/**` routes with **no `RoleGuard` / `RoleCheck` component
  wrapping them**. Whatever the outer `AppRoutes` layout imposes for `/os` is what
  guards them. Sidebar visibility in `Layout.tsx:878` is placement-based; no role
  gate visible on those items.
- The hub uses the Earn project's **publishable (anon) key** shipped to the browser
  (see `dynastyEarnClient.ts`). All row-level security is therefore delegated to whatever
  RLS lives on the public Earn project. If that project's RLS is permissive, any signed-
  in Dynasty OS user (or even any browser with the anon key) can perform every
  approve/mark-paid mutation this hub issues. **Inferred — RLS in the other project
  cannot be inspected from here.**
- No admin-only allow-list in this hub. No `useUserRole()` check in any file under
  `src/pages/os/dynasty-earn/`.

Verdict: not admin-gated in code. Reachability likely depends on whether `/os/**` has
a global guard — worth checking directly, but no evidence of one on these routes.

---

## SECTION 12 — TWO PERCENTAGES + SCORECARD

BUILT + WIRED = 100 %, BUILT − WIRED = 50 %, STUBBED = 25 %, MISSING = 0.

| Area | Score | Notes |
|---|---:|---|
| Data connection (hub ↔ public Earn DB) | **0 %** | env vars missing, `earnDb=null` |
| Earner management | 50 % | code complete, no DB |
| Brand management | 25 % | list only; no tier/MRR/churn/approve |
| Commission & payout ops | 40 % | ledger works when connected; **no payment processor**; no sales→commission compute |
| Platform monitoring / stats | 40 % | 6 real counts wired; **MRR + top-brand revenue missing** |
| Sidebar / routing / structure | 100 % | reachable, not orphaned |
| Security / role gating | ~10 % | inferred — no local admin gate; RLS unknown on remote |
| Orphaned tabs (AdminControl / BrandDealExchange / TalentMgmt) | 0 % | built, not routed |

**Overall build completion: ~40 %.** Every page has real-looking code; half the promised
capabilities aren't built, and the connection layer that would make the built half
visible is entirely absent.

**Operational-readiness: ~5 %.** An admin cannot run the platform from this hub
today. They cannot see a single real earner, brand, commission, or payout, cannot
approve anything, and even after connecting the DB cannot actually send money — payouts
still require using Stripe/PayPal outside the system and pasting the reference back in.

**Plain answer to the plain question:** this is an **empty admin shell**. The shell
is well-built and would light up quickly if the two env vars were set — but calling
it a working operator console today is not accurate.

---

## SECTION 13 — PRIORITIZED TASK LIST TO 100 %

### CRITICAL (blocks hub from showing/doing anything real)

1. **Wire the data connection.** Add `VITE_DYNASTY_EARN_SUPABASE_URL` and
   `VITE_DYNASTY_EARN_SUPABASE_KEY` (public Earn project URL + anon key) to the OS
   project. Every page in the hub is currently frozen on the "Connect Dynasty Earn
   database" banner until this is done. Decide now: cross-project browser client (what
   the code already assumes) vs. edge-function bridge with service-role read (safer,
   more work).
2. **Confirm the target schema.** Reconcile `brands` vs `brand_accounts` and
   `programs` vs `earn_programs` — dashboard and sub-pages disagree. Once connected,
   at least one query will fail.
3. **Gate the hub to admins.** Wrap `/os/dynasty-earn/**` in a `RoleGuard`
   (admin-only). Verify RLS on the public Earn project is not permissive to the
   shipped anon key — otherwise approve/mark-paid is exposed to anyone who can hit the
   route.

### HIGH (needed to actually operate the platform)

4. **Wire payouts to a real processor.** Today `mark paid` is manual bookkeeping. Add a
   Stripe Connect (or PayPal Payouts) call — most naturally as an OS edge function
   that reads the payout row from the Earn project, executes the transfer, then writes
   `status='paid'` + real `reference`.
5. **Build brand-subscription/MRR view.** Brand tier ($499 / $999 / $1,499),
   paying / churned status, brand-sourced revenue, MRR on dashboard. Requires a
   subscription source (Stripe subs sync) that doesn't exist yet.
6. **Move `commissions.mark_paid` into an RPC.** Current client-side read-modify-write
   on `earners.total_earnings` is race-prone. Turn it into a `security_definer`
   function on the Earn project.
7. **Commission compute path.** Confirm where `commissions` rows come from (sales
   webhook on the public site). If missing, that pipeline is a prerequisite for the
   ledger to be trustworthy.

### MEDIUM

8. Brand approve / suspend actions in `EarnBrands.tsx` (currently read-only).
9. Per-earner drill-down page (referrals, sales, commissions, lifetime value) instead
   of inline.
10. Wire or delete orphaned components: `AdminControlTab.tsx`,
    `BrandDealExchangeTab.tsx`, `TalentManagementTab.tsx`.

### LOW

11. Replace client-side search in `EarnEarners` with server-side `ilike` for scale.
12. Skeleton counts on dashboard tell no story — show last-updated timestamp / error
    surface if a query fails.
13. Remove the OS-side empty `dynasty_earn_*` tables (or repurpose them as a
    materialized read cache mirrored from the Earn project) to eliminate schema
    confusion.

---

*Grounded in: `src/pages/os/dynasty-earn/*`, `src/lib/dynastyEarnClient.ts`,
`src/components/Layout.tsx:573-878`, `src/routes/AppRoutes.tsx:1043-2274`,
`psql` reads on `public.dynasty_earn_*` (all 0 rows, `dynasty_earn_brands` absent),
`supabase/functions/` (no earn-related functions). Cross-project schema on
`ciouiczwspwfgtecivfo` is not inspectable from this project — items depending on it
are labelled "inferred."*
