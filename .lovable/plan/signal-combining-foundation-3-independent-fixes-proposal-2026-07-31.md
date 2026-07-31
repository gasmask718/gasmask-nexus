# Signal Combining Foundation — 3 Independent Fixes (Proposal)

Read-only measurement is done. One of the three assumptions in the brief does not
survive contact with the data, and it is called out honestly below before anything
is built.

## Measured current state (real numbers, taken just now)

| Fact | Value |
|---|---|
| `sbo_capper_picks` rows | 4,047 (711 with `player_name`, 3,624 with `team`) |
| Picks with `matched_prop_id` | **2** |
| `props_master` rows | 13,310 — all labelled `sport = 'NBA'` |
| `sbo_player_props` rows | 13,473 — `nba` 12,579 (Mar 21–Apr 24), `mlb` 894 (Jul 30–31) |
| `sbo_signals` rows | **0** |
| Capper picks by sport | MLB 3,250, Tennis 284, WNBA 118, Soccer 101, UFC 88, NBA 88 |
| Picks with a name on a date that has props at all | 132 (Jul 30 + Jul 31) |

`props_master` is **not an independent table**. `sbo-sync-props-master` (cron
`30 13,23 * * *`) rebuilds it from `sbo_player_props` + `sbo_predictions` via
`upsert(onConflict: player_name,stat_type,line,platform,game_date)`.

## 1. Cron for `sbo-match-capper-picks`

Dependency order matters: a pick can only be *resolved* after the prop it is
matched to has been graded, and a capper can only be *graded* after their picks
are resolved. The function already runs match → resolve → grade in that order
inside a single `mode: 'full'` invocation, so one job is correct — separate
`grade`-only jobs would race the resolve step.

Existing upstream jobs:

```text
03:59  auto-verify-results     sbo-verify-results     (writes actual_value/verdict)
04:00  sbo-result-tracking     sbo-track-results
05:00 Sun  sbo-weight-optimizer-weekly
```

Proposed: **`sbo-match-capper-picks-daily`, `30 4 * * *`, body `{"mode":"full"}`** —
after grading lands at 03:59/04:00, before the Sunday weight optimizer at 05:00.
Added with `private.cron_post(...)`, matching every other SBO job.

## 2. `props_master` → `sbo_player_props`

**The premise needs correcting.** Swapping the table alone changes the match rate
by zero. Simulated against live data, candidate pairs on name + date (±1):

- `props_master`: 68 picks find a candidate
- `sbo_player_props`: 68 picks find a candidate — identical, because one is a
  mirror of the other

All 68 are then killed by the stat-type filter, not by the table choice:

```text
pick prop_type       prop prop_type      picks
pts+reb+ast          rebounds / points / assists / threes / pts_reb_ast ...  34/33/31/28/8
nrfi                 strikeouts_p        20
home_runs            hits / total_bases  4/4
strikeouts_pitched   strikeouts_p        1
```

So the fix has to be **two changes, not one**:

**2a. Point match + resolve at `sbo_player_props`.** Justified on correctness, not
match rate: `matched_prop_id` currently points at rows in a derived table that is
rebuilt twice a day on a composite key, so IDs are not a stable reference. Column
mapping changes with the table:

```diff
- .from('props_master')
- .select('id, player_name, stat_type, line, game_date, sport')
- .eq('game_date', d)
+ .from('sbo_player_props')
+ .select('id, player_name, prop_type, line, game_date, sport_key')
+ .eq('game_date', d)
```

`matchPick` reads `prop.stat_type` → becomes `prop.prop_type`.

The resolve block **must** move with it, or every newly matched pick becomes
unresolvable (its ID will not exist in `props_master`):

```diff
- const { data: props } = await supabase.from('props_master')
-   .select('id, actual_result, result, line').in('id', chunk);
+ const { data: props } = await supabase.from('sbo_player_props')
+   .select('id, actual_value, verdict, line').in('id', chunk);
```

with `prop.actual_result` → `prop.actual_value`, and the fallback
`prop.result === 'won' || 'W'` → `prop.verdict === 'hit'`.
Grading coverage is better on the source table: 12,674/13,473 rows have
`actual_value` vs 9,901/13,310 with `actual_result`.

**2b. Extend `STAT_MAP`** to the vocabulary actually present:
`pts+reb+ast → pts_reb_ast`, `pts+reb → pts_reb`, `pts+ast → pts_ast`,
`reb+ast → reb_ast`, `strikeouts_pitched → strikeouts_p`, `threes → threes`
(not `3-pointers`), `blocks → blocked shots`.

**Honest expected result:** matched rises from 2 to roughly **10–12** (10 pairs
clear name+date+stat, 3 also clear the ±1.0 line tolerance and auto-match at
`score >= 85`; the rest land in `needs_review`). The ceiling is low for one
reason only: 3,250 of the picks are MLB and there are just **two days** of MLB
props in the system. This fix makes the pipeline correct; it does not make it
well-fed. Prop coverage is a separate problem.

## 3. Game identity in `combineSignal`

Current match is `sport + game_date + bet_type` — on an MLB slate that is ~15
unrelated games treated as one, so every capper's total pick confirms or fades
every signal.

`sbo_signals` has `home_team`, `away_team`, `game`. `sbo_capper_picks` has `team`
and `opponent`. There is no shared `game_id`, so team identity is the only real
join available:

```diff
  const { data: picks, error: picksErr } = await supabase
    .from('sbo_capper_picks')
    .select('id, capper_id, sport, game_date, bet_type, direction, stake, team, opponent')
    .eq('sport', signal.sport)
    .eq('game_date', signal.game_date)
    .eq('bet_type', signal.pick_type);
  if (picksErr) throw picksErr;
+
+ // Game identity: a pick counts only if it is on the same matchup.
+ const sideKeys = [signal.home_team, signal.away_team]
+   .filter(Boolean).map(normalizeTeam);
+ const gamePicks = sideKeys.length === 0
+   ? []                                   // no identity on the signal → confirm nothing
+   : (picks ?? []).filter((p) => {
+       const t = normalizeTeam(p.team);
+       const o = normalizeTeam(p.opponent);
+       return (t && sideKeys.includes(t)) || (o && sideKeys.includes(o));
+     });
```

with `normalizeTeam` lowercasing, stripping punctuation and collapsing whitespace,
and the scoring loop iterating `gamePicks` instead of `picks`.

Deliberate choice: when a signal has no `home_team`/`away_team`, the result is an
**empty** confirming/fading set, not the old sport-wide set. Silent
over-confirmation is worse than no confirmation.

**Correctness at 0 rows.** `sbo_signals` is empty, so this cannot be proven by
running it — and it does not need to be. The change is a pure filter on an
in-memory array between two existing steps. It is verified by property, three
ways:

1. **Unit-level** — `normalizeTeam` + the filter predicate are pure functions;
   the fixture cases (pick on home team, pick on away team, pick on a third team,
   pick with null team, signal with null teams) are asserted directly, no DB.
2. **Subset guarantee** — `gamePicks ⊆ picks` always, so `combined_confidence`
   can only move toward `internal_confidence`. It cannot produce a value the old
   code could not; it can only decline to produce inflated ones.
3. **Replay** — run against a hand-inserted throwaway signal row plus its real
   same-date capper picks, assert `confirming_cappers` contains only same-matchup
   cappers, then delete the row. Zero production impact.

## 4. Moneyline

None of the three touches it. `sbo-run-predictions` is not opened, not imported,
and not referenced. No prediction row is written or read by any of these changes.
Fix 3 filters signals that already exist; it does not create them. The
moneyline-derivation decision stays fully open.

## Scope

- `supabase/functions/sbo-match-capper-picks/index.ts` — table swap, column
  remap in match + resolve, `STAT_MAP` additions
- `supabase/functions/sbo-signal-combiner/index.ts` — `normalizeTeam` + game
  identity filter
- One `cron.schedule` insert via the data tool (contains the project URL, so not
  a migration)

No schema changes. No new tables. No touched rows in `sbo_predictions`.
