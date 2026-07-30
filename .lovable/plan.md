## Phase A — `sbo-fetch-odds` props unblock (proposal only, nothing changed)

Scope: `supabase/functions/sbo-fetch-odds/index.ts` only. No day-engine, no run-predictions, no prizepicks/pregame/SportsDataIO.

During recon for this proposal I found **two more blockers past the cache guard** that would have made the fix look like it worked while still writing zero rows. Both are in the same file and same code path, so they belong in Phase A.

---

### Blocker inventory

| # | Bug | Effect |
|---|---|---|
| 1 | Cache guard returns early when games exist | Props loop never runs. Confirmed live today. |
| 2 | ET wall-clock date compared to naive-UTC `game_date` | 4–5h offset window; yesterday's night games count as "today". |
| 3 | **Insert omits `team`, which is `NOT NULL`** | Every prop insert would fail even if the loop ran. |
| 4 | **Plain `.insert()` vs. unique `(player_name, prop_type, game_date, source)`** | Re-runs within a day error out instead of refreshing lines. |

Bugs 3 and 4 are new information — they were invisible until now because the loop has never executed for MLB.

---

### 1. Cache guard — current code (lines ~85–100)

```ts
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

const { count } = await supabase
  .from('sbo_games').select('*', { count: 'exact', head: true })
  .eq('sport_key', sport_key)
  .gte('game_date', `${today}T00:00:00`).lte('game_date', `${today}T23:59:59`);

if (count && count > 0) {
  return new Response(JSON.stringify({ ... source: 'cache', ... }));   // <-- props never reached
}
```

**Proposed:** replace the early `return` with a *cached-games branch* that reuses the rows already in the DB and then falls into the shared props loop.

```ts
// Cache is about GAMES only. Props are fetched independently.
const { data: cachedGames } = await supabase
  .from('sbo_games')
  .select('id, external_id, home_team, away_team, game_date')
  .eq('sport_key', sport_key)
  .gte('game_date', dayStartUtc).lt('game_date', dayEndUtc);

const gamesAreCached = (cachedGames?.length ?? 0) > 0;

let gameTargets: Array<{ id: string; external_id: string; home_team: string; away_team: string }>;

if (gamesAreCached) {
  gameTargets = cachedGames!;            // skip the games+odds API call entirely
  source = 'cache';
} else {
  ... existing games fetch / upsert / odds insert loop ...
  gameTargets = <rows upserted above>;
}

if (include_props && PROP_MARKETS[sport_key]?.length) {
  for (const g of gameTargets) { ...existing per-event props fetch... }
}
```

Net effect: games caching still saves API credits (no games/odds refetch), but props are always attempted. The props loop body itself is unchanged apart from bugs 3/4 below.

Optional guard I recommend but will not add unless you say so: skip the props fetch for a game whose `commence_time` is already in the past, so we don't burn credits on finished games.

---

### 2. Timezone convention

**Proposed convention, documented in a comment at the top of the file:**

> A sports "day" is the **America/New_York calendar date**, because that is how US books, PrizePicks slates, and `sbo_player_props.game_date` (a `date` column) already label slates. A 10:05pm ET first pitch belongs to that ET date, not to the following UTC date.

**Implementation:** keep ET as the label, but convert the window to real UTC instants before querying, instead of interpolating a bare string.

```ts
// Current — ET label compared against UTC timestamps as naive strings
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
.gte('game_date', `${today}T00:00:00`).lte('game_date', `${today}T23:59:59`)

// Proposed
const etToday = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // 'YYYY-MM-DD'
const etOffset = getEtOffsetHours();            // 4 during EDT, 5 during EST — derived, not hardcoded
const dayStartUtc = new Date(`${etToday}T00:00:00-0${etOffset}:00`).toISOString();
const dayEndUtc   = new Date(`${etToday}T00:00:00-0${etOffset}:00`);
      dayEndUtc.setUTCDate(dayEndUtc.getUTCDate() + 1);   // exclusive upper bound
.gte('game_date', dayStartUtc).lt('game_date', dayEndUtc.toISOString())
```

`etToday` remains the value written to `sbo_player_props.game_date`, so the ledger label and the query window finally agree. The `lte ...T23:59:59` inclusive bound also becomes an exclusive `lt`, removing the one-second hole.

---

### 3. Insert fixes inside the props loop

```ts
// Current — omits NOT NULL `team`, and plain insert collides with the unique constraint
await supabase.from('sbo_player_props').insert({
  game_id, sport_key, player_name: player, prop_type: stdType, line: v.line,
  over_odds, under_odds, source: bm.key, game_date: today,
});

// Proposed
await supabase.from('sbo_player_props').upsert({
  game_id: gameRecord.id,
  sport_key,
  player_name: player,
  team: v.team ?? `${away_team} @ ${home_team}`,   // Odds API prop outcomes carry no team; matchup is the honest fallback
  prop_type: stdType,
  line: v.line,
  over_odds: v.over_odds ?? null,
  under_odds: v.under_odds ?? null,
  source: bm.key,
  game_date: etToday,
  updated_at: new Date().toISOString(),
}, { onConflict: 'player_name,prop_type,game_date,source' });
```

The upsert also makes repeated intraday calls refresh lines instead of erroring — which is what a day-engine cadence needs.

Note on `team`: The Odds API player-prop outcomes only give `description` (player name), not a team. Options are (a) store the matchup string as shown, (b) leave a roster-join enrichment for a later phase. I propose (a) now, since the column is `NOT NULL` and blocking. Say the word if you'd rather I make `team` nullable via migration instead — that's a schema change, so I won't do it unprompted.

---

### 4. Walkthrough against today's exact observed state

Today, 2026-07-30. `sbo_games` holds 3 MLB rows inside the buggy window — Dodgers/Mariners 02:11Z, Athletics/Red Sox 01:41Z, Angels/Astros 01:39Z. All three are **last night's ET slate** (Jul 29 evening ET), already finished.

**Before (observed live 10:18Z):**
```json
{"errors":[],"games_fetched":3,"games_inserted":0,
 "message":"Using 3 mlb games already fetched today",
 "props_fetched":0,"props_inserted":0,"source":"cache","sport_key":"mlb"}
```

**After both fixes, same invocation `{ sport_key: 'mlb' }`:**

1. `etToday` = `2026-07-30`; window = `2026-07-30T04:00:00Z` → `2026-07-31T04:00:00Z`.
2. The 3 stale rows at 01:39–02:11Z now fall **outside** the window — they correctly belong to the Jul 29 ET slate. So `gamesAreCached` is **false** for the Jul 30 ET slate.
3. Games branch runs: fetches today's real MLB slate (the provider currently lists 10 upcoming MLB events, first pitch 16:11Z), upserts them, writes moneyline/spread/total odds.
4. Props loop runs per event against the endpoint the diagnostic already proved returns 200 with live data — e.g. Rays/Rangers returned Shane McClanahan `pitcher_strikeouts` 5.5 (+132/-170, FanDuel) and Yandy Diaz `batter_hits` 1.5 (+191/-260, DraftKings).
5. Rows upsert into `sbo_player_props` with `sport_key='mlb'`, `game_date='2026-07-30'` — the table's first MLB rows ever (currently 12,579 rows, all NBA).

Second scenario, to prove the guard fix independently: if the day-engine calls this twice in one day, the second call hits `gamesAreCached = true`, **skips** the games/odds API entirely, and still runs the props loop, refreshing lines via upsert. That is the case that is broken today and the reason props have never landed.

Credit cost: 1 request for the games list plus 1 per event for props — roughly 11 credits for a full MLB slate. Quota showed 246 remaining at diagnostic time.

---

### 5. NBA impact: none

- All logic is keyed off the `sport_key` parameter; NBA still resolves to `basketball_nba` with the unchanged `PROP_MARKETS.nba` list.
- NBA_ONLY gating lives in `sbo-sync-prizepicks` / `sbo-sync-pregame` / SportsDataIO paths — not touched.
- The only NBA-visible deltas are shared improvements: the corrected ET window, and props inserts becoming upserts (which for NBA means duplicate-key errors stop appearing in `errors[]`). No NBA row is deleted or rewritten with different semantics.
- NBA is out of season today, so the practical NBA blast radius this week is zero.

---

### Files touched if approved

- `supabase/functions/sbo-fetch-odds/index.ts` — cache guard branch, ET/UTC window helper, props upsert with `team`.

No migrations. No other functions. No downstream fanout — `sbo-run-predictions` invocation stays a separate follow-up as you specified.
