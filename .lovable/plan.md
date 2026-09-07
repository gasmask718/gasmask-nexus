# Playboxxx Recruiting Ingest Webhook — Stage 1 (US staff leads)

A single secure endpoint that Make.com posts Overpass staff results to. It checks a
shared secret, validates and normalises each lead, skips duplicates, and writes into
the existing shared lead table tagged as Playboxxx. No new lead table, no outreach,
no Twilio, no Apify, no creator lane.

## What inspection found (facts the design rests on)

- The shared table is `public.business_leads` (258,216 rows, all currently `business = 'ut'`).
- `business` is NOT NULL with **no default** and a CHECK list of
  `ut, toptier, dynasty, brandaro, gasmask, surplus, brightsun` — **`playboxxx` is not allowed yet**.
- `state` is NOT NULL, must be exactly 2 uppercase characters, and must be a real US
  state/territory. There is **no country column**. So non-US leads cannot be stored today —
  hence US-first, per your answer.
- `business_name` NOT NULL; `category` NOT NULL against a fixed allowed list;
  everything else relevant (`phone`, `email`, `city`, `website`, `full_address`,
  `latitude`, `longitude`, `external_source`, `external_place_id`, `metro`, `notes`) is nullable.
- Dedupe today: unique index `(external_place_id, business)` — but it is a **partial**
  index, so it cannot be used as an upsert conflict target (standing project rule).
  There is also a generated `phone_last10` column and an index on it.
- The existing writer `ut_upsert_partner_lead(p jsonb)` requires a `business` key and raises without it.
- Existing webhook auth precedent in this project: `scraper-ingest` uses a shared-secret
  header checked in code plus `verify_jwt = false` in `supabase/config.toml`.
- Existing dedupe precedent: `supabase/functions/_shared/icwCandidateDedupe.ts`
  (source id → normalised phone → name + city + state), which this reuses.
- The Playboxxx candidate screens filter by job category only, **not** by business — so
  without scoping they would show Unforgettable Times leads. You asked for scoping.

## 1. Files created

| File | Purpose |
|---|---|
| `supabase/functions/playboxxx-recruiting-ingest/index.ts` | The webhook |
| `supabase/functions/_shared/playboxxxLeadNormalize.ts` | Role→category mapping, phone/state/city normalisation, US-state validation |
| `docs/architecture/playboxxx-recruiting-ingest.md` | Endpoint contract, payload, Make.com setup, dedupe rules |

## 2. Existing files modified

| File | Change |
|---|---|
| `supabase/config.toml` | Add `[functions.playboxxx-recruiting-ingest] verify_jwt = false` |
| `src/pages/os/playboxxx/recruiting/Candidates.tsx` | Add `.eq('business','playboxxx')` to the candidate query |
| `src/pages/os/playboxxx/recruiting/RecruitingDashboard.tsx` | Same filter on the count queries |

Nothing else is touched. No existing table is dropped or renamed.

## 3. Database migration — yes, one, additive

1. Add `playboxxx` to the `business` CHECK list (drop + recreate the same constraint with one extra value).
2. Add a **partial** unique index
   `business_leads_ext_ref_unique ON (business, external_source, external_place_id)
   WHERE duplicate_of IS NULL AND external_source IS NOT NULL AND external_place_id IS NOT NULL`.
   Verified against live data first: a plain unique index would **fail** — of 297,010 rows,
   110,038 carry both source and external id and 204 of those form duplicate groups. All 204
   involve rows already marked `duplicate_of`, so once those are excluded the remaining set is
   unique (0 conflicting groups). The partial form therefore applies cleanly today. Because a
   partial index cannot be an upsert conflict target (standing project rule), the webhook does
   **not** upsert — it looks a lead up first and inserts only when there is no match (section 9).
   The index is a safety net, not the dedupe mechanism.
3. Add an index on `(business, category, created_at DESC)` so the newly scoped Playboxxx
   screens stay fast against a ~297k-row table.

No column is added, no data is rewritten, no constraint is loosened. The US-state rule
stays exactly as it is in Stage 1.


## 4. New secret — yes, one

`PLAYBOXXX_INGEST_SECRET`, a long random string, stored server-side only and given to
Make.com to send as a header. It never appears in frontend code, in the database, or in logs.

## 5. Endpoint

`POST https://<project>.supabase.co/functions/v1/playboxxx-recruiting-ingest`

## 6. Authentication

Header `x-playboxxx-secret: <secret>`, compared in code against `PLAYBOXXX_INGEST_SECRET`
using a constant-time comparison. `verify_jwt = false` so Make.com needs no Supabase JWT
and no service-role key. Missing or wrong secret → `401`, nothing read or written.
The function itself runs with the service role, which never leaves the server.

## 7. Payload

```json
{
  "source": "overpass",
  "run_id": "make-2026-09-07-01",
  "leads": [
    {
      "external_id": "node/1234567890",
      "name": "Bella Nails & Spa",
      "role_type": "nails",
      "phone": "+1 305-555-0100",
      "email": null,
      "website": "https://example.com",
      "address": "123 Main St, Miami, FL 33130",
      "city": "Miami",
      "state": "FL",
      "latitude": 25.7617,
      "longitude": -80.1918
    }
  ]
}
```

Single-object bodies (`{ "lead": {...} }` or a bare lead) are accepted too and treated as a batch of one.
Batch cap: 500 leads per request.

## 8. Required vs optional fields

**Required:** `name`, a `role_type` that maps to a known job category, and a valid US
`state` (2-letter). A lead missing any of these — or carrying an unknown/ambiguous
`role_type` — is rejected individually as `invalid` with a clear message. It does not
fail the whole batch.
**Strongly recommended:** `external_id` (best dedupe key) and `phone`.
**Optional:** everything else.


## 9. Deduplication (in order, scoped to `business = 'playboxxx'`)

1. `external_source` + `external_id` match → duplicate.
2. Normalised last-10 phone match (`phone_last10`) → duplicate.
3. Normalised name + city + state match → duplicate.

Duplicates are **not** re-inserted and **not** overwritten; the existing row's id is
returned. Within a single batch, later rows are also checked against rows inserted
earlier in the same request, so one payload cannot create its own duplicates.

## 10. Mapping into `business_leads`

| Payload | Column | Notes |
|---|---|---|
| — | `business` | always `'playboxxx'` |
| `name` | `business_name` | trimmed, required |
| `role_type` | `category` | mapped to an allowed value; unknown → `other` |
| `role_type` | `category_original` | raw value kept |
| `phone` | `phone` | normalised to E.164 where possible |
| `email` / `website` | `email` / `website` | |
| `address` | `full_address` | |
| `city` | `city` | title-cased |
| `state` | `state` | upper-cased, US-validated |
| `latitude` / `longitude` | `latitude` / `longitude` | |
| `external_id` | `external_place_id` | |
| `source` | `external_source` | e.g. `overpass` |
| — | `source` | `'playboxxx_make_ingest'` |
| — | `status` | table default `new` |

Role mapping (agreed: reuse existing values): hair/makeup/salon/barber/nails/spa → `beauty`;
chef/cook/catering → `private_chef`; cleaner/housekeeping → `cleaner`;
seamstress/tailor/decorator → `decorator`; florist → `florist`; general staff → `staff`;
anything else → `other`.

## 11. Responses

Batch (HTTP `200`):

```json
{ "success": true, "run_id": "make-2026-09-07-01",
  "counts": { "received": 40, "inserted": 31, "duplicate": 7, "invalid": 2 },
  "results": [ { "index": 0, "status": "inserted", "id": "…", "external_id": "node/123" },
               { "index": 1, "status": "duplicate", "id": "…", "matched_by": "external_id" },
               { "index": 2, "status": "invalid", "error": "state must be a 2-letter US state" } ] }
```

Single lead: `{ "success": true, "status": "inserted" | "duplicate", "id": "…", "matched_by": "phone" }`.

Errors: `{ "success": false, "error": "..." }` with `401` unauthorised, `400` bad JSON /
missing `leads` / batch too large, `405` wrong method, `500` unexpected. `200` is returned
whenever the batch was processed, even if some rows were invalid, so Make.com can branch
on the counts rather than on a failed HTTP call.

## 12. Error handling

Per-row isolation: one bad lead never aborts the batch. Every row's outcome is reported
by index. Database errors on a row are captured as `invalid` with the message. Malformed
JSON, oversized batches and wrong methods fail before any database access.

## 13. Security

- Shared secret only; no service-role key, JWT or any credential given to Make.com.
- Secret compared in constant time; never logged, never returned, never stored in a table.
- Logs record run id, counts and per-row outcome reasons — never the secret and never full payloads.
- `verify_jwt = false` is paired with an in-code check, exactly the pattern `scraper-ingest` uses.
- Write path is insert-only into `business_leads` with a hard-coded `business = 'playboxxx'`;
  the payload cannot set the business, status, ids, or timestamps.
- No frontend change carries any credential.

## 14. Make.com setup

HTTP → Make a request:
- URL: the endpoint above · Method: `POST`
- Headers: `Content-Type: application/json`, `x-playboxxx-secret: <secret from your Make.com data store>`
- Body: the JSON in section 7
- Parse response on, then branch on `counts.inserted` / `counts.duplicate` / `counts.invalid`.

## Out of scope (Stage 2+)

Non-US / Philippines leads (needs a `country` column and a relaxed state rule),
creator-lane ingestion, Apify, scheduling, and any outreach.
