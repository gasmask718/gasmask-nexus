# playboxxx-recruiting-ingest

Inbound webhook for the Playboxxx recruiting engine. Make.com runs the Overpass staff
discovery and POSTs the results here; this function validates, normalises, dedupes and
writes them into `public.business_leads` with `business = 'playboxxx'`.

Stage 1 scope: **US staff leads only**. No creator lane, no Apify, no outreach, no Twilio.

## Endpoint

```
POST https://<project-ref>.supabase.co/functions/v1/playboxxx-recruiting-ingest
```

`verify_jwt = false` in `supabase/config.toml` — the shared secret is the auth boundary,
same pattern as `scraper-ingest`.

## Authentication

Header `x-playboxxx-secret: <PLAYBOXXX_INGEST_SECRET>`, compared in constant time against
the server-side secret. Missing/wrong → `401` and nothing is read or written.
No Supabase JWT, anon key or service-role key is given to Make.com.

## Request

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

A single lead object, or `{ "lead": {...} }`, is also accepted. Max 500 leads per request.

### Required fields

- `name`
- `role_type` that maps to a known category (see below)
- `state` — a valid 2-letter US state/territory

Everything else is optional; `external_id` and `phone` are strongly recommended because
they are the strongest dedupe keys.

## Role mapping (allow-list only)

| role_type | category |
|---|---|
| hair, hairdresser, makeup, salon, beauty, barber, nails, nail_salon, manicurist, spa | `beauty` |
| chef, cook, private_chef, catering, caterer | `private_chef` |
| cleaner, cleaning, housekeeping, housekeeper | `cleaner` |
| seamstress, tailor, dressmaker, decorator | `decorator` |
| florist, flowers | `florist` |
| staff, event_staff, server, waiter, waitress, usher | `staff` |

**Anything else is rejected** as `invalid` with
`unrecognised role_type '<x>' — no valid category mapping`. Unknown roles are never filed
under `other` and never silently misclassified. Adding a role means editing the map in
`supabase/functions/_shared/playboxxxLeadNormalize.ts` deliberately.

## Deduplication (scoped to `business = 'playboxxx'`)

In order, first hit wins:

1. `external_source` + `external_place_id`
2. normalised last-10 phone (`phone_last10`)
3. normalised name + city + state

Duplicates are neither re-inserted nor overwritten; the existing row id is returned.
Rows already flagged `duplicate_of` are ignored as match targets. Within one batch,
later rows are also checked against earlier ones so a single payload cannot self-duplicate.

The webhook does **not** use `upsert`: the backing unique index
`business_leads_ext_ref_unique (business, external_source, external_place_id) WHERE
duplicate_of IS NULL AND ...` is partial and therefore not a valid `onConflict` target.
It exists as a safety net only.

## Column mapping

| payload | column |
|---|---|
| — | `business` = `'playboxxx'` (hard-coded) |
| `name` | `business_name` |
| `role_type` | `category` (mapped), `category_original` (raw) |
| `phone` | `phone` (E.164 when NANP) |
| `email`, `website` | `email`, `website` |
| `address` | `full_address` |
| `city`, `state` | `city` (title-cased), `state` (upper, US-validated) |
| `latitude`, `longitude` | `latitude`, `longitude` |
| `external_id` | `external_place_id` |
| `source` | `external_source` |
| — | `source` = `'playboxxx_make_ingest'`, `status` = table default `new` |

## Responses

Batch — HTTP `200`:

```json
{ "success": true, "run_id": "make-2026-09-07-01",
  "counts": { "received": 40, "inserted": 31, "duplicate": 7, "invalid": 2 },
  "results": [
    { "index": 0, "status": "inserted", "id": "…", "external_id": "node/123" },
    { "index": 1, "status": "duplicate", "id": "…", "matched_by": "external_id" },
    { "index": 2, "status": "invalid", "error": "state must be a 2-letter US state — got 'Cebu'. Non-US leads are not supported in stage 1." }
  ] }
```

Single lead: `{ "success": true, "status": "inserted" | "duplicate", "id": "…", "matched_by": "phone" }`.

Errors: `{ "success": false, "error": "..." }` — `401` unauthorised, `400` bad JSON /
no leads / batch too large / single invalid lead, `405` wrong method.

A batch always returns `200` when it was processed, even with invalid rows, so Make.com
branches on the counts rather than on a failed HTTP call.

## Security

- Shared secret only; never logged, never returned, never stored in a table.
- Logs carry run id, counts and invalid reasons — never the secret, never full payloads.
- Insert-only; the payload cannot set `business`, `status`, ids or timestamps.
- No credential appears in any frontend file.

## Make.com setup

HTTP → Make a request:
- URL as above, Method `POST`
- Headers: `Content-Type: application/json`, `x-playboxxx-secret: <secret>`
- Body: the JSON above, "Parse response" on
- Route on `counts.inserted` / `counts.duplicate` / `counts.invalid`

## Stage 2+

Non-US (Philippines) leads need a `country` column on `business_leads` and the US-state
CHECK relaxed for non-US rows. Creator-lane ingestion, scheduling and outreach are separate.
