# PHASE 5-E — NULL `game_date` Disposition (EXECUTED)

Date: 2026-08-10. Table: `public.sbo_capper_picks`. Data-only phase — no code, no deploys,
no live Odds API / Anthropic calls. 9 rows updated, 0 deleted, 0 merged.

---

## ITEM 1 — Known three (owner-approved)

### 1a. Row A — `3f0d766c` KBO parlay mislabeled MLB

Collision pre-check (relabel re-keys the natural-key tuple):

```sql
SELECT id,sport,game_date,bet_type,coalesce(team,''),coalesce(player_name,''),coalesce(direction,'')
FROM sbo_capper_picks
WHERE capper_id='f67d2875-4eba-4457-b182-fcbdf1335b69' AND sport='KBO';
```

6 existing KBO rows, all with non-NULL `game_date` (2026-07-25 / 2026-07-31) and non-empty `team`.
The new tuple `(f67d2875, KBO, NULL, '', '', parlay, '')` matches none → no collision. Confirmed
post-update: the UPDATE succeeded, so `idx_sbo_capper_picks_natural_key` was satisfied.

```sql
UPDATE public.sbo_capper_picks
SET sport='KBO', unsupported=true, unsupported_reason='no_grading_provider:KBO'
WHERE id='3f0d766c-5893-4dbe-8002-2534a324e95e';
```

Before: `sport=MLB, unsupported=false, unsupported_reason=NULL`.
After: `sport=KBO, bet_type=parlay, game_date=NULL, result=pending, unsupported=true,
unsupported_reason='no_grading_provider:KBO'`. `raw_message` preserved (3-leg KBO slate intact).

### 1b. Rows B (`457ebce4`) and C (`1eaa707d`)

```sql
UPDATE public.sbo_capper_picks
SET unsupported=true, unsupported_reason='no_grader_for_bet_type:parlay'
WHERE id IN ('457ebce4-9d20-4465-a2d9-96cf90e747fb','1eaa707d-547c-454a-ba4b-824cd6c1eb6d');
```

After: both `pending`, `unsupported=true`, reason as above, `raw_message` non-NULL (leg data
retained — excluded from grading, not lost).

Regression risk: LOW. Flag-only; `result`, `game_date`, `pnl_units`, `stake` untouched. Effect is
that these rows leave the gradeable-pending backlog, which is the intended honest state.

### 1c. Rollback — see ITEM 5.

---

## ITEM 2 — The other 6 NULL-date pending rows

Enumerated via:

```sql
SELECT id, capper_id, sport, bet_type, team, pick_text, raw_message, created_at, result
FROM sbo_capper_picks
WHERE game_date IS NULL AND unsupported=false AND result='pending' ORDER BY created_at;
```

Duplicate test (a): grouped all 9 NULL-date pending rows by `raw_message` + `capper_id` — **all 9
raw_messages are distinct, and no dated twin shares any of them**. No duplicates. Nothing was
flagged `duplicate_of_repointed` (count stays 9, from Phase 5-C).

`sbo_games` coverage by sport (relevant to (c)):

| sport key | min | max |
| --- | --- | --- |
| baseball_mlb | 2026-07-21 | 2026-08-09 |
| basketball_wnba | 2026-08-01 | 2026-08-09 |
| NBA / basketball_nba | 2026-03-22 | 2026-06-19 |

### Per-row disposition table

| id | capper | sport / bet_type | pick | class | disposition |
| --- | --- | --- | --- | --- | --- |
| `7fda9571` | e8c21c57 | NBA / spread | Lakers -4.5, ingested 2026-07-14 | (b) mislabel | NBA season ended 2026-06-19; zero Lakers games on 07-14 → Summer League. Flagged with the existing precedent reason (5 prior rows) |
| `9db6b5b4` | f67d2875 | MLB / moneyline | Cubs ML, ingested 2026-07-18 | (c) attempted, FAILED | `sbo_games` MLB coverage starts 2026-07-21; zero Cubs candidates on 07-18 → inference NOT defensible, flagged honestly |
| `5dd61b5a` | be4ec021 | MLB / parlay | 4-leg prop mix (#MatthewP07) | (d) parlay | `no_grader_for_bet_type:parlay` |
| `ca79adf8` | d1c70b41 | MLB / parlay | Rockies U11.5 + Rockies ML (#Travy) | (d) parlay | `no_grader_for_bet_type:parlay` |
| `7efae9de` | f67d2875 | WNBA / total | Aces v Fever Under 195.5, ingested 2026-08-06 | (c) inferable | exactly one game: Indiana Fever vs Las Vegas Aces 2026-08-06 → `game_date` set, stays gradeable |
| `a5a4981a` | f67d2875 | MLB / total | Padres/Dbacks OVER 9 -105, ingested 2026-08-07 | (c) inferable | exactly one game: Arizona Diamondbacks vs San Diego Padres 2026-08-07 → `game_date` set, stays gradeable |

---

## ITEM 3 — Applied dispositions

1. **Duplicates:** none found → nothing flagged. (Rule respected: "if in doubt, do not flag.")
2. **Mislabeled sport:**

```sql
UPDATE public.sbo_capper_picks
SET unsupported=true,
    unsupported_reason='mislabeled_sport:NBA_SUMMER_LEAGUE — July-dated NBA franchise pick; Summer League games are absent from the ESPN NBA scoreboard'
WHERE id='7fda9571-8894-49c9-8ce8-8343ec42fa13';
```

Reused the byte-identical reason string already carried by 5 Phase-3 rows (`sport` left as `NBA`,
matching that precedent) rather than inventing a variant.

3. **Date inference:**

```sql
UPDATE public.sbo_capper_picks
SET game_date=DATE '2026-08-06', game_id='9a71f5e9-5ae9-4157-b5ad-3e5b5dd9fcbd'
WHERE id='7efae9de-751e-4439-938f-d88bb24c7b4f';

UPDATE public.sbo_capper_picks
SET game_date=DATE '2026-08-07', game_id='bfee7b84-6cea-4dd9-898f-d24292c73e7c'
WHERE id='a5a4981a-ea12-48c2-a6fa-e3b51f01f5e3';
```

Both kept `unsupported=false`, `unsupported_reason=NULL`, `result='pending'`. Natural-key
pre-check returned 0 rows for capper f67d2875 at `(WNBA, 2026-08-06)` and `(MLB, 2026-08-07)` →
no collision. `game_id` was additionally pinned because both rows have `team IS NULL` (the teams
live only in `raw_message`), so a date alone would not let the matcher find the game.

Negative case, flagged instead of guessed:

```sql
UPDATE public.sbo_capper_picks
SET unsupported=true,
    unsupported_reason='no_game_found:pre_coverage_window — game_date could not be inferred; sbo_games MLB coverage begins 2026-07-21 and this pick was ingested 2026-07-18'
WHERE id='9db6b5b4-0af0-49a7-b7ae-ceab34df5e60';
```

4. **Parlays** (B, C + the two other-capper parlays):

```sql
UPDATE public.sbo_capper_picks
SET unsupported=true, unsupported_reason='no_grader_for_bet_type:parlay'
WHERE id IN ('457ebce4-9d20-4465-a2d9-96cf90e747fb','1eaa707d-547c-454a-ba4b-824cd6c1eb6d',
             '5dd61b5a-4178-40f3-83cb-7b3c602decc6','ca79adf8-91e9-4bd1-89ba-d24524eaad29');
```

5. **Updated ledger** (live counts):

| reason | count |
| --- | --- |
| `stale_game_date` | 160 (unchanged) |
| `prop_missing_player` | 69 (unchanged) |
| `duplicate_of_repointed` | 9 (unchanged) |
| `no_grader_for_bet_type:parlay` | **4 (new)** |
| `no_grading_provider:KBO` | **1 (new)** |
| `mislabeled_sport:NBA_SUMMER_LEAGUE …` | 5 → **6** |
| `no_game_found:pre_coverage_window …` | **1 (new)** |
| re-pointed rows still dated + gradeable | 74 (unchanged) |
| `sbo_capper_picks_repoint_backup` | 83 (unchanged) |

Note: the pre-existing 55-row MLB parlay bucket referenced in the brief is not a single
`unsupported_reason` string in the live table — the closest existing bucket is the 28-row
long-form "Multi-leg parlay: legs are not stored individually…" reason from the 2026-07-27
quarantine. Those 28 were NOT rewritten (no destructive/mass rewrite this phase); the new
`no_grader_for_bet_type:parlay` short-form matches the `no_grader_for_bet_type:f5_total` /
`team_total` convention the owner cited. Reconciling the two parlay vocabularies is left as a
future hygiene item.

---

## ITEM 4 — Verify + final scan

```sql
SELECT count(*) FROM sbo_capper_picks WHERE game_date IS NULL AND unsupported=false AND result='pending';
-- 0
```

**0 remaining.** Total NULL-`game_date` rows: 19 (was 21 — the two inferred rows now carry dates);
all 19 are `unsupported=true` with an explicit reason.

- Natural-key index `idx_sbo_capper_picks_natural_key` intact and unchanged; every UPDATE passed it,
  so no duplicate tuple was introduced. Row A's relabel caused no collision (verified before and
  implicitly enforced by the index on write).
- `SELECT count(*) … WHERE result NOT IN ('won','lost','push','pending')` → **0**. No `win`/`loss`.
- Prior-ledger rows untouched: 160 / 69 / 9 / 83 backup rows / 74 re-pointed still dated and
  `unsupported=false`.

---

## ITEM 5 — Rollback SQL

```sql
-- 1a Row A
UPDATE public.sbo_capper_picks
SET sport='MLB', unsupported=false, unsupported_reason=NULL
WHERE id='3f0d766c-5893-4dbe-8002-2534a324e95e';

-- 1b + Item 3.4 parlays
UPDATE public.sbo_capper_picks
SET unsupported=false, unsupported_reason=NULL
WHERE id IN ('457ebce4-9d20-4465-a2d9-96cf90e747fb','1eaa707d-547c-454a-ba4b-824cd6c1eb6d',
             '5dd61b5a-4178-40f3-83cb-7b3c602decc6','ca79adf8-91e9-4bd1-89ba-d24524eaad29');

-- NBA Summer League
UPDATE public.sbo_capper_picks
SET unsupported=false, unsupported_reason=NULL
WHERE id='7fda9571-8894-49c9-8ce8-8343ec42fa13';

-- Cubs ML pre-coverage flag
UPDATE public.sbo_capper_picks
SET unsupported=false, unsupported_reason=NULL
WHERE id='9db6b5b4-0af0-49a7-b7ae-ceab34df5e60';

-- Date-inferred rows
UPDATE public.sbo_capper_picks SET game_date=NULL, game_id=NULL
WHERE id IN ('7efae9de-751e-4439-938f-d88bb24c7b4f','a5a4981a-ea12-48c2-a6fa-e3b51f01f5e3');
```

All prior values were `NULL` / `false` / `sport='MLB'` as shown in the ITEM 2 enumeration, so this
rollback is exact.

---

## REGRESSION CHECK

1. `npx tsgo --noEmit` → **clean** (no output, exit 0).
2. `git status --porcelain` → **empty before this report file**. No `.ts` changed under `src/` or
   `supabase/functions/`. No deploys, no cron re-runs needed.
3. **No live Odds API and no Anthropic calls** were made. All work was `psql` reads plus one
   data-only write batch.
4. `trg_sbo_capper_picks_validate` exists, `tgenabled='O'` (verified before and after).
5. `result` vocabulary untouched — all 9 rows remain `pending`; 0 rows outside
   `won/lost/push/pending` table-wide.

### Unable to complete / UNKNOWN

- **UNKNOWN:** whether `7efae9de` (WNBA) and `a5a4981a` (MLB) will actually grade — both have
  `team IS NULL`, so grading depends on the grader honouring `game_id`. Not exercised this phase
  (no cron runs). If the grader keys on `team`, these two will need a team backfill from
  `raw_message` in a later phase.
- **NOT DONE (deliberate):** the extractor's missing-default bug (writes NULL instead of inferring
  the post date) is code, and this is a data-only phase. Still open.
- **NOT DONE (deliberate):** the natural-key index does not `COALESCE`-guard `game_date`, so NULL
  dates still bypass the uniqueness constraint. Fixing it is a migration and was not authorised here.
