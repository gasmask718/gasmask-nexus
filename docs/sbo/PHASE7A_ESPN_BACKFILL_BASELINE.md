# Phase 7a — Free-ESPN backfill baseline (pre-billing)

Run date: 2026-08-10 (UTC). **No Odds API and no Anthropic calls were made.** Every
data source below is the free ESPN scoreboard/box-score API.

## Item 1 — NBA stats ingest (unblocks basketball props)

NBA had **0** rows in `sbo_player_game_stats` and no ESPN config. Added:

- `NBA_GRADING` in `_shared/espnGrading.ts`, reusing the WNBA parser/accessor verbatim
  (the `basketball/nba` and `basketball/wnba` box-score payloads are identical in shape).
- NBA registered in `GRADING_CONFIGS` so `sbo-ingest-player-stats` can resolve it.
  `GRADED_SPORT_KEYS` is now an **explicit list** (`mlb, wnba, nfl, nhl`) rather than
  `Object.keys(GRADING_CONFIGS)` — enrolling NBA in the scheduled day-engine/verify
  fanout is a separate governance decision and was deliberately NOT done here.
- Basketball prop vocabulary in `_shared/statLine.ts` (`statSpecForSport`): points,
  rebounds, assists, steals, blocks, turnovers, threes and the PRA/PR/PA/RA/STL+BLK
  combos. MLB resolution is untouched.

Ingest: **2026-03-19 → 2026-03-28, 74 games, 1,575 rows** (dry run and write agreed
exactly: `would_write_rows` 1575 → `records_synced` 1575, 0 errors).

## Item 2 — MLB missing box scores

Missing dates found by joining pending MLB props against `sbo_player_game_stats`:
`2026-08-01, 08-02, 08-03, 08-05` (0 rows each). Backfilled 2026-08-01 → 2026-08-08.
MLB coverage is now continuous **2026-03-16 → 2026-08-08 (144 dates, 57,277 rows)**.

## Item 3 — Prop grader re-run

The grader is now multi-sport: candidate `sport` filter accepts `mlb/nba/wnba`
(case-insensitive), box scores are keyed `sport|date` so an NBA date can never read
an MLB box score, and picks already flagged `unsupported` are excluded.

Dry run → write agreed exactly (26 → 26 in the 30-day MLB/WNBA window; 1 → 1 for NBA).

**Independent SQL spot check (6/6 exact match)** before the write pass — Whisenhunt ER 4,
Goodman TB 0, Urena outs 18, Collier 18 PTS, Howard 13+4=17, Brink 7 PTS.

Graded this pass: **28** (27 in the MLB/WNBA window + Banchero NBA). 12 won / 15 lost
across the runs, plus 1 additional WNBA rebound prop after an alias fix.

## Two pick corrections (documented, not silent)

| Pick | Was | Now | Evidence |
|---|---|---|---|
| `087af1e0` Paolo Banchero PRA U35.5, 03-19 | `bet_type='parlay'`, `unsupported=true` | `bet_type='prop'`, gradeable → **won** (20+3+7=30) | Single player, single prop_type, single line — a mislabelled single-player prop, not a parlay |
| `81fa86e9` LeBron James PRA U36.5, 03-28 | pending | `unsupported='prop_no_game_on_date'` | The Lakers played **no game on ET 2026-03-28**. Their 03-27 game (tip 03-28T02:30Z) had already finished before this pick was posted (03-28 16:27 ET), and the next Lakers games were 03-30 and 03-31 — two candidates, so the intended game is **not** deterministically recoverable. Not guessed. |

This is the same pre-Phase-6 defect class: the row has `game_date_source IS NULL`, i.e.
it predates the ET post-date fallback added in Phase 6.

## Post-backfill baseline

`sbo_player_game_stats`

| sport | rows | dates | range |
|---|---|---|---|
| mlb | 57,277 | 144 | 2026-03-16 → 2026-08-08 |
| wnba | 4,828 | 84 | 2026-05-08 → 2026-08-09 |
| nba | 1,575 | 10 | 2026-03-19 → 2026-03-28 |
| nhl | 534 | 1 | 2026-04-09 |
| nfl | 315 | 2 | 2026-01-10 → 2026-01-11 |

## What is still blocked, and by what

- **130 of the 137 remaining pending props have no OVER/UNDER direction.** This is the
  single dominant blocker and it is *not* an ESPN problem — it needs the Anthropic
  direction backfill (Phase 7 Item 4), which stays blocked on billing.
- 6 picks: player absent from the box score for that date (same NULL-game_date /
  wrong-date defect class as above; needs case-by-case disposition).
- 1 pick: `hitter fs` — unrecognised MLB vocabulary, needs a vocabulary decision.
- NBA coverage is only the 10-day window the target props needed. A full-season NBA
  ingest is possible with the same free endpoint but must be run in ~10-day chunks:
  a 13-day MLB request hit the gateway timeout mid-run (it still wrote the days it
  had completed, which is why the ingest is safely re-runnable/idempotent).
