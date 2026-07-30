## UT-006b — Budget control and balance monitor

Verified against the live schema: `ut_api_budget` (monthly_limit, warn_pct, critical_pct, autopause_pct, manual_pause, auto_paused, auto_paused_at, provider) and view `ut_api_budget_status` (spend_today, spend_month, month_remaining, balance_pct, manual_pause, auto_paused, is_paused, status, calls_total). No migrations needed.

### 1. Auto-pause gate (built first)

In `_shared/places-client.ts`, add alongside the existing tracker (nothing existing is changed):

- `type BudgetStatus` mirroring the view columns.
- `fetchBudgetStatus(sb, provider = 'google_places')` — single `select` from `ut_api_budget_status`. On query failure it returns a fail-safe "paused, reason: budget_status_unavailable" result, so a broken read never allows uncontrolled spend.
- `enforceBudgetGate(sb, status)` — if `status.status === 'depleted'` and `auto_paused` is false, write `auto_paused = true, auto_paused_at = now()` to `ut_api_budget` so the pause persists until a human clears it.
- `pausedResponse(status, reason)` helper returning the standard body.

In **both** `ut-run-territory-job` and `ut-places-search`: read the status ONCE at the top of the invocation, before any Google call and before the tracker is used. If `is_paused || status === 'depleted'`:
- run the depleted→auto_paused flip,
- return `{ success: false, paused: true, reason, month_remaining, status }` (HTTP 200),
- return before any `writeLedger()` call so **no ledger row is written**.

### 2. Run-level spend ceiling

- Extend `createUsageTracker(maxRequests, maxSpend?)`: add `maxSpend`, and `canRequest()` becomes `total() < maxRequests && estimatedCost() < maxSpend`. `capped` is set the same way as today, plus a `capReason: 'requests' | 'spend' | null` for reporting.
- Both functions accept optional `max_spend` in the request body; default = `month_remaining` from the status read. `max_requests` behaviour is unchanged — both caps apply, whichever hits first stops the run and returns `capped: true`.

### 3. `src/components/unforgettable/ApiBudgetCard.tsx` (new)

React Query on `ut_api_budget_status`, `refetchInterval: 30000`.
- Large headline: `$161.46 of $200.00` remaining.
- Progress bar tinted from `status`: ok green / warning amber / critical orange / depleted or paused red (semantic tokens only).
- Rows: Spend today, Spend this month, Total API calls.
- PAUSE / RESUME switch writing `ut_api_budget.manual_pause`, with spinner + `invalidateQueries`.
- When `auto_paused`: red banner "AUTO-PAUSED — monthly budget depleted." plus a RESUME button that clears `auto_paused` (and `auto_paused_at`).
- Raw Supabase errors surfaced, no silent failures.

Mounted as the first child of the existing content block in `UTPenthouse.tsx` — no other restructuring.

### 4. In-app notification

`UTHubLayout.tsx` gets a slim persistent banner above the outlet, rendered only when `status` is `warning`, `critical`, `depleted`, or paused; text scales with severity and links to the Penthouse card. Same 30s poll via a shared `useUTApiBudget()` hook so both surfaces share one query key.

### Verification before reporting done
- `git diff` on `ingest-google-places` empty; no migration files.
- Set `manual_pause = true`, snapshot `count(*) ut_api_usage_log`, invoke a territory job, confirm `paused: true` and the count is UNCHANGED.
- Temporarily lower `monthly_limit` to force `depleted`, confirm `auto_paused` flips true; then restore `monthly_limit = 200`, `manual_pause = false`, `auto_paused = false`.
- Confirm card renders $161.46 remaining; build passes.
