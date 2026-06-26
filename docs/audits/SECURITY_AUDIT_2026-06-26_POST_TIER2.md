# Dynasty OS — Post-Tier-2 Security Audit
**Date:** 2026-06-26 (after Tier 1 + Tier 2 lockdown)
**Scope:** Supabase project `qalaaroashbggynpvqct` — 1,852 public tables, all DB functions/views, auth config
**Verdict:** ✅ All ERROR-level findings cleared. Remaining items are WARN/INFO bulk noise + 1 design-review queue.

---

## Score card

| Check | Result | Status |
|---|---|---|
| Public tables with RLS disabled | **0 / 1,852** | ✅ Clear |
| RLS-enabled tables with zero policies | **0** | ✅ Clear |
| `SECURITY DEFINER` views | **0** | ✅ Clear |
| User functions missing `search_path` | **0 / 92** | ✅ Clear |
| HIBP leaked-password check | enabled | ✅ Clear |
| Anonymous sign-ups | disabled | ✅ Clear |
| Auto-confirm email | disabled | ✅ Clear |
| Materialized views in `public` | 2 | 🟡 Review |
| Extensions in `public` | 1 (`pg_trgm`) | 🟡 Low |
| Permissive `USING (true)` / `WITH CHECK (true)` non-SELECT policies | 1,279 | 🟠 Design review |
| Unused indexes | 1,512 | 🟡 Defer 30d |
| OTP expiry (linter says "long") | n/a via tool | 🟡 Manual |

Linter scoreboard: **2,334 → 2,093 → (current)** — every ERROR severity issue is gone.

---

## 🟠 What still needs attention

### 1. Permissive RLS policies (1,279 INSERT/UPDATE/DELETE policies using `true`)
These are policies like `CREATE POLICY ... FOR INSERT WITH CHECK (true)` — any authenticated user can write. Hot spots:

| Table | Permissive non-SELECT policies |
|---|---|
| `unforgettable_ambassadors` | 6 |
| `event_spaces`, `wholesalers`, `ut_outreach_sequences`, `brandaro_phone_numbers`, `brandaro_qualified_leads`, `ut_leads`, `ut_recruiting_leads`, `dc_leads`, `experience_markup_rules` | 4 each |
| 18 more tables | 3 each |
| 1,200+ more | 1–2 each |

Many of these are intentional (public lead intake, partner self-onboarding). They need a **per-table design pass** — not a blanket migration — to decide which should scope to `auth.uid()` or `has_role()`. Recommend tackling top-25 by hand next sprint.

### 2. Materialized views exposed via Data API
- `public.store_intelligence_v`
- `public.vendor_performance_summary`

Materialized views don't honor RLS. Either move them to a private schema (e.g. `analytics.`) and proxy via a SECURITY DEFINER function, or revoke `anon`/`authenticated` grants on them.

### 3. `pg_trgm` extension installed in `public`
Low-risk standard pattern; clean-up only if you want a perfectly clean linter. Moving requires recreating GIN/GIST trigram indexes — defer unless required.

### 4. OTP expiry warning
Lovable Cloud's `configure_auth` API doesn't expose the OTP TTL knob; the `auth_otp_long_expiry` linter warning will persist until that surface is added. Not exploitable on its own (rate-limits + HIBP + email confirmation already cover it).

### 5. Unused indexes (1,512)
Held — most are on recently-shipped tables (`sf_*`, `re_*`, `tt_*`, `sbo_*`) that haven't accumulated query traffic. Re-check `pg_stat_user_indexes` in 30 days and drop only indexes still at `idx_scan = 0`.

---

## ✅ What's already locked

- **Tier 1 (June 26 AM):** 65 unprotected tables → RLS + admin/owner policies.
- **Tier 1 (June 26 AM):** 13 silent-locked tables → policies issued.
- **Tier 1 (June 26 AM):** `v_public_store_locator` → `security_invoker = true`.
- **Tier 2 (June 26 PM):** 92 user functions → `SET search_path = public`.
- **Tier 2 (June 26 PM):** 155 views → `security_invoker = true`.
- **Tier 2 (June 26 PM):** HIBP enabled, anonymous + auto-confirm disabled.
- Edge functions (`dc-bland-webhook`, `sf-trigger-bland-campaign`, `re-trigger-bland-campaign`) verified using service-role correctly.

---

## Recommended next sprint order

1. **Audit top-25 tables with `true` write policies** — confirm intent or scope to `auth.uid()` / `has_role()`.
2. **Lock down the 2 materialized views** (move schema or revoke grants).
3. **30-day unused-index re-snapshot**, then bulk drop the survivors.
4. **OTP TTL** — request Lovable Cloud surface for `otp_expiry_seconds`, or accept as known WARN.
5. **`pg_trgm` schema move** — optional polish.

No code changes made in this pass — audit only.
