# PHASE 8G — SBO AI ENGINE DEEP AUDIT (READ-ONLY, SBO-ONLY)

Date: 2026-08-12 · Project: Dynasty OS / SBO AI Engine (`qalaaroashbggynpvqct`)
Method: static source reads (`supabase/functions/sbo-*`, `_shared/*`) + read-only SQL
(`cron.job`, `pg_trigger`, `pg_proc`, `sbo_capper_picks`). **No edge function invoked.**

---

## REQUEST LEDGER — 0 paid calls

| Provider | Calls this phase | Proof |
| --- | --- | --- |
| Anthropic | 0 | No `supabase--curl_edge_functions` / `test_edge_functions` / `deploy` call was made. The only two Anthropic sites (`sbo-telegram-intake/index.ts:38` + `:157`, `sbo-weekly-report-generator/index.ts:181`) are reachable only by invoking those functions; neither was invoked. |
| Lovable AI Gateway (Gemini) | 0 | Same — all 8 gateway sites live inside edge functions; none invoked. No `lovable_ai.py` skill run. |
| The Odds API | 0 | `ODDS_API_KEY` is read only inside `sbo-fetch-odds:150`, `sbo-ingest-book-props:63`, `sbo-track-clv:19`, `sbo-debug-sports-api:13`. None invoked. |
| SportsDataIO / ESPN | 0 | Same — function-internal only. |

Tools used this phase: `code--exec` (ripgrep/sed/ls, local FS only) and `supabase--read_query`
(SELECT only). No migration, no code file modified. This report is the only file written.

---

## ITEM 1 — COMPLETE SBO FUNCTION INVENTORY

**57 `sbo-*` directories exist** (`ls -d sbo-*` → 57; total 17,506 LOC across `index.ts`).

### 1a. Tracker names that DO NOT exist (verified `MISSING`)

`sbo-grade-capper-picks` (only `-alt` and `-props` exist), `sbo-signal-generator`,
`sbo-morning-briefing`, `sbo-learning-weekly`, `sbo-performance-analyzer`, `sbo-pick-extractor`,
`sbo-result-tracking`, `sbo-run-prop-predictions`.

`sbo-run-prop-predictions` is confirmed still a **virtual step label**, not a function:
declared as a step at `sbo-day-engine/index.ts:52` and intercepted inline at
`sbo-day-engine/index.ts:374` (`if (step.fn === 'sbo-run-prop-predictions')`) where the engine
itself fans out over `sbo_player_props` and calls `sbo-run-predictions`' prop branch. It also
carries a cost row at `sbo-day-engine/index.ts:16`.

### 1b. Full inventory

AI column: **G** = Gemini via Lovable Gateway, **A** = Anthropic direct, **—** = no AI.

| function | purpose | AI? (model) | trigger |
| --- | --- | --- | --- |
| sbo-day-engine | Master pipeline orchestrator (per-sport + global + postgame steps) | — (orchestrates AI steps) | cron 24 (`0 23 * * *`, mlb-only), cron 110 (`*/20`), cron 23 **disabled**, manual |
| sbo-telegram-intake | Telethon webhook → store post → capper resolve → Claude pick extraction | **A** claude-sonnet-4-5 (`:157`, max_tokens 2000 `:162`) | webhook (secret `:284`) |
| sbo-parse-capper-image | Vision OCR of capper slip images → picks | **G** gemini-2.5-flash (`:142`, max_tokens 6000 `:202`) | invoked by intake (`:441`) |
| sbo-parse-prop-image | Vision OCR of prop-board screenshots | **G** gemini-2.5-flash (`:34`, max_tokens 4000 `:60`) | manual/UI |
| sbo-run-predictions | 3-brain per-game & per-prop prediction engine | **G** gemini-2.5-flash (`:102`, `:126`, **no max_tokens**) | day-engine step + prop fanout |
| sbo-build-parlays | Parlay construction/AI narrative | **G** gemini-2.5-flash-lite (`:43`) | manual/UI |
| sbo-daily-profit-plan | AI daily bankroll/profit plan | **G** gemini-2.5-flash (`:49`) | manual/UI |
| sbo-hedge-calculator | Hedge sizing + AI explanation | **G** gemini-2.5-flash (`:79`) | manual/UI |
| sbo-analyze-prizepicks | PrizePicks board analysis | **G** gemini-2.5-pro (`:25`) | manual/UI |
| sbo-analyze-model | Model self-analysis + weight adjust | **G** gemini-3-flash-preview (`:20`) | day-engine POSTGAME step (`:96`) |
| sbo-weekly-report-generator | Weekly narrative report | **A** claude-sonnet-4-5 (`:189`, max_tokens 1000 `:190`) | cron 122 (`0 6 * * 0`) |
| sbo-fetch-odds | Odds API pull → `sbo_games` + `sbo_player_props` | — | day-engine PREGAME step |
| sbo-match-capper-picks | Deterministic pick↔prop matcher | — | cron 104 (`30 4 * * *`, `mode:full`) |
| sbo-grade-capper-props | Player-prop grader (MLB v1, ESPN box scores) | — | manual (not in day-engine steps) |
| sbo-grade-capper-picks-alt | Alt-sport (CFL/MMA) game-level grader | — | day-engine POSTGAME (`:91`) |
| sbo-score-capper-picks | Recompute per-pick edge/confidence via `_shared/perPickScore` | — | cron 121 (`25 */3 * * *`) |
| sbo-verify-results | Generalized ESPN grading (all sports via `getGradingConfig()`) | — | cron 26 (`59 3 * * *`) + POSTGAME |
| sbo-result-tracker | Resolve pending picks/signals vs ESPN, capper counters/streaks | — | cron 99 (`0 */2 * * *`) |
| sbo-track-results | Grade predictions + accuracy (SportsDataIO NBA) | — | cron 25 (`0 4 * * *`) + POSTGAME |
| sbo-external-results | Multi-provider result backfill | — | manual/internal |
| sbo-ingest-player-stats | ESPN box-score → `sbo_player_game_stats` | — | POSTGAME (`:80`, gated on `GRADED_SPORT_KEYS`) |
| sbo-collect-stats | Stats collection sweep | — | cron 123 (`0 * * * *`) |
| sbo-expand-stat-context | Expand `sbo_prop_stat_context` | — | manual/chained |
| sbo-build-prop-context | Build per-prop context payload | — | internal |
| sbo-get-player-context | Player context lookup (uses `_shared/espnGrading`) | — | UI/internal |
| sbo-sync-props-master | `sbo_player_props` → `props_master` fanout | — | cron 101 (`30 13,23 * * *`) + GLOBAL step (`:68`) |
| sbo-consensus-engine | Capper consensus + value-play scoring | — | cron 102 (`45 13,23 * * *`) |
| sbo-signal-combiner | Weighted capper-signal combination | — | cron 108 (`15 5 * * *`), cron 109 (`50 23 * * *`) |
| sbo-top-plays | Composite top-play ranking + Kelly sizing | — | manual/UI |
| sbo-auto-capper | Betting-signal detection + capper identity resolve | — | invoked by intake |
| sbo-auto-bet | Automated bet placement/logging | — | manual |
| sbo-weight-optimizer | Capper/model weight optimization | — | cron 85 (`0 5 * * 0`) |
| sbo-recalibrate | Confidence recalibration | — | manual |
| sbo-clamp-readiness | Readiness clamp report | — | cron 103 (`0 9 * * 1`) |
| sbo-compare-odds | Cross-book odds comparison | — | GLOBAL step (`:69`) |
| sbo-fetch-intelligence | SportsDataIO intelligence pull | — | manual |
| sbo-track-clv | Closing-line-value tracking (Odds API) | — | manual |
| sbo-simulate-parlay | Parlay EV simulation | — | manual/UI |
| sbo-ingest-book-props | Sportsbook prop ingest (Odds API) | — | manual |
| sbo-market-performance | Market-level performance rollups | — | manual |
| sbo-intelligence-audit | Internal intelligence audit report | — | manual |
| sbo-run-analysis | Job-driven full analysis (`sbo_analysis_jobs`) | — | UI fire-and-forget (`useUnifiedProps.ts:154`) |
| sbo-daily-automation | Legacy daily chain + Twilio SMS | — | manual/legacy |
| sbo-generate-daily-briefing | Build SMS briefing row | — | GLOBAL step (`:70`) |
| sbo-send-daily-sms | Twilio send of briefing | — | GLOBAL step (`:71`) |
| sbo-send-daily-email | Email digest | — | manual |
| sbo-send-picks-sms | Twilio picks SMS | — | manual |
| sbo-inbound-sms | Inbound SMS webhook | — | webhook |
| sbo-sync-daily | SportsDataIO season stats/injuries (NBA) | — | MORNING step (`:47`) |
| sbo-sync-pregame | SportsDataIO projections/props (NBA) | — | PREGAME step (`:56`) |
| sbo-sync-prizepicks | PrizePicks props (NBA-hardcoded) | — | PREGAME step (`:57`) |
| sbo-sync-polymarket / -full | Polymarket markets (NBA-hardcoded) | — | PREGAME step (`:58`) |
| sbo-cache-player-images | Player headshot cache (SportsDataIO) | — | manual |
| sbo-system-health | Health rollup for `useSBOSystemHealth` | — | UI (30s poll) |
| sbo-debug-sports-api | Key/endpoint debug probe | — | manual |
| sbo-analyze-tonight | Tonight-slate devig analysis | — | manual |

### 1c. Cron topology (from `cron.job`, SBO rows only)

| jobid | schedule | target | active |
| --- | --- | --- | --- |
| 23 | `0 13 * * *` | sbo-day-engine `{}` | **false (disabled 7e)** |
| 24 | `0 23 * * *` | sbo-day-engine `{run_type:cron, sports:[mlb], props_sports:[mlb]}` | true |
| 25 | `0 4 * * *` | sbo-track-results | true |
| 26 | `59 3 * * *` | sbo-verify-results | true |
| 85 | `0 5 * * 0` | sbo-weight-optimizer | true |
| 99 | `0 */2 * * *` | sbo-result-tracker | true |
| 101 | `30 13,23 * * *` | sbo-sync-props-master (props fanout safety net) | true |
| 102 | `45 13,23 * * *` | sbo-consensus-engine | true |
| 103 | `0 9 * * 1` | sbo-clamp-readiness | true |
| 104 | `30 4 * * *` | sbo-match-capper-picks `{mode:full}` | true |
| 108 | `15 5 * * *` | sbo-signal-combiner `{reprocess_all:true}` | true |
| 109 | `50 23 * * *` | sbo-signal-combiner `{reprocess_all:true}` | true |
| 110 | `*/20 * * * *` | sbo-day-engine (props fanout catch-up) | true |
| 121 | `25 */3 * * *` | sbo-score-capper-picks | true |
| 122 | `0 6 * * 0` | sbo-weekly-report-generator | true |
| 123 | `0 * * * *` | sbo-collect-stats | true |

Confirms 7e/8B decisions: 23 disabled, 24 kept at 23:00Z, 101 + 110 are the props fanout safety net.

---

## ITEM 2 — SBO AI CALL-SITE MAP

| function | file:line | endpoint / model | key (`Deno.env.get`) | max_tokens | temp | granularity | trigger / cadence | vision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| sbo-telegram-intake | `:38` URL, `:157` model | api.anthropic.com/v1/messages · claude-sonnet-4-5 | `ANTHROPIC_API_KEY` (`:537`) | 2000 (`:162`) | not set | **per post** (after skip gate) | webhook, real-time | no (text-only) |
| sbo-weekly-report-generator | `:181`, `:189` | api.anthropic.com/v1/messages · claude-sonnet-4-5 | `ANTHROPIC_API_KEY` (`:171`) | 1000 (`:190`) | not set | per run | cron 122, weekly | no |
| sbo-parse-capper-image | `:134`, `:142` | ai.gateway.lovable.dev/v1 · google/gemini-2.5-flash | `LOVABLE_API_KEY` (`:126`) | 6000 (`:202`) | 0.1 (`:201`) | per image | intake image branch | **yes** |
| sbo-parse-prop-image | `:26`, `:34` | ai.gateway.lovable.dev/**chat/completions** (no `/v1`) · gemini-2.5-flash | `LOVABLE_API_KEY` (`:18`) | 4000 (`:60`) | 0.1 (`:59`) | per image | manual/UI | **yes** |
| sbo-run-predictions | `:95`/`:102` and retry `:119`/`:126` | ai.gateway.lovable.dev/v1 · gemini-2.5-flash | `LOVABLE_API_KEY` (`:85`) | **NONE — unbounded** | not set | **per brain, per game/prop** (stats/market/context) | day-engine PREGAME + `*/20` prop fanout | no |
| sbo-build-parlays | `:36`, `:43` | ai.gateway.lovable.dev/v1 · gemini-2.5-flash-lite | `LOVABLE_API_KEY` (`:113`) | not set | not set | per run | manual/UI | no |
| sbo-daily-profit-plan | `:42`, `:49` | ai.gateway.lovable.dev/v1 · gemini-2.5-flash | `LOVABLE_API_KEY` (`:15`) | not set | not set | per run | manual/UI | no |
| sbo-hedge-calculator | `:72`, `:79` | ai.gateway.lovable.dev/v1 · gemini-2.5-flash | `LOVABLE_API_KEY` (`:31`) | not set | not set | per request | manual/UI | no |
| sbo-analyze-prizepicks | `:18`, `:25` | ai.gateway.lovable.dev/v1 · gemini-2.5-pro | `LOVABLE_API_KEY` (`:12`) | not set | not set | per run | manual/UI | no |
| sbo-analyze-model | `:13`, `:20` | ai.gateway.lovable.dev/v1 · gemini-3-flash-preview | `LOVABLE_API_KEY` (`:16`, inline) | not set | not set | per run | day-engine POSTGAME | no |

**Correction to the Phase 8E inventory:** 8E listed 5 Gemini sites. There are **8**. Three were
not previously listed: `sbo-build-parlays:43` (gemini-2.5-flash-lite), `sbo-daily-profit-plan:49`
and `sbo-hedge-calculator:79` (both gemini-2.5-flash). All three are manual/UI-triggered, so they
do not add cron burn, but they do consume Lovable credits on user action.

**Anthropic direct vs Gateway:** 2 direct Anthropic (`api.anthropic.com`), 8 Lovable Gateway.
Zero raw-provider Gemini (`generativelanguage.googleapis.com`) — grep returned nothing.

### Unbounded / high-cadence flags

| flag | site | why it matters |
| --- | --- | --- |
| **UNBOUNDED output** | `sbo-run-predictions:95`+`:119` | No `max_tokens` on either the primary or the retry call. This is the only AI site on a `*/20` cadence path (via day-engine cron 110 prop fanout) and it runs **3 brains per prop**, up to 60 props/run (`sbo-day-engine:379`). Highest burn surface in SBO. |
| UNBOUNDED output | build-parlays, daily-profit-plan, hedge-calculator, analyze-prizepicks, analyze-model | manual/UI or once-nightly, so bounded by human action, not cadence. |
| Retry doubles cost | `sbo-run-predictions:113-135` | `catch` → full re-issue of the same unbounded call once. A failing prop costs 2× tokens. |
| High cadence | cron 110 `*/20` → day-engine → prop fanout → run-predictions | 72 engine invocations/day; each can dispatch up to 60 props × 3 brains, bounded only by `RUN_BUDGET_MS = 115_000` (`sbo-day-engine:143`). |

### Token/usage capture status

| function | usage persisted? | evidence |
| --- | --- | --- |
| ALL 10 AI sites | **NO — discarded** | grep for `usage`/`input_tokens`/`output_tokens` writes across `sbo-*` returns no persistence path. `sbo-telegram-intake:180` reads only `data?.stop_reason`; the `usage` object on the Anthropic/Gateway response is never read or written. `sbo-day-engine` records cost via a **static table** `API_COSTS` (`:13-27`) where every AI-bearing step is hardcoded `cost_cents: 0` (`sbo-run-predictions` → "Internal AI predictions", `sbo-analyze-model` → "Internal model analysis"). `sbo_api_costs` inserts (`sbo-day-engine:~300`) therefore write **0** for every AI call. |

Net: SBO's own cost telemetry reports $0 for AI by construction. Real spend is only visible in the
AI-Gateway logs and the Anthropic console. This is unchanged from 8E and confirmed again here.

---

## ITEM 3 — EDGE CASES IMPLEMENTED (function | file:line | guards | on hit)

### sbo-telegram-intake

| file:line | guards | on hit |
| --- | --- | --- |
| `:330-337` | SHA-256 content hash over `{text, image_url, has_media, image_data.length}` | hash computed for idempotency compare |
| `:346-350` | TERMINAL_STATUSES = dispatched/extracted/skipped_not_pick/deleted | marks post already processed |
| `:356-364` | `alreadyProcessed && contentUnchanged && !deleted` | **short-circuit 200** `reason:"duplicate_delivery"` — no Claude call |
| `:284` | `SBO_TELEGRAM_WEBHOOK_SECRET` compare | reject unauthenticated webhook |
| `:425-429` | image branch: prefer inline `image_data` base64, else fetch `image_url` | hands off to `sbo-parse-capper-image` (`:441`) — Claude never called for images |
| `:435-437` | image fetch failure | `dispatch_error:"image_fetch_failed"`, stop |
| `:73-79` | `fetchImageAsDataUrl` content-type default `image/jpeg`, try/catch | fallback/typed error |
| `:510-517` | auto-capper returned `action:"skipped"` (no betting signal) | `skipped_not_pick` — **Claude short-circuited before the paid call** |
| `:180-186` | `stop_reason === "max_tokens"` | write `claude_truncated:` error, no pick inserted (BUG-06 lineage: 500→600→2000 cap, current `:162`) |
| `:192-199` | JSON parse failure of Claude output | `extraction_failed` (distinct from `skipped_not_pick`) |
| `:209-224` | `supabase.functions.invoke` collapses non-2xx → generic string | unwraps `error.context` body; falls back to raw text |
| `:612-614` | `game_date` absent from extraction | falls back to `inferredGameDate` and stamps `game_date_source:"inferred_post_date"` |
| `:602-604` | sport has no ESPN grading provider | `unsupported:true`, `unsupported_reason:"no_grading_provider:<SPORT>"` (DB confirms 292 Tennis / 85 Soccer / 42 UFC / 10 NCAAB / 4 Golf rows) |
| `_shared/capperIdentity.ts:1-8` | "did not resolve ⇒ therefore create" bug (31 junk cappers) | resolve-vs-create split; unknown identity quarantined instead of inserted |

### sbo-fetch-odds

| file:line | guards | on hit |
| --- | --- | --- |
| `:150-157` | missing `ODDS_API_KEY` | **HTTP 500 config guard, no provider call attempted** (explicit detail string) |
| `:352-374` | nested 4xx inside the props loop (`status 401\|403\|429` in `errors[].detail`) | response status normalized to **502**, not a green 200 |
| `:380-399` | fatal throw with provider auth signature | 502; every other fatal stays 500 |
| `:110-131` | `provider_usage` + `observed_headers` capture (header may be absent) | records the header set once; defaults when absent |
| `:234` | game upsert `onConflict:'external_id'` | dedupe on natural key |
| `:327` | prop upsert `onConflict:'player_name,prop_type,game_date,source'` | dedupe on natural key |
| `:285-289` | `include_props && PROP_MARKETS[sport_key]?.length` | props only for sports in the allowlist (`:47`); day-engine passes `props_sports` (default `['mlb']`, `sbo-day-engine:180-183`) |
| `:218`, `:273-278`, `:294`, `:330-336` | per-game / per-market / per-prop try-catch | error pushed into `errors[]`, loop continues (one bad game never kills the pull) |
| `:349` | audit-write failure | swallowed (`/* ignore audit failures */`) |

### sbo-match-capper-picks (zero AI — confirmed: no gateway/anthropic URL in file)

| file:line | guards | on hit |
| --- | --- | --- |
| `:105-109` | miss taxonomy: `UNMATCHABLE_STAT`, `NO_CANDIDATE`, `NAME_FUZZY_FAIL`, `DATE_MISMATCH`, `PROP_TYPE_MISMATCH` | funnel bucket recorded, pick left unmatched |
| `:123` | stat normalizes to `UNMATCHABLE` sentinel (`_shared/statNormalize`) | refuse to match — a wrong match corrupts edge math worse than none |
| `:160`, `:302-308` | ET/UTC skew: candidate must be within **±1 day**; date set expanded by ±86400000 ms | prevents 19:00 ET → next-UTC-day misses |
| `:172` | line tolerance `max(1.0, 4% of line)` | flat ±1.0 was too tight for combo props |
| `:192-194` | funnel depth resolution (`reachedName`/`reachedDate`/`reachedStat`) | precise miss reason rather than a generic fail |
| `:264-267` | `dry_run:true` | computes full funnel, writes nothing |
| `:271` | pagination replaces flat `.limit(1000)` | prevents silent truncation of the pick population |
| `:406` | `.limit(500)` on the candidate prop pull | bounded read |
| `:567` | top-level catch | error response, no partial claim of success |
| `_shared/teamMatcher.ts:1-4` | token-level nickname matching, module-scoped NY/LA ambiguity counter | callers must `resetNylaSkipped()`/`getNylaSkipped()`; skipped count surfaced (`sbo-signal-combiner:252`) |

### Grading (sbo-grade-capper-props, sbo-grade-capper-picks-alt, sbo-verify-results)

| file:line | guards | on hit |
| --- | --- | --- |
| `sbo-grade-capper-props:44-46`, `-alt:39-41` | vocabulary is exactly `won\|lost\|push` (never `win`/`loss`) | units 0 / −1 / computed |
| `-props:233` | actual **exactly equals** line | `push`, note carries "exact equality" |
| `-alt:72`, `:79`, `:88` | draw / spread-adjust < 0.001 / total == line | `push` |
| `-alt:230` | alt-sport feed cannot grade | `unsupported:true` + explicit `unsupported_reason` (DB: 11 rows "ESPN CFL feed inactive as of 2026-08-01") |
| `-alt:221`, `-props:252` | successful grade on a previously-unsupported row | clears `unsupported_reason` to null |
| `_shared/espnGrading.ts:1035` | `GRADED_SPORT_KEYS = ['mlb','wnba','nfl','nhl']` | NBA deliberately excluded (`:479`, `:1047`) even though a config can resolve it |
| `sbo-verify-results:1-6` | generalized: no per-sport branches, all through `getGradingConfig()` | unknown sport → no grader, row stays pending |
| DB trigger `trg_sbo_capper_picks_validate` | (a) `unsupported=true` with blank `unsupported_reason`; (b) `result IN (won,lost,push)` with NULL `graded_at` | **RAISE EXCEPTION** — the write fails; no silent ungrounded grade |

### sbo-run-predictions

| file:line | guards | on hit |
| --- | --- | --- |
| `:142`, `:362`, `:387` | three brains: `runStatsBrain`, `runMarketBrain`, `runContextBrain` | per-prop / per-game triple call |
| `:113-135` | any error on the AI call | **full retry once** (`:119`); on second failure logged and degraded |
| `:384`, `:401` | market/context brain parse or call failure | neutral fallback `score: 50, "…inconclusive"` — never blocks the prediction |
| `:791-794` | `dataQuality === 'odds_only'` and score > 65 | hard clamp to `ODDS_ONLY_MAX_CONFIDENCE = 65` (no real stats feed ⇒ cannot reach PLAY on its own) |
| `:153`, `:913` | date handling normalized to `America/New_York` via `en-CA` | avoids UTC day-shift on stored `game_date` |
| `:414` | `.limit(3)` on the context pull | bounded read |
| `:475` | required env vars filtered for missing keys | config-missing surfaced rather than a 500 mid-call |
| `:518`, `:555`, `:851`, `:874`, `:917`, `:952` | calibration / signal-write / counter / save / top-level try-catch | each degrades independently; the prediction still writes |

### sbo-day-engine

| file:line | guards | on hit |
| --- | --- | --- |
| `:46-97` | step chains MORNING → PREGAME → GLOBAL → POSTGAME; `sports?: string[]` per step | step skipped for sports it does not support (replaces the old hardcoded NBA check, `:30-33`) |
| `:143` | `RUN_BUDGET_MS = 115_000` shared wall clock | steps draw from one deadline instead of each claiming 60 s (would blow the ~150 s edge limit at 4 sports) |
| `:151-163`, `finally` | run row hoisted so it always closes | no more stuck `running` status on crash/timeout |
| `:98-127` | `SUPPORTED_ALLOWLIST` + `SEASON_WINDOWS` + `isInSeason()` (wrap-around months) | out-of-season sport **skipped, never failed**; `force_offseason` escape hatch (`:176`) |
| `:243-250` | four skip buckets: unsupported / budget-filtered / off-season | recorded separately so a skip is never read as a failure |
| `:255-268` | `sbo-verify-results.required` resolved at runtime from `gradedRunning` | a night with no graded sport is not flagged required-but-empty |
| `:290-297` | required step returns 0 records with no note | **downgraded success → `warning`** ("silent no-op" guard) |
| `:129-137` | `extractRecords()` also reads `games_inserted + props_inserted` | a dead odds feed can no longer read as "0 records, success" |
| `:135` (type `FeedBlocker`) | required feed = 0 rows for an in-season sport | collected and **thrown at the end** — the run cannot return 200 while writing nothing |
| `:374-420` | virtual step `sbo-run-prop-predictions` | inline fanout: dedupe by `(player_name, prop_type)` with `SOURCE_RANK {draftkings:3, fanduel:2, prizepicks:1}` and freshest-wins, cap `MAX_PROPS_PER_RUN = prop_fanout_limit ?? 60`, `PROP_CONCURRENCY = 3`, 70 % time share when moneyline is also scheduled (30 % reserved), 100 % on step-filtered runs; same-day predictions pre-filtered ⇒ **resumable across `*/20` runs** |
| `:308-322` | `sbo_api_costs` insert per non-skipped step | records provider/records/cost (0 for AI, see Item 2) |
| step entry shape `~:325` | `{fn, label, sport, records, duration_ms, status, note, error?}` | uniform step record consumed by the health dashboard |

### sbo-result-tracker

| file:line | guards | on hit |
| --- | --- | --- |
| `:41-49` | `ET_TZ` + `etDateOf()` via `en-CA` | ET calendar day, not UTC |
| `:52-58` | half-open UTC range for one ET day, probed at **noon UTC** | DST edge cases avoided |
| `:65-72` | `game_date` exactly midnight ET = date-only ingestion artifact | placeholder rows dropped from write-back (`:310`) |
| `:88-95` | ESPN fetch non-OK / exception | pushed to `errors[]` with sport+stage, returns `[]`, run continues |
| `:149`, `:155`, `:181` | exact-equality on net/total/score | `push`, pnl 0 |
| `:264`, `:309`, `:319` | pending scan / write-back select / update errors | recorded per-stage in `summary.errors`, loop continues |

### sbo-signal-combiner

| file:line | guards | on hit |
| --- | --- | --- |
| `:12-13` | `MIN_GRADED_PICKS_FOR_WEIGHT = 3` | below it, win_rate/streak/weight are treated as noise |
| `:178-186` | capper with `gradedSample < 3` | pushed to `unweighted[]` with reason string; excluded from the combine |
| `:191-204` | `Number(capper.capper_weight ?? 1)` | prevents the old 100× bonus to never-computed weights |
| `:248-252` | run report | returns `unweighted_count`, `unweighted[]`, `ambiguous_ny_la_skipped` |
| `:264`, `:303` | body parse / top-level catch | `{}` default; error surfaced |

### sbo-consensus-engine / sbo-top-plays / sbo-auto-capper

| file:line | guards | on hit |
| --- | --- | --- |
| `sbo-consensus-engine:79` | grade bands A≥60, B≥55, C≥50, else D | capper confidence grade |
| `:82` | ROI only when `total >= 5` | otherwise 0 (small-sample suppression) |
| `:196-197` | `consensusScore >= 80 && total >= 3` → STRONG; `>= 65 && total >= 2` → MEDIUM | signal strength gate |
| `:206` | `edgeVsImplied > 5 && consensusScore >= 65 && modelAligns` | flags `is_value_play` |
| `sbo-top-plays:29` | `.not("confidence_score","is",null)` | unscored props excluded outright |
| `:66` | elite = capper grade A or B | elite bias computed separately from public bias |
| `:79-81` | ≥2 elite vs public disagree → fade; ≥3 picks with 0 elite and 2:1 over → contrarian | narrative reason tags |
| `:110-111` | composite ≥75 → max(quarterKelly, 3 %); ≥60 → max(quarterKelly, 2 %) | stake sizing floor |
| `sbo-auto-capper:147-153` | no betting-signal pattern match (`:11`) | returns `action:'skipped', reason:'no_betting_signal'` — this is what saves the Claude call upstream |
| `sbo-auto-capper:116`, `:497` | body parse / top-level catch | `{}` default; error response |

### `_shared/*` (SBO-relevant)

| file:line | pattern |
| --- | --- |
| `_shared/perPickScore.ts:1-8` | single source of truth; `src/lib/sbo/perPickScore.ts` is a pure re-export so UI number cannot drift from persisted number |
| `_shared/statNormalize.ts:1-8` | canonical stat vocabulary + `UNMATCHABLE` sentinel; `src/lib/sbo/statNormalize.ts` re-export |
| `_shared/teamMatcher.ts:1-4` | extracted verbatim from result-tracker, behaviour-neutral; module-scoped NY/LA counter with reset/read contract |
| `_shared/espnGrading.ts:1035,1060` | `GRADED_SPORT_KEYS`, `minScore: 60` fuzzy bar; MLB config is the first entry, not a parallel system |
| `_shared/statLine.ts:1-8` | capper vocabulary → `sbo_player_game_stats.stat_line` keys, MLB v1 |
| `_shared/capperIdentity.ts:1-8` | resolve-vs-create identity gate |
| `_shared/invokeError.ts`, `_shared/errText.ts` | unwrap `FunctionsHttpError` bodies so non-2xx invokes stop reading as an opaque string |
| `_shared/sboSignals.ts`, `_shared/devigMoneyline.ts`, `_shared/espnScoreboard.ts`, `_shared/espnMlb.ts`, `_shared/sportCanonical.ts` | shared signal write, devig math, scoreboard fetch, sport canonicalization |

Importers (verified): day-engine, get-player-context, ingest-player-stats, verify-results →
`espnGrading`; match-capper-picks, score-capper-picks, parse-capper-image, telegram-intake →
`statNormalize`; result-tracker, signal-combiner → `teamMatcher`; score-capper-picks →
`perPickScore`; grade-capper-props → `statLine`; auto-capper, parse-capper-image →
`capperIdentity`; run-predictions, analyze-tonight → `devigMoneyline`.

### Additional edge cases not on the owner's list

1. `sbo-day-engine:129-137` — record-count extraction normalization (dead-feed invisibility fix).
2. `sbo-day-engine:290-297` — required-step-zero-records auto-downgrade to `warning`.
3. `sbo-day-engine:98-127` — season-window wrap-around arithmetic for NFL/NHL/NBA.
4. `sbo-day-engine:390-397` — 70/30 time split between prop fanout and moneyline predictions.
5. `sbo-day-engine:404-412` — source-rank dedupe (real book line beats a PrizePicks line).
6. `sbo-run-predictions:791-794` — odds-only confidence hard clamp at 65.
7. `sbo-result-tracker:52-58` — noon-UTC probe to read the ET offset without DST error.
8. `sbo-fetch-odds:120-122` — one-time header-key capture when the usage header is absent.
9. `sbo-match-capper-picks:172` — percentage-based line tolerance for combo props.
10. `sbo-consensus-engine:82` — ROI suppressed below a 5-pick sample.
11. DB-level: `trg_sbo_capper_picks_validate` enforces both the reason-required and
    graded_at-required invariants at write time (see Item 4.3).

---

## ITEM 4 — IMPLEMENTATION PATTERNS

**4.1 Day-engine architecture.** `MORNING_STEPS` + `PREGAME_STEPS` are per-sport; `GLOBAL_STEPS`
run once after the sport loop; `POSTGAME_STEPS` run once at the end (`:46-97`). The `steps`
selector accepts `'morning'|'pregame'|'postgame'|'full'|string[]` (`:205-227`). Sports are the
intersection of `sbo_sports.is_active`, `SUPPORTED_ALLOWLIST`, the caller's `sports` filter, and
`isInSeason()` (`:243-250`). `recordStep()` (`:281`) writes an `sbo_api_costs` row and pushes a
uniform entry `{fn, label, sport, records, duration_ms, status, note, error?}` into
`completed`/`failed`. `required:false` steps never fail the run; `required:true` steps with zero
records on an in-season sport become `FeedBlocker`s and throw at the end. The whole handler is a
`try/finally` around a hoisted `runId` so `sbo_day_engine_runs` always closes.

**4.2 Shared-helper pattern.** One implementation under `supabase/functions/_shared/`, imported
directly by edge functions and re-exported (never copied) by `src/lib/sbo/*`. Rationale stated in
each header: the UI number and the persisted number cannot drift.

**4.3 Result vocabulary.** `won | lost | push | pending` only — enforced in code
(`sbo-grade-capper-props:44`, `sbo-grade-capper-picks-alt:39,52`) and in the database by
`trg_sbo_capper_picks_validate` (BEFORE INSERT OR UPDATE on `sbo_capper_picks`), which raises when
`unsupported=true` has a blank reason, or when a `won/lost/push` transition leaves `graded_at`
NULL. "no_grading_provider" is **written at intake** (`sbo-telegram-intake:602-604`), not by the
graders; live distribution: Tennis 292, Soccer 85, UFC 42, NCAAB 10, Golf 4.

**4.4 Secrets read (names only).** `ANTHROPIC_API_KEY` — telegram-intake, weekly-report-generator.
`LOVABLE_API_KEY` — parse-capper-image, parse-prop-image, run-predictions, build-parlays,
daily-profit-plan, hedge-calculator, analyze-prizepicks, analyze-model. `ODDS_API_KEY` —
fetch-odds, ingest-book-props, track-clv, debug-sports-api. `SPORTSDATAIO_API_KEY` —
fetch-intelligence, external-results, cache-player-images, debug-sports-api.
`VITE_SPORTSDATAIO_NBA_KEY` — track-results, sync-daily, sync-pregame. `TWILIO_ACCOUNT_SID` /
`TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` — send-daily-sms, send-picks-sms, daily-automation.
`YOUR_PHONE_NUMBER` — generate-daily-briefing, send-daily-sms.
`SBO_TELEGRAM_WEBHOOK_SECRET` — telegram-intake. `SUPABASE_ANON_KEY` — external-results
(self-invoke). Plus `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` everywhere.

**4.5 Cron topology** — see Item 1c table (16 SBO jobs, 15 active, jobid 23 disabled).

**4.6 Data flow with table names.**
`sbo-fetch-odds` → `sbo_games` (`onConflict:external_id`) + `sbo_player_props`
(`onConflict:player_name,prop_type,game_date,source`) → `sbo-sync-props-master` → `props_master`
(what the Command Center reads) → day-engine prop fanout → `sbo-run-predictions` →
`sbo_predictions` / `sbo_unified_props` → `sbo-consensus-engine` → capper performance +
consensus fields → `sbo-top-plays` → `sbo_top_plays`.
Capper lane: Telegram → `sbo_telegram_posts` → `sbo-auto-capper` (identity) → Claude →
`sbo_capper_picks` → `sbo-match-capper-picks` (`matched_prop_id`) → `sbo-verify-results` /
`sbo-grade-capper-props` / `sbo-grade-capper-picks-alt` (`result`, `graded_at`) →
`sbo-score-capper-picks` (`_shared/perPickScore`) → `sbo-signal-combiner` → `sbo_signals`.
Stats lane: `sbo-ingest-player-stats` → `sbo_player_game_stats` (authoritative actuals used by the
prop grader) and `sbo-expand-stat-context` → `sbo_prop_stat_context`.

---

## ITEM 5 — FINAL STATE

**5.1 Zero paid calls confirmed.** No edge function was invoked; no AI/Odds/SportsDataIO endpoint
was contacted. Evidence: the only tools used were local filesystem reads and read-only SQL
(see Request Ledger).

**5.2 UNKNOWNs**

| UNKNOWN | how it becomes knowable |
| --- | --- |
| Real token consumption per AI site | Not derivable from source — usage is discarded. Read the AI-Gateway request logs (`list_ai_gateway_requests`) for Gemini and the Anthropic console for Claude, or add a `usage` persist write (a code change, out of scope for a read-only phase). |
| Whether `sbo-parse-prop-image`'s gateway URL (`:26`, missing `/v1`) actually resolves | Only provable by one live invoke — a paid call. Static reading shows it differs from every other site, which use `/v1/chat/completions`. Flagged, not tested. |
| Deployed-vs-source parity for each `sbo-*` function | Source is authoritative here; the deployed bundle could differ. Knowable via a function-list/deploy diff, not from the repo. |
| Which of the 30-odd manual functions are actually reachable from the UI | Requires a full `src/` route/hook grep beyond the SBO-engine scope of this phase. |
| Whether cron 110's `*/20` day-engine runs actually reach the prop fanout (vs exhausting budget first) | Read `sbo_day_engine_runs` + `sbo_api_costs` step history for the last 24 h — read-only, cheap, but not part of this phase's questions. |

**5.3 `tsgo --noEmit`** — **not run.** No code was modified this phase, so a typecheck would prove
nothing about this work. Stating it honestly rather than reporting an unrun green.
