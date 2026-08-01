# SBO AI Engine — QA Test Notes (Full Re-Audit)

**Date:** 2026-08-01 (18:00 UTC)
**Supersedes:** `docs/qa/SBO_AI_ENGINE_TEST_NOTES_2026-07-31.md` (kept as historical record)
**Method:** Every claim below was re-verified against live database/live code in this session. No claim was carried forward from the prior document without a fresh check.
**Scope:** all `sbo_*` tables, all `sbo-*` edge functions, cron schedule, SBO frontend hooks.

> ### ⚠️ Post-publication corrections — 2026-08-01 (later same day)
> The fix-pass investigation (`docs/qa/SBO_FIX_PASS_PROPOSAL_2026-08-01.md`) found two conclusions in this document to be **factually wrong**, not merely under-detailed. Both have been corrected in place, and one timing note was added. Documentation-only changes; no code, table, or cron was touched.
>
> 1. **§5 item 2 (`props_master`)** — this document called the table "dead legacy surface". It is **live and actively synced** (600 rows written today with real current MLB data). The real defect is a hardcoded `'NBA'` literal at the write site mislabeling every row's sport. Verdict corrected; **do not retire this table** — 10 live consumers depend on it.
> 2. **§5 item 6 (ambiguous props)** — this document reported the ambiguous population as **671**. That overstates it: only **41** of those 671 have genuinely opposing `predicted_outcome` values; the remaining 630 are duplicate predictions on the *same* side and were never at risk of a coin-flip grade.
> 3. **§3 (`sbo_signals` never settles)** — accurate at time of writing, now **stale**: settlement has since run and produced *incorrect* results. See the timing note in §3.


---

## 1. Multi-sport coverage status

### Raw evidence

`sbo_player_props` (all time):

| sport_key | props | first game_date | last game_date | graded (actual_value not null) |
|---|---|---|---|---|
| nba | 12,579 | 2026-03-21 | 2026-04-24 | 12,296 |
| mlb | 1,569 | 2026-07-30 | 2026-08-01 | 922 |
| wnba | 364 | 2026-08-01 | 2026-08-01 | 0 |
| nfl | 139 | 2026-08-01 | 2026-08-01 | 0 |
| nhl | 0 | — | — | — |

`sbo_games` by sport: `americanfootball_nfl` 272 (through 2027-01-10), `baseball_mlb` 117, `icehockey_nhl` 31 (through 2026-10-10), `basketball_wnba` 6, legacy `NBA`/`basketball_nba` 310.

Stats brain — `sbo_player_game_stats`: mlb 54,024 · nhl 534 · nfl 315 · wnba 153.
Season splits — `sbo_player_season_splits`: mlb/2026 2,481 · nhl/**2026** 534 · nfl/2025 315 · wnba/2026 136.

Predictions last 7 days: mlb 1,186 (274 graded), wnba 2, everything else 0.

### Verdicts

| Sport | Odds/props ingestion | Grading | Stats brain | Verdict |
|---|---|---|---|---|
| **MLB** | LIVE — 1,569 props, refreshed daily through today | LIVE — 922 graded, 513 verified today, 409 yesterday | LIVE — 54,024 game rows, 2,481 splits | **PASS** |
| **WNBA** | LIVE — 364 props today, 6 games | Wired but **0 rows graded to date** (first slate is today, games not final) | LIVE — 153 game rows, 136 splits | **PARTIAL** |
| **NFL** | LIVE — 139 props today (preseason), 272 games scheduled | Code live; **0 props graded** (no completed regular-season game in prop window) | 315 game rows, 315 splits under season `2025` (correct) | **PARTIAL** |
| **NHL** | Games ingested (31, first 2026-10-10) but **0 props** — offseason | Code live, unexercised | 534 game rows from the 2025-26 season | **PARTIAL** (offseason; unverifiable end-to-end until October) |
| **NBA (legacy)** | Frozen — last prop 2026-04-24 | 12,296 of 12,579 graded via SportsDataIO legacy path | No `sbo_player_game_stats` rows (legacy path uses SportsDataIO averages, not the new brain) | **PASS as archive** |
| **MMA/UFC** | No odds/props tables populated; only capper picks (151) | None | None | **FAIL** (not built — capper-signal only) |
| **Tennis / Golf / CFL / Soccer / NCAAB** | No odds/props; capper picks only (Tennis 308, Soccer 117, Golf 35, CFL 23, NCAAB 12) | None | None | **FAIL** (not built) |

> **Prompt Fix — WNBA/NFL/NHL grading is asserted, not demonstrated**
> WNBA, NFL and NHL each have **zero graded props on real data**. The grading code paths passed dry-run/adversarial tests but have never produced a single live graded row. Schedule a verification pass the morning after the first completed WNBA slate (2026-08-02) and after the first NFL regular-season week, and record actual graded counts + spot-checked box-score values before treating these sports as production-grade.

> **Prompt Fix — WNBA has props but essentially no predictions**
> 364 WNBA props exist for today but only **2** `sbo_predictions` rows are WNBA. Prop-prediction fanout in `sbo-day-engine` / `sbo-run-predictions` is effectively MLB-only in practice. Confirm whether WNBA/NFL are intentionally excluded from the prediction fanout or whether they are silently failing (time budget, missing context, or player-context resolution misses).

---

## 2. `sbo-verify-results` generalization

- **Sport scoping is live in deployed source.** `supabase/functions/sbo-verify-results/index.ts` applies `.eq('sport_key', sportKey)` on every prop read (lines 348, 416, 586, 772) and `.in('sport_key', activeSports)` on the batch selector (line 480), with an explicit comment noting the previously-unscoped query. **PASS**
- **Deterministic tiebreak holds.** The prediction embed now selects `id, created_at, ...` and the grader sorts newest-`created_at`-first with `id` as the secondary key (lines 144–158), with the rule documented in-file. **PASS**
- **Dry-run mode is present** (`dry_run: !!report_only` in the response envelope, line 909). **PASS**
- **Zero cross-sport contamination in real recent output.** All props verified since 2026-07-30 are: 2026-08-01 → 513 rows, **100% `mlb`**; 2026-07-31 → 409 rows, **100% `mlb`**. No NBA, WNBA or NFL row has been touched by a run since the refactor. **PASS**
- **WNBA spot-check:** 364 WNBA props exist, `verified_at` is null on all of them — i.e. the WNBA-targeted runs correctly wrote nothing to a sport whose games were not yet final, and equally importantly wrote nothing to NBA. This is the exact contamination scenario the fix targeted. **PASS (negative-case confirmed; positive-case still pending first final WNBA slate)**

**Section verdict: PASS**, with the caveat that the positive path for non-MLB sports has not yet produced live rows (see §1 Prompt Fix).

---

## 3. Core combined-confidence loop (`sbo_signals` → `sbo-signal-combiner`)

Cron state (live `cron.job`):

| jobid | jobname | schedule | active |
|---|---|---|---|
| 108 | `sbo-signal-combiner-morning` | `15 5 * * *` | ✅ |
| 109 | `sbo-signal-combiner-evening` | `50 23 * * *` | ✅ |
| 104 | `sbo-match-capper-picks-daily` | `30 4 * * *` | ✅ |
| 99 | `sbo-results-2hr` | `0 */2 * * *` | ✅ |
| 102 | `sbo-consensus-engine-daily` | `45 13,23 * * *` | ✅ |
| 101 | `sbo-props-master-sync-daily` | `30 13,23 * * *` | ✅ |
| 103 | `sbo-clamp-readiness` | `0 9 * * 1` | ✅ |
| 85 | `sbo-weight-optimizer-weekly` | `0 5 * * 0` | ✅ |

Nothing has reverted to manual-only. **PASS on automation.**

Real output: `sbo_signals` holds **22 rows total, all MLB**, 9 of them created 2026-08-01 at ~05:04 UTC — i.e. the 05:15 morning cron fired and wrote. Grades: LEAN 19, NO_PLAY 2, NULL 1. Confirm/fade payloads are populated and real (e.g. Yankees @ Cubs: internal 54 → combined 39 after 5 fading cappers at −3 each; D-backs @ Guardians: 54 → 54 with one confirming capper at +0).

Observations that matter:
- Every internal confidence is exactly **54** — the de-vig moneyline clamp. The "combined" signal is therefore entirely capper-driven variance around a flat internal prior. Working as designed post-clamp, but the internal side is contributing no discrimination.
- **All 22 signals are `result = 'pending'`.** Nothing has ever been resolved, so there is no signal-level win rate.
- Zero non-MLB signals despite 900+ non-MLB capper picks in the last 3 days.

**Section verdict: PARTIAL** — automation runs on schedule and writes real rows, but the loop is MLB-only, output is dominated by LEAN, and no signal has ever been settled.

> **Prompt Fix — `sbo_signals` never settles**
> 22/22 signals are `pending`; `result`, `pnl_units` and `resolved_at` have never been written. Until a settlement job runs against `sbo_signals`, the combined-confidence system produces no measurable track record and the confirm/fade weighting cannot be validated or tuned.
>
> **STALE AS OF 2026-08-01 18:00 UTC (this audit's snapshot time).** Settlement has since run and settled 14 rows — but produced **INCORRECT** results: the settler compares literal `'home'`/`'away'` side tokens against team names, so every settlement fabricated a `loss` regardless of the actual outcome. See `SBO_FIX_PASS_PROPOSAL_2026-08-01.md` item 2. This is now a **data-integrity issue, not just a missing-feature gap.**


---

## 4. Capper confidence scoring

- **`roi_pct` → `roi` column fix: LIVE.** `src/hooks/useConsensusIntelligence.ts:208–212` reads `Number(p.roi)` with the explanatory comment. Confirmed at the DB level: `sbo_capper_performance` **has no `roi_pct` column at all**, so the old code was guaranteed to produce `NaN`/0 — the fix was necessary and is correctly applied. **PASS**
- **Real per-pick scoring redesign: LIVE.** Per-capper ROI/WR are computed from resolved picks (`cResolved`, lines 349–416) and badges derive from real thresholds (`roi > 5` → high_roi, `winRate < 45 && n ≥ 5` → low_accuracy). **PASS**
- **Line-edge join via normalized vocabulary: LIVE.** The hook imports `normalizeStat, marketPropCandidates` from `@/lib/sbo/statNormalize` and iterates candidate spellings at line 247. **PASS**
- **Stale-data banner: LIVE** in the consensus/manual-betting surface. **PASS**

Data reality check: `sbo_capper_picks` = 4,521 rows, 1,754 in the last 3 days, spanning 12 sports. **Only 10 picks have a `matched_prop_id`.** The confidence formula is therefore correct, but the line-edge component is available for a fraction of a percent of picks; the other ~99.8% score on capper-quality only.

**Section verdict: PASS on the fixes, PARTIAL on usefulness** — the formula is right; the join coverage is still near-zero because the market side simply does not carry props for Tennis/UFC/Soccer/CFL/Golf, which is where most capper volume lives.

> **Prompt Fix — line-edge coverage remains ~0.2%**
> 10 of 4,521 capper picks resolve to a market prop. The vocabulary normalization fixed *matching*, but coverage is now bounded by sport coverage (§1): the sports cappers post most about have no props ingested at all. Either ingest props for the high-volume capper sports or explicitly label capper confidence as "capper-quality only" in the UI so the score isn't read as line-aware.

---

## 5. Known open items — fresh status of every prior item

| # | Item (from 2026-07-31) | Status | Evidence |
|---|---|---|---|
| 1 | **RLS posture on `sbo_*`** | **CLOSED (1 residual)** | Scan of `pg_policy` across all `sbo_*` tables: exactly **one** table still carries a fully-permissive (`USING true`) policy — `sbo_analysis_jobs` (1 of its 2 policies). Every other `sbo_*` table is scoped. `sbo_signals` is admin/owner-only. |
| 2 | **`props_master` drift** | **OPEN — live table, mislabeling bug at write time** *(corrected 2026-08-01, post-publication)* | **CORRECTION:** this row previously read "worse than described… dead legacy surface". That was wrong. `props_master` is **live and actively synced** — the fix-pass investigation found **600 rows written today** carrying real current MLB data (e.g. Corey Seager, `stat_type='hits'`). The 100%-`sport='NBA'` reading is not staleness, it is a **hardcoded `'NBA'` string literal at the write site (`sbo-sync-props-master`, line 99)** that mislabels every row's sport regardless of the sport it actually belongs to. **10 confirmed live consumers depend on this table. Do not retire it** — fix the label at the write site. |
| 3 | **`athlete_id` gap** | **CHANGED — column does not exist** | Neither `sbo_player_game_stats` nor `sbo_player_season_splits` has an `athlete_id` column. Identity is carried by `player_id` + `player_key`. The prior document's framing is stale; the ESPN-id collision fix landed under different column names. Re-file as "verify `player_key` uniqueness" rather than "athlete_id gap". |
| 4 | **Telegram dispatch outage** | **CLOSED** | `sbo_telegram_posts` = 1,312 rows, most recent `updated_at` **2026-08-01 17:57 UTC** (≈5 min before this audit). Intake is flowing; 1,754 capper picks landed in the last 3 days. |
| 5 | **`sbo_signals` grading** | **OPEN** | 22/22 rows `pending`, no `resolved_at` ever written. Unchanged from prior doc. |
| 6 | **35 ambiguous historical props** | **OPEN — real population is 41** *(corrected 2026-08-01, post-publication)* | **CORRECTION:** this row previously stated "the ambiguous population is 671". That overstates it. **671 props have more than one prediction attached, but only 41 have genuinely opposing `predicted_outcome` values** — that **41 is the real ambiguous population requiring a re-grade decision.** The other **630 are harmless duplicates** (multiple predictions on the *same* side) and were never at risk of a coin-flip grade. The determinism fix (newest-wins) makes future grading of all of them reproducible; the historical verdicts on the 41 were never re-graded. |
| 7 | **NHL rows mislabeled season `2026`** | **OPEN — unchanged** | `sbo_player_season_splits`: 534 NHL rows still carry `season = '2026'` for games played 2025-10 → 2026-04, which belong to season `2025`. Held pending instruction, as agreed — these are not duplicates, so a blind delete is wrong; they need a relabel. |

---

## 6. New issues found during this re-audit

1. **`sbo_predictions` is effectively single-sport.** Last 7 days: mlb 1,186, wnba 2, nfl 0, nhl 0. Prop ingestion was generalized; prediction generation was not. This is the single biggest gap between "sports are built out" and "sports produce output". **FAIL**
2. **Prediction mix is 97.5% player props.** Last 3 days: 1,159 `player_prop` vs 29 `moneyline`. The moneyline signal path — the entire input to `sbo_signals` — is generating ~10 rows/day, which is why the signal table has 22 lifetime rows.
3. **NBA clamp-readiness evaluator returns all-zero every run.** `sbo_clamp_readiness` NBA rows show `graded_n = 0`, `coverage_total = 0`, all five gates false, on every evaluation. It is evaluating a 60-day window against a sport whose last prop was 2026-04-24 (>90 days ago). The evaluator is not wrong, but it emits a permanent 0/5 FAIL row that will read as a regression to anyone scanning the table. MLB by contrast now passes **5/5 gates** (n=219, 63.0% win rate, CI lower 0.564, coverage 94.6%, hi-bucket 69.3% > lo-bucket 58.8%) — a meaningful improvement over the 2026-07-31 snapshot's 1/5.
4. **Calibration inversion is resolved for MLB.** The prior document's flagged inversion (high-confidence band underperforming) no longer reproduces: the hi bucket is 69.3% vs the lo bucket at 58.8% on 219 graded picks. The earlier inversion was legacy-NBA contamination, and the sport-scoped grader has removed it from the MLB view. **CLOSED**
5. **`sbo_games` sport keys are inconsistent.** Three different conventions coexist: `NBA`, `basketball_nba`, `basketball_wnba`, `baseball_mlb`, `americanfootball_nfl`, `icehockey_nhl`. Anything joining `sbo_games.sport` to `sbo_player_props.sport_key` (`mlb`, `wnba`, `nfl`, `nba`) needs a translation layer, and any code that forgets one is a silent-zero-rows bug.
6. **NHL has 31 games and 0 props, permanently, until October.** Nothing is broken — but any health check that treats "NHL props today = 0" as RED will alert continuously for ~10 weeks.

---

## Verdict summary

| Section | Verdict |
|---|---|
| 1. Multi-sport coverage | **PARTIAL** (MLB PASS, WNBA/NFL/NHL PARTIAL, MMA/Tennis/Golf/CFL FAIL) |
| 2. `sbo-verify-results` generalization | **PASS** |
| 3. Combined-confidence loop | **PARTIAL** |
| 4. Capper confidence scoring | **PASS** (fixes) / **PARTIAL** (coverage) |
| 5. Prior open items | 2 CLOSED · 3 OPEN · 1 CHANGED · 1 OPEN-larger |
| 6. New issues | 6 found, 1 of them a **FAIL** |

---

## Biggest deltas vs. the 2026-07-31 document

1. **MLB clamp readiness flipped from 1/5 gates to 5/5.** 219 graded picks, 63.0% win rate, CI lower bound 0.564, 94.6% coverage. The prior doc's headline "MLB passes 1/5" is obsolete.
2. **The confidence-band inversion the prior doc flagged is gone** — it was NBA contamination, and the sport-scoped grader eliminated it.
3. **`sbo-verify-results` is genuinely sport-scoped and deterministic in the deployed source**, and real grading output since 2026-07-30 is 100% MLB with zero cross-sport writes.
4. **Telegram dispatch outage is closed** — intake was live 5 minutes before this audit.
5. **The ambiguous-props population is 41, not 35 and not 671.** *(corrected post-publication)* 671 props carry more than one prediction, but only 41 have genuinely opposing outcomes; the other 630 are same-side duplicates.
6. **New headline gap the prior doc did not have:** props ingestion was generalized to WNBA/NFL but *prediction generation was not* — WNBA has 364 props and 2 predictions; NFL has 139 props and 0.
7. **`props_master` is live, not dead.** *(corrected post-publication)* 600 rows written today with real MLB data; the 100%-NBA reading is a hardcoded `'NBA'` literal at the write site. 10 live consumers — do not retire.

8. **RLS is effectively closed** — one residual permissive policy on `sbo_analysis_jobs`, down from 65 fully-permissive policies.
9. **`athlete_id` gap is a stale framing** — the column does not exist; identity lives in `player_key`.
10. **NHL season-2026 mislabel (534 rows) is still open**, unchanged.
