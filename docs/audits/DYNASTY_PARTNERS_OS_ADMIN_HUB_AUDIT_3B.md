# Dynasty Partners — Business-Logic Audit (Audit 3B)

**Scope:** OS `/admin` operator hub (Lovable project `e9aba3c3`, Supabase `qalaaroashbggynpvqct`, `partners.*` + `public.dp_*`).
**Mode:** Read-only. All findings grounded in real code / DB / triggers.
**Rule:** "Displayed but not enforced" ≡ NOT enforced.

---

## Section 1 — Tier rules in commission / backend logic

### 1a. Tier commission rates (Foundation 5% / Equity 7% / Sovereign 10%)

**Status: MISSING (not wired).**

- The only place these percentages exist is the **UI constant** `src/lib/dpTiers.ts`:
  ```ts
  { value: "foundation", …, commissionRate: 5 }
  { value: "equity",     …, commissionRate: 7 }
  { value: "sovereign",  …, commissionRate: 10 }
  ```
  Grep confirms `commissionRate` from this file is **never imported** by any commission/split logic (used only by copy on marketing/CreatePartner UI).
- The actual on-DB commission engine is `partners.fn_create_commission_split()` (trigger function).
  Its splits are **fixed** and do **not** branch on tier:
  ```
  active   → partner 50% / ambassador 40% / dynasty 10%   (of commission_pool_cents)
  trailing → partner 25% / ambassador 50% / dynasty 25%   (dormant/churned/suspended)
  ```
  `v_tier` is read only for the `partner_tier_at_sale` snapshot column — never used to compute a percentage.
- The upstream "pool rate" (`partners.platforms.commission_pool_rate`, 0.20–0.35 per platform) is what actually determines gross commission — not the partner tier. Values in DB today: Brandaro 0.30, Dynasty Connect 0.20, GasMask 0.25, iClean 0.25, Playboxxx 0.35, TopTier 0.30, UBEN 0.30, Unforgettable 0.30.
- No `calculate_commission` function exists in the `partners` schema. The full function list is `current_partner_id, fn_create_commission_split, fn_increment_lifetime_earnings, fn_log_ambassador_insert, fn_payout_completed, is_admin, set_updated_at`.

**Are the rates themselves "correct"?** They are not present anywhere the engine can reach, so the question is moot — the tier is decorative.

### 1b. Ambassador caps (Foundation 75 / Equity 300 / Sovereign unlimited)

**Status: MISSING.**

- No DB constraint, trigger, or function references a cap.
  - `partners.ambassadors` has no CHECK constraint counting per-partner rows.
  - No `pg_proc` entry mentions `max`, `cap`, `75`, `300`.
- No edge function enforces it. Grep across `supabase/functions/` for `ambassador.*cap|max.*ambassador|75.*300` returns zero matches inside the partners pipeline.
- No client-side guard on ambassador creation flows (`DPRecruitment.tsx`, `CreatePartner.tsx`).
- `partners.ambassadors` row count today: **0**, so the omission is invisible in prod.

---

## Section 2 — Sovereign 50-seat lifetime cap

**Status: MISSING.**

- No CHECK/UNIQUE constraint on `partners.partners` restricts sovereign count. Constraints inventory: only uniqueness on `email`, `user_id`, `stripe_customer_id`, `stripe_subscription_id`.
- No trigger on `INSERT`/`UPDATE` of `partners.partners` (0 triggers on that table).
- No function performs a `select count(*) … where tier='sovereign'` guard. Grep for `sovereign` outside UI copy returns nothing in `supabase/functions/**` or migrations.
- The OS hub does **not** show a "seats taken" count anywhere. `DPDashboard.tsx` shows partners by tier as a raw count but there is no target/cap comparison. Filter chip in `DPPartners.tsx` is a filter only.
- Current sovereign count: **0** (of an unenforced 50).

Cap is a marketing claim only.

---

## Section 3 — Trailing / dormant policy

Rule: dormant → 50% of tier rate on existing production; reactivation → 3 months MRR upfront.

### 3a. Dormancy detection — **MISSING**

- Columns `dormant_since`, `mrr_active_until`, `reactivation_count` exist on `partners.partners` (migration `20260512020706`), but grep shows they are only **read** (in `DPPartners.tsx` risk score, `DPMrr.tsx` at-risk logic, `CreatePartner.tsx` initial insert). Nothing **writes** `dormant_since` and nothing flips `status` to `'dormant'`.
- No scheduled job, edge function, or DB trigger evaluates subscription state → dormancy. Cron inventory has no partners-related dormancy job.
- `DPMrr.tsx` "at-risk partners" is a live query over `mrr_subscriptions.status in ('past_due','paused')` — it never mutates the partner row.

### 3b. Reduced-rate for dormant — **PARTIAL**

- The engine (`fn_create_commission_split`) **does** branch on `status IN ('dormant','churned','suspended')` and applies a **25/50/25** trailing split (not "50% of tier rate", since tier rate isn't wired — see §1a).
- Because §3a is missing, no partner ever actually arrives in status `dormant` automatically, so the branch is unreachable except by manual admin flip.

### 3c. Reactivation gate ("3 months MRR upfront") — **MISSING**

- No function, RPC, or edge function enforces a prepayment before flipping status back to `active`.
- `reactivation_count` field exists but is never incremented in code.
- No Stripe webhook / edge function inspects invoice count on reactivation. `supabase/functions/` contains no partners-schema Stripe hook.

---

## Section 4 — Ambassador layer (operator/data side)

### 4a. Schema

`partners.ambassadors` (24 cols) links correctly:
- `partner_id uuid` → `partners.partners.id`
- `platform_id`, `campaign_id`, `lead_id`, `tracking_link_id` all present
- Lifetime rollups: `total_sales_count`, `total_sales_volume_cents`, `total_commission_earned_cents`
- Row count: **0**

Schema is complete; enums (`onboarding|active|dormant|churned|banned`) present.

### 4b. Attribution chain — **PARTIAL (structurally complete, operationally unproven)**

Chain: `tracking_links → sales → commission_splits`.

Wired:
- `partners.sales.tracking_link_id` FK → `partners.tracking_links.id` ✅
- `partners.sales.ambassador_id` FK → `partners.ambassadors.id` ✅
- `partners.sales` has `AFTER INSERT` trigger → `fn_create_commission_split` which writes into `partners.commission_splits` with `ambassador_id`, `partner_id`, three shares, `partner_tier_at_sale`. ✅
- Payout completion trigger (`fn_payout_completed`) increments `partners.total_lifetime_paid_cents` on `partner` payouts.

Break points (why "partial", not "complete"):
1. **No ingestion.** There is no edge function that accepts a webhook / API call to insert into `partners.sales`. `supabase/functions/*` has zero writers to `partners.sales`. Zero rows in `sales` and `commission_splits` today.
2. **No click→conversion increment.** `tracking_links.click_count` and `.conversion_count` have no trigger or edge function updating them. Grep confirms no writers.
3. **`ambassador.total_sales_*` rollup** is never updated by a trigger — the columns exist but no `AFTER INSERT` on `sales` writes back. Only `fn_increment_lifetime_earnings` (on `commission_splits` paid) touches the parent `partners.partners`, not the ambassador.
4. **Rate correctness.** As covered in §1a, the amount landing in `commission_splits.ambassador_share_cents` is 40% of an input `commission_pool_cents` the caller supplies — with no server-side check that the pool matches `platforms.commission_pool_rate * amount_cents`.

### 4c. Admin visibility

- `DPPartners.tsx` shows partner-level MRR/lifetime — no per-ambassador drilldown.
- `DPRecruitment.tsx` exists but is analytics-only (per the main hub audit).
- No route lists "ambassadors per partner" or their production. `src/pages/admin/dp/` has no `DPAmbassadors.tsx`.
- Dashboards read real tables, so numbers are "honest zero" — not mocked, but not visible either.

**Attribution chain verdict: PARTIAL — DDL and trigger for split exist; ingestion, click tracking, rollup, and pool-rate validation are all missing.**

---

## Section 5 — Summary + task list

| Area | Verdict | Evidence |
|---|---|---|
| §1a Tier commission rates wired | **MISSING** | `dpTiers.ts.commissionRate` unused; `fn_create_commission_split` hardcodes 50/40/10 |
| §1b Ambassador caps (75/300/∞) | **MISSING** | No constraint, trigger, function, or client guard |
| §2 Sovereign 50-seat cap | **MISSING** | No constraint, no trigger, no UI counter |
| §3a Dormancy detection | **MISSING** | Columns exist; no writer, no cron |
| §3b Reduced-rate for dormant | **PARTIAL** | Trigger branch exists but unreachable (25/50/25, not "50% of tier rate") |
| §3c Reactivation 3-month prepay gate | **MISSING** | No function / webhook |
| §4a Ambassador schema | **BUILT** | 24 cols, FKs, enums |
| §4b Attribution chain | **PARTIAL** | Split trigger works; ingestion, click, rollup absent |
| §4c Admin visibility of ambassadors per partner | **MISSING** | No DPAmbassadors page |

### Task list

**CRITICAL** *(revenue integrity — money is wrong or unenforced)*
1. Wire tier commission rates into `fn_create_commission_split` — replace 50/40/10 with tier-driven percentages (or introduce `partners.tier_config` table). Overlaps main-hub Phase 6 "commission engine hardening".
2. Add server-side validation that `commission_pool_cents = round(amount_cents * platforms.commission_pool_rate)` on `sales` insert.
3. Build `partners.sales` ingestion path (Stripe webhook + platform-specific adapters) — attribution chain is dead until this exists.

**HIGH** *(cap / policy enforcement)*
4. Enforce Sovereign 50-seat cap — trigger on `partners.partners` insert/update-of-tier.
5. Enforce Foundation 75 / Equity 300 ambassador cap — trigger on `partners.ambassadors` insert.
6. Build dormancy detector — scheduled function that flips `status='dormant'` and stamps `dormant_since` when `mrr_active_until < now()` or subscription cancels.
7. Build reactivation gate — RPC that only flips `dormant → active` after verifying 3× MRR paid in Stripe; increment `reactivation_count`.

**MEDIUM** *(operator visibility)*
8. `DPAmbassadors.tsx` page — ambassadors per partner + production rollups.
9. Add "Sovereign seats: N of 50" counter to `DPDashboard`.
10. Backfill `tracking_links.click_count` / `.conversion_count` writer (edge function or DB trigger from a click log table).
11. Backfill `ambassadors.total_sales_*` rollup trigger.

### Overlap with main roadmap Phase 6
Items **1, 3, 6, 7** are the same tasks called out in the main OS-hub audit as "Phase 6 — commission engine + subscription lifecycle". Items **2, 4, 5, 8–11** are additional gaps this business-logic pass surfaced that Phase 6 does not name explicitly.

---

**Inference notes:** All verdicts above are grounded in `pg_proc`, `pg_class`, `pg_constraint`, `information_schema.triggers`, direct reads of `supabase/functions/**` and `src/**`, and row counts via `partners.*` views. No assumption was made about behavior that does not appear in source.
