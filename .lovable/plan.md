## Recon evidence (read-only, done now)

**Today's MLB prop data (`sbo_player_props`, sport_key='mlb', last 24h)**
- 316 raw rows, 3 sources (draftkings, fanduel, prizepicks), 3 prop types (`hits`, `strikeouts_p`, `total_bases`)
- **278 distinct (player_name, prop_type)**; 281 distinct (player, prop_type, line) → books mostly agree on the line, so dedupe on (player, prop_type) collapses 316 → 278. Only ~3 line disagreements.

**data_quality behavior — MUST FIX, evidence below**
`sbo-run-predictions/index.ts:130-148`:
```ts
let dataQuality = 'odds_only';
if (ctx.prediction_type === 'player_prop' && ctx.player_name) {
  const { data } = await supabase.functions.invoke('sbo-get-player-context', {...});
  if (data?.context_text) { statsContext = data.context_text; dataQuality = 'full'; }
}
```
`sbo-get-player-context` **always** returns a non-empty `context_text` — it's a template string that fills `N/A`/`0` when no rows are found (index.ts:93-115). So an MLB prop with zero baseball stats would come back `data_quality: 'full'` with an all-N/A NBA-shaped context (pts/ast/reb/3pm). Confirmed the tables are NBA-only: `sbo_player_season_stats` = 587 rows, `sbo_player_game_logs` = 130 rows, and `propFieldMap` has no baseball keys (`hits`, `strikeouts_p`, `total_bases` all fall back to `points`).

Existing MLB predictions (11, all moneyline, from 2026-07-21) show 5 rows already mislabeled `full` on the team-stats path.

**Conclusion:** shipping the fanout as-is would produce **falsely `full`-labeled** MLB props — the exact opposite of the labeling requirement. The proposal therefore includes one narrow, additive truthfulness guard (not brain-logic change).

---

## 1. Fanout step design

New step in `PREGAME_STEPS`, placed immediately after `sbo-fetch-odds`, `required: false`, **not** in `NBA_ONLY_STEPS`:

```ts
{ fn: 'sbo-run-prop-predictions', label: 'AI Prop Predictions (per prop)', icon: '🎯', required: false }
```

This is a **virtual step** handled inline in the per-sport loop (same shape as the existing disabled `sbo-run-predictions` branch at index.ts:207-236) — no new edge function to deploy, no new secrets.

Behavior inside the branch:
1. Query today's props for the current sport using the ET day window already proven in Phase A:
   `sbo_player_props` where `sport_key = sport` and `game_date` in [etDayStartUTC, etDayEndUTC).
2. **Dedupe** in JS by `${player_name}|${prop_type}`, keeping the row with the most recent `created_at` (tiebreak: prefer `source='draftkings'` → `fanduel` → `prizepicks`, so we keep a real sportsbook line over PrizePicks when both exist).
3. **Cap + time budget.** 278 props is far beyond a single invocation: each `sbo-run-predictions` call makes 3 sequential/parallel AI calls (stats → then market/context/polymarket in parallel), realistically 5-9s per prop. The day-engine already warns at 150s wall-clock (index.ts:331). So:
   - `MAX_PROPS_PER_RUN = 25` (overridable via request body `prop_fanout_limit`)
   - `TIME_BUDGET_MS = 60_000` — break out of the loop when exceeded, whichever comes first
   - Order by `created_at desc` so the freshest lines get predicted first
   - **Idempotent + resumable:** `sbo-run-predictions` already short-circuits on an existing same-day prediction for a `prop_id` (index.ts:511-533, returns `source: 'cache'`). We pre-filter those prop_ids out of the queue before invoking, so each successive pregame run advances the slate instead of re-burning the cap. Note in the step record how many remain unprocessed.
4. Invoke per prop: `supabase.functions.invoke('sbo-run-predictions', { body: { prop_id, prediction_type: 'player_prop' } })`, sequential, `await sleep(400)` between calls.
5. **Per-item error isolation + save verification** (the pattern from this session): try/catch per prop; count from the response, not from the absence of an error:
   - `saved` ← `data.saved === true && data.prediction_id`
   - `skipped` ← `data.skipped === true` (sub-50% confidence) or `data.source === 'cache'`
   - `failed` ← thrown error, `error` from invoke, or `data.insert_error` non-null
   - `records` reported to `recordStep` = **saved only**; note string carries `saved/skipped/failed/remaining` and the cap/time-budget reason if we bailed early.
6. `API_COSTS` entry added for the step (`internal`, 0 cents) so the `sbo_api_costs` insert doesn't log `unknown`.

The existing disabled `sbo-run-predictions` moneyline branch is **left exactly as-is**.

## 2. data_quality truthfulness guard (narrow, required for point 3 to mean anything)

In `sbo-run-predictions/runStatsBrain`, the player-prop branch only: promote to `'full'` when the context actually contains real numbers, otherwise leave `'odds_only'`.

```ts
if (data?.context_text) {
  statsContext = data.context_text;
  const hasRealStats =
    (data.raw?.recent_values?.length ?? 0) > 0 ||
    (data.raw?.season_stats?.games_played ?? 0) > 0;
  dataQuality = hasRealStats ? 'full' : 'odds_only';
}
```
`sbo-get-player-context` already returns `raw.recent_values` and `raw.season_stats` (index.ts:115-128), so this needs **no change to that function** and no brain-logic change. Effect on NBA: none — NBA props have game logs, so `recent_values.length > 0` and they stay `full`. Effect on MLB: correctly `odds_only`, which also triggers the already-existing confidence cap at 55 (`index.ts:290, 323`) → these land in `weak`/`moderate` tiers, never `elite`.

If you'd rather I not touch `sbo-run-predictions` at all, the alternative is the fanout step overwriting `data_quality` post-insert — dirtier, and it can't apply the 55 cap. I recommend the guard above.

## 3. UI labeling — where it lands

Existing badge pattern (reuse verbatim, `full → 📊 Full Stats` / `partial → ⚠️ Partial Stats` / else `🔴 Odds Only`):
- `src/pages/sports-betting/SportsBettingOS.tsx:714, 747, 755` — already renders it ✅
- `src/components/sbo/PrizePicksAnalyzer.tsx:652-659` — already renders it ✅
- `src/components/sbo/PredictionHistory.tsx:232` — emoji only, already renders it ✅

Gaps to close in this task:
1. **`src/pages/sports-betting/tabs/NightlyBoardTab.tsx`** (lines 104, 126, 477) — selects `confidence_tier` and brain scores but **not** `data_quality`. Add `data_quality` to all three selects and render a badge next to the confidence tier on both the game rows and the prop rows (line 477 is the prop join — this is the primary surface these new MLB predictions will appear on).
2. **Saved-picks surfaces.** `sbo-run-predictions` auto-saves every prediction into `sbo_saved_picks`, and that table has **no `data_quality` column**. Affected: `src/pages/owner/OwnerSportsDetailPage.tsx` and any other saved-picks list. Fix without a schema change: those queries already have `source_id` → join `sbo_predictions!source_id(data_quality, sport_key)` and render the same badge. (If you prefer a denormalized `data_quality` column on `sbo_saved_picks`, say so — that's a migration and I'd propose it separately.)
3. Extract the badge into one shared `src/components/sbo/DataQualityBadge.tsx` (variant text: `Odds-Only — Limited Data` on hover/tooltip for the `odds_only` case) and swap the three existing inline copies to use it, so there's a single place to maintain.

Verification before I call it done: run the fanout for MLB, then load NightlyBoardTab and the owner sports page and screenshot the badge actually rendering on real MLB prop rows — not just confirm the field exists.

## 4. Realistic volume + duration estimate

| | Today (real) | Typical full MLB slate |
|---|---|---|
| Raw prop rows | 316 | ~400-900 |
| Deduped (player, prop_type) | **278** | ~300-700 |
| Predictions saved per pregame run (cap 25) | ~18-23 (some skipped <50% confidence) | same |
| Runs to cover a slate | ~12 | ~15-30 |

Step duration per run: 25 props × (~6s AI + 0.4s pacing) ≈ **~150s** — too long on its own. That's why the **60s time budget wins in practice**: expect ~8-12 props per pregame run at ~60-70s, and the step reports `remaining: N` honestly. To cover a full slate you'd want pregame invoked repeatedly (existing cron cadence) or a follow-up task to move this to a dedicated `sbo-run-prop-predictions` edge function with chunked concurrency — flagged, not built here.

## Explicitly not in scope
`sbo-fetch-odds` (untouched), any SportsDataIO/NBA feed, Phase B baseball stats domain, moneyline fanout re-enable.

## Files touched if approved
- `supabase/functions/sbo-day-engine/index.ts` — new step def + inline fanout branch + API_COSTS entry
- `supabase/functions/sbo-run-predictions/index.ts` — 4-line data_quality truthfulness guard (player-prop branch only)
- `src/components/sbo/DataQualityBadge.tsx` — new shared badge
- `src/pages/sports-betting/tabs/NightlyBoardTab.tsx` — add `data_quality` to selects + render badge
- `src/pages/owner/OwnerSportsDetailPage.tsx` — join `sbo_predictions` for quality + render badge
- `SportsBettingOS.tsx` / `PrizePicksAnalyzer.tsx` / `PredictionHistory.tsx` — swap inline badge for shared component
