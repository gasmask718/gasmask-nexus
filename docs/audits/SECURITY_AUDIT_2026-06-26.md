# Dynasty OS — Security Audit
**Date:** 2026-06-26  
**Scope:** Supabase project `qalaaroashbggynpvqct` (public schema, 1,852 tables) + edge functions + auth config  
**Verdict:** ⚠️ Several CRITICAL data-exposure gaps + bulk medium findings. Fix Tier 1 immediately.

---

## Executive summary

| Severity | Count | Source |
|---|---|---|
| 🔴 CRITICAL | 65 tables | RLS disabled on public tables (Data API reachable) |
| 🟠 HIGH | 13 tables | RLS enabled but **zero policies** (locked OR silently broken) |
| 🟠 HIGH | 1 view | Security-definer view (`v_public_store_locator`) |
| 🟡 MEDIUM | ~2,300 | Linter info-level (function search_path, indexes, etc.) reported by Supabase linter — bulk noise, fix opportunistically |
| 🟢 OK | 1,774 | public tables with RLS enabled + policies |

Scanner totals: **2,404 findings** (Supabase scanner) / **2,413** (Supabase linter). The vast majority are repetitive lint-info rows; the actionable items are listed below.

---

## 🔴 TIER 1 — Fix immediately (RLS disabled, table data publicly reachable via Data API)

65 tables in `public` have **no RLS**. With the anon/authenticated grants Supabase applies by default through the Data API, every row is readable/writable by anyone holding the publishable key (which ships in the browser bundle).

### Highest-risk clusters

**Sports Betting OS (`sbo_*`) — 41 tables, financial + betting data**
```
sbo_accuracy_log, sbo_actual_bets, sbo_api_budget, sbo_api_costs,
sbo_arbitrage, sbo_bankroll, sbo_bettor_profile, sbo_calibration,
sbo_clv_tracker, sbo_daily_briefings, sbo_daily_profit_plan,
sbo_day_engine_runs, sbo_defense_vs_position, sbo_game_intelligence,
sbo_games, sbo_hedge_engine, sbo_injuries, sbo_line_movement,
sbo_live_picks, sbo_model_performance, sbo_odds, sbo_odds_comparison,
sbo_parlay_payouts, sbo_parlays, sbo_player_game_logs,
sbo_player_projections, sbo_player_props, sbo_player_season_stats,
sbo_polymarket, sbo_polymarket_markets, sbo_polymarket_signals,
sbo_predictions, sbo_prop_correlations, sbo_run_log, sbo_sdio_props,
sbo_simulations, sbo_sms_log, sbo_sync_log, sbo_team_stats,
sbo_unit_log, sbo_user_books, sbo_va_sessions, sbo_wealth_sync,
sbo_weight_history
```
→ Exposes bankroll, bets placed, SMS logs, user-linked betting accounts.

**Brandaro (`brandaro_*`) — 6 tables**
```
brandaro_event_failures, brandaro_framework_stats,
brandaro_industry_intelligence, brandaro_market_intelligence,
brandaro_payment_links, brandaro_pending_messages
```
→ `brandaro_payment_links` and `brandaro_pending_messages` are **PII/financial**.

**Sales Mastery (`sales_mastery_*`) — 4 tables**
```
sales_mastery_call_scores, sales_mastery_coaching_triggers,
sales_mastery_leaderboard, sales_mastery_objections
```
→ Internal coaching scores world-readable.

**UT logistics — 5 tables**
```
ut_rfq_requests, ut_rfq_supplier_responses, ut_shipments,
ut_shipping_quotes, ut_supplier_conversations
```
→ Supplier conversations + shipping quotes exposed (vendor cost data).

**Dynasty Connect / Misc — 9 tables**
```
_merge_matrix_results, _quarantine_misclassified_stores,
ai_dispatch_feedback, dc_business_pipelines, legacy_invoice_price_map,
platform_settings
```
→ `platform_settings` is the worst — config writable anonymously could compromise the whole hub.

**Action:** Enable RLS + write owner/admin-only policies for every table above. Use `has_role(auth.uid(),'admin'|'owner')` per the user-roles standard.

---

## 🟠 TIER 2 — RLS enabled but no policies (table is fully locked OR silently mis-deployed)

13 tables. Either the app cannot read them (silent breakage) or this is intentional service-role-only — verify each:

```
ai_scoring_runs              brandaro_auto_actions
dd_email_suppressions        dropship_orders
dropship_revenue             dynasty_os_api_logs
email_jobs                   note_cleaning_log
review_summary_jobs          sbo_backfill_log
sbo_capper_aliases           trending_products
tt_dispatch_tokens
```

**Action:** Decide per-table → either add a policy (most likely `service_role` + admin SELECT) or document intent. `tt_dispatch_tokens` and `dropship_revenue` especially should NOT be reachable from the client.

---

## 🟠 TIER 3 — Security-definer view

`public.v_public_store_locator` is a SECURITY DEFINER view. It enforces the *view-creator's* permissions, bypassing the caller's RLS.

**Action:** If this view is meant to expose only public store fields, recreate it with `security_invoker=true` (Postgres 15+) and verify the underlying table policies allow `anon` read of just those columns.

---

## 🟡 TIER 4 — Linter noise (~2,300 rows)

Supabase linter flagged duplicates of:
- `function_search_path_mutable` — functions missing `SET search_path`
- `auth_otp_long_expiry`, `auth_leaked_password_protection` — auth config
- `extension_in_public` — extensions installed in `public` schema
- Unused/duplicate indexes

These are warnings, not active exploits. Fix in a follow-up sweep:

1. Add `SET search_path = public` to every SECURITY DEFINER function.
2. In Cloud → Users → Auth Settings: shorten OTP expiry, enable HIBP password check.
3. Move `pg_trgm`, `unaccent`, etc. out of `public` if any are flagged.

---

## Edge functions / app code

Not exhaustively scanned in this pass. Spot-checks during recent builds confirm:
- ✅ `dc-bland-webhook`, `sf-trigger-bland-campaign`, `re-trigger-bland-campaign` use service-role correctly.
- ⚠️ Recommend: review every edge function that accepts a `leadId` from the client to ensure it re-checks the caller's role before mutating cross-hub data.

---

## Auth posture

- Email + Google providers configured (per project standard).
- ❓ HIBP leaked-password check status: needs confirmation in Cloud → Users → Auth Settings.
- ❓ OTP expiry: linter flagged "long expiry" — recommend ≤ 600s.

---

## Recommended fix order

1. **Today** — RLS + admin policies on the 65 Tier 1 tables (especially `platform_settings`, `sbo_bankroll`, `sbo_actual_bets`, `brandaro_payment_links`).
2. **This week** — Resolve Tier 2 (13 tables): policy or document.
3. **This week** — Rebuild `v_public_store_locator` with `security_invoker=true`.
4. **Next sprint** — Bulk function `search_path` migration + auth hardening + index cleanup.

---

## Reproduction

```sql
-- Tier 1 list
select tablename from pg_tables t
where schemaname='public' and not exists (
  select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=t.tablename and c.relrowsecurity);

-- Tier 2 list
select c.relname from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relrowsecurity
and not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname);
```

No code changes made — audit only. Awaiting approval to ship Tier 1 RLS migration.
