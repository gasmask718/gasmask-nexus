# PHASE 4 / ITEM 4 — `sbo-grade-capper-props` SPEC STUB

**Status: SPEC ONLY. Function not built — there is no live prop data to test
against while `ODDS_API_KEY` is deactivated. Building it now would ship an
unverified grader into the accuracy path.**

---

## 1. Verified backlog (2026-08-10, live query)

`sbo_capper_picks` where `result='pending'` AND `unsupported IS NOT TRUE`
AND `game_date >= '2026-01-01'` AND `bet_type = 'prop'`:

| sport | count | all `bet_type='prop'`? | has `player_name` | has `prop_type` | has `matched_prop_id` |
| --- | --- | --- | --- | --- | --- |
| MLB | 232 | yes (232/232) | 163 | 226 | 5 |
| WNBA | 20 | yes (20/20) | 20 | 20 | 3 |
| NBA | 4 | yes (4/4) | 4 | 4 | 0 |
| **TOTAL** | **256** | **256/256** | 187 | 250 | **8** |

The 232 + 20 + 4 in the brief is **confirmed exactly**. All are `bet_type='prop'`.

Matching prop rows in `sbo_player_props` today (same player name, same
game_date):

| sport | pending props | player+date match exists today |
| --- | --- | --- |
| MLB | 232 | 58 |
| WNBA | 20 | 5 |
| NBA | 4 | 0 |

So the brief's "no matching rows" claim is **mostly but not entirely true**:
63 of 256 already have a same-player/same-date prop row present; the other
193 have none, consistent with the prop-ingest outage.

## 2. What grades automatically vs what needs new code

- **Would grade via the existing match + score path: 8.** Only the rows that
  already carry `matched_prop_id` (5 MLB + 3 WNBA) can flow through
  `sbo-match-capper-picks` → existing score path today.
- **Would become matchable once props flow again: ~63 now, growing.** These
  need only `sbo-match-capper-picks` to be re-run (it has `dry_run`); no new
  code.
- **Needs a new grader: 256 minus whatever matches.** Matching produces
  `matched_prop_id`; it does **not** produce a `result`. There is currently no
  function that turns a matched player-prop pick into won/lost/push. That is
  the gap `sbo-grade-capper-props` fills.
- **Structurally ungradeable regardless: 69 rows lack `player_name`** (232−163
  MLB) and 6 lack `prop_type`. Those cannot be matched to a prop line at all
  and should be flagged `unsupported_reason = 'prop_missing_player'`.

## 3. Spec: `supabase/functions/sbo-grade-capper-props/index.ts`

**Reads**

- `sbo_capper_picks`: `id, player_name, prop_type, line, direction, sport,
  game_date, matched_prop_id, result, unsupported, score_frozen`
  filtered `result='pending' AND bet_type='prop' AND unsupported IS NOT TRUE
  AND matched_prop_id IS NOT NULL`, paginated (1k pages) — never an unbounded
  read.
- `sbo_player_props` by `matched_prop_id`: `actual_value, verified, verdict,
  game_date, sport_key`.
- `sbo_player_game_stats` as the authoritative actual, keyed
  `(player_name, game_date, sport)` — used when `sbo_player_props.actual_value`
  is null. This is the same free-ESPN source `sbo-ingest-player-stats` fills,
  so the grader needs **no vendor key**.
- `_shared/statNormalize.ts` for prop_type → canonical stat key. Import via the
  existing single-implementation re-export; do **not** re-implement.
- `_shared/teamMatcher.ts` only if a team-scoped fallback is added. Token-level
  nickname matching must not be duplicated or altered.

**Writes** (all on `sbo_capper_picks`, no new table needed)

- `result`: `'won' | 'lost' | 'push' | 'pending'` — **never `'win'`/`'loss'`.**
  - `direction='over'`: actual > line → `won`; actual < line → `lost`;
    actual == line → `push`.
  - `direction='under'`: inverted.
  - actual unavailable → leave `pending`, write nothing else.
- `actual_value`, `graded_at = now()`, `grading_source = 'espn_player_stats'`.
- `pnl_units` / `profit_loss` via the existing scoring helper
  (`_shared/perPickScore.ts`) — reuse, do not fork the math.
- Skip any row with `score_frozen = true`.
- Emit one summary row per run to the existing run-log table used by
  `sbo-result-tracker` (same shape) so the health dashboard picks it up.

**Idempotency / safety**

- Only transitions `pending → won/lost/push`. Never re-grades a non-pending row.
- Wrap in `try/finally` so the run status always closes (same pattern applied
  to `sbo-day-engine` in an earlier phase).
- No new public table, therefore no new GRANTs and no `public_view_contracts`
  entry required.

**Cron**: register only after a live dry run against real prop data. Suggested
cadence: hourly during the slate, immediately after `sbo-result-tracker`.

## 4. Acceptance criteria before this is built

1. `ODDS_API_KEY` active and `sbo_player_props` carries forward-dated rows.
2. `sbo-match-capper-picks --dry_run` shows match rate materially above the
   current 0.96%.
3. A 20-pick manual spot check against ESPN box scores before any write pass.
