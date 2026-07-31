# SBO Stage 2c — Player Context Integration (NOT YET BUILT)

Captured requirement following the player-name collision fix (2026-07-31).

## Player identity resolution (MANDATORY in 2c)

`sbo_player_game_stats` and `sbo_player_season_splits` are now keyed on
`player_key = coalesce(nullif(player_id,''), player_name)` — the ESPN athlete id
when available. Seven real MLB name collisions exist (Max Muncy, Jose Fermin,
Jose Suarez, Christian Arroyo, et al.), so **name lookups are not safe**.

`sbo-get-player-context` must resolve in this order:

1. **By `player_id`** when the prop/prediction carries an ESPN athlete id →
   match on `player_key`. Authoritative; use the row directly.
2. **By name + team** when only a name is available: if a name lookup returns
   more than one row, disambiguate using the prop's team.
3. **Bail out** if still ambiguous (multiple matches after team filter, or no
   team available): return `data_quality: 'odds_only'` and let the existing
   54/Weak clamp apply. **Never guess** and never blend rows across ids.

Any resolution that falls back to path 3 must be logged so the ambiguity rate
is visible before the clamp-lifting gates (2d) are evaluated.

## Status: 2c SHIPPED (2026-07-31)

Implemented in `sbo-get-player-context` (MLB branch behind `sport === 'mlb'`,
NBA path untouched) and `sbo-run-predictions` (passes `sport` + `player_id`;
honours a returned `data_quality` field, NBA guard unchanged).

## Follow-up task (logged, NOT built)

Plumb the ESPN `athlete_id` onto `sbo_player_props` at odds-fetch time so
resolution path 1 (`player_id` → `player_key`) becomes live. Until then path 1
is dormant and resolution runs on name + team narrowing, which can only narrow,
never guess.
