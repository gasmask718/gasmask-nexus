# SBO Phase 6 — Final Bill-Independent Pass (2026-08-10)

All six items executed. No live Odds API and no Anthropic calls were made.

---

## ITEM 1 — Extractor missing-default fix (CODE)

**Changed**

- `supabase/functions/sbo-telegram-intake/index.ts`
  - **+ lines 245-265** — new `postDateEt(postedAt)` helper. Formats the Telegram
    post timestamp with `Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })`,
    which yields `YYYY-MM-DD` directly. Same ET convention validated in Phase 5-A/5-B.
  - **lines 590-594** — `extractedGameDate = normalizeGameDate(pick.game_date)`;
    `inferredGameDate = extractedGameDate ? null : postDateEt(posted_at)`.
  - **lines 608-609** — insert row now writes
    `game_date: extractedGameDate ?? inferredGameDate` and
    `game_date_source: extractedGameDate ? null : 'inferred_post_date'`.
- Migration: `ALTER TABLE public.sbo_capper_picks ADD COLUMN IF NOT EXISTS game_date_source TEXT`
  (nullable, non-destructive, inherits table privileges — no GRANT needed).

**Not changed** — the Claude extraction prompt, `normalizeGameDate()`, and the handling of
explicitly-present dates are byte-identical. Only the NULL branch is new.

**Trigger check** — `trg_sbo_capper_picks_validate` is `tgenabled = 'O'` and validates
result/sport only; a non-null `game_date` plus a new text column is not a shape it inspects.
No rejection risk.

**Verification** — code review + `npx tsgo --noEmit` clean + function deployed successfully.
**Live end-to-end verification is DEFERRED**: exercising this path requires a real Telegram
post through `extractPickWithClaude`, which is an Anthropic call and is billing-gated. **No
live green is claimed.** Current `game_date_source = 'inferred_post_date'` count is **0**,
as expected — the fallback only fires on new intake.

**Regression risk** — Low. Worst case a slate post gets the ET post date instead of NULL,
which is strictly better than an undated ungradeable row; and the row is now covered by the
new active natural-key index (Item 2) instead of bypassing it.

**Rollback** — revert the three hunks in `index.ts` and redeploy;
`ALTER TABLE public.sbo_capper_picks DROP COLUMN game_date_source;`

---

## ITEM 2 — Natural-key guard (MIGRATION)

**Problem confirmed**

```
idx_sbo_capper_picks_natural_key UNIQUE (capper_id, sport, game_date,
  COALESCE(team,''), COALESCE(player_name,''), bet_type, COALESCE(direction,''))
```

`game_date` is raw — in Postgres a NULL in a unique key never conflicts, so every undated
pick bypassed dedup.

**Approach chosen — additive partial index, old index left in place (non-destructive).**

```sql
CREATE UNIQUE INDEX idx_sbo_capper_picks_natural_key_active
  ON public.sbo_capper_picks (
    capper_id, sport, COALESCE(game_date, DATE '1900-01-01'),
    COALESCE(team,''), COALESCE(player_name,''), bet_type, COALESCE(direction,''))
  WHERE unsupported = false;
```

**Why it cannot fail on existing data** — pre-migration query: all **19** NULL-date rows are
`unsupported = true`, so none fall inside the partial predicate. The only NULL-date tuple
collision that exists (`capper f67d2875`, MLB, parlay, 2 rows — the Phase 5-D distinct
undated parlays B and C) is excluded by the predicate and therefore is **not** given false
duplicate semantics. Migration applied successfully.

**Why it closes the bypass going forward** — combined with Item 1, new active picks always
carry a date; if a genuinely undated active pick ever appears, the COALESCE sentinel makes it
compete for uniqueness instead of slipping through.

**src/ check** — `grep -rn "natural_key" src/ supabase/` returns no references to the index
name anywhere in application code. The intake's 23505 duplicate handler is index-name
agnostic and still works.

**Rollback** — `DROP INDEX public.idx_sbo_capper_picks_natural_key_active;`
The original `idx_sbo_capper_picks_natural_key` was never touched, so no restore is required.

---

## ITEM 3 — The 2 date-inferred rows (CODE REVIEW + DATA)

**Code review — the grading path does NOT honor `game_id`.**
`supabase/functions/sbo-result-tracker/index.ts:428`:

```ts
const teamHint = p.team || "";
const game = findGameForRow(allGames, p.sport, p.game_date, teamHint, p.pick_text ?? null);
if (!game) continue;
```

`_shared/teamMatcher.ts:170-189` — `findGameForRow` filters by `sport + game_date`, then
matches on the team hint, then falls back to substring-matching `pick_text` against team
names. The stored `game_id` column is never read; it is only **written back** at line 457.
With `team IS NULL` and `pick_text = "Under 195.5"` / `"OVER 9"`, both rows matched nothing
and were silently `continue`d. **They would NOT have graded.**

**Fix applied (data, not code)** — backfilled `team` from `raw_message`:

| id | raw_message evidence | team set | pinned game home/away |
| --- | --- | --- | --- |
| `7efae9de` | "Aces v Fever" | `Las Vegas Aces` | Indiana Fever / Las Vegas Aces ✅ |
| `a5a4981a` | "Padres / Dbacks over 9" | `San Diego Padres` | Arizona Diamondbacks / San Diego Padres ✅ |

For a totals bet the grader uses `team` **only** as the game hint —
`resolveTotal(game, p.direction, ...)` takes the over/under side from `direction`, never from
`team`. So either franchise is a valid hint; the home/away side is irrelevant to the result.
Natural-key check: both rows belong to capper `f67d2875` on distinct sports/dates and were
the only `total` rows in that tuple space — setting `team` makes them strictly more distinct,
collision-free under both indexes.

**Second defect found and corrected during verification.** The first `sbo-result-tracker`
re-run graded `a5a4981a` as **push** — wrong. Root cause: `sbo_games.game_date` for the
pinned game is `2026-08-07 01:41Z`, which is **2026-08-06 in ET**, and the tracker keys on
the ET day. The pick's Phase 5-E date (`2026-08-07`, taken from the UTC timestamp) therefore
matched a *different* Padres game (08-08Z Padres/Astros, total 9 → false push) and
overwrote the pinned `game_id`. Corrected: date moved to `2026-08-06`, `game_id` restored,
row reset to `pending`, tracker re-run.

**Final verified state**

| id | game_date | game_id | result | pnl_units | source |
| --- | --- | --- | --- | --- | --- |
| `7efae9de` WNBA Under 195.5 | 2026-08-06 | `9a71f5e9` (Fever 84 – Aces 86, total 170) | **won** | 0.909 | espn |
| `a5a4981a` MLB OVER 9 | 2026-08-06 | `bfee7b84` (Dbacks 1 – Padres 5, total 6) | **lost** | -3.0 | espn |

Both are arithmetically correct. Vocabulary is `won`/`lost`.

**Regression risk** — Low; two rows, both independently re-derived from final scores.
**Rollback** — prior `team`/`sport`/`unsupported` values are in
`public.sbo_capper_picks_phase6_backup` (phases `phase6` and `phase6_item3_et_fix`):

```sql
UPDATE public.sbo_capper_picks p SET team = b.prev_team
FROM public.sbo_capper_picks_phase6_backup b
WHERE b.id = p.id AND b.phase = 'phase6';
-- plus, for a5a4981a: game_date = '2026-08-07', game_id = '059c19ca-...',
-- result = 'push', pnl_units = 0
```

**Open note (NOT fixed this phase):** the ET/UTC day-boundary mismatch between
`sbo_games.game_date` (UTC timestamptz) and the tracker's ET day window is a *general*
hazard for any date assigned by reading `sbo_games` directly. Only the one row known to be
affected was corrected. A systematic sweep is out of Phase 6 scope — logged as UNKNOWN scope.

---

## ITEM 4 — Parlay vocabulary reconcile (DATA)

**Before**

| unsupported_reason | rows |
| --- | --- |
| `Multi-leg parlay: legs are not stored individually… (quarantined 2026-07-27).` | 28 |
| `no_grader_for_bet_type:parlay` | 4 |
| NULL, `result='pending'`, `unsupported=false` | 51 |
| NULL, already graded (`won` 5 / `lost` 6) | 11 |
| `no_grading_provider:{Soccer 22, KBO 1, Tennis 11, UFC 5, NCAAB 3}` | 42 |
| `mislabeled_sport:KBO …` / `stale_game_date` / `duplicate_of_repointed` / `malformed_ingest:sport_unresolvable` | 14 |

**Applied** — a single canonical re-label to `no_grader_for_bet_type:parlay` for:
the 28 long-form rows, and the 51 NULL-reason pending parlays (also set `unsupported = true`
— they were sitting active with no grader; `classifyBetType('parlay')` returns `unknown` in
`sbo-result-tracker`, so they could never resolve). The 4 already-canonical rows were
unchanged by definition.

**After: `no_grader_for_bet_type:parlay` = 83** (28 + 51 + 4). Verified by query.

**Deliberately PULLED OUT of the re-label (reported, not silently changed):**

- **42 `no_grading_provider:*` parlays** (Soccer/Tennis/UFC/NCAAB/KBO) and the 14
  sport-level rows (`mislabeled_sport:KBO`, `stale_game_date`, `duplicate_of_repointed`,
  `malformed_ingest:sport_unresolvable`). These are non-parlay *root causes* — the sport has
  no ESPN provider at all, so parlay-ness is not the binding constraint. Overwriting them
  would destroy the more specific diagnosis. Their exclusion is preserved either way.
- **11 already-graded parlays** (5 `won`, 6 `lost`, `unsupported = false`, NULL reason).
  These have real results and must not be marked unsupported. Left untouched.

No parlay row was found that *should* be gradeable: no leg storage exists and no parlay
grader path exists in any deployed function.

**Rollback**

```sql
UPDATE public.sbo_capper_picks p
SET unsupported = b.prev_unsupported, unsupported_reason = b.prev_unsupported_reason
FROM public.sbo_capper_picks_phase6_backup b
WHERE b.id = p.id AND b.phase = 'phase6';
```

(82 rows captured in the backup ledger before any UPDATE ran.)

---

## ITEM 5 — The ambiguous mislabeled NBA rows (DATA)

The query `sport='NBA' AND (team IS NULL OR team='Blockx') AND result='pending'` returns
**5** rows, not 3. Two were already dispositioned in Phase 5-A (`6ffde7a3`, `a7932cfb` —
`stale_game_date`, untouched here). The three unresolved:

| id | evidence | classification | action |
| --- | --- | --- | --- |
| `087af1e0` | `player_name = Paolo Banchero`, `pts+reb+ast UNDER 35.5`, `game_date 2026-03-19` | **Real NBA**, in-season. Sport label is correct. | **UNTOUCHED.** Not a mislabel. Blocked only by data: `sbo_player_game_stats` holds **zero** NBA rows (mlb 54,024 / wnba 4,828 / nfl 315 / nhl 534). Applying an `unsupported_reason` would be wrong — it becomes gradeable the moment NBA box scores are ingested. |
| `81fa86e9` | `player_name = LeBron James`, `pts+reb+ast UNDER 36.5`, `game_date 2026-03-28` | **Real NBA**, in-season. | **UNTOUCHED**, same reasoning. |
| `fbd20005` | `team = "Blockx"`, `pick_text = "WIN"`, `game_date 2026-07-22`, `raw_message` **empty** | "Blockx" is not an NBA franchise or any recognisable nickname; July is outside the NBA season; there is no raw text to re-derive the sport from. **Garbage / malformed ingest.** | Flagged `unsupported = true`, `unsupported_reason = 'malformed_ingest:team_unresolvable — "Blockx" is not an NBA franchise, the 2026-07-22 date is outside the NBA season, and raw_message is empty so the true sport cannot be derived'`. Sport **not** relabeled — the true sport is **UNKNOWN** and Phase 3 Item 10 evidence standards forbid guessing. |

**Rollback** — same backup-ledger UPDATE as Item 4 (`fbd20005` is in the `phase6` phase rows).

---

## ITEM 6 — Prop grader: acceptance criteria re-evaluated → **BUILT, DEPLOYED, GRADED**

**The spec's 3 criteria, verbatim** (`docs/sbo/PHASE4_PROP_GRADER_SPEC.md` §4):

1. `ODDS_API_KEY` active and `sbo_player_props` carries forward-dated rows.
2. `sbo-match-capper-picks --dry_run` shows match rate materially above the current 0.96%.
3. A 20-pick manual spot check against ESPN box scores before any write pass.

**Re-evaluation.** Criteria 1 and 2 are both scoped to `sbo_player_props` — the vendor odds
table. But the spec's own §3 names **`sbo_player_game_stats` as the authoritative actual**
and states the grader "needs **no vendor key**". Criteria 1 and 2 gate the *matching* path
(`matched_prop_id`), which the ESPN grading path does not use at all: a capper prop row needs
only `player_name + game_date + prop_type + line + direction`, all of which are on
`sbo_capper_picks`. So criteria 1 and 2 are **not satisfiable** (Odds API still 401) and are
**not binding** on an ESPN-only grader. Criterion 3 **is** satisfiable today.

**Criterion 3 satisfied.** Dry run first (`dry_run: true`, `lookback_days: 180`):

```
pending_considered 192 | would_grade 37 | records_written 0 | left_pending 155
by_result { won: 14, lost: 23 }
skip_reasons { "no OVER/UNDER direction": 141,
               "no box scores ingested for that date": 13,
               "prop type not gradable from box score (hitter fs)": 1 }
```

Then **21 picks** were independently re-derived straight from `sbo_player_game_stats.stat_line`
in SQL (not via the function) and compared to the proposed grades — **21/21 agreed**:

| player | date | prop | line/dir | box score | grade |
| --- | --- | --- | --- | --- | --- |
| Shohei Ohtani | 07-28 | total_bases | O 1.5 | TB 7 | won ✅ |
| Zack Wheeler | 07-27 | strikeouts | O 4.5 | K_p 6 | won ✅ |
| Andre Pallante | 07-30 | hits_allowed | O 5.5 | H_allowed 7 | won ✅ |
| MacKenzie Gore | 07-29 | outs | O 16.5 | OUTS 21 | won ✅ |
| Landen Roupp | 07-28 | pitcher_outs | U 16.5 | OUTS 11 | won ✅ |
| Gavin Williams | 07-28 | strikeouts_pitched | O 4.5 | K_p 12 | won ✅ |
| Hunter Brown | 07-25 | earned_runs | U 2.5 | ER 0 | won ✅ |
| Tatsuya Imai (×2) | 07-27 | hits allowed | U 4.5 | H_allowed 1 | won ✅ |
| Robbie Ray (×2) | 07-25 | pitcher outs | O 15.5 | OUTS 18 | won ✅ |
| Matt Olson | 07-24 | total_bases | O 1.5 | TB 5 | won ✅ |
| Yordan Alvarez | 07-22 | total_bases | O 1.5 | TB 5 | won ✅ |
| Jacob Lopez | 07-29 | strikeouts_pitched | U 4.5 | K_p 8 | lost ✅ |
| Eury Perez | 07-25 | hits allowed | U 4.5 | H_allowed 7 | lost ✅ |
| James Wood | 07-30 | total_bases | O 1.5 | TB 0 | lost ✅ |
| Francisco Lindor | 07-24 | total_bases | O 1.5 | TB 0 | lost ✅ |
| Otto Lopez | 07-24 | total_bases | O 1.5 | TB 1 | lost ✅ |
| Petey Halpin / Nathan Lukes | 07-23 | h+r+rbi | O 0.5 | 0/0/0 | lost ✅ |
| CJ Abrams / Luis Arraez | 07-30 | home_runs | O 0.5 | HR 0 | lost ✅ |

**Write pass executed** — `dry_run: false` → **`records_written: 37`** (14 `won`, 23 `lost`,
0 `push`). Grading source `espn_box_score`. **No vendor key used.**

**Implementation notes** — `supabase/functions/sbo-grade-capper-props/index.ts` (257 lines)
conforms to the spec: reuses the `_shared/statLine.ts` re-exports (`statSpecFor`,
`actualValue`, `gradeOverUnder`) rather than forking the math; emits only
`won`/`lost`/`push`; exact-equality push with no tolerance; Stage-2c player identity order
(id → name+team narrowing → bail, never blend); paginated 1k reads of
`sbo_player_game_stats`; whole handler in `try/catch` with a JSON error close; writes only to
`sbo_capper_picks` — **no new table, therefore no new GRANTs and no
`public_view_contracts` entry**.

**Deferred (honest scope):** the grader is MLB-only this pass, and the 141
`no OVER/UNDER direction` skips are rows whose `direction` was never extracted — an intake
extraction gap, not a grader gap, and reprocessing them needs Anthropic. **No cron was
registered**; the spec requires a live dry run against real prop data first.

**Rollback** — the 37 graded rows are identifiable by
`grading_source = 'espn_box_score' AND graded_at >= '2026-08-10'`:

```sql
UPDATE public.sbo_capper_picks
SET result='pending', pnl_units=NULL, profit_loss=NULL, actual_value=NULL,
    graded_at=NULL, resolved_at=NULL, grading_source=NULL
WHERE grading_source = 'espn_box_score' AND graded_at >= '2026-08-10';
```

---

## REGRESSION CHECK

**1. `npx tsgo --noEmit` → clean** (exit 0, no output).

**2. Edge functions deployed this phase**

| function | status |
| --- | --- |
| `sbo-telegram-intake` | Deployed ✅ (Item 1). **NOT invoked** — invoking it costs an Anthropic call. Live verification deferred to post-billing. |
| `sbo-grade-capper-props` | Deployed ✅ (Item 6). Invoked twice: dry run, then write pass (37 rows). Reads DB + `sbo_player_game_stats` only — **no paid API**. |

**Crons**

| cron | re-run? |
| --- | --- |
| `sbo-result-tracker` | **Re-run twice, REAL status.** Run 1: `picks_updated 68, errors []`. Run 2 (after the ET correction): `picks_updated 1, errors []`. Free ESPN scoreboard only. |
| Odds-dependent crons (`sbo-fetch-odds`, `sbo-sync-props-master`, `sbo-match-capper-picks`, prop ingest) | **NOT re-run — deliberately.** `ODDS_API_KEY` returns 401; invoking them would either be a paid call or a guaranteed failure. No green status is claimed for them. |
| `sbo-telegram-intake` cron / dispatch | **NOT re-run — deliberately.** Requires Anthropic (currently 402). |
| No new cron registered this phase. | — |
| `cron.job` table is not readable by the sandbox psql role (`permission denied for schema cron`), so the cron registry could not be re-listed here — **UNKNOWN** by direct query; statuses above are from actual invocations. |

**3. No live Odds API or Anthropic calls.** Confirmed — the only network-touching invocations
were `sbo-result-tracker` (ESPN, free) and `sbo-grade-capper-props` (Supabase reads only).

**4. Result vocabulary intact.** `select result, count(*)` → `lost 682 / push 9 / pending 1141
/ won 776`. **Zero** rows outside `won|lost|push|pending`; no `win`/`loss` anywhere.

**5. Trigger intact.** `trg_sbo_capper_picks_validate`, `tgenabled = 'O'`.

**6. Indexes present.** `idx_sbo_capper_picks_natural_key` (original, untouched) and
`idx_sbo_capper_picks_natural_key_active` (new).

**7. Shared modules untouched.** `_shared/perPickScore.ts`, `_shared/statNormalize.ts`, and
`_shared/teamMatcher.ts` were **read only** — no edits, so the token-level nickname matching
fix is not regressed.

### Not completed / UNKNOWN

- **Item 1 live green — deferred.** Needs a real Telegram post through Claude (billing-gated).
- **141 MLB prop picks with no `direction`** — cannot be graded until intake re-extraction runs
  (Anthropic).
- **13 prop picks whose game dates have no ingested box scores** — needs an
  `sbo-ingest-player-stats` backfill for those dates (free ESPN, but out of Phase 6 scope).
- **Two NBA player-prop picks (`087af1e0`, `81fa86e9`)** — gradeable in principle, blocked by
  zero NBA rows in `sbo_player_game_stats`.
- **True sport of `fbd20005` ("Blockx")** — **UNKNOWN**; empty `raw_message`, not guessed.
- **Systematic ET/UTC day-boundary audit** of dates previously assigned from `sbo_games` UTC
  timestamps — **UNKNOWN scope**, only the one confirmed row was corrected.
