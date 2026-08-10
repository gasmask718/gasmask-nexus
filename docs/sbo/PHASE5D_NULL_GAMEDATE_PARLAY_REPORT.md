# PHASE 5-D — NULL `game_date` Parlay Group (capper f67d2875)

**Status: INVESTIGATED. NO ROWS MODIFIED.**
Date: 2026-08-10. Scope: `public.sbo_capper_picks`, capper
`f67d2875-4eba-4457-b182-fcbdf1335b69`, `sport='MLB'`, `bet_type='parlay'`,
`game_date IS NULL`.

**Headline finding: the 3 rows are NOT duplicates of one another.** They are
three *distinct* bets that collide only on the natural-key tuple because every
discriminating column is NULL. Applying
`unsupported_reason='duplicate_of_repointed'` would have been factually wrong
and would have suppressed two legitimate, distinct picks. Per the owner's own
condition ("pending your confirmation from the data"), the flagging step was
**not executed**. Nothing was written this phase.

---

## ITEM 1 — Enumeration and comparison

### SQL used

```sql
SELECT indexdef FROM pg_indexes
WHERE tablename='sbo_capper_picks'
  AND indexname='idx_sbo_capper_picks_natural_key';

SELECT id, capper_id, sport, team, game_date, player_name, bet_type, direction,
       odds, stake, pnl_units, pick_text, raw_message, created_at, result,
       unsupported, unsupported_reason, matched_prop_id
FROM public.sbo_capper_picks
WHERE game_date IS NULL
  AND bet_type = 'parlay'
  AND capper_id = 'f67d2875-4eba-4457-b182-fcbdf1335b69'
ORDER BY created_at;
```

Note: `sbo_capper_picks` has **no `updated_at` column** (the brief asked for
it). Verified: `ERROR 42703: column "updated_at" does not exist`. Last-modified
time is therefore **UNKNOWN** for these rows — the table carries `created_at`
only.

### Why they collide

```
CREATE UNIQUE INDEX idx_sbo_capper_picks_natural_key
  ON public.sbo_capper_picks
  (capper_id, sport, game_date, COALESCE(team,''), COALESCE(player_name,''),
   bet_type, COALESCE(direction,''));
```

`team`, `player_name` and `direction` are COALESCE-guarded, but `game_date` is
**not**. For all three rows the tuple is
`(f67d2875…, 'MLB', NULL, '', '', 'parlay', '')`. Postgres treats NULL as
distinct in a unique index, so the index never fires. `pick_text` and
`raw_message` — the only columns that actually differ — are not part of the key.

### The three rows

| # | id | created_at | stake | odds | result | unsupported | pick_text |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | `3f0d766c-5893-4dbe-8002-2534a324e95e` | 2026-07-31 02:43:54Z | 3 | NULL | pending | false | 3-leg KBO parlay: Samsung Lions -1.5, KT Wiz ML, SSG Landers ML |
| B | `457ebce4-9d20-4465-a2d9-96cf90e747fb` | 2026-08-08 17:52:29Z | 1.5 | NULL | pending | false | 5-leg parlay: Braves ML, Red Sox U9, White Sox ML, Padres ML, Giants ML |
| C | `1eaa707d-547c-454a-ba4b-824cd6c1eb6d` | 2026-08-08 20:01:25Z | NULL | NULL | pending | false | Braves O7.5 and Red Sox -1.5 |

All three: `team NULL`, `player_name NULL`, `direction NULL`, `pnl_units NULL`,
`matched_prop_id NULL`, `unsupported_reason NULL`.

### Raw messages

**A** (`3f0d766c`), posted 2026-07-31:
```
Wake N Cash 🔥💎‼️
#Kimspicks ✅️
KBO: ⚾️
Samsung Lions -1.5 (1U)
Kt wiz ml (1U)
SSG Landers ml (1U)
Let's sweep!
```

**B** (`457ebce4`), posted 2026-08-08 17:52:
```
#NickyCashin
Atlanta Braves ML (-134) 1.5U
Boston Red Sox Under 9 (-102) 1.5U
Chicago White Sox ML (+117) 1.5U
San Diego Padres ML (-115) 1.5U
San Francisco Giants ML (+105) 1.5U
```

**C** (`1eaa707d`), posted 2026-08-08 20:01:
```
Tony 🐳
Braves O7.5
Red Sox -1.5
```

### Same bet or distinct bets?

**Distinct — unambiguously.**

- **A vs B/C:** A is a *Korean* KBO parlay (Samsung Lions / KT Wiz / SSG
  Landers) mislabeled `sport='MLB'`, posted 8 days earlier. Zero overlap.
- **B vs C:** both posted 2026-08-08 and both touch Braves and Red Sox, but the
  *markets are different bets*: B is Braves **ML** + Red Sox **Under 9**; C is
  Braves **Over 7.5** + Red Sox **-1.5** (spread). Different leg count (5 vs 2),
  different sub-capper attribution in the raw text (`#NickyCashin` vs `Tony 🐳`),
  different stake (1.5U vs NULL). A re-post of the same slip would carry the
  same legs and the same handle. These are two separate cappers' slips relayed
  into the same aggregator channel.

### Best representative / redundant copies

**None are redundant, so there is no "representative" to elect.** All three are
independent picks. Ranked by data quality if one ever had to be chosen:

1. **B** — 5 legs, every leg carries an explicit price and unit size; the most
   parseable and the only row with per-leg odds in the text.
2. **C** — 2 legs, complete but unpriced.
3. **A** — legs complete but the row's `sport` is wrong (KBO recorded as MLB),
   making it a data-quality defect independent of this phase.

### Are the legs reconstructible? Is there a date-parse bug?

- **Legs: yes, all three.** Every leg (team + market + line, and for B the
  price) is present verbatim in `raw_message`. Nothing was lost at ingest on the
  leg dimension.
- **Dates: no date token exists in any of the three messages.** None of the
  three slips says "8/8", "tonight", or any date at all — this is normal for
  Telegram slate posts. So `game_date IS NULL` is **not** a token-parse failure
  (unlike the Phase 4 wrong-year hallucinations, which *did* have tokens). It is
  a **missing-default** bug: the extractor has no fallback when the message
  carries no date, and writes NULL instead of inferring the post date.
- Both 2026-08-08 rows were posted in the evening ET slate window and their legs
  (Braves, Red Sox, White Sox, Padres, Giants) are all plausible 2026-08-08 MLB
  games — i.e. `created_at::date` is a defensible inference, exactly the rule
  Phase 5-A/5-B validated. **Not applied this phase** (out of scope, and parlays
  are multi-game so a single `game_date` is only meaningful as a slate date).

**Regression risk (Item 1):** none. Read-only.
**Rollback (Item 1):** none required — nothing written.

---

## ITEM 2 — Flagging: NOT EXECUTED

The owner-approved UPDATE was conditional on the data confirming duplication.
It does not. Executing it would have set `unsupported=true` on two legitimate,
fully-parseable MLB parlays (B and C) and permanently removed them from the
gradeable pool under a reason string (`duplicate_of_repointed`) that is a lie
about their provenance. Under the "no silent corruption / ledger truth" rule
that is a worse outcome than leaving them pending.

**Rows updated: 0. Rows deleted: 0. Rows merged: 0.**
All three remain `result='pending'`, `unsupported=false`,
`unsupported_reason=NULL`.

### What I recommend instead (needs a fresh decision — NOT executed)

Three options, none applied:

- **Option 1 — infer the slate date.** `game_date = created_at::date` for B and
  C (2026-08-08). Reuses the Phase 5-B convention. Makes them gradeable only if
  a parlay grader exists — it does not today (`sbo-result-tracker` grades
  single-leg markets; parlay legs are not decomposed). So this alone does not
  yield grades.
- **Option 2 — flag honestly.** `unsupported=true`,
  `unsupported_reason='parlay_missing_game_date'` (a *new*, accurate reason
  string — not `duplicate_of_repointed`). Makes the pending backlog honest, zero
  false provenance, fully reversible. This is what I would pick.
- **Option 3 — fix A's sport separately.** A is a KBO parlay stored as MLB;
  it belongs with the Phase 3 mislabeled-sport class
  (`no_grading_provider:KBO`), not with any duplicate class.

If the owner confirms Option 2, the statement would be:

```sql
-- NOT RUN in Phase 5-D
UPDATE public.sbo_capper_picks
SET unsupported = true, unsupported_reason = 'parlay_missing_game_date'
WHERE id IN ('3f0d766c-5893-4dbe-8002-2534a324e95e',
             '457ebce4-9d20-4465-a2d9-96cf90e747fb',
             '1eaa707d-547c-454a-ba4b-824cd6c1eb6d')
  AND result = 'pending';
```

---

## ITEM 3 — Verification and integrity checks

### 3.1 Resolution state of the 3 rows

All 3 remain active/pending, 0 flagged — see Item 2 for why. The group is
*resolved as "not a duplicate group"*, not resolved by flagging.

### 3.2 Re-run of the scan — is the group exactly 3?

```sql
SELECT count(*) FROM sbo_capper_picks
WHERE capper_id='f67d2875-4eba-4457-b182-fcbdf1335b69'
  AND sport='MLB' AND bet_type='parlay' AND game_date IS NULL;
-- 3   (unchanged, before == after)
```

Confirmed: exactly 3, no others for this capper/sport/bet_type.

**Wider finding — the NULL-`game_date` population is larger than 3.** Full scan:

```sql
SELECT sport, bet_type, unsupported, unsupported_reason, count(*)
FROM sbo_capper_picks WHERE game_date IS NULL
GROUP BY 1,2,3,4 ORDER BY 5 DESC;
```

| sport | bet_type | unsupported | reason | rows |
| --- | --- | --- | --- | --- |
| MLB | parlay | false | — | **5** |
| Soccer | parlay | true | no_grading_provider:Soccer | 3 |
| Soccer | total | true | no_grading_provider:Soccer | 3 |
| MLB | total | false | — | 1 |
| MLB | moneyline | false | — | 1 |
| MLB | f5_total | true | no_grader_for_bet_type:f5_total | 1 |
| NBA | spread | false | — | 1 |
| WNBA | total | false | — | 1 |
| Rugby | spread | true | no_grading_provider:Rugby | 1 |
| UNKNOWN | parlay | true | malformed_ingest:sport_unresolvable | 1 |
| Soccer | spread / other / team_total | true | no_grading_provider:Soccer | 3 |
| **TOTAL** | | | | **21** |

Of the 21, **9 are still `unsupported=false` and pending with no date** (5 MLB
parlay — 3 of which are our group, plus 2 from other cappers — 1 MLB total,
1 MLB moneyline, 1 NBA spread, 1 WNBA total). The other 12 are already excluded
for unrelated reasons. This 9-row set is an open backlog item, not addressed
this phase.

### 3.3 Natural-key index intact / no new duplicates

```sql
SELECT indexdef FROM pg_indexes
WHERE tablename='sbo_capper_picks' AND indexname='idx_sbo_capper_picks_natural_key';
```
Present and unchanged (definition quoted in Item 1). No rows were inserted or
updated this phase, so no new duplicates are possible.

**Structural note (report only, not fixed):** the index cannot dedupe any row
with `game_date IS NULL`. Wrapping it as `COALESCE(game_date,'1900-01-01')` —
consistent with how `team`/`player_name`/`direction` are already handled —
would close the hole. That is a schema migration and is **out of scope** for a
data-only phase; also note it would then *reject* legitimately-distinct
undated parlays like B and C, so it should only ship together with a
game_date-inference rule at intake.

### 3.4 Result vocabulary

```sql
SELECT count(*) FROM sbo_capper_picks
WHERE result NOT IN ('won','lost','push','pending');
-- 0
```
No `'win'` / `'loss'` values anywhere. Clean.

### 3.5 Phase 5-C ledger — unchanged

| reason | Phase 5-C | Phase 5-D now | delta |
| --- | --- | --- | --- |
| `stale_game_date` | 160 | **160** | 0 |
| `prop_missing_player` | 69 | **69** | 0 |
| `duplicate_of_repointed` | 9 | **9** | 0 |
| `sbo_capper_picks_repoint_backup` rows | 83 | **83** | 0 |

74 re-pointed rows intact (83 backup rows = 74 re-pointed + 9 collisions).
**No new total to report — this phase added zero flags.**

### 3.6 Intake guidance for NULL-`game_date` picks (report only)

1. **Default, don't NULL.** When no date token is present, the extractor should
   set `game_date = <telegram post date in ET>` and record
   `game_date_source='inferred_post_date'` (new column) rather than writing
   NULL. Every one of the 21 NULL rows is a post-date-inferable slate pick.
2. **Parlays need a slate date, not a game date.** A multi-game parlay has no
   single `game_date`; the correct model is a slate date plus per-leg rows. Until
   legs are decomposed, parlays should be marked
   `unsupported_reason='no_grader_for_bet_type:parlay'` at intake, the same way
   `f5_total` and `team_total` already are (Phase 4 convention). That alone
   would have prevented all 5 undated MLB parlays from sitting pending forever.
3. **Guard the natural key.** Until `game_date` is never NULL, intake should
   apply a secondary content dedupe on `hash(capper_id, raw_message)` — that
   check would correctly have found these three rows *distinct*.

No intake code was changed this phase, per instruction.

---

## ITEM 4 — Rollback SQL

**No rollback is required: zero rows were written in Phase 5-D.** The table is
byte-identical to its post-Phase-5-C state.

Provided for completeness — *if* the owner later approves the Option 2 flagging
in Item 2, this reverses it exactly:

```sql
UPDATE public.sbo_capper_picks
SET unsupported = false, unsupported_reason = NULL
WHERE id IN ('3f0d766c-5893-4dbe-8002-2534a324e95e',
             '457ebce4-9d20-4465-a2d9-96cf90e747fb',
             '1eaa707d-547c-454a-ba4b-824cd6c1eb6d')
  AND unsupported_reason = 'parlay_missing_game_date';
```

Pre-5-D state of the three rows, for hand-restoration if ever needed:
`result='pending'`, `unsupported=false`, `unsupported_reason=NULL`,
`game_date=NULL` on all three.

---

## REGRESSION CHECK

| Check | Result |
| --- | --- |
| `npx tsgo --noEmit` | **Clean**, exit 0, no diagnostics |
| Files changed under `src/` or `supabase/functions/` | **None.** `git status --porcelain` returned empty before this report was written; the only new file is this markdown doc under `docs/sbo/`. No edge function deployed, no cron re-run. |
| Live Odds API calls | **None.** No function invoked. |
| Live Anthropic calls | **None.** No function invoked. |
| `result` vocabulary won/lost/push/pending | **Intact** — 0 rows outside the four values |
| `trg_sbo_capper_picks_validate` | **Exists, `tgenabled='O'`** (verified via `pg_trigger`), untouched |
| `_shared/teamMatcher.ts`, `statNormalize.ts`, `perPickScore.ts` | Untouched |
| Rows inserted / updated / deleted | **0 / 0 / 0** |

### Unable to complete / UNKNOWN

- **ITEM 2 flagging: deliberately not executed.** The data contradicts the
  premise. Needs a fresh owner decision (Option 1/2/3 in Item 2).
- **`updated_at` for the 3 rows: UNKNOWN.** The column does not exist on
  `sbo_capper_picks`; there is no last-modified audit on this table.
- **Whether B and C were ever settled off-platform: UNKNOWN.** `pnl_units` and
  `odds` are NULL and no external settlement source was consulted (no live API
  calls permitted).
- **Whether the 2 undated MLB parlays from *other* cappers are duplicates:**
  not investigated — outside the approved scope of this capper's group.
