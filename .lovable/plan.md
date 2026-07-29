## UT-006 — Places API cost guard + usage ledger

State check first: sections 2–5 (metering, cap, ledger, response fields) are **already implemented and deployed** from the earlier UT-006 pass. Verified in the current code:

- `_shared/places-client.ts` — `SKU_TEXT_SEARCH = 'text_search_enterprise'` @ `$0.035`, `SKU_PLACE_DETAILS = 'place_details_enterprise'` @ `$0.020`, both flagged as Google list prices needing billing verification; `createUsageTracker()` with `canRequest()`, `total()`, `estimatedCost()`, `rows()`; both `textSearch()` and `placeDetails()` take an optional trailing tracker and increment before `fetch`.
- `ut-run-territory-job` — `max_requests` (default 200), cap guards before each page and each details call, `writeLedger()` one row per non-zero SKU on success/cap/error, response carries `requests_made`, `estimated_cost`, `capped`.
- `ut-places-search` — same tracker, cap, service-role ledger client, and response fields.

So the remaining work is **section 1 only**: search-term support.

### The one change

`supabase/functions/ut-run-territory-job/index.ts`, lines 69–78:

```ts
const searchTerm = job.search_term || job.category || '';
const term = searchTerm.replace(/_/g, ' ');
const query = `${term} in ${job.city}, ${job.state}`;
```

`ledgerCtx.search_term` stays as-is (already the literal query phrase used).

Everything else in that file is untouched. Critically, line ~169 already writes `category: job.category` to `ut_partner_leads` — the canonical value — so `search_term` never reaches the lead row and the 18-value CHECK constraint stays satisfied. No edit there; I'll just re-confirm it in the diff.

`ut-places-search` needs no change — it already takes a free-text `query` from the caller.

### Behaviour

- `search_term = 'banquet hall'`, `category = 'event_hall'` → Google gets `"banquet hall in Marietta, GA"`; leads written with `category = 'event_hall'`; ledger row records `search_term = 'banquet hall in Marietta, GA'`.
- `search_term = NULL` → falls back to `job.category` with the same `_ → space` normalisation, i.e. byte-identical to today's query string.

### Not touched

`ingest-google-places`, pagination (3 pages), `delay(2500)`/`delay(150)`/`delay(200)`, both field masks, `MAX_BATCH = 20`. No migration — both tables already exist.

### Verification before reporting done

- `git diff` on `ingest-google-places` empty; no new files under `supabase/migrations`
- deploy `ut-run-territory-job`, run a job with `search_term = 'banquet hall'` / `category = 'event_hall'`; confirm resulting `ut_partner_leads.category = 'event_hall'` and ledger `search_term` shows the banquet-hall phrase
- run a NULL-`search_term` job; confirm query string unchanged
- run with `max_requests: 6` → `capped: true`, and ledger `sum(request_count)` equals response `requests_made`
- diff review for pagination/delays/masks; build passes
