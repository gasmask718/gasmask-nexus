# Automate Moneyline Predictions + Signal Combining

## 1. Why cron job 104 has never fired — diagnosis

Evidence pulled live just now:

| jobid | jobname | schedule | runs recorded | last run |
|---|---|---|---|---|
| 101 | sbo-props-master-sync-daily | 30 13,23 * * * | 21 | 2026-07-31 23:30 |
| 102 | sbo-consensus-engine-daily | 45 13,23 * * * | 21 | 2026-07-31 23:45 |
| 103 | sbo-clamp-readiness | 0 9 * * 1 | 0 | never |
| 104 | sbo-match-capper-picks-daily | 30 4 * * * | 0 | never |
| 105 | demo-expiry-cleanup-daily | 0 9 * * * | 0 | never |

Findings:

- **Nothing is broken.** Job 104 uses `private.cron_post('sbo-match-capper-picks', ...)`, the exact same mechanism as jobs 101 and 102, which have fired 21 times each with `succeeded` status. The function exists, is SECURITY DEFINER, resolves the service-role key from vault with an anon fallback, and posts via `net.http_post`.
- **The real reason is elapsed time.** Job 104 was registered on 2026-07-31 (jobid 104 sorts after 101–103, all created in the same recent window), *after* 04:30 UTC that day. Its next fire is **2026-08-01 04:30 UTC** — roughly four hours from now. Jobs 103 and 105 show the same "zero runs" pattern for the same reason: 105 was created yesterday and fires at 09:00; 103 is weekly on Mondays and hasn't reached one yet.
- Conclusion: "active" in `cron.job` does mean "will fire". There is no misregistration, no wrong project, no malformed `cron_post` call. **No fix is required for job 104 — only observation of its first real run at 04:30 UTC today.**

This is the honest answer, and it changes the shape of the task: step 1 is a verification step, not a repair step. If 04:30 passes with still zero rows in `cron.job_run_details` for jobid 104, *then* it is a genuine defect and we escalate — but there is no evidence of that yet.

## 2. Re-enabling the moneyline fanout in sbo-day-engine

Current disabled block (`supabase/functions/sbo-day-engine/index.ts`, ~337–365) queries the day's games, then records a step with `records: 0` and the note "skipped: moneyline predicted_outcome derivation not yet implemented (disabled 2026-07-22)". It never invokes anything.

That premise is now obsolete: `sbo-run-predictions` has a real de-vig path — it loads all books' `moneyline` markets for the game, builds `ctx.devig`, derives the side from de-vigged consensus, applies the odds-only confidence clamp, and (line ~829) upserts the moneyline signal into `sbo_signals`.

Proposed replacement, mirroring the proven prop-fanout structure directly above it:

- Query the day's `sbo_games` for the sport (unchanged).
- Loop games, invoking `sbo-run-predictions` with `{ game_id, prediction_type: 'moneyline' }` — **no `predicted_outcome` passed**, so the function's own de-vig derivation is the only source of the side. No hardcoded/arbitrary logic is reintroduced.
- Apply the same guardrails as the prop branch: `MAX_GAMES_PER_RUN` cap, `TIME_BUDGET_MS` check, 400ms inter-call delay, `stopReason` tracking.
- Tally `saved` / `skipped` (cache hits and de-vig-unavailable skips) / `failed`; `status: 'warning'` only when there were invocations, zero saves, and at least one failure.
- Record the step with a note in the same format as the prop branch.

No new cron is needed for prediction generation: the `sbo-run-predictions` entry is already in `PER_SPORT_STEPS`, so it runs inside the existing `sbo-day-engine` cron at **13:00 and 23:00 UTC**.

## 3. Proposed schedule for sbo-signal-combiner

Real dependency chain, as confirmed:

```text
04:30  job 104  sbo-match-capper-picks   -> refreshes capper win-rate weights
13:00  day-engine (morning)              -> odds, props, moneyline predictions -> sbo_signals
23:00  day-engine (evening)              -> same, for the late slate
```

Proposal — **two runs**:

- **`05:15 UTC` (`15 5 * * *`)** — 45 minutes after job 104 starts, giving the matcher ample room to finish. This pass combines the *previous* day-engine output (the 23:00 batch) against **freshly-recomputed capper weights**. This is the pass that matters for weight freshness.
- **`23:45 UTC` (`45 23 * * *`)** — after the 23:00 day-engine run has generated the evening slate's signals, and after the existing consensus engine at 23:45... to avoid contention, use **`23:50` (`50 23 * * *`)**. This catches same-day evening signals so the combined output is available for games before the 05:15 pass would otherwise reach them.

Yes, the second evening pass is needed: without it, signals created at 23:00 for late-night games wouldn't be combined until 05:15 the next morning — after those games have already started. The morning pass gives weight freshness; the evening pass gives timeliness. Both use `private.cron_post`, matching jobs 101/102.

## 4. Verification method (all four links, no manual intervention)

A single read-only SQL health query, runnable any morning, that returns one row per check:

- **(a) Job 104 fired and updated weights** — `cron.job_run_details` has a `succeeded` row for jobid 104 with `start_time::date = current_date`, AND the capper weight/stats table has `updated_at::date = current_date`. Both must be true: a fired job that updated nothing is a silent failure.
- **(b) Predictions generated without manual invocation** — `sbo_predictions` rows with `created_at::date = current_date` whose `created_at` falls inside a ±10 minute window of a `sbo-day-engine` cron run recorded in `cron.job_run_details`. Rows created outside those windows are manual and are excluded from the pass condition.
- **(c) Signals created from those predictions** — `sbo_signals` rows for today that join back to today's cron-window prediction ids. Count must be > 0 and the join must resolve (not just "signals exist").
- **(d) Combiner ran against that day's fresh weights** — the combiner's own run/output rows are timestamped after today's job-104 completion time, and the capper weights they reference carry today's `updated_at`. This is what "used fresh weights" actually means, rather than the weak `combined_confidence != 0` test.

This will be packaged as a saved SQL view or a small read-only check so it can be run repeatedly without touching anything.

## 5. How many days before we trust it

**Recommendation: 5 consecutive days.**

Reasoning — the cycle spans a 24-hour dependency chain across four independently scheduled pieces, and MLB slates vary by weekday (getaway days, off-days, doubleheaders). Three days can be satisfied by a run of three ordinary weekday slates and would not exercise a light-slate or an off-day path. Five consecutive days guarantees at least one weekend slate and one thin slate, and gives grading (which resolves ~24h after prediction) three full observed predict-then-grade handoffs rather than one.

Proof required, for each of the 5 days, with **zero manual invocation in the window**:

1. Job 104 succeeded and capper weights carry that day's `updated_at`.
2. Predictions exist for that day, created inside a day-engine cron window.
3. Signals exist for that day and join to those predictions.
4. Combiner output for that day is timestamped after job 104 and references that day's weights.
5. Predictions from day N have graded results by day N+1 (`sbo_results_verification` / `was_correct` set).

Documentation gets updated only after all 5 days pass all 5 conditions. A single day failing any condition resets the count — a partial streak is not evidence of an automated cycle.

## Technical details

- Files touched: `supabase/functions/sbo-day-engine/index.ts` (fanout block only).
- Migrations: two `cron.schedule` registrations for `sbo-signal-combiner` via `private.cron_post`.
- Not touched: `sbo-run-predictions` derivation (de-vig, clamp, `data_quality`), job 104, jobs 101/102/103/105.
