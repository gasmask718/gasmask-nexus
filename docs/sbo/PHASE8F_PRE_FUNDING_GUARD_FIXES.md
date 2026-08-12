# SBO AI Engine — Phase 8F: Pre-Funding Guard Fixes

Date: 2026-08-12 (UTC) · Scope: SBO only · Supabase: qalaaroashbggynpvqct
Status: implemented, typecheck clean, **NOT deployed** (ships with next scheduled deploy).

---

## REQUEST LEDGER — 0 paid calls this phase

| Provider | Calls made | Proof |
|---|---|---|
| Anthropic | **0** | No edge function invoked. No `supabase--curl_edge_functions`, no `deploy_edge_functions`, no `test_edge_functions` call in this phase. All Anthropic knowledge came from reading `supabase/functions/sbo-telegram-intake/index.ts` on disk. |
| Lovable AI Gateway (Gemini) | **0** | Same — `sbo-run-predictions` / `sbo-parse-capper-image` were read with `code--view` / `grep`, never executed. |
| The Odds API | **0** | `sbo-fetch-odds` untouched and uninvoked. |
| Twilio / SMS | **0** | Not touched. |

Tools used this phase: `code--exec` (grep/sed/tsgo — local FS only), `code--view`, `code--line_replace`, `code--write`, `supabase--read_query` (read-only `SELECT`s only). **No migration, no insert, no function invocation, no deploy.** No key material was printed at any point (`ANTHROPIC_API_KEY` / `LOVABLE_API_KEY` appear only as `Deno.env.get(...)` identifiers in source).

---

## ITEM 1 — Guard A1: cap output + deterministic temperature (Anthropic)

**File:** `supabase/functions/sbo-telegram-intake/index.ts`

Before (line 162):
```ts
        max_tokens: 2000,
        system,
```
After (lines 172–179):
```ts
        // PHASE 8F — Item 1: 2000 -> 600. Never below 600 (500 caused BUG-06).
        // The stop_reason === "max_tokens" guard below makes any truncation an
        // explicit failure, so a too-small cap is visible, never silent.
        max_tokens: 600,
        // PHASE 8F — Item 1.2: extraction is deterministic; sampling buys nothing
        // and produces wasted paid retries.
        temperature: 0,
        system,
```

- **Why (8E):** the only two Anthropic sites in SBO are this one and `sbo-weekly-report-generator:181`. Output tokens bill at 5× input; 2000 was 3.3× the observed need for an 18-field JSON object.
- **Truncation is not silent:** the pre-existing guard at **:212–218** returns `claude_truncated` and the caller files `extraction_failed` (line ~638), never `skipped_not_pick`. If 600 is too small it surfaces as a red row, not a lost pick.
- **600 floor honoured** — 500 was the exact BUG-06 cause and was not used.
- **Regression risk:** LOW-MED. Very long parlay legs could hit 600 and fail loudly. Watch `sbo_telegram_posts.processing_status='extraction_failed'` with `dispatch_error LIKE 'claude_truncated%'` in the first funded week.
- **Rollback:** set `max_tokens` back to `2000` and delete the `temperature: 0` line.

---

## ITEM 2 — Persist token usage (measurement precondition)

**File:** `supabase/functions/sbo-telegram-intake/index.ts`

**2a. New return field.** Before (line 114–117) the extractor returned `{ pick, error?, raw? }` and `data.usage` was discarded at old line 176. After (lines 114–127) it also returns `usage`:

```ts
export interface ClaudeUsage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  stop_reason: string | null;
  estimated_cost_cents: number;
}
```

**2b. Capture site (lines 190–204)** — pattern copied from `claude-call-analyzer/index.ts:71-75`, the only site in the repo that reads usage today (identical `input*3/1M + output*15/1M`, `Math.ceil(... * 100)` cents math, Anthropic sonnet list price):

```ts
    const inputTokens = Number(data?.usage?.input_tokens ?? 0);
    const outputTokens = Number(data?.usage?.output_tokens ?? 0);
    const usage: ClaudeUsage = { model: data?.model ?? CLAUDE_MODEL, input_tokens: inputTokens,
      output_tokens: outputTokens, stop_reason: data?.stop_reason ?? null,
      estimated_cost_cents: Math.ceil(((inputTokens*3)/1_000_000 + (outputTokens*15)/1_000_000) * 100) };
```
`usage` is attached to **every** return path (empty response, truncated, parse error, success) so failed-but-billed calls are also measured.

**2c. Persistence (lines 584–611).** `sbo-telegram-intake` writes **no** `sbo_function_logs` row today (verified: `rg -l sbo_function_logs supabase/functions` returns only `sbo-system-health`, `sbo-expand-stat-context`, `sbo-collect-stats`). So there is **no conflicting writer** for this function name. A new row is inserted per extraction, following the `sbo-collect-stats:26-29 / :46` shape:

```ts
      const claudeStartedAt = Date.now();
      const { pick, error: claudeErr, raw, usage } = await extractPickWithClaude(text, ANTHROPIC_API_KEY);
      if (usage) {
        await supabase.from("sbo_function_logs").insert({
          function_name: "sbo-telegram-intake",
          status: pick ? "completed" : "failed",
          records_processed: pick ? 1 : 0,
          error_message: claudeErr ?? null,
          duration_ms: Date.now() - claudeStartedAt,
          completed_at: new Date().toISOString(),
          metadata: { phase: "8F", provider: "anthropic", call: "extract_pick",
                      source_message_id: sourceMessageId, post_id: post.id, usage },
        });
      }
```
Insert errors are logged and swallowed — telemetry must never break intake.

**Schema verification (read-only SQL, `information_schema.columns`):**
`sbo_function_logs` = `id uuid NOT NULL`, `function_name text NOT NULL`, `status text NOT NULL`, `records_processed int NULL`, `records_failed int NULL`, `records_skipped int NULL`, `error_message text NULL`, **`metadata jsonb NULL`** ✅, `started_at timestamptz NOT NULL` (defaulted — `sbo-collect-stats` omits it and works), `completed_at timestamptz NULL`, `duration_ms int NULL`.
**Choice made:** used the existing `metadata` jsonb column (as specified), nested under key `usage`. No new column, no migration.

- **Why:** without persisted counts the 8A `$5` day-1 budget cap and the 50,000-output-token/day abort cannot exist. Abort logic is **deliberately NOT added** this phase.
- **Regression risk:** LOW. One extra DB insert per text extraction; failure path is non-fatal.
- **Rollback:** delete the `if (usage) {...}` block and the `usage` field from the return type.

---

## ITEM 3 — Bound the real burn: `sbo-run-predictions` (Gemini)

**File:** `supabase/functions/sbo-run-predictions/index.ts`, function `callAI` (was lines 84–140, now 84–184).

**3.1 max_tokens.** Before: the request body at :101-107 (main) and :125-131 (retry) had **no** `max_tokens`. After: a single shared `body` const with `max_tokens: MAX_OUTPUT_TOKENS` (=400) at **:103/:128** used by both attempts — one definition, so the two paths can no longer drift.

**3.2 Retry condition.** Before (:113-138) a single `catch (e)` wrapped the whole call and **re-issued the entire request on ANY thrown error** — including 30s `AbortError` timeouts (upstream may have completed and billed) and JSON parse failures of an already-billed success. After:

| Outcome | Old behaviour | New behaviour (:139-184) |
|---|---|---|
| 429 / 5xx | retried (via throw only if fetch threw — a 500 body actually did **not** retry, it parsed garbage) | **retried once** after 2s (`res.status === 429 \|\| res.status >= 500`) |
| 4xx (402 out-of-credits, 401, 400) | silently parsed as `{}` → empty string | **no retry**, logged with status + body slice, neutral fallback |
| Timeout / transport error | **retried — double-billed** | **NOT retried**, explicit log "may already be billed" |
| Parse failure of 200 response | **retried — double-billed** | **NOT retried**, neutral fallback |

Failure return value is unchanged (`{"score": 50, "reasoning": "AI analysis unavailable — using fallback"}`), so downstream scoring behaviour is identical.

**3.3 Truncation signal (no paid call).** `readContent()` (:118-137) emits one structured `console.log` per call, tagged `sbo_ai_usage`, carrying `finish_reason`, `output_chars`, `prompt_tokens`, `completion_tokens` — all read from the response already received. If `finish_reason === 'length'` it emits a `console.warn` naming the cap.
**Verification plan for the first funded run:** grep the `sbo-run-predictions` function logs for `"finish_reason":"length"` and for the `OUTPUT TRUNCATED` warn after the first full cron-110 cycle. If truncation rate > 0, raise `MAX_OUTPUT_TOKENS` to 700 and re-measure. If `completion_tokens` p95 < 250 across a day, consider lowering to 300.

**3.4** Cron 110 fanout cadence **untouched** (no cron rows read or written this phase).

- **Regression risk:** MED. 400 tokens is the one genuinely unmeasured number here; a brain that writes long `reasoning` will get cut. Mitigated by 3.3 making it loud rather than silent, and by the fallback keeping the pipeline alive.
- **Rollback:** restore the original `callAI` body (remove `max_tokens` from `body`, re-wrap in the original try/catch retry).

---

## ITEM 4 — Image intake (`sbo-parse-capper-image`) — report only + usage persist

**`max_tokens: 6000` at :202 was NOT changed.** Vision output shape is unmeasured; blind cutting risks truncating real multi-pick extractions.

Added instead (lines 211–237, immediately after `const aiData = await aiResponse.json()`), reusing the existing `supabase` service-role client created at :131:

```ts
      await supabase.from('sbo_function_logs').insert({
        function_name: 'sbo-parse-capper-image', status: 'completed', records_processed: 0,
        completed_at: new Date().toISOString(),
        metadata: { phase: '8F', provider: 'lovable_ai_gateway', call: 'vision_extract',
          model: aiData?.model ?? 'google/gemini-2.5-flash', max_tokens_configured: 6000,
          finish_reason: aiData?.choices?.[0]?.finish_reason ?? null,
          output_chars: String(content).length, usage: aiData?.usage ?? null },
      });
```

Adds **zero** paid calls — it only reads the response body already returned. After one funded week: if `completion_tokens` p99 ≪ 6000, right-size the cap in a follow-up phase with evidence.

- **Regression risk:** LOW. One non-fatal insert; error is logged, never thrown.
- **Rollback:** delete the block.

---

## ITEM 5 — Fake-green AI cost telemetry (`API_COSTS` hardcoded 0s)

**File:** `supabase/functions/sbo-day-engine/index.ts`

**5.1 The table (was :13-27, now :12-32).** Type widened to `cost_cents: number | null`. Changes:

| Step | Before | After |
|---|---|---|
| `sbo-run-predictions` | `internal`, `0`, "Internal AI predictions" | `lovable_ai_gateway`, **`null`**, "AI spend UNKNOWN — usage-not-persisted (gemini-2.5-flash via gateway; no published per-token list price)" |
| `sbo-run-prop-predictions` | `internal`, `0` | `lovable_ai_gateway`, **`null`**, "…prop fanout…" |
| `sbo-analyze-model` | `internal`, `0`, "Internal model analysis" | `lovable_ai_gateway`, **`null`**, "…gemini-3-flash-preview…" |
| `sbo-compare-odds`, `sbo-generate-daily-briefing` | `internal`, `0` | unchanged `0`, note clarified "no model call" (verified: neither contains a gateway/Anthropic fetch) |
| all feed/subscription/Twilio rows | unchanged | unchanged |

**5.2 The insert (was :309-325, now :309-331).**
```ts
      const knownCost = typeof costInfo?.cost_cents === 'number' ? costInfo.cost_cents : null;
      ...
        totalCostCents += knownCost ?? 0;
      ...
          endpoint_called: costInfo && knownCost === null
            ? `${step.fn} [cost:unknown usage-not-persisted]` : step.fn,
          estimated_cost_cents: status === 'error' ? 0 : knownCost,
```
Sentinel chosen: **`NULL` + an explicit `[cost:unknown usage-not-persisted]` marker on `endpoint_called`** — not `-1`. Reason below.

**5.3 No invented prices.** The Lovable AI Gateway publishes no per-1M-token list price accessible read-only, so no cost is derived for the Gemini steps — sentinel + note only, exactly as instructed. Anthropic list price **is** known ($3/$15 per 1M) and is applied in Item 2 inside `sbo_function_logs.metadata.usage.estimated_cost_cents`; `sbo-telegram-intake` is not an `API_COSTS` step so it needs no entry here.

**5.4 Dashboard safety (why NULL, not -1).**
- Column verified nullable: `sbo_api_costs.estimated_cost_cents integer NULL`.
- Sole consumer: `src/components/sbo/SyncDashboard.tsx:222-231` — `byProvider[row.api_provider].cost += row.estimated_cost_cents || 0;`. `null || 0 → 0`: renders cleanly, contributes nothing. **`-1` would have silently subtracted a cent per row from the displayed total** — a worse lie than the zero. Hence NULL.
- Other writers (`sbo-sync-polymarket:122`, `sbo-sync-polymarket-full:180`) write genuine `0` for genuinely-free feeds — untouched and still correct.

- **Regression risk:** LOW. Dashboard math unchanged for real costs; AI rows now show 0 *contribution* but are labelled unknown in `endpoint_called`.
- **Rollback:** restore the all-`0` `API_COSTS` table and the `|| 0` insert expression.

---

## ITEM 6 — Confirm nothing else burns (static re-check)

1. **Real-burn flags addressed.** `sbo-run-predictions` is now bounded (400) and retry-scoped (Item 3). `grep -n "max_tokens" sbo-telegram-intake sbo-run-predictions` → `600` (:175) and `MAX_OUTPUT_TOKENS` (:103, :128) only.
2. **Idempotency gate intact.** `sbo-telegram-intake` :337-362 (unshifted region, above all edits) still hashes `{text, image_url, has_media, image_data.length}`, compares against `sbo_telegram_posts.content_hash` for the `(channel_id, message_id)` natural key, and returns `reason: "duplicate_delivery"` **before** any capper resolution or Claude call → duplicate deliveries cost **zero** model calls. Natural-key index present (SQL: 1 index on `sbo_telegram_posts` matching `channel_id`+`message_id`).
3. **No Anthropic vision call anywhere in SBO** — the only Anthropic sites remain `sbo-telegram-intake` (text-only, `messages: [{ role: "user", content: user }]`, a string) and `sbo-weekly-report-generator:181`.
4. **`sbo-match-capper-picks` = 0 AI calls.** `grep -c "gateway.lovable.dev\|anthropic" supabase/functions/sbo-match-capper-picks/index.ts` → **0**. Unchanged this phase; still purely deterministic.
5. **`API_COSTS` AI zeroes gone** (Item 5) and the dashboard renders the sentinel without error (5.4). Note: 3,565 **historical** `sbo_api_costs` rows for the three AI feeds still carry `estimated_cost_cents = 0` — they are pre-fix history and were **not** rewritten (no destructive migration). Read them as "unmeasured", not "free".

---

## FINAL VERIFICATION

1. **`npx tsgo --noEmit` → clean.** Exit 0, no diagnostics.
2. **ZERO paid calls of any provider this phase.** No edge function invoked, tested, or deployed by me. See REQUEST LEDGER.
3. **Edge functions modified (none deployed):**

| Function | Lines changed | Deployed? |
|---|---|---|
| `sbo-telegram-intake` | 114–127 (usage type), 166–232 (max_tokens 600 + temperature 0 + usage capture), 584–611 (persist) | **No** — ships with next scheduled deploy |
| `sbo-run-predictions` | 84–184 (`callAI` rewrite: max_tokens 400, transient-only retry, usage/truncation log) | **No** |
| `sbo-parse-capper-image` | 211–237 (usage persist; `max_tokens: 6000` at :228 unchanged) | **No** |
| `sbo-day-engine` | 12–32 (`API_COSTS` sentinel), 309–331 (insert honours NULL) | **No** |

Every change carries a `PHASE 8F` marker comment — grep `PHASE 8F` to audit or revert.
4. **No key material printed.** Confirmed.
5. **Result vocabulary intact.** `SELECT count(*) FROM sbo_capper_picks WHERE result IS NOT NULL AND result NOT IN ('won','lost','push','pending')` → **0 rows**.
6. **Trigger + indexes.** `pg_trigger.tgenabled` for `trg_sbo_capper_picks_validate` = **`'O'`** ✅. Both natural-key indexes present: `idx_sbo_capper_picks_natural_key` and `idx_sbo_capper_picks_natural_key_active` (12 indexes total on the table) ✅.
7. **No destructive migration, no schema change, no `_shared/*` file touched** — the re-export pattern and the teamMatcher token-level fix are byte-identical.

### UNABLE TO COMPLETE / UNKNOWN

- **UNKNOWN — is 400 output tokens sufficient for `sbo-run-predictions`?** Cannot be known read-only; no call may be made this phase. Becomes knowable on the first funded cron-110 cycle via the `sbo_ai_usage` / `OUTPUT TRUNCATED` logs added in Item 3.3.
- **UNKNOWN — is 600 sufficient for the Claude extractor on long parlays?** Becomes knowable via `sbo_telegram_posts.dispatch_error LIKE 'claude_truncated%'` after funding.
- **UNKNOWN — Lovable AI Gateway per-token list price.** Not published in any read-only source available here; hence the honest NULL sentinel rather than a derived cost. Becomes knowable from the gateway's billing/usage surface once funded.
- **UNKNOWN — is `max_tokens: 6000` over-provisioned for vision?** By design: Item 4 persists the measurement rather than guessing.
- **NOT DONE (by instruction):** the day-1 $5 budget cap and 50,000-output-token/day abort — deferred to Phase 8A after funding is live.
- **NOT DONE (by instruction):** cron 110 cadence, `sbo-weekly-report-generator` (already capped at 1000), and any change to `sbo-parse-capper-image`'s token cap.
