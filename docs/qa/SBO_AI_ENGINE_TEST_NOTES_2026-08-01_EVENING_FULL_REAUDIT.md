# SBO AI ENGINE — FULL RE-AUDIT (COMPLETE FRESH PASS)

**Run at:** 2026-08-01 20:26–20:35 UTC
**Mode:** READ-ONLY. Nothing modified, invoked, or deployed.
**Project:** `qalaaroashbggynpvqct`
**Supersedes (does not overwrite):** `SBO_AI_ENGINE_TEST_NOTES_2026-08-01.md`
**Method:** direct SQL against live tables/`pg_policy`/`cron.job`/`cron.job_run_details`, source read of every SBO edge function touched by recent work, headless browser load of all 34 SBO routes.

---

## 1. Multi-sport coverage — every sport with any data

### 1.1 Raw inventory (live counts, 2026-08-01 20:30 UTC)

| Sport | Games (`sbo_games`) | Props (`sbo_player_props`) | Predictions (`sbo_predictions`) | Saved picks | Capper picks | Stats brain (`sbo_player_game_stats` / `_season_splits`) |
|---|---|---|---|---|---|---|
| MLB | 117 (98 closed / 19 upcoming) | 1,569 | 1,712 (1,701 in 7d) | 1,712 | 3,706 | 54,024 / 2,481 |
| WNBA | 6 upcoming | 364 | 114 | 114 | 149 | 153 / 136 |
| NFL | 272 upcoming | 139 | 88 | 88 | 23 | 315 / 315 |
| NHL | 31 upcoming | 0 | 0 | 0 | 5 | 534 / 534 |
| NBA (legacy) | 291 `NBA` + 19 `basketball_nba` | 12,579 (last 2026-04-24) | 1,654 (last 2026-07-04) | 1,477 | 88 | 0 / 0 |
| UFC/MMA | 0 | 0 | 0 | 0 | 151 (84 graded) | n/a (game-level only) |
| CFL | 0 | 0 | 0 | 0 | 23 (0 graded, 23 `unsupported`) | n/a |
| Tennis | 0 | 0 | 0 | 0 | 309 | none |
| Soccer | 0 | 0 | 0 | 0 | 110 + 10 (`soccer` lowercase) | none |
| Golf | 0 | 0 | 0 | 0 | 35 + 3 (`PGA Tour`) | none |
| NCAAB | 0 | 0 | 0 | 0 | 12 (2 graded) | none |
| NCAAF | 0 | 0 | 0 | 0 | 2 | none |
| Boxing | 0 | 0 | 0 | 0 | 1 | none |
| Rugby | 0 | 0 | 0 | 0 | 3 | none |
| Misc (`Multiple`, `Mixed`, `baseball`, `null`) | — | — | — | — | 10 | none |

`sbo_sports` registry: active = `mlb, mma, nba, nfl, nhl, wnba`; inactive = `ncaab, ncaaf, soccer_epl`. Every registry row still shows `accuracy_rate = 0` (registry field never back-filled; real accuracy lives in `sbo_predictions`).

### 1.2 Grading / accuracy

| Sport | Graded predictions | Win rate | Graded capper picks |
|---|---|---|---|
| MLB | 304 verified | **60.9 %** | 2,017 |
| NBA (legacy) | 1,365 verified | 57.4 % | 48 |
| WNBA | 0 verified (all 114 created today) | — | 15 |
| NFL | 0 verified (all 88 created today, games upcoming) | — | 0 |
| UFC | n/a | n/a | 84 |
| NCAAB | n/a | n/a | 2 |
| CFL | n/a | n/a | 0 (23 labelled data-unavailable) |

### 1.3 Fanout cron (jobid 110) real impact

`sbo-prop-fanout-catchup`, `*/20 * * * *`, active, last run **20:20:00 succeeded**, zero failures in 3 days.

Predictions created in the **last 2 hours**: MLB 516, WNBA 106, NFL 79 — the catch-up cron is demonstrably producing, not idling.

Today's prop→prediction coverage (`game_date >= today`):

| Sport | Props with a prediction | Props still un-fanned | Coverage |
|---|---|---|---|
| MLB | 557 | 32 | **94.6 %** |
| NFL | 88 | 51 | 63.3 % |
| WNBA | 112 | 252 | **30.8 %** |

Baseline before the dedicated cron was effectively 0 % for WNBA/NFL. WNBA is the remaining backlog (252 props), NFL second (51), MLB effectively cleared.

**Verdict:**
- MLB — **PASS** (full loop: odds → props → predictions → grading → signals).
- WNBA — **PARTIAL** (odds/props/predictions live, stats brain seeded 153/136, but 69 % of today's props still un-fanned and zero graded predictions yet).
- NFL — **PARTIAL** (pipeline live, games all `upcoming`, nothing graded yet by construction; 51 props un-fanned).
- NHL — **PARTIAL** (31 games + full 534-row stats brain, but **zero props and zero predictions** — odds ingest is not producing NHL props).
- NBA — **LEGACY / FROZEN** (props stop 2026-04-24, predictions stop 2026-07-04; only `props_master` still receives NBA rows, see §6).
- UFC/MMA — **PASS at game level** (84/151 graded).
- CFL — **FAIL (external)** — see §10.
- Tennis (309), Soccer (120), Golf (38), NCAAB/NCAAF/Boxing/Rugby (18) — **NOT COVERED, deliberate.** Picks accumulate ungraded.

---

## 2. `sbo-verify-results` — full re-verification

Source read of `supabase/functions/sbo-verify-results/index.ts` (current deployed source):

- **Generalised registry** — no per-sport branches. All sports route through `getGradingConfig()` / `GRADING_CONFIGS` in `_shared/espnGrading.ts`. Registered ESPN paths: `baseball/mlb`, `basketball/wnba`, `football/nfl`, `hockey/nhl`.
- **Legacy isolation** — NBA/SportsDataIO is a *separate* registry (`LEGACY_SCORE_SOURCES`); a sport with no entry there cannot reach the vendor path. Confirmed by comment + code at line 986.
- **Sport scoping** — every read is `.eq('sport_key', sportKey)` (lines 348, 416, 586, 772). The one previously-unscoped query is now `.in('sport_key', activeSports)` (line 480) with the explicit fix comment at line 478. **Zero unscoped reads remain in the file.**
- **Determinism** — `pickPrediction()` (documented tiebreak): newest `created_at` wins, ties break on larger uuid text. Explicitly rejects the self-referential "prefer row with a verdict" rule. Repeatable across re-runs.
- **Dry-run** — `report_only` flag returns `dry_run: !!report_only` (line 909) and suppresses writes.
- **Cross-sport contamination** — checked *all* verification output, not a sample: `sbo_results_verification` = 181 `game` + 1,459 `prop` rows, **0 rows with a null verdict**; `sbo_predictions` verified-with-null-verdict = **0**; `sbo_player_props` verified-with-null-actual = **0**. No sport_key/verdict mismatches found.

Cron 26 (`auto-verify-results`, 03:59 daily) — last run 2026-08-01 03:59 succeeded, 0 failures in 2 days.

**Verdict: PASS.**

---

## 3. Core combined-confidence loop

Crons:

| Job | Schedule | Active | Last run |
|---|---|---|---|
| 108 `sbo-signal-combiner-morning` | `15 5 * * *` | ✅ | 2026-08-01 05:15 succeeded |
| 109 `sbo-signal-combiner-evening` | `50 23 * * *` | ✅ | **never yet fired** (registered after 23:50 UTC yesterday — first fire due tonight) |
| 104 `sbo-match-capper-picks-daily` | `30 4 * * *` | ✅ | 2026-08-01 04:30 succeeded |

`sbo_signals` — **29 rows total** (MLB 27, WNBA 2). Distribution:

| Grade | pending | win | loss |
|---|---|---|---|
| LEAN | 13 | 5 | 7 |
| NO_PLAY | 1 | 1 | 0 |
| (null grade) | 0 | 1 | 1 |

Combined confidence range **0–54** (54 clamp holding, no value above it).

**Settlement is now proven end to end.** 15 signals carry a real terminal result with `resolved_at` between 18:25 and 20:00 today (all post-fix): **7 win / 8 loss / 0 push**, with real differentiated PnL (`+0.909`, `+0.806`, `+0.794` for varying prices; `-1` on losses; net **-1.85 u**). Sample: `MLB | Detroit Tigers | conf 54 → win +0.909`, `MLB | New York Mets | conf 54 → loss -1`, `WNBA | Las Vegas Aces | conf 0 → loss -1`. This is no longer unproven.

**Verdict: PASS**, with one caveat — job 109 has not yet had a scheduled window, so evening-side combining is registered-but-unexercised.

Two anomalies worth naming (not failures): 3 settled signals carry `combined_confidence` 0 or 12, and 2 settled rows have a **null `signal_grade`** — signals are being written and settled before/without a grade in some paths.

---

## 4. Capper confidence scoring

- **Column fix — PASS.** `useConsensusIntelligence.ts:208` reads `p.roi` with the explicit comment "column is `roi`, not `roi_pct`". No `roi_pct` reference remains in the hook.
- **Per-pick scoring — PASS.** Live in the hook: directional agreement (majority direction over unique cappers), average American odds → implied probability, line edge vs live market line via `marketPropCandidates()` spelling variants, and recent player form vs the exact line/direction. Consensus requires ≥2 *distinct* cappers (`uniqueCappers.size < 2` → skip).
- **Stale-data banner — PASS.** `ManualBettingDashboard.tsx:145-250`: `isStaleFallback` computed from whether today's date is in the returned pick dates; renders a notice block and a `stale · {date}` chip on the Best Picks header.
- **Line-edge join coverage — FAIL (real gap).** Only **10 of 4,640** capper picks carry `matched_prop_id` (0.22 %); over the last 7 days it is **7 of 3,512** (0.20 %). `edge_score` is non-null on **0** rows and `confidence_score` non-null on **0** rows in `sbo_capper_picks` — all scoring is computed client-side per render and never persisted, so line edge is available for a fraction of a percent of picks and nothing is queryable/back-testable server-side.

**Verdict: PARTIAL.**

> **Prompt Fix — capper line-edge join coverage**
> `sbo-match-capper-picks` matches only 0.2 % of picks to `sbo_player_props`. Investigate the join key (player name normalisation, prop_type vocabulary, game_date timezone) using `src/lib/sbo/statNormalize.ts` as the canonical normaliser, and persist `matched_prop_id`, `edge_score` and `confidence_score` on `sbo_capper_picks` so scoring is durable and back-testable instead of render-time only. Report matched-rate before/after on the same 7-day window.

---

## 5. RLS posture — full policy sweep

Full re-scan of `pg_policy` for every `public` table matching `sbo_%`, `%capper%`, plus `props_master`, `prop_results`, `confirmed_game_winners`. **93 SBO-family tables, all with `relrowsecurity = true`. Zero tables with RLS off. Zero tables with zero policies.**

Policy shape breakdown:

| Shape | Tables |
|---|---|
| `ALL` gated on `has_role(admin/owner)` | 52 tables (incl. `sbo_games`, `sbo_predictions`, `sbo_player_props`, `sbo_signals`, `sbo_player_game_stats`, `sbo_player_season_splits`, `sbo_team_stats`) |
| 4-policy operator set (`auth_read` + `operator_insert/update/delete` on `is_sbo_operator()`) | 30 tables (incl. `sbo_capper_picks`, `sbo_cappers`, `sbo_results_verification`, `sbo_saved_picks`, `sbo_analysis_jobs`) |
| `ALL` gated on `auth.uid() = user_id` | 5 tables (`sbo_bet_log`, `sbo_betting_wallet`, `sbo_daily_report`, `sbo_market_performance`, `sbo_strategy_performance`) |
| Operator-read only | 4 tables (`sbo_clamp_readiness`, `sbo_external_match_logs`, `sbo_prop_accuracy`, `sbo_sports`) |

New/changed surfaces since the last audit re-checked individually:
- `sbo_capper_picks.unsupported` + `unsupported_reason` (new columns) — inherit the table's 4-policy operator set. **No new policy, no regression.**
- `sbo_clamp_readiness` — operator-read only. Clean.
- No new tables were created by the CFL/MMA grading work (it writes to `sbo_capper_picks` only). Confirmed: no `sbo_alt_*` / `sbo_scoreboard_*` tables exist.

**Residual permissive policies (3 — all pre-existing, none introduced today):**

1. `props_master` — `ALL` to `authenticated`, `USING true / WITH CHECK true`. **Any authenticated user can read, write and delete all 14,435 rows.** This is the single widest surface in the SBO family.
2. `sbo_prop_stat_context` — `ALL` to `service_role`, `USING true`. Acceptable (service_role bypasses RLS anyway) but redundant.
3. `sbo_telegram_posts` and `sbo_top_plays` — `ALL` to `service_role`, `true/true`. Same category as (2): noise, not exposure.

Also outside the `sbo_` prefix but in-loop: `confirmed_game_winners` — `SELECT USING true` (public read) and `UPDATE USING (auth.uid() IS NOT NULL)`; `prop_results` — `SELECT USING true` to **all roles including `anon`**.

**Verdict: PARTIAL — zero regressions from today's work, but `props_master` remains fully permissive and `prop_results` is anon-readable.**

> **Prompt Fix — residual permissive SBO-adjacent policies**
> Replace `props_master`'s single `Authenticated users can manage props_master` (`ALL`, `true/true`) with the standard 4-policy operator set used by `sbo_capper_picks` (`auth_read` + `operator_insert/update/delete` on `is_sbo_operator()`). Decide explicitly whether `prop_results` and `confirmed_game_winners` are intended public-read; if not, scope both to `is_sbo_operator()`. Drop the redundant `true/true` `service_role` policies on `sbo_prop_stat_context`, `sbo_telegram_posts`, `sbo_top_plays`. Re-run the full `pg_policy` sweep afterwards.

---

## 6. `props_master` — label fix on fresh writes

Rows written in the **last 48 hours**, by label:

| Sport label | Rows | game_date range | Last write |
|---|---|---|---|
| NBA | 535 | 2026-03-28 → 2026-08-01 | 2026-08-01 18:27 |
| MLB | 497 | 2026-08-01 → 2026-08-01 | 2026-08-01 13:30 |
| WNBA | 364 | 2026-08-01 → 2026-08-01 | 2026-08-01 18:27 |
| NFL | 139 | 2026-08-01 → 2026-08-01 | 2026-08-01 18:27 |

Distinct labels on fresh writes = exactly `MLB, NBA, NFL, WNBA` — no lowercase variants, no `null`, no `Multiple`. The label fix **holds on fresh writes**.

Caveat: the NBA bucket still receives writes with a `game_date` reaching back to 2026-03-28 and forward to 2026-08-01, while `sbo_player_props` NBA has been dead since April. Cron 101 (`sbo-props-master-sync-daily`, 13:30 & 23:30) last ran 13:30 succeeded — but the 18:27 writes came from a different path (consensus/prizepicks sync), and the NBA rows are re-writes of stale market data, not new games.

**Verdict: PASS on labelling. Flagged: NBA rows in `props_master` are stale-source, not live.**

---

## 7. NHL season relabel

`sbo_capper_picks` NHL: **5 picks total**, `game_date` 2026-07-29 → 2026-07-30, created 2026-07-30 16:48. Zero NHL picks created since. No new mislabels.

`sbo_games` NHL = 31 rows, all `sport = icehockey_nhl`, all `status = upcoming`. `sbo_player_game_stats` / `sbo_player_season_splits` NHL = 534 / 534, `sport = 'nhl'` lowercase, consistent with the mlb/nfl/wnba convention.

**Verdict: PASS (relabel holding, zero new mislabels).**
Note: 5 NHL picks dated late July sit outside the real NHL season — they are off-season/futures noise from the Telegram intake, not a relabel regression.

---

## 8. The 41 re-graded ambiguous props

- **Batch confirmed stable.** 28 rows in `sbo_player_props` carry `verified_at` inside the 19:56–19:58 window on 2026-08-01 — unchanged since the write, matching the reported count exactly.
- **Structural check — currently clean.** Live scan right now:
  - props `verified = true` with a null/empty/`unknown`/`ambiguous` verdict → **0**
  - props `verified = true` with a null `actual_value` → **0**
  - predictions `verified = true` with a null verdict → **0**
  - `sbo_results_verification` rows with a null verdict → **0**
  - `sbo_saved_picks` for past dates with a null result → **0**
- **Structurally impossible? — NO, only structurally unlikely.** There is no DB-level constraint (no CHECK, no trigger) preventing a row from being marked `verified = true` with a null/ambiguous verdict. The guarantee is purely code-side in `sbo-verify-results` (a prop with no resolvable `actual_value` is left unverified rather than verified-ambiguous). If any other writer sets `verified` directly, ambiguity can re-accumulate.

**Verdict: PASS on stability, PARTIAL on the "structurally impossible" claim.**

> **Prompt Fix — enforce the no-ambiguous-verdict invariant at the DB layer**
> Add a validation trigger (not a CHECK constraint — the rule references other columns and is best kept in one place) on `sbo_player_props`, `sbo_predictions` and `sbo_results_verification` that rejects any row where the verified flag is true while the verdict is null/empty or the actual value is null. This turns today's clean scan from a code-side convention into an enforced invariant.

---

## 9. kingcap / kims merge

| Capper | Active | `total_picks` field | Real pick count |
|---|---|---|---|
| **KINGCAP** (survivor) | ✅ true | 6 | **6** |
| `KingCapPicks` (merged away) | ❌ false | 0 | **0** |
| **KimsVIP** (survivor) | ✅ true | 20 | **20** |
| `Kims Picks` (merged away) | ❌ false | 0 | **0** |

No orphan picks pointing at the deactivated rows. `total_picks` matches the real join count on both survivors (no counter drift).

Adjacent look-alikes still active and **intentionally separate** (not merge targets, listed for completeness): `kingcap702` (5 picks), `VegasKing` (0), `KBO Cappers / Kims Picks` composite name (0), `IK Start vs Viking` (0 — a parsed match title mis-created as a capper), `Breaking Bank` (field says 3, real count 1 — minor counter drift).

**Verdict: PASS.** Flagged: one mis-created capper row (`IK Start vs Viking`) and one `total_picks` drift (`Breaking Bank` 3 vs 1).

---

## 10. CFL / MMA grading

**MMA/UFC — PASS.** 151 picks, **84 graded** (55.6 %). `sbo-grade-capper-picks-alt` reaches them through `ALT_SCOREBOARD_CONFIGS` in `_shared/espnScoreboard.ts`, which is a *deliberately separate* registry from `GRADED_SPORT_KEYS` (comment at line 17 confirms adding a sport there must not enrol it in prop grading). The ungraded 67 are older/uncovered events.

**CFL — labelling is holding, correctly.** All **23** CFL picks carry `unsupported = true` with the exact reason string:
> "ESPN CFL feed inactive as of 2026-08-01 (returns only a stale 2022 event) — will auto-grade if the feed resumes"

Last write 2026-08-01 16:44. Auto-resolution is wired both ways: `sbo-grade-capper-picks-alt` sets `unsupported: false, unsupported_reason: null` (lines 220-221) on any pick it successfully grades, and re-applies the flag with a fresh reason (line 230) when the feed is empty. So the labels will clear themselves if ESPN's CFL feed comes back — no manual intervention required.

Frontend renders the ⚪ DATA UNAVAILABLE badge with hover note in `CapperPicksFeed.tsx`.

**Verdict: CFL — PASS on labelling / FAIL on grading (external data blocker, correctly quarantined).**

**Unrelated finding surfaced by this check:** **144 MLB capper picks also carry `unsupported = true` — with a NULL `unsupported_reason`.** They were written 2026-07-21 → 2026-07-26, i.e. *before* the `unsupported_reason` column existed, and are `bet_type = prop`. They will render the same ⚪ DATA UNAVAILABLE badge with **no explanatory note**.

> **Prompt Fix — 144 unlabelled MLB `unsupported` picks**
> `sbo_capper_picks` has 144 MLB rows (created 2026-07-21 → 2026-07-26, `bet_type = 'prop'`) with `unsupported = true` and `unsupported_reason IS NULL` — pre-dating the reason column. Determine why they were flagged (likely the pre-column prop-grading quarantine), then either back-fill an accurate reason string or clear the flag if they are now gradable. They currently render an unexplained ⚪ DATA UNAVAILABLE badge in `CapperPicksFeed`.

---

## 11. Data integrity spot-check (NEW)

### 11.1 Unbounded `.select()` scan

Frontend — 29 files query `sbo_*`/`props_master`. Files with **no** `.limit()`, `.range()` or `head: true` anywhere:

| File | Risk |
|---|---|
| `src/hooks/useCrossPlatformProps.ts` | Reads props across platforms — **real 1,000-row truncation risk** (`props_master` NBA alone is 13,363 rows) |
| `src/pages/sports-betting/pages/PropIntelligenceHub.tsx` | Same table family, same risk |
| `src/components/sbo/PrizePicksAnalyzer.tsx` | Same |
| `src/components/sbo/PropStatContextCard.tsx` | Single-prop context; low volume, low risk |
| `src/components/sbo/SBOHealthDashboard.tsx` | Aggregate counts; low risk |

Edge functions — 21 files with no limit/range. Most are write-only paths (`sbo-fetch-odds`, `sbo-sync-*`, `sbo-parse-prop-image`), which are not affected. The ones that **read** unbounded and matter: `sbo-consensus-engine`, `sbo-track-results`, `sbo-daily-profit-plan`, `sbo-compare-odds`, `sbo-day-engine`.

**Nothing here was introduced by today's work** — `_shared/sboSignals.ts` (new) does a single scoped `upsert(...).select('id')` with `onConflict: 'sport,game_date,home_team,away_team,pick_type'`; `sbo-grade-capper-picks-alt` (new) is bounded (`.in('sport', ALT_PICK_SPORTS)` + limit). These are clean.

### 11.2 Silent-failure patterns

- `_shared/sboSignals.ts` — upsert returns `.select('id')`, so a zero-row write is detectable. **Clean.**
- `sbo-grade-capper-picks-alt` — writes `unsupported` on the empty-feed branch rather than silently reporting success. This is exactly the anti-silent-failure shape. **Clean.**
- **Real silent-success case found:** the CFL run reports HTTP 200 with `graded: 0` and no non-zero exit signal; only the `unsupported_reason` write distinguishes "nothing to grade" from "feed dead". Acceptable because the reason column carries the truth, but a caller reading only the status would see success.
- `sbo_signals` writes with `signal_grade = null` and `combined_confidence = 0` (see §3) are a genuine partial-write signature — rows land, grading metadata does not.

**Verdict: PARTIAL.**

> **Prompt Fix — unbounded prop reads in the frontend**
> `useCrossPlatformProps.ts`, `PropIntelligenceHub.tsx` and `PrizePicksAnalyzer.tsx` read `props_master`/`sbo_player_props` with no `.limit()` or `.range()`. `props_master` holds 14,435 rows (13,363 NBA), so PostgREST silently truncates at 1,000 and the UI shows a partial universe with no indication. Add explicit date/sport filters plus paginated `.range()` fetches (the same pattern used for the UT territory hooks), and surface a count so truncation cannot be silent.

---

## 12. Frontend route health (NEW)

All **34** SBO routes enumerated from `src/routes/AppRoutes.tsx` (19 under `/os/sports-betting/*`, 13 under `/sbo-ai-engine/*`, 2 under `/os/sbo*`) and loaded headless against the running dev server.

- **Module resolution: PASS.** Every lazy `import('@/pages/sports-betting/...')` target resolves to a real file — zero missing modules, zero build-time route breaks.
- **Render verification: UNVERIFIED.** `LOVABLE_BROWSER_AUTH_STATUS = signed_out`, so all 34 routes redirected to `/auth` and rendered the "GasMask Universe OS — Command Center Access" login shell. No route produced a white screen, a 404, an unhandled exception, or an ErrorBoundary trip — but the authenticated render of each page could not be exercised.
- The only console error on every route is a `406` from the pre-auth profile probe, which is the expected signed-out response, not an SBO defect.
- Redirect-only routes behaved correctly at the router level: `/os/sports-betting` → `/dashboard`, `/sbo-ai-engine/props|props-intelligence|parlay|prizepicks|bovada` → `/prop-hub`.

**Verdict: PARTIAL — routing and module graph PASS; authenticated page render UNVERIFIED for all 34 routes.**

> **Prompt Fix — authenticated SBO route health**
> Re-run the 34-route sweep with a signed-in session (sign in via the Lovable preview so the managed session injects), asserting per route: HTTP-level render, zero console errors, and non-empty primary data region. Without this, no claim about SBO page health above the router layer is evidence-backed.

---

## 13. Known open items — complete fresh list

| # | Item | State | Severity |
|---|---|---|---|
| 1 | **Tennis (309), Soccer (120), Golf (38) capper picks** ungraded, no grading path | Deliberately held | Medium — 467 picks pollute any global capper win-rate |
| 2 | **CFL grading** blocked on dead ESPN feed (23 picks quarantined, auto-resolves) | External blocker, correctly labelled | Low |
| 3 | **144 MLB `unsupported` picks with NULL reason** | Newly surfaced this audit | Medium |
| 4 | **Capper line-edge join at 0.2 %** (10/4,640 matched) | Real gap | High |
| 5 | **`edge_score` / `confidence_score` never persisted** on `sbo_capper_picks` (0 non-null rows) | Real gap | Medium |
| 6 | **`props_master` fully permissive RLS** (`ALL`, `true/true`, authenticated) | Pre-existing | High |
| 7 | **`prop_results` readable by `anon`** | Pre-existing | Medium |
| 8 | **NHL: 31 games + 534-row stats brain but 0 props, 0 predictions** | Pipeline half-built | Medium |
| 9 | **WNBA fanout backlog: 252/364 of today's props un-fanned** (30.8 % coverage) | Cron 110 working but under-provisioned for WNBA | Medium |
| 10 | **Cron 109 (`signal-combiner-evening`) never fired yet** | Registered 23:50, first window tonight | Low — needs one confirmation run |
| 11 | **Cron 85 (weight-optimizer, weekly Sun 05:00) and Cron 103 (clamp-readiness, Mon 09:00) have no run history** in the 3-day window | Expected given their cadence, but never observed succeeding | Low |
| 12 | **Weight optimizer sport coverage:** `optimizeSport()` is per-`sport_key` and skips any sport absent from `sbo_sports` (`reason: 'Sport not found in sbo_sports'`). Registry has 9 rows, 6 active — UFC/CFL/Tennis/Golf can never be optimised | Structural | Low |
| 13 | **`sbo_sports.accuracy_rate = 0` for all 9 rows** — registry accuracy never written back | Data staleness | Low |
| 14 | **38 empty `sbo_*` tables** (`n_live_tup = 0`): `sbo_actual_bets, sbo_analysis_jobs, sbo_arbitrage, sbo_bankroll, sbo_bet_log, sbo_clv_tracker, sbo_daily_report, sbo_decision_weight_history, sbo_defense_vs_position, sbo_hedge_engine, sbo_injuries, sbo_learning_events, sbo_line_movement, sbo_live_picks, sbo_market_performance, sbo_parlay_legs, sbo_pm_tracked_wallets, sbo_pm_wallet_events, sbo_pm_wallet_positions, sbo_pm_wallet_scores, sbo_pm_wallet_snapshots, sbo_polymarket_signals, sbo_prop_accuracy, sbo_prop_correlations, sbo_prop_picks, sbo_prop_predictions, sbo_sdio_props, sbo_signal_inputs, sbo_signal_performance, sbo_strategy_performance, sbo_top_plays, sbo_tracked_wallets, sbo_unit_log, sbo_va_sessions, sbo_wallet_activity, sbo_wealth_sync, sbo_weekly_reports, sbo_weighted_picks`. Notably `sbo_signal_inputs` and `sbo_signal_performance` are empty **despite signals now settling** — the combiner writes results to `sbo_signals` only | Schema debt + missing signal provenance | Medium (for `sbo_signal_inputs`/`_performance`), Low otherwise |
| 15 | **Telegram intake healthy** — 1,335 rows in `sbo_telegram_posts`, last update 2026-08-01 20:13 (13 min before audit). No dispatch failures. Its AI extractor emits free-text `sport`, which is the root of the label sprawl in §1 (`soccer` vs `Soccer`, `PGA Tour` vs `Golf`, `baseball` vs `MLB`, `Multiple`, `Mixed`, one `null`) | Live but un-normalised | Medium |
| 16 | **2 settled signals with NULL `signal_grade`, 3 with confidence 0/12** | Partial-write signature | Medium |
| 17 | **`IK Start vs Viking`** exists as an active capper (a parsed soccer match title) and `Breaking Bank` has counter drift (3 vs 1) | Data hygiene | Low |
| 18 | **Authenticated SBO route render UNVERIFIED** (all 34) | Blocked on signed-out session | Medium |
| 19 | **No DB-level invariant** preventing new ambiguous verdicts | Convention only | Medium |
| 20 | **NBA legacy frozen** — props dead since 2026-04-24, predictions since 2026-07-04, yet 12,296 verified props and 1,365 verified predictions (57.4 %) still dominate any global accuracy figure | Known, must stay sport-scoped in every UI | Medium |

---

## SUMMARY — biggest deltas since 2026-08-01 (morning audit)

1. **Signal settlement is now PROVEN, not theoretical.** Previously "unproven end to end." Now 15 signals carry real terminal results resolved 18:25–20:00 today: 7 W / 8 L, differentiated PnL (+0.909 / +0.806 / +0.794 / -1), net -1.85 u. This is the single most important delta.
2. **Fanout cron 110 is materially working.** 701 predictions created in the last 2 hours (MLB 516, WNBA 106, NFL 79). MLB today's prop coverage is 94.6 %. But **WNBA is still only 30.8 % covered (252 props un-fanned)** — the backlog moved, it did not clear.
3. **RLS: zero regressions from today's work.** All 93 SBO-family tables have RLS on with at least one policy; the new `unsupported`/`unsupported_reason` columns inherit the operator set. But the sweep re-confirmed **`props_master` is still fully permissive** and **`prop_results` is anon-readable** — neither is new, both are still open.
4. **NEW FINDING: 144 MLB capper picks flagged `unsupported` with a NULL reason**, written 2026-07-21→26 before the column existed. They render an unexplained ⚪ DATA UNAVAILABLE badge. Not caught by prior audits.
5. **NEW FINDING: capper line-edge join is at 0.2 %** (10/4,640 picks matched; 7/3,512 in 7d), and `edge_score`/`confidence_score` are non-null on **zero** rows. The line-edge fix works where it fires — it almost never fires.
6. **MLB accuracy re-measured at 60.9 %** on 304 verified predictions (down from the 65.4 % figure quoted on 2026-07-31, which was a smaller graded base). NBA legacy 57.4 % on 1,365.
7. **CFL labelling holds and auto-resolves correctly** — the grader clears the flag on successful grading and re-applies with a fresh reason on an empty feed. MMA at 84/151 graded.
8. **kingcap/kims merge holds cleanly** — survivors at 6 and 20 real picks, losers deactivated with 0 orphans, counters accurate.
9. **`sbo-verify-results` re-read line by line:** every read sport-scoped, deterministic tiebreak documented, dry-run present, and **zero** null-verdict rows anywhere in verification output.
10. **NEW GAP: `sbo_signal_inputs` and `sbo_signal_performance` are both empty** despite signals now settling — settled signals have no stored provenance for which capper/model inputs produced them.
11. **Route health could not be verified above the router layer** — the browser session is signed out, so all 34 SBO routes were exercised only to the auth guard. Module graph is clean; authenticated render is UNVERIFIED and should not be assumed.

**Overall posture:** the core MLB loop (odds → props → predictions → grading → signals → settlement) is now **PASS end to end for the first time**. The open work is concentrated in (a) capper-pick joining/persistence, (b) WNBA/NHL pipeline completion, (c) two pre-existing permissive RLS surfaces, and (d) verification of the authenticated frontend.
