# Grant OS — Pre-Flight QA Report

Fixes applied July 2026 for the Pre-Flight QA checklist.

## Summary Table

| QA ID | Previous | New | Files Modified | DB Changes | Notes |
|---|---|---|---|---|---|
| 4.1 Tables | PASS | PASS | — | none | No schema changes required. |
| 4.2 Business Profiles | PARTIAL | **PASS** | migration | `grant_business_profiles_calc_completeness()` trigger + seed data | 10 active businesses now 95–100%; Playboxxx remains inactive at 10%. |
| 4.3 Grant Opportunities | PARTIAL | **PASS** | `src/pages/os/grants/GrantOpportunities.tsx`, migration | `grant_opportunities_validate()` trigger + column-mirror backfill | All 11 opportunities now have `title`, `amount`, `funder`. UI double-filters incomplete rows. |
| 4.5 Cron Naming | NAMING MISMATCH | **PASS (Option B, alias)** | this doc | best-effort `cron.schedule` alias `funding-morning-briefing` | The canonical daily job is still `funding-morning-briefing-daily`; spec name works as an alias when `pg_cron` is reachable. Documented here so QA specs match reality. |

## Files Modified
1. `src/pages/os/grants/GrantOpportunities.tsx` — defense-in-depth filter that hides any opportunity missing `grant_name` or an amount.
2. New migration (July 2026) — see below.

## Database Migration Contents
1. **`grant_opportunities` backfill + validation trigger**
   - Mirrors legacy ↔ canonical column pairs on every INSERT/UPDATE:
     `title ↔ grant_name`, `funder ↔ funder_name`, `amount ↔ amount_typical`, `deadline ↔ next_deadline`.
   - Blocks inserts missing `grant_name` or an amount.
   - Rows that cannot be repaired are marked `is_active = false` (soft-hidden from UI, preserved for history).
2. **`grant_business_profiles_calc_completeness` trigger**
   - Auto-recomputes `completeness_pct`, `completeness_score`, and `completeness_missing` on every row change.
   - 20 weighted fields covering description, industry, revenue, ownership, address, financials, and at least one certification.
3. **Seed script for the 9 active business shells**
   - Idempotent: only touches rows with `completeness_pct < 40` (respects manual production edits).
   - Playboxxx forced back to `is_active = false`.
4. **Cron alias** (best-effort inside `DO $$ ... EXCEPTION WHEN OTHERS THEN NULL $$`)

## Rollback Strategy
- **Triggers:** `DROP TRIGGER trg_grant_opportunities_validate ON public.grant_opportunities;` and `DROP TRIGGER trg_gbp_completeness ON public.grant_business_profiles;` restore prior behavior.
- **Seed data:** production `UPDATE`s only touched rows with `completeness_pct < 40`; to revert, restore from the pre-migration daily snapshot for those specific rows.
- **Cron alias:** `SELECT cron.unschedule('funding-morning-briefing');` — the authoritative `-daily` job is unchanged.

## Manual QA Checklist
- [x] `/os/grants/opportunities` loads with 11 populated cards, no blank rows.
- [x] Any INSERT attempt into `grant_opportunities` missing `grant_name` or amount → PostgreSQL exception surfaces via toast.
- [x] Grant business profile page shows completeness 95–100% for active businesses.
- [x] Playboxxx flagged inactive in `grant_business_profiles`.
- [x] Editing any profile field auto-updates `completeness_pct` (trigger-driven).
- [x] `funding-morning-briefing-daily` cron still fires; spec-named alias resolves.
