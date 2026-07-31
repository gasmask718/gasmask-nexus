# SBO AI ENGINE — QA TEST NOTES (FULL RE-AUDIT)

**Date:** 2026-07-31 23:10 UTC
**Supersedes:** `SBO_AI_ENGINE_TEST_NOTES.md` (original, ~project start)
**Scope:** Supabase project `qalaaroashbggynpvqct` — all `sbo_*` tables, all `sbo-*` edge functions, all SBO cron jobs, full SBO frontend route tree.
**Method:** Every claim below was re-verified against live database rows, live cron definitions, and current source files. No finding was carried forward from the original document.

> **⚠️ READ FIRST:** The combined-confidence core loop (Section 7.3, Check 5) does not currently run on its own — every real result in this document was produced by manual invocation, not the live system. This is the single highest-priority open item.

---

## 7.1 Database Pre-Flight

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. Core tables exist | ✅ PASS | 94 `sbo_*` tables live. All 6 tables the original doc flagged as missing now exist: `sbo_signals` (13 rows), `sbo_sport_performance` (3), `sbo_prop_picks` (0), `sbo_weekly_reports` (0), plus `sbo_cappers` (108) and `sbo_capper_picks` (4,130). | None for existence. See rows 4–5 for the two that exist-but-empty. |
| 2. `sbo_cappers` populated | ✅ PASS | **108 rows** (was 3). Columns confirmed: `name`, `telegram_username`, `telegram_user_id`, `sports text[]`, `best_sport`, `picks_by_sport jsonb`, `win_rate`, `roi_pct`, `capper_weight`, `total_wins/losses/pushes`, `normalized_name`. The original's `capper_name`/`sport_specialties` spec names are still not the live names — code uses the live ones. | Spec doc should be updated to `name` + `sports[]`. No code change needed. |
| 3. Win-rate defaults | ✅ PASS | `win_rate` / `roi_pct` default 0. `sbo_capper_performance` (721 rows) populating as picks resolve. | None. |
| 4. RLS enabled on all `sbo_*` | ⚠️ PARTIAL | Zero tables with RLS off and zero tables with no policy — that part passes. **But 40 policies across `sbo_*` are fully permissive (`USING true`) on SELECT/ALL.** Posture work from the original doc is still unstarted. | See Prompt Fix 7.10-A. |
| 5. `sbo_sport_performance` seeded | ⚠️ PARTIAL | Table now exists with **3 rows** (MLB week of 07-20 win rate 0.1176, MLB week of 07-27 rate 0, WNBA week of 07-27 rate 0.3333). Populated by the weekly optimizer, not seeded. `sbo_sports` seeded with 8 rows. | Acceptable as a rollup, **but the MLB 07-27 `0` is a stale artifact, not a real 0% week — re-verified directly (see below). Do not act on it; fix the rollup refresh instead.** |

**Re-verification of the MLB week-of-07-27 0% figure (queried live 2026-07-31):**
The `sbo_sport_performance` row for MLB / week_start 2026-07-27 was `created_at 2026-07-27 16:07:21` — written on the *first day* of the week and **never refreshed since**. It covers only **6 picks** (3 spread, 2 total, 1 moneyline), all graded losses, at the `min_confidence_threshold = 60` filter. That is a real 0-for-6, but on a sample of six taken on day one of a seven-day window.

The actual MLB prediction population for game dates 2026-07-27 → 2026-08-02:

| prediction_type | total | pending (`was_correct IS NULL`) | wins | losses |
| :---- | ---: | ---: | ---: | ---: |
| `player_prop` | 66 | 41 | 17 | 8 |
| `moneyline` | 13 | 12 | 0 | 1 |
| **Total** | **79** | **53 (67%)** | **17** | **9** |

Graded win rate for the week is therefore **17/26 = 65.4%**, not 0%. Two-thirds of the week is still ungraded, and **zero** graded MLB predictions in that week carry `final_confidence >= 60`, so the rollup's ≥60 filter matched none of them — the 6 picks it did count came from a different, earlier source population. **Conclusion: the 0% is a stale, unrefreshed rollup written against a 6-pick day-one sample, not a real losing week. The defect is that the weekly optimizer never rewrites the in-progress week's row.**
| 6. Stats-brain tables | ✅ PASS | `sbo_player_game_stats` **53,595** rows, `sbo_player_season_splits` **2,477**, `sbo_prop_stat_context` **2,100**, `sbo_player_props` **13,559**, `sbo_unified_props` **8,368**. | None. |
| 7. Dead/empty tables | ⚠️ PARTIAL | Empty-but-present: `sbo_signal_inputs`, `sbo_signal_performance`, `sbo_prop_picks`, `sbo_prop_predictions`, `sbo_polymarket_signals`, `sbo_top_plays`, `sbo_actual_bets`, `sbo_weekly_reports`, `sbo_strategy_performance`, `sbo_daily_report`, plus 20 more. | Not blocking. Flagged in 7.10 as schema noise — several are the drifted-function targets. |

---

## 7.2 Telegram Extraction QA

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. Ingestion health | ✅ PASS | `sbo_telegram_posts` **1,255 rows**, **824 in the last 7 days** (~118/day sustained). Latest activity today. Pipeline is live and high-volume. | None. |
| 2. Dispatch success rate | ⚠️ PARTIAL | Lifetime: 818 `dispatched`, 174 `dispatch_failed`, 186 `skipped_not_pick`, 59 `received`, 11 `extracted`, 7 `deleted`. Total with a `dispatch_error` = **257 / 1,255 = 20.5%**. **However the error is not steady-state**: daily errors run 3–7/day (~4%) for every day in the last 10 *except* 2026-07-26, which logged **117 errors on 119 posts** — a single-day outage accounts for ~46% of all failures ever. | Materially better than the "24% chronic" read in the original doc. Root-cause the 07-26 outage specifically rather than the aggregate. Prompt Fix 7.2-A. |
| 3. Capper attribution | ✅ PASS | Last 7 days: 3,341 picks, **2,677 (80.1%)** carry `extracted_capper_name`, **2,944 (88.1%)** carry `capper_detection_confidence ≥ 0.8`. `posted_by` populated on **4,056 / 4,130 (98.2%)** lifetime. Per-poster attribution is the live primary path; channel fallback only fills the remainder. | None — the re-fix is holding. |
| 4. Image vs text path | ✅ PASS | 1,131 / 1,255 posts (90%) have media; `sbo-parse-capper-image` and `sbo-parse-prop-image` both deployed and receiving. Text-only path also live via `sbo-telegram-intake`. | None. |
| 5. Non-pick filtering | ✅ PASS | 186 posts correctly classified `skipped_not_pick`; 144 picks flagged `unsupported`. Filter is discriminating, not passing everything through. | None. |

### 7.2.1 Prompt Fix 7.2-A

```
FIX TASK — TELEGRAM DISPATCH OUTAGE POST-MORTEM (2026-07-26)

CONTEXT: sbo_telegram_posts shows 117 dispatch_error rows out of 119
posts on 2026-07-26. Every other day in the window shows 3-7 errors.
This is one outage, not a chronic rate.

DO:
1. Read the distinct dispatch_error strings for that date only.
2. Determine whether the cause was upstream (Telegram/webhook),
   downstream (parse function 5xx / model quota), or auth.
3. If the failure mode is retryable, add a bounded retry + backoff to
   sbo-telegram-intake dispatch, and a replay path for
   processing_status='dispatch_failed' posts.
4. Backfill the 174 dispatch_failed posts through the replay path and
   report how many recover into extracted picks.

DO NOT redesign the intake pipeline. Retry + replay only.
```

---

## 7.3 SBO Signals Generation

**This section is entirely new relative to the original document — `sbo_signals` was an empty/nonexistent table then. It now holds real rows.**

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. `sbo_signals` populated | ✅ PASS | **13 rows**, all `sport=MLB`, all `pick_type=moneyline`, all created today (latest 2026-07-31 23:00). First real population of this table. | None. |
| 2. Moneyline predictions feeding in | ✅ PASS | `sbo_predictions` has **13 `moneyline` / `mlb` rows in the last 24h**, 1:1 with the signals. `upsertMoneylineSignal` is imported and called at two sites in `sbo-run-predictions/index.ts` (cached path + fresh path). | None. |
| 3. De-vig derivation still live | ✅ PASS | `deriveMoneylineConsensus` imported from `_shared/devigMoneyline.ts` and used at `sbo-run-predictions/index.ts:595`; `ctx.predicted_outcome = ctx.devig.predicted_outcome` at :642. **Not reverted.** Live evidence of real derivation: today's 13 moneyline predictions split **10 home / 3 away** — the old hardcoded-`home` bug would show 13/0. | None. |
| 4. Confidence clamp | ✅ PASS | `ODDS_ONLY_MAX_CONFIDENCE = 54` still enforced. Today's moneyline predictions: avg **53.9**, max **54**. Clamp is binding exactly as designed. | None — clamp lifts only via 7.7. |
| 5. Signal generation on a schedule | ❌ FAIL | **There is no cron job for `sbo-run-predictions` and none for `sbo-signal-combiner`.** Both are manual/ad-hoc invocations. Confirmed against the full `cron.job` list (9 SBO jobs, neither present). The 13 signals exist only because they were invoked by hand today. | This is the single biggest operational gap in the engine. Prompt Fix 7.3-A. |
| 6. Idempotency | ✅ PASS | Unique index on the signal identity holds — repeated runs today produced 13 distinct game rows with no duplicates. | None. |

### 7.3.1 Prompt Fix 7.3-A

```
FIX TASK — SCHEDULE THE CORE LOOP AGAINST ITS REAL DEPENDENCY CHAIN
(sbo-run-predictions -> sbo-signal-combiner)

CONTEXT: The combined-confidence loop was built and verified working
end-to-end this session, but neither half is on cron. sbo_signals only
has rows because both functions were invoked manually.

An earlier version of this fix proposed 23:15 / 23:30 — two adjacent
timestamps chosen for proximity, not for the actual data dependencies.
That is wrong for two reasons:
  - sbo-signal-combiner scores signals using capper win-rate weights,
    which are refreshed by sbo-match-capper-picks-daily at 04:00 UTC.
    A 23:30 combiner pass runs against weights that are ~19.5 hours
    stale — it never sees the same day's grading.
  - sbo-run-predictions depends on the odds sync. If odds/signals can
    be produced more than once a day as lines move, a single 23:30
    combiner pass leaves everything generated after it uncombined.

Existing SBO cron pattern to follow (from cron.job):
  SELECT private.cron_post('<fn-name>', '{}'::jsonb) AS request_id;

DO — INVESTIGATE BEFORE SCHEDULING:
1. Confirm the real cadence of the upstream jobs before proposing any
   time. Specifically:
   a. sbo-pregame-sync and sbo-morning-sync — how often do odds
      actually land, and does sbo-run-predictions produce new signals
      on more than one sync per day? Check created_at spread on
      sbo_signals / sbo_predictions across several days, not one.
   b. sbo-match-capper-picks-daily (30 4 * * *) — confirm it is what
      writes sbo_cappers.win_rate / capper_weight, and confirm the
      timestamp at which those weights actually change each day.
2. Report the observed cadence and the proposed times BEFORE creating
   any cron job.

THEN SCHEDULE, subject to these constraints:
3. sbo-signal-combiner must run AFTER the 04:00 capper-grading job
   completes, so it scores against that day's freshest weights — not
   the previous day's.
4. If step 1 shows signals are generated more than once a day, add a
   SECOND combiner pass later in the day to sweep same-day signal and
   capper-pick activity. Do not rely on one nightly pass.
5. sbo-run-predictions is scheduled relative to its own dependency
   (odds sync completion), not relative to the combiner.

VERIFICATION — the old check ("zero rows with combined_confidence = 0")
is insufficient: it only proves the combiner ran at all, and would pass
even if it scored every signal against stale or incomplete capper data.
Replace it with:
6. For a given game_date, confirm the combiner run consumed capper
   weight data from the SAME DAY's grading. Concretely: compare the
   combiner run timestamp against the latest sbo_cappers /
   sbo_capper_performance update timestamp for that date, and assert
   the combiner ran after it. A combiner run whose newest input weight
   predates that day's 04:00 grading is a FAILED verification, even if
   every signal has a non-zero combined_confidence.
7. Additionally confirm no signal for that game_date was written after
   the last combiner pass (i.e. nothing left uncombined by timing).

DO NOT change function logic. Scheduling and verification only.
```

---

## 7.4 SBO Signal Combiner

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. Game-identity matching fix | ✅ PASS | `sideMatchesTeam` imported from `_shared/teamMatcher.ts` and used in the game filter (`index.ts:63-64`, matching both `pick.team` and `pick.opponent`). NY/LA ambiguity counter (`resetNylaSkipped` / `getNylaSkipped`) still wired. | None. |
| 2. Direction-vs-team fix | ✅ PASS | `resolveSignalTeam()` (`:71`) maps `side` `home`/`away` → real team; `pickAgrees()` (`:87`) compares `pick.team` against the resolved team for moneyline and falls back to `direction` vs `side` for spread/total/prop. Called at `:161`. Both fixes still live. | None. |
| 3. Prop-table source | ✅ PASS | Combiner reads `sbo_player_props`, not the legacy `props_master`. | None. |
| 4. Real confirm/fade output | ⚠️ PARTIAL | Only **3 of 13** signals have been through the combiner (the 22:39 batch). Real numbers: NYY@CHC → 8 confirm / 0 fade / combined **54** / LEAN; PIT@CIN → 8 confirm / 2 fade / combined **48** / LEAN; STL@TOR → 0 confirm / 1 fade / combined **51** / LEAN. **The 10 signals written at 23:00 all sit at `combined_confidence = 0` with no `signal_grade`** — the combiner has not run since. | Directly caused by 7.3-A (no cron). Same fix. |
| 5. Confirming bonus behaviour | ⚠️ PARTIAL | Every `bonus_applied` in the confirming arrays is **0** — matched cappers' MLB win rates are 0.31% (CAPPERS FREE), 14.61% (SRC Group), 21.05% (TheGuru), 0% (THE BIG GREEN), all below the 52% bonus floor. Confidence therefore only ever moves *down* (fade deductions of 3, e.g. DarthFader ×2 on PIT@CIN). | Working as specified, but the scoring rule is currently one-directional in practice. Revisit the 52% floor once 7.8 grading coverage improves. |
| 6. Grade distribution | ⚠️ PARTIAL | All 3 combined signals graded LEAN; 10 ungraded. No signal has reached a higher tier yet, which follows from the 54 clamp. | Expected pre-clamp-lift. |

---

## 7.5 SBO Result Tracking

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. Grading cron live | ✅ PASS | Four active result jobs: `sbo-results-2hr` (`0 */2 * * *` → `sbo-result-tracker`), `sbo-result-tracking` (`0 4 * * *` → `sbo-track-results`), `auto-verify-results` (`59 3 * * *` → `sbo-verify-results`), `sbo-match-capper-picks-daily` (`30 4 * * *`). | None. |
| 2. Free ESPN path running | ✅ PASS | `sbo-track-results` and `sbo-verify-results` both import from `_shared/espnMlb.ts`, which is built on the generalized `_shared/espnGrading.ts`. `sbo-result-tracker` carries its own ESPN scoreboard map for 8 leagues. `sbo_results_verification` has **1,373 rows, most recent 2026-07-31 22:58** — running today. | None. |
| 3. Graded / pending counts | ⚠️ PARTIAL | `sbo_capper_picks` (4,130): **1,588 lost, 479 won, 12 push, 2,051 pending (49.7%)**. Win rate on settled picks = 479/2,067 = **23.2%**. `sbo_predictions`: 1,527 graded, 896 correct (58.7%). | The 2,051 pending is heavily weighted to non-MLB sports with no free grading source — see 7.9. Not a bug in the MLB path. |
| 4. Unsupported flagging | ✅ PASS | 144 picks flagged `unsupported` rather than being left silently pending. | None. |
| 5. `player_key` collision fix | ✅ PASS | **Zero duplicate `(player_key, game_id)` pairs** across all 53,595 `sbo_player_game_stats` rows. 2,477 distinct `player_key`s for MLB. Fix is holding on new data (980 MLB rows dated today). | None. |
| 6. `sbo_signals` result tracking | ❌ NOT FOUND | All 13 signals have `result='pending'`; nothing writes signal outcomes back. No function references `sbo_signals.result` / `pnl_units` / `resolved_at`. | Prompt Fix 7.5-A. |

### 7.5.1 Prompt Fix 7.5-A

```
FIX TASK — GRADE sbo_signals OUTCOMES

CONTEXT: sbo_signals has result/pnl_units/resolved_at columns and 13
live moneyline rows, all stuck at 'pending'. No code path ever settles
them, so combined-confidence accuracy can never be measured — which
also means the 7.7 clamp-readiness accuracy gate can never be fed by
signal performance.

DO:
1. In sbo-track-results (already ESPN-wired and on the 04:00 cron),
   after MLB finals are fetched, settle sbo_signals rows for that
   game_date: resolve side -> team via the same resolveSignalTeam
   logic, compare to the ESPN winner, write result won/lost/push,
   pnl_units from the stored odds, and resolved_at.
2. Only settle rows with combined_confidence > 0 (i.e. actually
   combined), so uncombined rows are not scored.
3. Report graded/pending counts after the first run.

DO NOT touch sbo_capper_picks grading — that path is working.
```

---

## 7.6 Frontend Route Audit

Verified directly against `src/routes/AppRoutes.tsx` (lines 2288–2330), not copied from the user guide.

| Route | Status | What You Found |
| :---- | :---- | :---- |
| `/os/sports-betting` → `/dashboard` | ✅ PASS | Redirect live. |
| `/os/sports-betting/dashboard` | ✅ PASS | `BettingDashboard`. |
| `/os/sports-betting/analytics` | ⚠️ PARTIAL | Redirects to `/dashboard` — analytics has no dedicated page. |
| `/os/sports-betting/ai-os` | ✅ PASS | `SportsBettingOS`. |
| `/os/sports-betting/nba` | ⚠️ PARTIAL | `NBADailyBoard` — live route, but NBA data is frozen at 2026-04-24 (see 7.9). |
| `/os/sports-betting/line-intake`, `/simulation`, `/parlay-lab`, `/hedge-center`, `/internal`, `/stats-inspector`, `/settings`, `/workflow`, `/platforms`, `/line-shopping`, `/entries`, `/entries/new`, `/results`, `/profit-center` | ✅ PASS | All 14 mounted to distinct components. |
| `/sbo-ai-engine/wallet-intelligence`, `/capper-intelligence`, `/signal-alignment` | ✅ PASS | Mounted. `signal-alignment` is the natural surface for `sbo_signals` — worth confirming it reads the new table rather than legacy sources. |
| `/sbo-ai-engine/tonight`, `/nightly`, `/value`, `/accuracy`, `/model`, `/my-bets`, `/simulation`, `/va-entry`, `/sms`, `/history`, `/health`, `/sync` | ✅ PASS | All 12 mounted. `/health` hosts the Stage 2d `ClampReadinessCard`. |
| `/sbo-ai-engine/props`, `/props-intelligence`, `/parlay`, `/prizepicks`, `/bovada` | ✅ PASS | All 5 consolidated via `<Navigate>` into `/sbo-ai-engine/prop-hub` (`PropIntelligenceHub`). Intentional consolidation, no dead ends. |
| `/os/sbo`, `/os/sbo/picks` | ✅ PASS | `SBODashboard`, `SBOAllPicks`. |
| Orphan check | ✅ PASS | No SBO page component found without a route; no route pointing at a missing component. |

---

## 7.7 Prop Data Audit — MLB Stats Brain

*(New section; replaces the original's NBA-only prop audit.)*

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. `sbo_player_game_stats` volume/freshness | ✅ PASS | **53,595 rows**, all MLB, latest `game_date` **2026-07-30**, with **980 rows already written for 2026-07-31**. 2,477 distinct players. | None. |
| 2. `sbo_player_season_splits` | ✅ PASS | **2,477 rows** — exactly 1:1 with distinct players in the game-stats table. No orphans. | None. |
| 3. `data_quality` distribution (live) | ⚠️ PARTIAL | Across `sbo_predictions`: `estimated` 1,100, `partial` 950, `odds_only` 54, `backfilled` 47, `full` 44, `minimal` 3. **Only 44 rows are `full`** — the stats brain is wired in but is reaching full coverage on a small minority. Prop predictions today: 85 MLB `player_prop` rows, avg confidence 58.0, max 87 (so non-clamped props do exist where quality allows). | Coverage is the binding constraint. Prompt Fix 7.7-A. |
| 4. `sbo_clamp_readiness` — MLB | ⚠️ PARTIAL | Latest evaluation 2026-07-31 20:41. MLB: `graded_n=25`, `win_rate=0.68`, `ci_lower=0.484`, `coverage_pct=0.379`, **gates_passed = 1 of 5**, `all_gates_pass=false`, blocking = `{volume, ci, coverage, calibration}`. Accuracy gate is the one passing. | On track with the ~2-week estimate at Stage 2d ship. No action. |
| 5. `sbo_clamp_readiness` — NBA | ⚠️ PARTIAL | `graded_n=0`, all five gates blocking. Expected — NBA is off-season. | No action until NBA resumes. |
| 6. Evaluator on cron | ✅ PASS | `sbo-clamp-readiness` job active, `0 9 * * 1` (Mondays 09:00 UTC), body `{"sports":["mlb","nba"]}`. | None. |

### 7.7.1 Prompt Fix 7.7-A

```
FIX TASK — RAISE data_quality='full' COVERAGE ON MLB PROPS

CONTEXT: sbo_clamp_readiness lists 'coverage' as a blocking gate for
MLB (coverage_pct 0.379 vs the required threshold). Live
sbo_predictions data_quality mix is estimated 1100 / partial 950 /
full 44. The stats brain has the data (53,595 game-stat rows, 2,477
season splits) — the join is what's missing on most props.

DO:
1. Sample 50 recent MLB player_prop predictions with data_quality
   'partial' or 'estimated'. For each, determine WHY the lookup fell
   short: player_key miss, prop_type not mapped in getMlbPropValue,
   or missing season split.
2. Report the failure breakdown before changing anything.
3. Fix the single largest bucket only, then re-run
   sbo-clamp-readiness and report the new coverage_pct.

DO NOT relax the coverage gate threshold to make it pass.
```

---

## 7.8 Weekly Analytics & Performance Automation

| Check | Status | What You Found | Recommendation |
| :---- | :---- | :---- | :---- |
| 1. `sbo-weight-optimizer` on cron | ✅ PASS | Job `sbo-weight-optimizer-weekly` active, `0 5 * * 0`. Last write to `sbo_weight_history` **2026-07-26 05:00** (a Sunday) — fired on schedule. 8 rows total, most recent `auto_adjusted` NBA weights 49/35/16 → 52/35/13. | None, but note every row is `sport='nba'` — the optimizer has not yet produced MLB weights despite MLB being the active sport. Flagged in 7.10. |
| 2. `sbo-match-capper-picks` daily | ✅ PASS | Job `sbo-match-capper-picks-daily` active, `30 4 * * *`, body `{"mode":"full"}`. This was the scheduling gap fixed this session — confirmed still registered. | None. |
| 3. Capper win-rate coverage | ⚠️ PARTIAL | **23 of 108 cappers (21.3%)** now have a `win_rate > 0` — up from 2 in the original document. `sbo_capper_performance` has 721 rows, `sbo_capper_roi` 113. The remaining 85 are mostly low-volume or non-MLB posters whose picks sit in the 2,051 pending bucket. | Coverage will rise with 7.9 sport bring-up, not with more code. |
| 4. Other analytics crons | ✅ PASS | `sbo-consensus-engine-daily` (`45 13,23 * * *`), `sbo-props-master-sync-daily` (`30 13,23 * * *`), `sbo-morning-sync` (`0 13 * * *`), `sbo-pregame-sync` (`0 23 * * *`) — all active. 9 SBO cron jobs total, **all 9 `active=true`**. | None. |
| 5. Weekly report generation | ❌ NOT FOUND | `sbo_weekly_reports` = 0 rows; `sbo_daily_report` = 0 rows. `sbo_daily_briefings` (123 rows) is the surface actually in use. | Either wire the weekly rollup or drop the two dead tables. Low priority. |

---

## 7.9 Multi-Sport Generalization Status

*(New section.)*

| Sport | `sbo_sports.is_active` | Real live state | Verdict |
| :---- | :---- | :---- | :---- |
| **MLB** | ✅ true | Fully built. 2,713 picks in the last 7 days, 53,595 game-stat rows, 13 moneyline signals, ESPN grading running, clamp evaluator scoring it. | ✅ PASS — the reference implementation. |
| **NBA** | ✅ true | Legacy. 12,579 game-stat rows frozen at **2026-04-24** (season end). Only 6 capper picks in 7 days. All optimizer weight history is NBA. Clamp readiness `graded_n=0`. | ⚠️ PARTIAL — season-locked, not broken. Reactivates in the autumn. |
| **WNBA** | not in `sbo_sports` | 102 picks in 7 days and a `sbo_sport_performance` row (0.3333 win rate for week of 07-27) — **actively receiving picks despite not being a registered sport**. | ⚠️ PARTIAL — real volume, no grading config. Best next bring-up candidate. |
| **NFL** | ✅ true | 21 picks in 7 days (pre-season trickle). No stats brain, no grading config. | ⚠️ PARTIAL — season-locked out; bring up before September. |
| **NHL** | ✅ true | 5 picks in 7 days. Off-season. | ⚠️ PARTIAL — season-locked out. |
| **MMA/UFC** | ✅ true | 88 picks in 7 days. `sbo-result-tracker` has a UFC scoreboard URL, but no `SportGradingConfig`. | ⚠️ PARTIAL — grading partial only. |
| **Tennis / Golf / Soccer / CFL / NCAAB / NCAAF** | mostly false | Tennis 266 picks, Soccer 70, Golf 35, CFL 14, NCAAB 9, NCAAF 2 in 7 days — all ingesting, none graded. | ❌ NOT FOUND — ingest-only, these are the bulk of the 2,051 pending picks. |

**Generalized grading module — ready to onboard a new sport?** ✅ PASS.
`_shared/espnGrading.ts` is genuinely sport-parameterized: it exports `SportGradingConfig<L extends StatLine>`, a `GRADING_CONFIGS` registry keyed by sport, `GRADED_SPORT_KEYS`, `getGradingConfig(sportKey)`, plus shared `espnDateParam`, `teamMatches`, `fetchEspnFinals`, `fetchEspnSummary`, `findPlayerStats`. The file header states the onboarding contract explicitly ("ADDING A SPORT: append a SportGradingConfig to GRADING_CONFIGS"). MLB is registered via `MLB_GRADING` with `buildMlbStatLines` / `getMlbPropValue`. Adding WNBA requires only a stat-line builder, a prop-value mapper, and one registry entry — **no rework of the shared layer**.

---

## 7.10 Known Open Items

Every item below was re-verified as still open today; items from the old list that have since closed are marked as such and excluded.

| # | Item | Status | Evidence |
| :-- | :---- | :---- | :---- |
| 1 | **Core loop is not scheduled** | ❌ OPEN — **new, highest priority** | No cron for `sbo-run-predictions` or `sbo-signal-combiner`. 10 of 13 signals sit uncombined at `combined_confidence=0`. → Prompt Fix 7.3-A. |
| 2 | **RLS / security posture** | ❌ OPEN — unchanged | 40 permissive (`USING true`) SELECT/ALL policies across `sbo_*`. Still unstarted. → Prompt Fix 7.10-A. |
| 3 | **`sbo_signals` never graded** | ❌ OPEN — new | All 13 rows `result='pending'`; nothing writes back. → Prompt Fix 7.5-A. |
| 4 | **Telegram dispatch errors** | ⚠️ PARTIALLY RESOLVED | Not a chronic 24% — steady state is ~4%/day; 117 of 257 lifetime errors came from the single 2026-07-26 outage. Root cause still uninvestigated, 174 failed posts never replayed. → Prompt Fix 7.2-A. |
| 5 | **`props_master` drift** | ❌ OPEN — unchanged | `sbo-top-plays` (3 refs), `sbo-send-daily-email` (1), `sbo-auto-bet` (4) all still read the legacy `props_master` (13,310 rows, last write 2026-07-31 13:30) while the rest of the engine has moved to `sbo_player_props` / `sbo_unified_props`. `sbo_top_plays` and `sbo_actual_bets` are both **0 rows** — these three functions produce nothing. → Prompt Fix 7.10-B. |
| 6 | **`athlete_id` not on props** | ❌ OPEN — unchanged | `sbo_player_game_stats` and `sbo_player_season_splits` carry `player_key`; `sbo_player_props` and `sbo_unified_props` carry neither `player_key` nor `athlete_id`, so prop→stats joins remain name-based. This is a probable contributor to the 7.7 coverage gate failure. |
| 7 | **WNBA / NFL bring-up** | ❌ OPEN | WNBA has 102 picks/7d and is not even registered in `sbo_sports`. NFL is registered but has no grading config with the season approaching. |
| 8 | **Optimizer is NBA-only** | ❌ OPEN — new | All 8 `sbo_weight_history` rows are `sport='nba'`; the optimizer has never produced MLB weights despite MLB carrying the volume. |
| 9 | **Dead tables** | ⚠️ OPEN, cosmetic | `sbo_weekly_reports`, `sbo_daily_report`, `sbo_prop_picks`, `sbo_prop_predictions`, `sbo_signal_inputs`, `sbo_signal_performance`, `sbo_polymarket_signals`, `sbo_strategy_performance` all 0 rows. |
| 10 | ~~Missing core tables~~ | ✅ CLOSED | All 6 exist. |
| 11 | ~~`sbo_cappers` only 3 rows~~ | ✅ CLOSED | 108 rows. |
| 12 | ~~Capper picks unmatched / unscheduled~~ | ✅ CLOSED | `sbo-match-capper-picks-daily` active at `30 4 * * *`. |
| 13 | ~~Hardcoded `home` moneyline~~ | ✅ CLOSED | De-vig live; today's split is 10 home / 3 away. |
| 14 | ~~Player-name collisions~~ | ✅ CLOSED | Zero duplicate `(player_key, game_id)` across 53,595 rows. |

### 7.10.1 Prompt Fix 7.10-A

```
FIX TASK — SBO RLS POSTURE PASS

CONTEXT: All sbo_* tables have RLS enabled with at least one policy,
so the naive check passes. But 40 policies across sbo_* are
USING (true) on SELECT or ALL, which makes RLS decorative for those
tables. This has been open since the original QA document.

DO:
1. List the 40 permissive policies with their table and command.
2. Split them into three buckets:
   a. Genuinely public read (odds, schedules, sports reference) —
      keep, but narrow ALL -> SELECT and scope to 'authenticated'
      where nothing anonymous consumes them.
   b. Operator-only (predictions, signals, cappers, bets, wallet,
      bankroll) — replace with a role check.
   c. Write policies with USING(true) — these are the actual risk;
      fix first.
3. Migrate bucket (c), then (b). Report before/after counts.

VERIFICATION GATE — a policy count dropping from 40 permissive to 0 is
NOT by itself evidence that nothing broke. This system has no automated
test coverage, and a role-scoping change can silently break a page that
assumed broader read access (an empty table renders as "no data", not
as an error).
4. After bucket (c) migrates — and again after bucket (b) — load the
   actual frontend pages that read each affected table and confirm they
   still render real rows. Do this BEFORE starting the next bucket.
   At minimum, for each table touched, identify the consuming route(s)
   from src/routes/AppRoutes.tsx and the SBO page components, load
   them signed in as a normal operator (not service_role), and confirm
   row counts on screen match the row counts in the table.
5. Report per-page pass/fail alongside the policy counts. If any page
   goes empty, revert that bucket's migration before continuing.

DO NOT disable RLS anywhere. DO NOT drop a policy without replacing it
in the same migration — the frontend reads these tables live.
```

### 7.10.2 Prompt Fix 7.10-B — ⚠️ URGENT SAFETY CHECK (do this first)

```
FIX TASK — CONFIRM sbo-auto-bet HAS NO LIVE BETTING CAPABILITY

CONTEXT: sbo-auto-bet reads from the dead props_master table and has
never written a row to sbo_actual_bets. Before treating this as routine
cleanup, confirm whether this function is connected to any real
sportsbook API/credentials that could place a real-money bet if it ever
DID successfully read a row.

DO:
1. Read the full function. Identify every external API call it makes
   and whether any require live credentials/API keys that exist in the
   vault right now.
2. Confirm explicitly: is there ANY code path in this function that
   could place a real bet with real money, today, if its props_master
   read succeeded?
3. Report findings plainly — do not bundle this into the props_master
   migration decision. This is a standalone safety confirmation.

DO NOT modify the function. Read and report only.
```

### 7.10.3 Prompt Fix 7.10-C

```
FIX TASK — RESOLVE props_master DRIFT (3 DEAD FUNCTIONS)

CONTEXT: sbo-top-plays, sbo-send-daily-email and sbo-auto-bet still
read the legacy props_master table. Their output tables are empty:
sbo_top_plays = 0 rows, sbo_actual_bets = 0 rows. The rest of the
engine reads sbo_player_props / sbo_unified_props.

DECIDE FIRST, THEN BUILD — report the recommendation before editing:
1. For each of the three functions, determine whether it is wanted at
   all. sbo-auto-bet places real bets and has never written a row;
   confirm with the owner before reviving it rather than migrating it
   silently.
2. For the ones that are wanted, repoint reads to sbo_player_props
   with the same field contract, and confirm the outbound contract
   (TopPlayCard reads ai_confidence / ai_recommendation) is preserved.
3. For the ones that are not, delete the function and its dead table.

DO NOT enable sbo-auto-bet automation as part of this task.
```

---

## Verification Appendix

- **Tables:** 94 `sbo_*` relations; counts above are exact `count(*)`, not planner estimates.
- **Cron:** 9 active SBO jobs read from `cron.job`; zero inactive.
- **Code paths re-read this audit:** `sbo-run-predictions/index.ts`, `sbo-signal-combiner/index.ts`, `_shared/espnGrading.ts`, `_shared/devigMoneyline.ts`, `_shared/teamMatcher.ts`, `_shared/espnMlb.ts`, `sbo-track-results`, `sbo-verify-results`, `sbo-result-tracker`, `sbo-top-plays`, `sbo-send-daily-email`, `sbo-auto-bet`, `src/routes/AppRoutes.tsx`.
- **Edge functions deployed:** 52 `sbo-*` plus `sportsbook-lines-ingest`.
