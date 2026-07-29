## UT-006 — Places API cost guard + usage ledger

Scope: metering and a cap only. No search behaviour, pagination, delay, or field-mask changes. `ingest-google-places` untouched. No migration — `ut_api_usage_log` already exists.

Confirmed ledger columns: `run_id, function_name, provider(default google_places), sku, request_count, estimated_cost, job_id, city, state, category, search_term, results_returned, leads_new, leads_duplicate, capped, created_at`.

### 1. `_shared/places-client.ts` (add only)
- Named constants with a verification comment:
  - `SKU_TEXT_SEARCH = 'text_search_enterprise'`, `COST_TEXT_SEARCH = 0.035`
  - `SKU_PLACE_DETAILS = 'place_details_enterprise'`, `COST_PLACE_DETAILS = 0.020`
  - Comment: rates must be verified against actual Google Cloud billing.
- `createUsageTracker(maxRequests = 200)` returns an object with:
  - `runId` (crypto.randomUUID), `textSearchCount`, `placeDetailsCount`, `total`, `capped`
  - `canRequest()` → total < maxRequests
  - `note(sku)` internal increment
  - `estimatedCost(sku)` helper and `rows()` → array of `{sku, request_count, estimated_cost}` (only non-zero SKUs, so a run using both writes two rows).
- `textSearch(query, apiKey, pageToken?, tracker?)` and `placeDetails(placeId, apiKey, fieldMask?, tracker?)` gain an **optional trailing** tracker arg and increment it immediately before `fetch`. Existing call signatures, request bodies, headers, masks and return values are unchanged — every existing caller (incl. any without a tracker) behaves byte-identically.

### 2. Per-run cap
- Both functions read optional `max_requests` from the request body, default `200`.
- Loop guards: before each `textSearch` page and before each `placeDetails` enrichment, check `tracker.canRequest()`. If false, set `capped = true` and break out of the API-calling loop.
- In `ut-run-territory-job`, the cap only stops further API calls — the place-processing/upsert loop still finishes writing every place already fetched, and job status/coverage updates still run. Never abort mid-write.
- In `ut-places-search`, `search_all` and `enrich_batch` stop fetching additional pages/ids and return what was gathered. `MAX_BATCH = 20` stays.

### 3. Ledger writes
- `ut-run-territory-job` already has a service-role client; it writes ledger rows in a `finally`-style path so rows are written on success, on cap, and on error.
- `ut-places-search` currently has no Supabase client — add a service-role client used **only** for ledger inserts.
- One row per non-zero SKU per invocation: `run_id` (per-invocation uuid), `function_name`, `sku`, `request_count`, `estimated_cost = count * rate`, `job_id`, `city`, `state`, `category`, `search_term` (the query), `results_returned` (places fetched), `leads_new`/`leads_duplicate` (reused directly from the existing `was_insert`-based `leadsFound` / `duplicatesSkipped` — no recount), `capped`.
- For `ut-places-search` (no job context), job/city/state/category are null; `leads_new`/`leads_duplicate` null.
- Ledger insert failures are caught and logged only — they never fail the job.

### 4. Response
- Add `requests_made`, `estimated_cost`, `capped` to both functions' JSON responses. No existing field removed or renamed (`success`, `leads_found`, `duplicates_skipped`, `enriched_count`, `places`, `count`, `next_page_token`, `pages_fetched`, `enriched`, `enriched_count`, `failed`, `capped_at` all stay).

### Verification before reporting done
- `git diff` on `supabase/functions/ingest-google-places` empty
- no files added under `supabase/migrations`
- live run with `max_requests: 6` returns `capped: true` and stops early
- ledger `request_count` equals response `requests_made`
- diff review confirming pagination counts, `delay(2000)`/`delay(2500)`/`delay(150)`/`delay(200)` and both field masks unchanged
- build/typecheck passes
