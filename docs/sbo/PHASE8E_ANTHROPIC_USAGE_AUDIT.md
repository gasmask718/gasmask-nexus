# Phase 8E — Anthropic Usage Audit (READ-ONLY)
Project: Dynasty OS / SBO AI Engine (`qalaaroashbggynpvqct`) · Date: 2026-08-11 · Mode: READ-ONLY

## REQUEST LEDGER — 0 calls

| Provider | Calls this phase | Evidence |
|---|---|---|
| Anthropic | **0** | No edge function was invoked. Every fact below comes from source files (`code--exec` / `rg` / `sed`) and `supabase--read_query` SELECTs. No `curl_edge_functions`, no `test_edge_functions`, no `functions.invoke`. |
| Odds API | **0** | `sbo-fetch-odds` never invoked; no cron triggered manually. |
| DB writes | **0** | Every SQL statement issued was a `SELECT`. No migration, no insert tool call. |

No key material printed. No code modified.

---

## HEADLINE: three premises in the brief are factually wrong

| Brief says | Reality (verified) |
|---|---|
| `sbo-run-predictions` does per-game predictions "via the Anthropic path" | **FALSE.** `sbo-run-predictions/index.ts:95` and `:119` call `https://ai.gateway.lovable.dev/v1/chat/completions` with `google/gemini-2.5-flash`. It contains **zero** Anthropic references. The "4 failed while unfunded" were **Lovable AI Gateway** failures (402/credits), not Anthropic. |
| `sbo-run-prop-predictions` ran (59 saved / 1 failed / cap 60) | **It is not a function.** No `supabase/functions/sbo-run-prop-predictions/` exists. It is a *virtual step label* inside `sbo-day-engine/index.ts:51`, handled at `:375`, which fans out to `sbo-run-predictions`' `player_prop` branch — i.e. Gemini, not Anthropic. |
| `sbo-match-capper-picks` can make an Anthropic call | **FALSE.** Zero AI calls of any provider in `sbo-match-capper-picks/index.ts` (573 lines, no `anthropic`, no `gateway.lovable`, no `model:`). Pure deterministic matching. |
| Telegram intake image extraction is a high-cost Anthropic vision call | **FALSE.** The image branch (`sbo-telegram-intake/index.ts:425-461`) hands off to `sbo-parse-capper-image`, which uses `google/gemini-2.5-flash` via the Lovable gateway (`:134`, `:142`). **There is no Anthropic vision call anywhere in SBO.** |

**Consequence: funding Anthropic does not unblock the SBO pipeline.** The pipeline's blocked spend is Lovable AI Gateway credits. See §7.

---

## ITEM 1 — Every Anthropic call site

### 1a. Inside SBO — 2 call sites

| # | File:line | Model | max_tokens | temp | Granularity | Images |
|---|---|---|---|---|---|---|
| A1 | `supabase/functions/sbo-telegram-intake/index.ts:149` (`CLAUDE_URL` const `:38`, model const `:37`) | `claude-sonnet-4-5` | **2000** (`:162`, raised from 500 — BUG-06) | unset → provider default 1.0 | **per text post** | No |
| A2 | `supabase/functions/sbo-weekly-report-generator/index.ts:181` | `claude-sonnet-4-5` (`:189`) | **1000** (`:190`) | unset | **per weekly run** (1 call) | No |

**A1 trigger path:** Telethon → `sbo-telegram-intake` (webhook, `x-webhook-secret`) → idempotency gate (`:337-362`) → **image branch exits to Gemini** (`:425`) → text branch → `sbo-auto-capper` gate (`:479`); `action === "skipped"` returns **before** Claude (`:508`) → `extractPickWithClaude()`. So Claude fires only on **text-only posts that clear the capper gate**. No cron drives it; it is webhook-driven.

**A1 prompts:** system 179 chars (`:117-118`) ≈ 45 tok. User template (18-field JSON schema + pick-type rules, `:120-146`) ≈ 1,180 chars ≈ **295 tok fixed**.

**A2 trigger path:** cron job **122** `sbo-weekly-report-generator`, schedule `0 6 * * 0` (Sundays 06:00 UTC), active. One call per run, null-guarded (`if (anthropicKey)`), degrades to `"Narrative unavailable"` when unfunded — **it does not fail the run**.

**Total distinct SBO Anthropic call sites: 2.** Neither sends images. Neither is on a high-frequency cron.

### 1b. Outside SBO — same `ANTHROPIC_API_KEY`, same bill (7 more sites)

The owner is funding one key; these all draw on it:

| File:line | Model | max_tokens | Trigger |
|---|---|---|---|
| `claude-call-analyzer/index.ts:39` | `claude-sonnet-4-20250514` | see file | per completed Bland call (webhook fan-out from `bland-agent-webhook:497`, `bland-webhook:84`/`:101`) |
| `bland-call-webhook/index.ts:49` | `claude-haiku-4-5-20251001` | — | per call transcript |
| `dc-post-call-analysis/index.ts:594` | `claude-haiku-4-5` | — | per DC call |
| `credit-analysis-brain/index.ts:113` | `claude-sonnet-4-6` | — | per funding client analysis |
| `weekly-briefing/index.ts:91` | `claude-sonnet-4-20250514` | — | weekly |
| `website-pitch-writer/index.ts:35` | `claude-sonnet-4-20250514` | — | per pitch (manual) |
| `backfill-dc-lead-intel/index.ts:170`, `backfill-dc-coaching/index.ts:248` | record `claude_model` | — | backfill (writes model tag; call site upstream) |

`claude-call-analyzer` is the only site in the entire repo that already reads `usage.input_tokens` / `usage.output_tokens` (`:71-72`).

---

## ITEM 2 — Is token usage captured?

| Question | Answer |
|---|---|
| Does any **SBO** function read `usage.input_tokens` / `output_tokens`? | **NO.** `rg "input_tokens\|output_tokens\|\.usage" supabase/functions/sbo-*` returns only two false positives (`usage_rate` basketball stat in `sbo-build-prop-context:245`, `sbo-get-player-context:266`). A1 reads `data.content[0].text` and `data.stop_reason` only; the `usage` block in the response is discarded. |
| Anywhere in the repo? | **One** site: `claude-call-analyzer/index.ts:71-72` — outside SBO. |
| Could the Phase 8B run-steps shape carry usage? | **Shape-wise yes, semantically no.** `{fn,label,status,records,note,duration_ms}` has no numeric usage field; `note` is free text, so usage could only be smuggled in as a string. `sbo_function_logs` has a **`metadata jsonb`** column that *would* hold `{input_tokens, output_tokens, model}` cleanly — nothing writes it today. |
| Is `sbo_function_logs` even being written? | Barely. Last 30 days: **only 2 functions log at all** — `sbo-collect-stats` (131 runs, meta keys `players,batch_size,stat_entries`) and `sbo-expand-stat-context` (4 runs). Neither is an AI call site. |

**Verdict: post-funding, per-call Anthropic spend would be MEASURABLE ONLY from the Anthropic billing dashboard, not from this system.** There is no in-system token ledger.

---

## ITEM 3 — Cost model (paper math)

**Estimation method (ESTIMATED, flagged):** tokens ≈ chars/4 (English + JSON). Fixed prompt lengths measured directly from source. Variable input measured from real rows: `sbo_telegram_posts.message_text` avg **55 chars**, p95 **408**, max **1,852** (n=2,303). Sonnet 4.5 list price **$3/M input, $15/M output**.

Volume, from the DB (last 30 days): **2,282 posts**, of which **2,004 have media** → the image branch (Gemini). Text-only ≈ **278 / 30 days ≈ 9.3/day**, and only the subset clearing the capper gate reaches Claude (`skipped_not_pick` = 318 lifetime), so **≤ 280 Claude calls/month**.

| Call site | Model | Input tok (est) | Output tok | $/call | Calls/run | Runs/day | $/day | $/month |
|---|---|---|---|---|---|---|---|---|
| **A1 typical** (avg 55-char post) | sonnet-4-5 | 45 + 295 + 14 = **354** → $0.00106 | ~350 actual → $0.00525 | **$0.0063** | 1 | ~9.3 | $0.059 | **$1.76** |
| **A1 p95** (408-char post) | sonnet-4-5 | 45 + 295 + 102 = **442** → $0.00133 | ~500 → $0.0075 | $0.0088 | 1 | ~9.3 | $0.082 | $2.46 |
| **A1 worst case** (hits the 2000 cap) | sonnet-4-5 | 442 → $0.00133 | **2000** → $0.030 | **$0.0313** | 1 | ~9.3 | $0.29 | **$8.73** |
| **A2 weekly narrative** | sonnet-4-5 | payload JSON ~2,000 → $0.006 | cap **1000** → $0.015 | **$0.021** | 1 | 0.143 (Sun only) | $0.003 | **$0.09** |
| **SBO Anthropic TOTAL** | | | | | | | | **$1.85 typical / $8.82 worst case per month** |

Vision token cost for Anthropic: **$0.00 — there are no Anthropic image calls.**

**Most expensive SBO Anthropic call site: A1 (`sbo-telegram-intake:149`)** — not because any single call is large, but because it is the only per-row site and its 2000-token output cap is ~5.7× the real output size, so a misbehaving model can multiply the bill 5× with no guardrail.

### The real spend (Lovable AI Gateway — kept separate, but the owner must see it)
| Call site | Model | max_tokens | Volume (30d) |
|---|---|---|---|
| `sbo-parse-capper-image:134` | `google/gemini-2.5-flash` **vision** | 6000 | **2,004 image posts** |
| `sbo-run-predictions:95` + retry `:119` | `google/gemini-2.5-flash` | **none set** | 3 brains × per prop/game, cap 60/run |
| `sbo-parse-prop-image:26` | gemini-2.5-flash vision | 4000 | manual |
| `sbo-analyze-prizepicks:18` | **gemini-2.5-pro** vision | — | manual |
| `sbo-analyze-model:13` | gemini-3-flash-preview | — | manual |

`sbo_telegram_posts.processing_status`: **dispatch_failed = 656** — consistent with the AI-gateway 402 documented at `sbo-telegram-intake:209-211`. Anthropic funding will not clear a single one of those.

---

## ITEM 4 — Optimizations (ranked by impact / effort)

| # | Change | File:line | Before → After | Savings | Effort | Risk |
|---|---|---|---|---|---|---|
| **1** | **Cap A1 output to real size** | `sbo-telegram-intake/index.ts:162` | `max_tokens: 2000` → **`600`** | Removes the 5× worst case: $8.73/mo → **$2.9/mo ceiling**. Typical unchanged. | Low | Very low — largest observed valid pick JSON is well under 600 tok. The `stop_reason === "max_tokens"` guard at `:181` already surfaces truncation as an explicit failure rather than a silent skip, so a bad cap is visible, not silent. **Do not go below 600** — 500 is exactly what caused BUG-06. |
| **2** | **Set `temperature: 0`** on A1 | `sbo-telegram-intake/index.ts:157-163` (add field) | unset (1.0) → `temperature: 0` | No direct $ saving; cuts retry/parse-failure rate (`claude_parse_error`, `extraction_failed`), each failure being a fully-billed wasted call. | Low | Very low — extraction is a deterministic task; sampling buys nothing. |
| **3** | **Persist token usage** | `sbo-telegram-intake/index.ts:176` (after `const data = await r.json()`) | discard `data.usage` → write `{input_tokens, output_tokens, model}` into `sbo_function_logs.metadata` | $0 saved, but converts every future estimate in this report into a measurement. Precondition for any budget cap. | Low | None — additive logging. Copy the pattern from `claude-call-analyzer:71-72`. |
| **4** | **Model tier: A1 → Haiku 4.5** | `sbo-telegram-intake/index.ts:37` | `claude-sonnet-4-5` → `claude-haiku-4-5` | Haiku is ~$1/M in, $5/M out → **~67% cut**: $1.76 → ~$0.59/mo typical. | Low | **Medium** — this is the accuracy-critical extraction step feeding the whole pipeline. Given the absolute spend is under $2/mo, **this is not worth the accuracy risk.** Listed for completeness; recommend NO. |
| **5** | **Batch A2 payload trim** | `sbo-weekly-report-generator:170-178` | full `sport_breakdown` + `capper_breakdown` JSON → top-5 slices | ~$0.003/run | Low | Low. Not worth doing at $0.09/mo. |
| **6** | **Bound the Gemini prediction fanout** (NOT Anthropic, but the actual burn) | `sbo-run-predictions/index.ts:95-140` | no `max_tokens`; **full-call retry on any failure** (`:119`) doubles the bill on every timeout | Add `max_tokens: 400` + retry only on 5xx/429, not on parse failure | Large (unquantified — see UNKNOWN) | Med | Med — needs a real run to verify output fits 400. |
| **7** | **Prop fanout cadence** | cron **110** `sbo-prop-fanout-catchup`, `*/20 * * * *` = **72 runs/day**, cap 60 props/run, **3 AI brains per prop** (`runStatsBrain`/`runMarketBrain`/`runContextBrain`) | worst theoretical 12,960 Gemini calls/day | Same-day predictions are pre-filtered (`:372-375` comment) so steady-state is far lower — **but the ceiling is unguarded** | Med | Med |

### Burning-tokens flags
- **FLAG-1 (real):** `sbo-run-predictions:119` retries the **entire** AI call once on *any* thrown error including timeout — a slow-but-successful upstream is billed twice.
- **FLAG-2 (real):** `sbo-run-predictions` sets **no `max_tokens`** on either call. Unbounded output on a per-prop × 3-brain × 72-runs/day path.
- **FLAG-3 (not real):** re-parsing unchanged posts — **already prevented.** `sbo-telegram-intake:337-362` has a SHA-256 content-hash idempotency gate with terminal-status short-circuit; a re-delivery of identical content returns `duplicate_delivery` with **zero** model calls. 25 duplicate content-hash groups exist and are being absorbed correctly.
- **FLAG-4 (not real):** sending images to Claude — never happens.
- **FLAG-5:** `ambassador`-style dead weight — `sbo-weekly-report-generator` is the only Anthropic cron in SBO and it degrades gracefully unfunded. Nothing is silently retrying it.

---

## ITEM 5 — GO / NO-GO on Phase 8A as written

### Verdict: **NO-GO as written — but for the opposite reason to the one assumed.**

Phase 8A is not expensive. SBO's entire Anthropic surface is **~$1.85/month typical, $8.82/month worst case**. Cost is not the risk. The risk is that **8A funds the wrong provider and its three stated deliverables cannot complete.**

1. **"137 MLB props lack OVER/UNDER direction; fix via an Anthropic re-extraction pass."**
   - The **137 rows could not be located.** Checked and found **0** in every candidate: `sbo_capper_picks` (`direction` null where `prop_type` not null) = 0; `sbo_player_props` — **has no direction/side column at all**; `sbo_prop_picks.side` null = 0; `sbo_prop_predictions.direction` null = 0; `sbo_sdio_props` = **0 rows in the table**.
   - **8A must name the exact table and column before this item can be scoped.** As written it is unexecutable.
   - Also: no existing code path performs prop re-extraction via Anthropic. Building it would be **new work**, not a backfill run.

2. **"One intake invoke."** Valid and cheap (~$0.006), but it only exercises Claude if the test post is **text-only**. A test post with an image exercises **Gemini**, and will fail on Lovable AI credits, not Anthropic.

3. **"Fresh pick end-to-end."** End-to-end traverses `sbo-parse-capper-image` (Gemini) and/or `sbo-run-predictions` (Gemini). **Funding Anthropic alone cannot turn this green.**

### Exact edits to the 8A prompt
1. **Replace** "fund Anthropic" as the sole precondition with: "fund **Lovable AI Gateway credits** (primary — unblocks image intake and predictions) **and** Anthropic (secondary — unblocks text pick extraction only, ~$2/mo)."
2. **Strike** the claim that `sbo-run-predictions` / `sbo-run-prop-predictions` / `sbo-match-capper-picks` are Anthropic paths. Only `sbo-telegram-intake` and `sbo-weekly-report-generator` are.
3. **Amend the 137-prop item** to first require: "identify the table and column holding the 137 direction-less MLB props, with a SELECT proving the count, before writing any re-extraction."
4. **Add a prerequisite step**: land optimization #3 (persist `usage` into `sbo_function_logs.metadata`) **before** the first funded call, so day-one spend is measured, not inferred.
5. **Add**: lower `max_tokens` at `sbo-telegram-intake:162` from 2000 → 600 and set `temperature: 0` before the first funded intake invoke.
6. **Specify the test post is text-only** for the Anthropic leg, and a separate image post for the Gemini leg, so a failure attributes to the right provider.

### Recommended first-funded-run budget cap
- **Anthropic: $5 hard cap** at the Anthropic console for the first funded week. At the modelled rate ($1.85/mo) that is ~2.7 months of normal traffic; hitting $5 in a week means the model is misbehaving — a genuine stop signal, not a false alarm. Note the key is **shared with 7 non-SBO functions** (call analyzers, credit brain), so scope the cap knowing DC call volume also draws on it.
- **Per-run in-code guard:** after #3 lands, abort `sbo-telegram-intake` extraction when cumulative `output_tokens` for the current UTC day exceeds **50,000** (≈ $0.75/day, ~8× normal).
- **Lovable AI Gateway: this is where a cap actually matters** — 2,004 vision calls/30d at `max_tokens: 6000`. Set the workspace usage alert before re-enabling image intake.

---

## ITEM 6 — Final state

1. **ZERO Anthropic invocations. ZERO Odds invocations.** No edge function was called this phase by any means. All evidence is static source reads and read-only SQL (§Request Ledger).
2. **UNKNOWN list:**
   - **The 137 direction-less MLB props** — table/column not identified; all five candidate tables return 0 (§Item 5.1). Cannot cost a backfill for rows I cannot find.
   - **Actual output-token distribution for A1** — `usage` is discarded at `sbo-telegram-intake:176`; output sizes are ESTIMATED from schema shape, never measured.
   - **Actual image byte sizes / vision token cost** — irrelevant to Anthropic (no vision calls), and for Gemini the images arrive as caller-supplied base64 (`:427-429`) with no size logging. UNKNOWN.
   - **Steady-state Gemini prediction call volume** — depends on how many props survive the same-day pre-filter each of the 72 daily catch-up runs; not logged. UNKNOWN.
   - **Historical Anthropic spend** — no in-system record exists; only the Anthropic dashboard would know.
   - **Whether `sbo-run-prop-predictions` exists as a *deployed* function** despite having no source in the repo — it is invoked only as an internal branch label, so most likely no. Not verified (would require a function call).
3. **`npx tsgo --noEmit` — NOT RUN.** No code was modified this phase, so a typecheck would prove nothing about this audit. Reported honestly rather than claimed.
