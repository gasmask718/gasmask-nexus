# Stage 2d — Clamp-Lifting Readiness Evaluator (proposal)

Strictly measurement + visibility. The 54/Weak clamp in `sbo-run-predictions` is **not touched**.

## 1. The six gates — re-confirmed, unchanged

| # | Gate | Threshold |
|---|------|-----------|
| 1 | Volume | ≥ 150 graded, non-push predictions for that sport |
| 2 | Accuracy | win rate ≥ 52.4% (break-even at -110) |
| 3 | Statistical floor | 95% CI lower bound (Wilson) ≥ 50.0% |
| 4 | Coverage | ≥ 60% of that sport's props resolve to `data_quality = 'full'` |
| 5 | Calibration | high-confidence bucket (final_confidence ≥ 70) win rate > low-confidence bucket (< 70) |
| 6 | Recency | all of the above measured over the trailing 60 days |

Building exactly these. No modified thresholds.

## 2. Exact computation against the real current schema

Verified schema facts:
- `sbo_predictions`: `sport_key`, `prop_id`, `prediction_type`, `final_confidence`, `data_quality`, `was_correct`, `verdict`, `verified`, `created_at`.
- `sbo_results_verification`: 1,372 rows, keyed by `prediction_id`, with `verdict`, `was_correct`.
- `sbo_player_props`: `sport_key`, `game_date` (no `data_quality` column — quality lives on the prediction row, written by 2c).
- Push detection: `verdict` values seen are `correct` / `incorrect` / null; a push would be `verdict = 'push'`. Non-push = `was_correct IS NOT NULL AND coalesce(verdict,'') <> 'push'`.

Single evaluation CTE per sport (`p_sport`, `p_days = 60`):

```sql
WITH graded AS (
  SELECT pr.id, pr.final_confidence, pr.was_correct, pr.data_quality
  FROM sbo_predictions pr
  WHERE pr.sport_key = p_sport
    AND pr.created_at >= now() - (p_days || ' days')::interval
    AND pr.prediction_type = 'player_prop'
    AND pr.was_correct IS NOT NULL
    AND coalesce(pr.verdict,'') <> 'push'
),
vol AS (                                   -- Gate 1 + 2 + 3
  SELECT count(*)::int AS n,
         count(*) FILTER (WHERE was_correct)::int AS wins
  FROM graded
),
wilson AS (
  SELECT n, wins,
         CASE WHEN n = 0 THEN 0 ELSE wins::numeric / n END AS p,
         CASE WHEN n = 0 THEN 0 ELSE
           (( wins::numeric/n + 1.96^2/(2*n)
              - 1.96 * sqrt( (wins::numeric/n)*(1 - wins::numeric/n)/n + 1.96^2/(4*n^2) ) )
            / (1 + 1.96^2/n))
         END AS ci_low
  FROM vol
),
coverage AS (                              -- Gate 4 (all predictions, graded or not)
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE data_quality = 'full')::int AS full_n
  FROM sbo_predictions
  WHERE sport_key = p_sport
    AND prediction_type = 'player_prop'
    AND created_at >= now() - (p_days || ' days')::interval
),
calib AS (                                 -- Gate 5
  SELECT
    count(*) FILTER (WHERE final_confidence >= 70)::int AS hi_n,
    avg((was_correct)::int) FILTER (WHERE final_confidence >= 70) AS hi_rate,
    count(*) FILTER (WHERE final_confidence <  70)::int AS lo_n,
    avg((was_correct)::int) FILTER (WHERE final_confidence <  70) AS lo_rate
  FROM graded
)
SELECT * FROM wilson, coverage, calib;
```

Gate verdicts computed in the edge function from that row:

- G1 `n >= 150`
- G2 `p >= 0.524`
- G3 `ci_low >= 0.50`
- G4 `total > 0 AND full_n::float/total >= 0.60`
- G5 `hi_n >= 20 AND lo_n >= 20 AND hi_rate > lo_rate` (buckets need minimum mass; if either bucket is under 20 the gate is `insufficient_data`, which counts as **not passed**)
- G6 implicit — every window above is 60 days; stored as `window_days = 60` so it is auditable rather than assumed.

`all_gates_pass = G1..G5 all true`.

## 3. `sbo_clamp_readiness` table

One row per sport per evaluation run (append-only history, no upsert — trend matters).

```
id                uuid pk
sport             text not null            -- 'mlb', 'nba'
evaluated_at      timestamptz not null default now()
window_days       int not null default 60
graded_n          int      -- gate 1 live number
wins              int
win_rate          numeric  -- gate 2
ci_lower          numeric  -- gate 3
coverage_total    int
coverage_full     int
coverage_pct      numeric  -- gate 4
hi_bucket_n       int
hi_bucket_rate    numeric
lo_bucket_n       int
lo_bucket_rate    numeric  -- gate 5
gate_volume       bool
gate_accuracy     bool
gate_ci           bool
gate_coverage     bool
gate_calibration  bool
gates_passed      int      -- 0..5
all_gates_pass    bool
blocking_gates    text[]   -- names of failing gates, for the UI
notes             jsonb    -- raw numbers snapshot
created_at        timestamptz default now()
```

Grants: `SELECT` to `authenticated`, `ALL` to `service_role`. RLS on; read policy for authenticated (internal ops tool), writes service-role only.

## 4. Trigger

- **Weekly cron** (`sbo-clamp-readiness`, Mondays 09:00 UTC) — volume accumulates at ~20 graded MLB props/day, so daily rows would be noise.
- **Manual invocation** from the UI ("Re-evaluate now" button) and via direct function call, same code path.
- Registered in `public.health_checks` as `kind='cron'` with `cadence_expected_minutes = 10080`, per the standing health-check rule.

## 5. Visibility (no new page)

A small `ClampReadinessCard` added to the existing **SBO Health** page (`src/pages/sports-betting/pages/HealthPage.tsx` → `SBOHealthDashboard`):

- Per sport: `3 / 5 gates passed` with a checklist row per gate showing the live number vs threshold (e.g. `Volume 36 / 150`).
- When `all_gates_pass = true`: a prominent green banner — "MLB clamp-lift criteria met (n=163, 54.6%, CI 50.8%) — review and lift manually" — plus the same row flagged in the table. Explicitly worded as a recommendation; no button that lifts anything.
- Last-evaluated timestamp + manual re-evaluate button.

## 6. Honest timeline estimate (real numbers, 2026-07-31)

Current MLB reality:
- MLB predictions ever written: **52**; graded: **36**.
- Prediction volume last 3 active days: 14 (today), 27 (7/30), 11 (7/21).
- `data_quality` on MLB predictions: **all of today's 14 and 7/30's 27 are still `odds_only`** — the 2c stats brain shipped after those runs. Only 5 rows (7/21) ever recorded `full`.
- MLB props on the board: 306 today, 395 yesterday — so prediction volume is a deliberate subset (~20/day), not a data ceiling.

At the current ~20 predictions/day, all resolving `full` from the next run onward and grading a day later:

- **Volume gate (150 graded non-push `full`-era props): ~8–10 days** of continuous daily runs, so realistically **mid-August 2026**, and only if the day engine runs every day and grading keeps up (currently 36/52 graded = ~70% grade-through, which stretches it to ~11–14 days).
- Coverage gate will flip to passing on the **first post-2c run** (2c measured 300/306 = 98% `full`).
- Accuracy / CI / calibration gates are meaningless until volume lands; expect the first genuinely informative evaluation around **week of 2026-08-11**.

So: this evaluator will report `0–2 / 5 gates` for roughly the next two weeks. It is infrastructure that starts producing a real verdict in ~2 weeks, and its main near-term value is proving volume is actually accumulating (and catching it if the day engine silently stops).

## Technical notes

- Nothing in `sbo-run-predictions` changes — no import, no shared module edit, no clamp constant touched.
- Evaluator is read-only against `sbo_predictions` + writes only to `sbo_clamp_readiness`.
- Sports evaluated: `mlb` and `nba` (same code path, per-sport rows).
