# NHL ODDS — READINESS NOTE (Phase 3, Item 5.3)

**Status: NO CODE CHANGE REQUIRED.** NHL is already fully wired in
`sbo-fetch-odds/index.ts`. The only thing standing between the current state
(31 scheduled NHL games, 0 props) and live NHL props is **an active The Odds API
key**. The current key returns `401 DEACTIVATED_KEY`.

This file exists so the next person does not re-derive the mapping.

---

## 1. What is already in place

| Concern | Location in `index.ts` | Value |
| --- | --- | --- |
| Odds API sport key | `SPORT_MAP` | `nhl: 'icehockey_nhl'` |
| Prop markets requested | `PROP_MARKETS` | `player_goals`, `player_assists`, `player_shots_on_goal`, `player_total_saves` |
| Market → canonical prop type | `PROP_TYPE_MAP` | `player_goals → goals`, `player_shots_on_goal → shots`, `player_total_saves → saves`, `goalie_saves → saves`, `player_assists → assists` |
| ESPN grading config | `_shared/espnGrading.ts` → `NHL_GRADING` (`espnPath: 'hockey/nhl'`) | present, registered in `GRADING_CONFIGS` |
| Stats ingestion | `sbo-ingest-player-stats` (`sport: 'nhl'`) | works today, free ESPN, no odds key needed |
| Day-engine allowlist | `sbo-day-engine` → `SUPPORTED_ALLOWLIST` | `nhl` present |
| Season window | `sbo-day-engine` + `sbo-ingest-player-stats` → `SEASON_WINDOWS` | `nhl: Sep–Jun` |

## 2. The actual 10-minute change once billing is resolved

1. Set a working `ODDS_API_KEY` in Supabase Vault (nothing hardcoded).
2. Invoke once to confirm:
   ```
   POST /functions/v1/sbo-fetch-odds
   { "sport_key": "nhl", "include_props": true }
   ```
   A working key returns HTTP 200 with `games_inserted > 0`.
   A dead key now returns **HTTP 502** (Phase 2 fix — nested 401/403/429 are no
   longer swallowed as success).
3. Confirm rows land. NOTE the column name is `sport_key`, not `sport`
   (`sbo_games` is the only table that carries a raw `sport` value such as
   `icehockey_nhl`):
   ```sql
   select count(*) from sbo_odds         where sport_key = 'nhl';
   select count(*) from sbo_player_props where sport_key = 'nhl'
     and game_date >= current_date;   -- forward-dated is the real signal
   ```
   Baseline before activation (2026-08-10): `sbo_odds` 1,722 NHL rows (all
   stale, pre-outage), `sbo_player_props` 0 forward-dated NHL rows.
4. Nothing else. The day-engine fanout picks NHL up automatically: `sbo_sports`
   already has `nhl` with `is_active = true` (verified 2026-08-10), and the
   Sep–Jun `SEASON_WINDOWS` entry opens on its own. Until September the engine
   will *skip* NHL as off-season — that is correct, not a failure.

## 2b. Vault secret name

The one and only secret is **`ODDS_API_KEY`** (Supabase Vault / edge-function
secret). `sbo-fetch-odds` reads it via `Deno.env.get('ODDS_API_KEY')`. Do not
introduce a second name and never hardcode the value.

## 3. Known gaps to watch on first live NHL run

- `player_assists` has a `PROP_TYPE_MAP` entry shared with basketball
  (`assists`). NHL and NBA assists are the same canonical stat name but
  different sports; every downstream read is already sport-scoped, so this is
  intentional, not a collision.
- The Odds API does not expose NHL `player_points` (goals+assists). If a capper
  posts an NHL "points" prop it will not find a book line. Add
  `player_points` to `PROP_MARKETS.nhl` **only** after confirming the market
  exists for `icehockey_nhl` in the live `/v4/sports/icehockey_nhl/odds`
  response — do not add it speculatively.
- Goalie saves arrive under either `player_total_saves` or `goalie_saves`
  depending on book. Both already map to `saves`.

## 4. What was deliberately NOT done

No live The Odds API call was made while writing this note (key is deactivated
and billing is unresolved). Everything above was verified by reading the
committed mapping tables and the ESPN grading registry, not by hitting the
vendor.
