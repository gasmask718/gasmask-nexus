# SBO FIX PASS — PROPOSED DIFFS (NOT DEPLOYED)

Status: **proposal only**. No file under `supabase/functions/`, no migration, and no
cron change has been applied. Every diff below is written against current live code.

---

## ITEM 1 — Prediction generation is effectively MLB-only

### Findings (live evidence)

| Sport | Props today | Games today | Predictions (7d) |
|---|---|---|---|
| mlb | 589 | 21 | 1,157 prop + 29 ML |
| wnba | 364 | 6 | 2 prop |
| nfl | 139 | 272 | 0 |
| nhl | 0 | 31 | 0 |

Two distinct causes, both confirmed:

**1a. The deployed day-engine was still on the 2-sport allowlist until ~16:43 today.**
`sbo_day_engine_runs` metadata for the 13:00 run: `allowlist: ["nba","mlb"]`,
`sports_run: ["nba","mlb"]`. The 16:43 run (post-deploy) shows
`allowlist: ["nba","mlb","nfl","nhl","wnba"]`. So the allowlist part is already fixed
in code — it simply has not had a pregame run yet. No change needed.

**1b. The real, unfixed problem: MLB starves every sport behind it.**
The per-sport loop is strictly sequential and each fanout step claims
`min(60s, max(15s, remainingRunMs()))`. Live 13:00 note for MLB:

```
473 deduped props (589 raw) · 15 invoked · 15 saved · 0 skipped · 458 remaining
— stopped: time budget 60s reached
```

MLB alone burns the full 60s and still leaves 458 props. Adding wnba/nfl/nhl behind it
means they each fall back to the 15s floor *and* the total run blows past the ~150s
edge limit — so the tail sports get nothing. Throughput is also poor: 15 props / 60s
(~4s each) because the prop fanout is serial with a 400ms sleep, while the moneyline
fanout already runs at `CONCURRENCY = 3`.

Player-context resolution is **not** the cause — WNBA prop predictions saved fine when
invoked directly (2 rows, 16:43), and WNBA stats ingestion returned 59 rows.

### Proposed fix

1. Order `sportsToRun` by pending work, but give every sport a **fair share** of the
   remaining wall clock instead of first-come-first-served.
2. Parallelize the prop fanout the same way moneyline already is.

```diff
--- a/supabase/functions/sbo-day-engine/index.ts
+++ b/supabase/functions/sbo-day-engine/index.ts
@@ const RUN_BUDGET_MS = 115_000;
+// Reserve for global + postgame steps so the per-sport loop can never eat the
+// whole run.
+const PER_SPORT_LOOP_BUDGET_MS = 90_000;
@@ per-sport loop
-    for (const sport of sportsToRun) {
+    // Fair-share: each sport gets (remaining loop budget / sports left), so a
+    // busy MLB slate can no longer consume the entire window and starve the
+    // sports behind it. A sport with no work returns instantly and hands its
+    // unused share back to the ones still queued.
+    const LOOP_START = Date.now();
+    const loopRemainingMs = () =>
+      Math.max(0, PER_SPORT_LOOP_BUDGET_MS - (Date.now() - LOOP_START));
+    let sportsLeft = sportsToRun.length;
+    for (const sport of sportsToRun) {
+      const sportBudgetMs = Math.max(10_000, Math.floor(loopRemainingMs() / Math.max(1, sportsLeft)));
+      const sportStart = Date.now();
+      const sportRemainingMs = () => Math.max(0, sportBudgetMs - (Date.now() - sportStart));
+      sportsLeft -= 1;
       for (const step of perSportSteps) {
@@ prop fanout
-            const MAX_PROPS_PER_RUN = Number(prop_fanout_limit ?? 40);
-            const TIME_BUDGET_MS = Math.min(60_000, Math.max(15_000, remainingRunMs()));
+            const MAX_PROPS_PER_RUN = Number(prop_fanout_limit ?? 60);
+            // 70% of this sport's share to props, 30% left for moneyline.
+            const TIME_BUDGET_MS = Math.max(8_000, Math.floor(sportRemainingMs() * 0.7));
+            const PROP_CONCURRENCY = 3;
@@ replace the serial prop loop
-            for (const prop of queue) {
-              if (invoked >= MAX_PROPS_PER_RUN) { stopReason = `cap ${MAX_PROPS_PER_RUN} reached`; break; }
-              if (Date.now() - stepStart > TIME_BUDGET_MS) { stopReason = `time budget ${TIME_BUDGET_MS / 1000}s reached`; break; }
-              invoked += 1;
-              try { ... } catch { ... }
-              await new Promise(r => setTimeout(r, 400));
-            }
+            const capped = queue.slice(0, MAX_PROPS_PER_RUN);
+            if (queue.length > MAX_PROPS_PER_RUN) stopReason = `cap ${MAX_PROPS_PER_RUN} reached`;
+            for (let i = 0; i < capped.length; i += PROP_CONCURRENCY) {
+              if (Date.now() - stepStart > TIME_BUDGET_MS) {
+                stopReason = `time budget ${Math.round(TIME_BUDGET_MS / 1000)}s reached`;
+                break;
+              }
+              const batch = capped.slice(i, i + PROP_CONCURRENCY);
+              invoked += batch.length;
+              await Promise.all(batch.map(async (prop: any) => {
+                try {
+                  const { data: res, error: invErr } = await supabase.functions.invoke('sbo-run-predictions', {
+                    body: { prop_id: prop.id, prediction_type: 'player_prop' },
+                  });
+                  if (invErr || res?.insert_error) { failedProps += 1; return; }
+                  if (res?.saved === true && res?.prediction_id) saved += 1;
+                  else if (res?.skipped === true || res?.source === 'cache') skipped += 1;
+                  else failedProps += 1;
+                } catch { failedProps += 1; }
+              }));
+              await new Promise(r => setTimeout(r, 150));
+            }
@@ moneyline fanout
-            const TIME_BUDGET_MS = Math.min(60_000, Math.max(15_000, remainingRunMs()));
+            const TIME_BUDGET_MS = Math.max(8_000, sportRemainingMs());
```

No change to data-quality/clamp handling — `sbo-run-predictions` already applies the
same `data_quality` + 54-confidence clamp per sport; this only changes *who gets called*.

**Honest caveat:** even with fair-share, one 115s run cannot cover 473 MLB + 364 WNBA +
139 NFL deduped props. Fair-share guarantees every sport gets served *some* props each
run and is resumable across the 13:00/23:00 runs. Full same-day coverage would need a
dedicated fanout cron (e.g. `sbo-day-engine {steps:['sbo-run-prop-predictions']}` every
30 min during the slate). Recommended as a follow-up, not bundled here.

---

## ITEM 2 — `sbo_signals` settlement (worse than reported)

### Findings

A settlement path **does** exist and ran at 14:00 today (`sbo-result-tracker`, STEP 3).
But every single settled row came back a loss:

```
result  | resolved | pnl | count
pending |        0 |   0 |     8
loss    |       14 |  14 |    14   (pnl_units = -1 on all 14)
```

Root cause: `sbo_signals.side` is written as the literal string `'home'` / `'away'`
(`_shared/sboSignals.ts` → `buildMoneylineSignal`), but the tracker resolves it with
`sideMatchesTeam(side, game.home_team)` which compares against **team names**. Neither
side matches, so `resolveMoneyline` hits its fallback:

```ts
if (!takingHome && !takingAway) return { result: "loss", pnl: -stake };
```

So the loop isn't "never settling" — it is settling **100% losses, all fabricated**.
That's a data-integrity bug, not just a gap. `findGameForRow` also receives `s.side`
("away") as the team hint and only matches via the `s.game` fallback string.

### Proposed fix

```diff
--- a/supabase/functions/sbo-result-tracker/index.ts
+++ b/supabase/functions/sbo-result-tracker/index.ts
@@
-function resolveMoneyline(game: Game, side: string, stake: number, odds: number | null): Resolution {
-  const takingHome = sideMatchesTeam(side, game.home_team, game.sport);
-  const takingAway = sideMatchesTeam(side, game.away_team, game.sport);
+// `side` may be a team name (capper picks) OR the literal 'home'/'away'
+// (sbo_signals, written by _shared/sboSignals.ts). Handle both explicitly —
+// previously 'home'/'away' matched no team and fell through to the loss
+// fallback, marking every AI signal a loss.
+function resolveMoneyline(game: Game, side: string, stake: number, odds: number | null): Resolution {
+  const s = String(side ?? '').trim().toLowerCase();
+  const takingHome = s === 'home' || (s !== 'away' && sideMatchesTeam(side, game.home_team, game.sport));
+  const takingAway = s === 'away' || (s !== 'home' && sideMatchesTeam(side, game.away_team, game.sport));
   if (!takingHome && !takingAway) return { result: "loss", pnl: -stake };
+  if (game.home_score === game.away_score) return { result: "push", pnl: 0 };
   const won = takingHome ? game.home_score > game.away_score : game.away_score > game.home_score;
   return { result: won ? "win" : "loss", pnl: won ? winPnl(stake, odds) : -stake };
 }
@@ STEP 3: sbo_signals
     const { data: signals, error } = await supabase
       .from("sbo_signals")
-      .select("id, sport, game, game_date, pick_type, side, line, odds")
+      .select("id, sport, game, game_date, home_team, away_team, pick_type, side, line, odds")
       .eq("result", "pending")
@@
-      const game = findGameForRow(allGames, s.sport, s.game_date, s.side, s.game);
-      if (!game) continue;
+      // Match on real team names, never on the 'home'/'away' token.
+      const teamHint = String(s.side).toLowerCase() === 'home' ? s.home_team : s.away_team;
+      const game = findGameForRow(allGames, s.sport, s.game_date, teamHint ?? "", s.game);
+      if (!game) continue;
@@ ESPN_ENDPOINTS
   NHL:   "https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard",
+  WNBA:  "https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/scoreboard",
```

Plus a one-time data repair (insert-tool operation, **not** run):

```sql
-- Reverse the 14 fabricated losses so the corrected tracker re-grades them.
UPDATE public.sbo_signals
SET result = 'pending', pnl_units = NULL, resolved_at = NULL
WHERE result = 'loss'
  AND pnl_units = -1
  AND resolved_at >= '2026-08-01T00:00:00Z';
```

---

## ITEM 3 — RLS residual on `sbo_analysis_jobs`

### Findings

```
Authenticated users can create jobs | INSERT | WITH CHECK (auth.uid() IS NOT NULL) | {public}
operator_select_sbo_analysis_jobs   | SELECT | USING is_sbo_operator()             | {authenticated}
```

Any signed-in user of the whole OS (not just SBO operators) can insert jobs, and the
policy is granted to `public` rather than `authenticated`. No UPDATE/DELETE policy at
all. The table has a `user_id` column and is in `supabase_realtime`.

### Proposed migration

```sql
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON public.sbo_analysis_jobs;

CREATE POLICY operator_insert_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR INSERT TO authenticated
  WITH CHECK (public.is_sbo_operator() AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY operator_update_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR UPDATE TO authenticated
  USING (public.is_sbo_operator()) WITH CHECK (public.is_sbo_operator());

CREATE POLICY operator_delete_sbo_analysis_jobs
  ON public.sbo_analysis_jobs FOR DELETE TO authenticated
  USING (public.is_sbo_operator());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sbo_analysis_jobs TO authenticated;
GRANT ALL ON public.sbo_analysis_jobs TO service_role;
```

---

## ITEM 4 — `props_master` and its twice-daily sync

### Findings — the audit's premise was wrong

`props_master` is **not** frozen. It is being written every run:

```
month      | rows
2026-08-01 |   600     <- today
2026-07    | 8,104
2026-03    | 5,206
```

Newest rows (13:30 today) are **MLB props** — Jeremy Pena / Corey Seager / Yordan
Alvarez, `stat_type='hits'` — but stored with `sport = 'NBA'`. The sync hardcodes the
label:

```ts
// supabase/functions/sbo-sync-props-master/index.ts:99
sport: 'NBA',
```

That single hardcode is what made the table look "100% stale NBA". Live consumers do
exist: `PropIntelligenceHub.tsx`, `usePropsMaster.ts`, `useUnifiedSignals.ts`,
`SBOCommandCenter.tsx`, plus `sbo-top-plays`, `sbo-consensus-engine`, `sbo-auto-bet`,
`sbo-run-analysis`, `sbo-send-daily-email`, `sbo-system-health`.

**Recommendation: (a) fix the sync. Do NOT retire the table.**

### Proposed diff

```diff
--- a/supabase/functions/sbo-sync-props-master/index.ts
+++ b/supabase/functions/sbo-sync-props-master/index.ts
@@
+// props_master predates multi-sport support and stored a hardcoded 'NBA'.
+// sbo_player_props carries the real sport_key — map it to the short label
+// props_master consumers (and sbo_capper_picks) already use.
+const SPORT_LABEL: Record<string, string> = {
+  mlb: 'MLB', nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL',
+  ncaab: 'NCAAB', ncaaf: 'NCAAF',
+};
@@
-        sport: 'NBA',
+        sport: SPORT_LABEL[String(p.sport_key ?? '').toLowerCase()]
+          ?? String(p.sport_key ?? 'NBA').toUpperCase(),
```

Plus a one-time backfill (insert-tool operation, **not** run):

```sql
UPDATE public.props_master pm
SET sport = CASE lower(pp.sport_key)
              WHEN 'mlb' THEN 'MLB'  WHEN 'wnba' THEN 'WNBA'
              WHEN 'nfl' THEN 'NFL'  WHEN 'nhl'  THEN 'NHL'
              ELSE upper(pp.sport_key) END
FROM public.sbo_player_props pp
WHERE pm.player_name = pp.player_name
  AND pm.stat_type   = pp.prop_type
  AND pm.line        = pp.line
  AND pm.game_date   = pp.game_date::text
  AND pm.sport IS DISTINCT FROM upper(pp.sport_key);
```

Cron job 101 stays enabled. Note the sync also has an unrelated scaling risk: it pulls
*all* of `sbo_player_props` and upserts the entire history twice a day — worth bounding
to a trailing window later, but out of scope for this pass.

---

## ITEM 5 — NHL rows mislabeled `season = '2026'`

### Findings

```
sport | season | rows | last_game_date
mlb   | 2026   | 2481 | 2026-07-31
nfl   | 2025   |  315 | 2026-01-11   (already corrected)
nhl   | 2026   |  534 | 2026-04-09   <- wrong
wnba  | 2026   |  136 | 2026-07-31
```

Collision check against `sbo_player_season_splits_key_unique (sport, player_key, season)`:

```sql
select count(*) ... where sport='nhl' and season='2026'
  and exists (same sport+player_key with season='2025')  -->  0
```

Zero collisions — a straight relabel is safe. `sbo_player_game_stats` has no `season`
column, so nothing else needs touching.

### Proposed migration

```sql
-- NHL 2025-26 regular season (2025-10 -> 2026-04) belongs to season '2025'
-- under seasonForDate(). No correctly-labeled '2025' NHL rows exist, so this
-- cannot violate sbo_player_season_splits_key_unique.
UPDATE public.sbo_player_season_splits
SET season = '2025', updated_at = now()
WHERE sport = 'nhl'
  AND season = '2026'
  AND last_game_date < '2026-09-01';
-- expected: 534 rows
```

(This is a data UPDATE, so it should go through the insert tool rather than a schema
migration.)

---

## ITEM 6 — 671 ambiguous historical props (surface only, no re-grading)

### Findings — the number needs nuance

```
props with >1 non-null predicted_outcome : 671
underlying predictions                   : 1,350
props where the outcomes actually DISAGREE:    41
by sport: mlb 510, nba 161
```

So 630 of the 671 are harmless duplicates that all predicted the same side — the old
non-deterministic tiebreak could not have changed their grade. Only **41** are truly
ambiguous and could have been graded either way.

### Proposed approach — a read-only view, no data change

```sql
CREATE OR REPLACE VIEW public.v_sbo_ambiguous_graded_props AS
SELECT
  pp.id                              AS prop_id,
  pp.sport_key,
  pp.game_date,
  pp.player_name,
  pp.prop_type,
  pp.line,
  pp.verdict,
  count(*)                           AS prediction_count,
  count(DISTINCT p.predicted_outcome) AS distinct_outcomes,
  (count(DISTINCT p.predicted_outcome) > 1) AS outcomes_conflict,
  array_agg(DISTINCT p.predicted_outcome)   AS outcomes,
  max(p.created_at)                  AS newest_prediction_at,
  (array_agg(p.predicted_outcome ORDER BY p.created_at DESC))[1]
                                     AS deterministic_winner
FROM public.sbo_predictions p
JOIN public.sbo_player_props pp ON pp.id = p.prop_id
WHERE p.prediction_type = 'player_prop'
  AND p.predicted_outcome IS NOT NULL
GROUP BY pp.id, pp.sport_key, pp.game_date, pp.player_name, pp.prop_type, pp.line, pp.verdict
HAVING count(*) > 1;

GRANT SELECT ON public.v_sbo_ambiguous_graded_props TO authenticated;
```

`deterministic_winner` shows what the *new* tiebreak (most recent `created_at` wins)
would choose, side by side with the historical grade — so the 41 conflicting rows can be
reviewed by a human later. Nothing is re-graded, nothing is written. Optional follow-up:
a small read-only panel on the SBO Health page listing the 41 conflicting rows.

---

## Summary

| Item | Verdict | Change type |
|---|---|---|
| 1 | Real. Allowlist already fixed; fair-share budgeting is the outstanding fix | Edge function |
| 2 | Worse than reported — 14 fabricated losses from a home/away vs team-name bug | Edge function + data repair |
| 3 | Confirmed | Migration |
| 4 | Premise wrong — data is fresh, sport label is hardcoded 'NBA'. Fix, don't retire | Edge function + backfill |
| 5 | Confirmed, zero collisions | Data UPDATE |
| 6 | 671 total, only 41 genuinely conflicting | Read-only view, no data change |
