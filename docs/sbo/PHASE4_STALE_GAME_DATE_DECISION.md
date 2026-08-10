# PHASE 4 / ITEM 2 — Stale `game_date` Decision Document

**Status: DECISION PREP ONLY. No rows were modified.**
Date: 2026-08-10. Scope: `public.sbo_capper_picks` where `result = 'pending'`
and `game_date < '2026-01-01'`.

---

## 1. Population

| sport | stale pending | of which `bet_type='prop'` | game_date min | game_date max |
| --- | --- | --- | --- | --- |
| MLB | 246 | 49 | 2020-07-20 | 2024-08-05 |
| Tennis | 32 | 8 | 2020-07-27 | 2024-07-29 |
| WNBA | 7 | 1 | 2020-08-03 | 2024-08-05 |
| KBO | 5 | 0 | 2024-05-29 | 2024-05-29 |
| NBA | 2 | 0 | 2020-07-21 | 2020-07-22 |
| CFL | 1 | 0 | 2025-07-24 | 2025-07-24 |
| **TOTAL** | **293** | **58** | | |

(The brief said 234 MLB / 7 WNBA / 2 other. The live count including *all*
stale pending rows regardless of `unsupported` flag is 293; 246 MLB. The 234
figure is the subset that is also `unsupported IS NOT TRUE` and gradeable
bet types. Both numbers are correct for their filter — stating this so the
owner is not comparing mismatched denominators.)

## 2. Sample of 20 stale MLB rows

| pick_text | stored game_date | stored team | bet_type | ingested (created_at) |
| --- | --- | --- | --- | --- |
| WIN | 2020-07-25 | Boston Red Sox | moneyline | 2026-07-25 |
| WIN | 2020-08-01 | Guardians | moneyline | 2026-08-01 |
| Michael McGreevy YES nrfi | 2023-07-23 | Michael McGreevy | prop | 2026-07-23 |
| WIN | 2020-07-25 | Dodgers | moneyline | 2026-07-25 |
| WIN | 2023-07-23 | New York Yankees | moneyline | 2026-07-23 |
| Suzuki OVER 1.5 hits+runs+rbi | 2020-08-05 | Cubs | prop | 2026-08-06 |
| Michael King YES nrfi | 2023-08-03 | SD | prop | 2026-08-03 |
| WIN | 2024-07-24 | TB Rays | moneyline | 2026-07-26 |
| WIN | 2020-07-24 | Tampa Bay Rays | moneyline | 2026-07-24 |
| Torkelson OVER 1.5 hits+runs+rbi | 2020-08-01 | Tigers | prop | 2026-08-01 |
| WIN | 2023-07-23 | Chicago White Sox | moneyline | 2026-07-23 |
| WIN -1 | 2020-07-23 | Tigers | spread | 2026-07-24 |
| WIN 1.5 | 2023-07-25 | Brewers | spread | 2026-07-25 |
| WIN | 2022-07-22 | Atlanta Braves | moneyline | 2026-07-23 |
| Shane Bieber YES nrfi | 2023-07-23 | Shane Bieber | prop | 2026-07-23 |
| WIN | 2020-08-04 | Houston Astros | moneyline | 2026-08-06 |
| WIN | 2024-07-29 | Toronto Blue Jays | moneyline | 2026-07-29 |
| WIN | 2020-08-03 | Padres | moneyline | 2026-08-03 |
| WIN | 2023-08-02 | Marlins | moneyline | 2026-08-02 |
| WIN | 2023-08-01 | Rays | parlay | 2026-08-01 |

Candidate-game lookup on the *stored* date returns **zero** rows for every
sample: `sbo_games` only covers 2026-03-23 → 2027-01-10. No stale row can
ever match a real game at its stored date. This is not ambiguous.

## 3. Failure-mode classification

Across the full 293:

| year stored | rows | rows whose stored **month+day == created_at month+day** |
| --- | --- | --- |
| 2020 | 85 | 56 |
| 2022 | 6 | 0 |
| 2023 | 130 | 116 |
| 2024 | 71 | 46 |
| 2025 | 1 | 0 |
| **same-year as ingest** | **0 / 293** | — |

**Dominant failure mode: wrong-year hallucination at extraction time.** The
month and day are overwhelmingly correct (the LLM read "7/23" off the Telegram
post and invented a year). 2023 is the single most common invented year —
consistent with a model defaulting to its training-data era rather than a
date-vs-time confusion or a genuinely-old game. No row is a genuinely-old
game: none of these cappers posted a 2020 slate into a 2026 intake pipeline.

Secondary mode: a small tail (2022 / 2025, 6+1 rows, and the 2020/2024 rows
whose month-day does not line up) where the day is also wrong — those are
unrecoverable without the raw message text.

## 4. Repair options

Setting `yfix = make_date(2026, month(game_date), day(game_date))`:

| sport | stale | yfix == ingest date | yfix within ±1 day of ingest | a real `sbo_games` game exists for that team on `yfix` |
| --- | --- | --- | --- | --- |
| MLB | 246 | 188 | 234 | **148** |
| Tennis | 32 | 21 | 27 | 0 (no tennis in `sbo_games` at all) |
| WNBA | 7 | 7 | 7 | 2 |
| KBO | 5 | 0 | 0 | 0 |
| NBA | 2 | 2 | 2 | 0 (NBA off-season in August) |
| CFL | 1 | 0 | 1 | 0 |

**Option A — Re-point by best match (team + opponent + nearest date).**
Would touch 293, confidently repair ~150 (148 MLB + 2 WNBA). Highest recovered
volume. Risk: MLB plays same-opponent series on consecutive days, so a
±1-day fallback can silently attach a pick to the *wrong game of the same
series* and then grade it as won/lost against a real but incorrect score.
That is a worse outcome than not grading: it corrupts capper accuracy with
confident-but-false results, and `score_frozen` makes it sticky.

**Option B — Re-derive from raw message text only where unambiguous.**
Lowest risk, honest provenance. `raw_message` is populated on these rows, so
a date-token regex is feasible. But the same regex would have to beat the LLM
that already failed, and it recovers only rows whose message carried an
explicit date — most Telegram slate posts say "tonight", not "7/23". Expected
yield is materially below 148 and cannot be estimated without a parse pass.

**Option C — Mark `unsupported = true`, `unsupported_reason = 'stale_game_date'`,
exclude from grading and accuracy.**
Touches all 293. Recovers zero picks. Costs nothing, guesses nothing, and
makes the pending backlog honest: today those 293 sit in "pending" forever
and inflate the apparent gradeable backlog. Non-destructive and reversible
(a flag, not a delete) — fully compliant with the no-destructive-migration
rule. The 143 non-MLB/non-matchable rows (Tennis 32, KBO 5, NBA 2, CFL 1, and
the 98 MLB rows with no candidate game) have no other possible disposition.

## 5. Recommendation

**Recommended: Option C now, with an explicit Option A follow-up gated on a
same-day uniqueness test.**

Rationale: the primary consumer of these rows is capper accuracy weighting.
A wrong-game grade is strictly more harmful there than an ungraded pick,
because weights feed dispatch. Option C makes the 293 honest immediately and
costs nothing. If the owner wants the 148 MLB rows back, the safe version of
Option A is: re-point **only** where `yfix == created_at::date` **and** exactly
**one** `sbo_games` row matches that team on that date (no series ambiguity).
That subset must be counted before execution; it is a strict subset of 148 and
is not yet measured — **UNKNOWN** until the owner approves running the count.

Exact counts by option:

- Option A: 293 touched, ~150 repaired, ~143 still unrepairable → still need C.
- Option B: 293 scanned, unknown repaired, remainder still need C.
- Option C: 293 flagged, 0 repaired, backlog immediately honest.

**Nothing was executed. Awaiting owner decision.**
