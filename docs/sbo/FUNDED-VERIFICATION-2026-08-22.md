# SBO AI ENGINE — FIRST FUNDED VERIFICATION PASS
**Date:** 2026-08-22 ~15:30 UTC · **Project:** Dynasty OS / SBO AI Engine (qalaaroashbggynpvqct)
**Mode:** 100% read-only. Zero AI calls made. Zero Odds API calls. One free ESPN scoreboard read.

---

## ITEM 0 — FUNDING GATE RE-CHECK

**Anthropic leg: LIVE.** `sbo-telegram-intake` completing with usage through 13:00 UTC today.
Zero `claude_http_400` since funding (the 4 pre-funding 400s are gone). Remaining text-path
errors are content-level (`claude_parse_error`, `claude_truncated`) — the model answers fine.

**Gateway leg: FUNDING CONFIRMED, BUT BALANCE EXHAUSTED AGAIN.**

| Date | 402 dispatch errors | Successful image extractions |
| --- | --- | --- |
| 08-16 | 16 | 2 |
| 08-17 | 41 | 1 |
| 08-18 | 53 | 5 |
| **08-19** | **0** | 3 — **funding took effect 2026-08-19 ~13:32 UTC** (first vision run with token usage) |
| 08-20 | 24 | 1 (intermittent — partial balance) |
| 08-21 | 0 | 1 |
| 08-22 | 16 | 2 — last success **09:49:34 UTC**; 402s resumed **14:00 UTC** and **15:06 UTC** |

The 15:06 UTC error is gateway-shaped: `Not enough credits`, `retryable: false`,
`requires: top_up`. **As of audit time the Gateway leg is DOWN again** — the top-up covered
~3 days of vision intake (~135 successful image extractions) and drained. If a fresh top-up
landed after 15:06 UTC, the next intake cron will confirm it.

Verdict: proceeded with the read-only items because a full post-funding dataset exists
(377 picks since 08-19). **AI calls this audit: 0 of 10 budgeted.**

## ITEM 1 — POST-FUNDING INTAKE THROUGHPUT

- Posts last 48h: 247 — 124 skipped_not_pick, 77 dispatched, 34 dispatch_failed (all 402),
  4 received, 4 extracted, 2 extraction_failed, 2 deleted.
- Picks/day: 08-19: **122**, 08-20: 36, 08-21: **207**, 08-22: 12 → **377 picks in 4 days
  vs ~1/day pre-funding baseline. ~100x jump confirmed.**
- **Path split: 254/254 picks in 48h trace to image posts** (`source_message_id` =
  `channel_id:message_id` join, 100% matched, 100% media posts). The vision leg is the sole
  producer. Text path is nearly idle (a handful of `dispatched_to: claude` posts).
- DATA GAP: image-path picks never set `source_image_url` or `raw_message` — both NULL on
  all 321 picks sampled in 72h. Provenance for vision picks exists only via `source_message_id`.

## ITEM 2 — EXTRACTION ACCURACY (20-pick sample)

Captions carry almost no pick content ("DTLtennis", "SUPER MAX PLAY ➡️ EXCLUSIVE PLAYS") —
the picks live in the images, so field-level ground truth would need vision re-reads
(0 AI calls made; not burned). Verified: caption↔capper alignment, internal consistency,
semantic validity.

**Aggregate (377 post-funding picks):** avg parse_confidence **95.8**; 314/377 (83%) ≥90;
17 <70. Unsupported: 5. Null sport: 2. 10 distinct sports. player_name fill 24.7% —
unchanged vs 25% baseline, but most intake is game picks where a player is legitimately absent.
`claude_truncated`: 3 occurrences 08-22 (guard working as designed).

**Errors found (systematic, not hallucination):**
1. **Sport misclassification:** a KBO/NPB "Wake n Cash" post produced 4+ picks stored as
   `sport=MLB` (Samsung/NC Dino's over 10.5 etc.). KBO content in MLB rows poisons matching
   AND grading. **Worst systematic error found.**
2. `extracted_capper_name: 'Saturday'` — a date parsed as the capper (Fredo text post).
3. **Direction vocabulary dirty:** `WIN`, `LOSE`, `over`, `OVER`, `UNDER` mixed case; `LOSE`
   is an outcome word sitting in a direction field.
4. Spread stored in `line` on moneyline picks (NFL `line=-6, direction=WIN`, ×2).
5. Partial player names: "Gauff", "Hsu" (surname only) — will break stats-join grading.
6. Soccer "Over 2.5 goals" extracted with `prop_type` NULL (should be `total`).
No invented players detected vs captions. No hallucination pattern — the failures are
classification/normalization, not fabrication.

## ITEM 3 — GRADING ACCURACY

- Graded last 14 days: **224** (won 121, lost 103, push 0) — sources: `espn` (game picks),
  `espn_box_score` (props).
- **Independent re-grade of 15 graded picks: 14 verified correct, 0 confirmed wrong, 1 ambiguous.**
  - 8/8 prop picks re-computed from `sbo_player_game_stats` box scores: **8/8 exact match**,
    including `actual_value` == box score in every row (Cardoso REB 7, Banchero PRA 30,
    Miles PRA 38, C.Gray AST 7, Ogunbowale PRA 35, Thornton PTS+REB 14, Thomas PRA 42,
    A.Gray REB 0).
  - 6/7 game picks verified against ESPN finals (08-18): Cardinals W 3-0 ✓, Guardians W 8-1 ✓,
    Rangers W 5-0 ✓, Diamondbacks L 4-9 ✓, Mets game total 7 vs UNDER 4.5 → lost ✓.
    Ambiguous: Orioles pick with `direction='LOSE'` (vocabulary bug makes intent unreadable).
- Wrong-game audit: no date mismatches in sample. One team anomaly: Olivia Miles pick carries
  `team='TOR'` vs stat row Minnesota Lynx.
- Result vocabulary strictly won/lost/push/pending. ✓
- **Pending backlog GROWING: 1,495 pending** (1,116 at last baseline). Week of 08-17:
  377 of 384 picks pending. Grading runs ~16/day vs intake ~94/day.
- **Capper rollups WRONG:** CAPPERS FREE MLB stored 668 picks / 271W / 396L / 40.6% vs real
  join 315W / 275L / 3P / 496 pending (53.1% decided win rate). Rollup stale since 08-04
  (18 days) and `sbo_capper_performance` holds duplicate daily-snapshot rows per
  (capper, sport) — no unique key.

## ITEM 4 — MATCHING + EDGE PIPELINE

- `matched_prop_id`: 36/2,997 overall (1.2%, baseline 1.0%); post-funding 10/377 (2.7%).
- **Cron 104 matcher last 7 days: 3,691 attempts, 100% `unmatched`.** Reasons:
  `UNMATCHABLE_STAT` (tennis `sets_won`/`games_won` vs MLB prop book) and `NO_CANDIDATE`
  (candidate_count 0). It is also re-attempting **2023 backlog picks** every run — wasted cycles.
- edge_score/confidence_score: 216/2,997 populated (7.2%).
- Sport mix mismatch unchanged: props exist only for MLB (591 recent); 38% of post-funding
  picks are WNBA/NFL/Tennis/Soccer/CFL with zero prop coverage → structurally unmatchable.

## ITEM 5 — E2E TRACE (pick f1947040, post-funding)

| Stage | Timestamp (UTC) | Evidence |
| --- | --- | --- |
| Telegram posted | 09:32:56 | `posted_at` |
| Ingested | 09:49:30 | `received_at` (16.5 min poll lag) |
| Vision extraction → pick row | 09:49:34.9 | 4.5s extract; gemini-2.5-flash usage logged |
| Post status write-back | — | **STUCK at `dispatched`** despite success |
| Match | — | never matched (KBO content stored as MLB) |
| Grade | — | pending (game is today — correct) |

Gaps: post-status write-back missing; match impossible on misclassified sport.

## ITEM 6 — RUNTIME PROOF

- `sbo-parse-capper-image`: **PROVEN** — 135 runs with token usage since 08-19.
- `sbo-day-engine`: **PROVEN RUNNING** — `sbo_day_engine_runs` every 20 min today, completed,
  correct allowlist/offseason skips. Steps no-op: "no props for this sport today" (Odds API
  deactivated — correct behavior, starved input).
- `sbo-run-predictions`: **NOT PROVEN** — no log rows in 72h. `sbo_run_log` shows only daily
  `auto-verify` runs (03:59, games_fetched=0 every day — game feed dead with Odds API off).

## ITEM 7 — SPEND GUARDS

- Intake text `max_tokens: 600` **ARMED** with truncation guard (sbo-telegram-intake lines 173-215).
- Vision `max_tokens: 6000` with self-measurement instrumentation (deliberate, monitored).
- **No hard AI spend cap.** `sbo_api_budget` holds rows only for the_odds_api / sportsdata_io /
  prizepicks, all `monthly_limit_cents=0`. No Anthropic/Gateway budget row, no daily token abort.
- Gateway workspace alert: no evidence found in code/DB — treat as unset.

## ITEM 8 — PRODUCTION-READINESS VERDICT

| Stage | Verdict |
| --- | --- |
| Telegram intake | PASS |
| Dispatch | PARTIAL (status write-back stuck; 402 stalls) |
| Image extraction | PARTIAL (scale works; sport misclassification, capper artifacts, partial names) |
| Text extraction | PARTIAL (low volume; 'Saturday' capper bug; truncation guard OK) |
| Prop matching | FAIL (0% in 7d; ancient backlog re-processing) |
| Prop grading | **PASS (8/8 exact)** |
| Game grading | **PASS (6/7 verified vs ESPN)** |
| Capper rollups | FAIL (stale 18d, wrong numbers, duplicate rows) |
| Spend guards | PARTIAL (token caps armed; no AI budget cap; no alert) |
| Day engine / scheduling | PASS (clean no-op without props) |

# READY FOR PRODUCTION? **NOT-YET.**
The grading engine is production-grade (14/15 verified, 0 confirmed wrong) and intake is alive,
but: (1) Gateway balance exhausted again as of 14:00 UTC — pipeline is stalled right now;
(2) matching is 0% — nothing reaches the edge pipeline; (3) capper rollups — the numbers the
product shows — are wrong; (4) KBO→MLB misclassification is actively poisoning match/grade inputs.
Conditions to flip to YES: sustained gateway balance (or alert before exhaustion), fix sport
classification + direction vocabulary at extraction, constrain matcher to matchable sports/recent
dates, rebuild `sbo_capper_performance` as a true upserted rollup.

## REQUEST LEDGER
| Provider | Calls | Purpose | Tokens | Est. cost |
| --- | --- | --- | --- | --- |
| Lovable AI Gateway | **0** | — | 0 | 0¢ |
| Anthropic | **0** | — | 0 | 0¢ |
| Odds API | 0 | (deactivated) | — | 0¢ |
| ESPN (free HTTP) | 1 | 08-18 MLB scoreboard for independent re-grade | — | 0¢ |
| DB read queries | ~22 | all items | — | 0¢ |
**Total AI budget consumed: 0 of 10 allowed.**
