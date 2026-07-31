## Context (verified facts this plan is built on)

- `brandaro-score-demo` today: 3 dimensions, threshold 70, scores raw HTML truncated to 8k, no fixes, no callers, 0 rows written.
- `brandaro_demo_quality_scores` already has `pass_number`, `dimension_scores`, `issues`, `fixes_applied` — all unused.
- `brandaro_demo_sites.audit_score` / `audit_breakdown` exist, unused, and `BuilderHubPage.tsx` already renders `audit_score`.
- `brandaro-generate-demo` currently fires SMS at L604 **before** the Vercel hook at L646. Spec order is deploy → audit → SMS, so this ordering gets corrected as part of the change.
- Vercel env vars are per-industry-project, so only one demo is live per industry at a time; the live URL always reflects the most recent deploy for that industry.

## Two decisions I need to flag before building

**A. "Fetch the live site" has a real timing problem.** After the deploy hook fires, Vercel takes roughly 1–3 minutes to build. Fetching `demo_url` immediately returns stale content or a 404 (and the `<slug>.<industry>.demo.brandarodigital.com` DNS may not be wired at all — unverified). Proposal: poll the live URL with backoff (6 attempts, ~15s apart, ~90s cap) and treat a fetch failure as non-fatal — fall back to scoring the full untruncated `generated_html` already stored on the row, and record `source: "live" | "stored_html"` in the breakdown so you always know which was scored. No headless browser (not available in edge runtime), so "live" means the fetched HTML response, not a rendered screenshot.

**B. Auto-fix regenerates copy, not layout.** The only things the pipeline actually controls are the AI content fields and the env vars derived from them. So a fix pass = re-run `callLovableAi` with the auditor's issue list appended as corrective instructions → re-sync env vars → re-fire the deploy hook → wait → re-score. Structural/perf/accessibility issues in `brandaro-base` itself cannot be auto-fixed; those get recorded in `issues` as `fixable: false` and reported, never silently retried.

## Implementation

### 1. `brandaro-score-demo` rewrite
- Threshold constant `PASS_THRESHOLD = 88`, `MAX_PASSES = 2`.
- Model updated to `google/gemini-3.6-flash` (current generation; `google/gemini-2.5-flash` is prior-gen). Forced tool call, unchanged pattern.
- 8 dimensions, each 0–100: `design`, `content`, `mobile`, `speed`, `trust`, `seo`, `conversion`, `accuracy`. `accuracy` = does the copy match the real business data (name/city/phone/services) passed alongside the HTML — this is the one that catches hallucinated content. `uniqueness` folded into `design`; the legacy `design_score` / `uniqueness_score` / `conversion_score` columns stay populated for backwards compat.
- `overall_score` = equal-weight mean of the 8, rounded. All 8 also stored in `dimension_scores` jsonb.
- AI also returns `issues[]` (`{dimension, severity, description, fixable}`), stored in `issues`.
- Input: full HTML, no 8k truncation (cap at a safe ~120k chars for context limits), plus a structured block of the real business facts for the accuracy check.
- Heuristic fallback retained but extended to 8 dims, and the response/row now explicitly records `scored_by: "ai" | "heuristic"` so a silent fallback is visible.

### 2. Auto-fix loop
New action `score_and_fix` on `brandaro-score-demo`:
```text
pass 1: fetch live (or stored html) -> score -> write row (pass_number=1)
        if overall >= 88 -> done
        else: regenerate copy with issue feedback -> env sync -> deploy hook -> wait
pass 2: re-fetch -> re-score -> write row (pass_number=2, fixes_applied populated)
        stop regardless of score; final row is authoritative
```
- Each pass writes its own `brandaro_demo_quality_scores` row (audit history preserved).
- `fixes_applied` on the pass-2 row records what was changed and the deploy result.
- The env-sync + hook logic is extracted from `brandaro-generate-demo` into `_shared/vercelDeploy.ts` so both functions use one implementation — no copy-paste divergence.

### 3. Writeback to `brandaro_demo_sites`
Final pass writes `audit_score` (integer) and `audit_breakdown` (jsonb: all 8 dims, pass count, issues, scored_by, source, timestamp) onto the demo row. `BuilderHubPage` starts showing real numbers with no UI change.

### 4. Wiring into `brandaro-generate-demo`
- Move the SMS block to run **after** the Vercel hook, and insert the audit between them: deploy hook → audit (`score_and_fix`) → SMS.
- Audit is fully non-fatal: any error, timeout, or AI failure is caught, logged, and generation continues to SMS as normal.
- Response gains an `audit` object: `{ score, passes, threshold, passed, scored_by, source, issues_count, error? }`.
- A low score does **not** block the SMS — the spec asks for audit-before-text ordering, not a send gate. If you want a hard gate (don't text below 88), say so and I'll add it as an opt-in flag rather than default behavior.

### 5. Cost/latency note
Audit adds one AI call plus up to ~90s of deploy-wait per pass, so a worst-case generation goes from a few seconds to ~3–4 minutes end to end. The SMS is delayed by that same amount. Acceptable? If not, the alternative is auditing asynchronously after the SMS, which breaks the spec's ordering.

## Technical details

- Files: rewrite `supabase/functions/brandaro-score-demo/index.ts`; new `supabase/functions/_shared/vercelDeploy.ts`; edit `supabase/functions/brandaro-generate-demo/index.ts`.
- No schema migration needed — every column required already exists.
- No UI changes needed.
- `batch_score` and `get_design_insights` actions preserved; `batch_score` upgraded to the 8-dim heuristic.
- Verification: deno check on all three files, then a live invoke against test lead `18e032b2-006a-4ee9-82a2-0a5b763b4729` and a report of the actual rows written.
