# SBO Phase 8H — Engine-internal props_master fanout fix

Date: 2026-08-12 · Zero Odds API calls · Zero Anthropic calls · Zero key material printed.

## 1. Root cause (with evidence)

Two separate defects, both proven:

**(a) Reporting defect — permanent `records: 0` (reproduced live, this is the real standing bug).**
`sbo-sync-props-master` returns `{ success, synced, source_count, predictions_matched, ... }`.
`extractRecords()` in `sbo-day-engine` only read `records_synced / games_processed / inserted / props`
— none of which the sync function emits — so the engine-internal step logged `records: 0`
even on a clean HTTP 200.

Live reproduction BEFORE the fix (engine invoke, `steps:["sbo-sync-props-master"]`, run_id `b3d3d494-cedf-4449-aea1-b3f2486f9314`, 2026-08-12 04:15Z):

```json
{"fn":"sbo-sync-props-master","duration_ms":11429,"records":0,"sport":"global","status":"success"}
```

11.4s of real work, 200, records 0. So the "engine step does nothing" reading was partly a
telemetry lie: the fanout DID run, the engine just could not count it.

**(b) The 2026-08-10 `status:warning` was a genuine invoke failure — and it left no evidence.**
Run `7ec921f7-b937-40e0-8d69-69271bb567de` (2026-08-10 23:00:07Z → 23:00:40Z), `steps_completed`:

```
{fn: sbo-sync-props-master, sport: global, records: 0, duration_ms: 1,  status: warning}
{fn: sbo-compare-odds,      sport: global, records: 0, duration_ms: 0,  status: warning}
{fn: sbo-generate-daily-briefing, records: 0, duration_ms: 0, status: warning}
{fn: sbo-send-daily-sms,          records: 0, duration_ms: 0, status: warning}
```

ALL FOUR global steps returned in 0–1 ms — i.e. `supabase.functions.invoke()` returned an
`error` object essentially instantly, before any network work. This is not the fanout function
failing (standalone the same function runs ~11s and returns 200); it is the invoke call itself
failing fast for every global step in that run. The old code recorded `status: error ? 'warning'`
with **no note and no error text**, so the actual failure string was never persisted, and edge
logs for 2026-08-10 are past retention (`edge_function_logs` returns nothing for that window).

Ruled out explicitly:
- **Config shape** — ruled OUT. Global steps are invoked with `{ date }` only; `sports` /
  `props_sports` never reach them, and the sync function ignores its body entirely (it reads
  `sbo_player_props` wholesale). Same input as the standalone cron.
- **isInSeason / required-flag guard** — ruled OUT. There is no season or required gate on the
  global loop; `required:false` only affects whether an error is rethrown.
- **Silent catch converting work into a warning** — ruled OUT inside `sbo-sync-props-master`
  (its catch returns HTTP 500 with `success:false`, which would have surfaced). The silent
  conversion was in the ENGINE: `status: error ? 'warning' : 'success'` with the error discarded.
- **Ordering** — ruled OUT as the cause. The global loop runs after the per-sport loop, so
  today's props are already written. It is also irrelevant to (a): the fanout syncs the whole
  table, not just today.
- **Run budget / timeout** — ruled OUT for that run: total wall clock was 33s of a 115s budget,
  and the globals failed at 0ms, not at a deadline.

## 2. The exact fix (smallest change, no engine restructure)

`supabase/functions/sbo-day-engine/index.ts:133` — count the field the fanout actually returns:

```diff
-  const explicit = data.records_synced ?? data.games_processed ?? data.inserted ?? data.props;
+  // PHASE 8H: sbo-sync-props-master reports `synced` (not records_synced), so
+  // the engine-internal fanout always logged 0 rows even on a clean 200.
+  const explicit = data.records_synced ?? data.synced ?? data.games_processed ?? data.inserted ?? data.props;
```

`supabase/functions/sbo-day-engine/index.ts:624-638` — persist the invoke error string for
non-required global steps so defect (b) can never again be an evidence-free `warning`:

```diff
         const records = extractRecords(data);
+        const errDetail = error ? await invokeErrorDetail(error) : null;
+        if (error) console.error(`[global] Step ${step.fn} invoke error:`, errDetail);
         await recordStep(step, {
           sport: 'global',
           status: error ? 'warning' : 'success',
           records,
           duration_ms: Date.now() - stepStart,
+          note: errDetail ? `invoke error: ${errDetail}` : undefined,
         });
```

No other file touched. Budget shape, crons 23/24, `sbo-fetch-odds`, the 8F changes,
`NightlyBoardTab`, and `API_COSTS` are all unmodified.

`npx tsgo --noEmit` — clean (exit 0, no output).

## 3. Live proof

HOW the proof ran: a **real engine invoke** (`POST /functions/v1/sbo-day-engine`) with
`{"run_type":"manual","steps":["sbo-sync-props-master"],"sports":["mlb"],"props_sports":["mlb"]}`.
The `steps` array selector resolves to the GLOBAL_STEPS entry only — same code path, same
`{ date }` body, same loop as a scheduled `full` run — while running **no** per-sport step, so
`sbo-fetch-odds` was never invoked (0 Odds API credits, 0 Anthropic).

AFTER the fix (deployed), run_id `6c4c3791-ac36-49b3-99c7-bb76be6bf7c2`, 2026-08-12 04:17Z:

```json
{"fn":"sbo-sync-props-master","duration_ms":10650,"records":21199,"sport":"global","status":"success"}
"summary": {"total_records_synced": 21199, "failed_steps": 0, "estimated_cost_cents": 0}
```

`props_master` state:

| | BEFORE (04:14Z) | AFTER (04:18Z) |
|---|---|---|
| max(game_date) | 2026-08-11 | 2026-08-11 |
| total rows | 21,502 | 21,502 |
| records_written reported by engine step | 0 | **21,199** |

max(game_date) did NOT advance — correctly. `sbo_player_props` has `max(game_date) = 2026-08-11`
and **0 rows for 2026-08-12**, because tonight's cron 24 odds pull (23:00Z) has not run and we are
forbidden from invoking it. The fanout is DB→DB: it can only mirror what the source holds. The
21,199 upserted rows are the full existing corpus, which is exactly what the standalone cron does.

## 4. Crons untouched + rollback

Verified post-change, both still active and unedited:

| jobid | jobname | schedule | active |
|---|---|---|---|
| 101 | sbo-props-master-sync-daily | `30 13,23 * * *` | true |
| 110 | sbo-prop-fanout-catchup | `*/20 * * * *` | true |

Rollback (one line each, `supabase/functions/sbo-day-engine/index.ts`):
1. Line 133: delete `data.synced ??` from the `explicit` chain.
2. Lines ~627-638: delete the `errDetail` line and the `note: errDetail ? ... : undefined,` line.
Then redeploy `sbo-day-engine`. Nothing else to undo — no cron, no schema, no config changed.

## 5. Honest UNKNOWNs

- **The exact 2026-08-10 failure string is unrecoverable.** Edge logs for that window are past
  retention and the old code never persisted the error. I can prove *that* all four global invokes
  failed in ≤1ms; I cannot prove *why*. The instrumentation added here is what makes the next
  occurrence diagnosable — it is not a proven fix for that specific fast-fail.
- **Not proven in a scheduled `full` run.** The proof is a manual invoke of the same loop, not the
  23:00Z cron 24 path with the per-sport loop ahead of it.
- **Not proven that the fanout advances `game_date` to a new day via the engine step**, because
  the source table has no rows for today yet and pulling them is out of scope (0 credits).
- Whether an intermittent gateway-level `functions.invoke` fault can recur is unknown.

## 6. Deploy status

**DEPLOYED this phase:** `sbo-day-engine` only (required to produce live proof). That deploy also
ships the previously-written-but-undeployed Phase 8F changes contained in the same file
(`API_COSTS` NULL sentinels + honest `usage-not-persisted` notes). 8F changes in the other three
functions (`sbo-telegram-intake`, `sbo-run-predictions`, `sbo-parse-capper-image`) remain
undeployed and still ship with the next scheduled deploy.

**Cron 101 MUST keep running** until the engine step is proven in a live scheduled 23:00Z run with
fresh same-day props. Do not disable 101 or 110 on the strength of this manual proof.
