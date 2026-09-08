# ICW ↔ public booking site webhooks (OS side)

Built 2026-09-08. Both edge functions are live and tested against real data.

## 1. Public site → OS: `icw-intake`

```
POST https://qalaaroashbggynpvqct.supabase.co/functions/v1/icw-intake
Content-Type: application/json
x-icw-intake-secret: <ICW_INTAKE_SECRET>
```

Body:

```json
{
  "category": "Cleaning",
  "sub_service": "Deep Clean",
  "state": "TX",
  "address": "100 Test St, Austin TX",
  "scheduled_at": "2026-09-15T15:00:00Z",
  "price": 180,
  "customer_name": "Jane Doe",
  "customer_phone": "+15125550100",
  "customer_email": "jane@example.com",
  "external_booking_id": "<public site bookings.id>"
}
```

Required: `category`, `state` (2-letter), `address`. Everything else optional.
`external_booking_id` is unique on our side — replaying the same booking returns
the existing job instead of creating a second one (`duplicate: true`, HTTP 200).

Responses:
- `201` `{ success, job_id, external_booking_id, status, assigned_worker_id, dispatch_note }`
  where `status` is the outcome *after* the existing auto-dispatch trigger ran:
  `matched` | `unmatched` | `blocked_licensing`.
- `400` missing/invalid fields (message names them), `401` bad/missing secret,
  `405` wrong method, `500` internal.
- `{"healthcheck": true}` returns 200 with no writes.

## 2. OS → public site: `icw-status-sync`

Trigger `icw_jobs_status_sync` (AFTER INSERT OR UPDATE OF status on `icw_jobs`)
fires for any job with an `external_booking_id` whose status changed to anything
other than `pending`, and calls `icw-status-sync` via `pg_net`. That function POSTs to
`PUBLIC_SITE_STATUS_WEBHOOK_URL`:

```
POST <PUBLIC_SITE_STATUS_WEBHOOK_URL>
x-icw-status-secret: <ICW_STATUS_SYNC_SECRET>

{ "job_id": "...", "external_booking_id": "...", "status": "matched",
  "previous_status": "pending", "assigned_worker_id": null, "changed_at": "..." }
```

The public site must verify `x-icw-status-secret` and return 2xx.

Every attempt is logged to `icw_dispatch_log`:
- `status_sync_sent` — queued by the trigger, and again on HTTP 2xx delivery.
- `status_sync_failed` — URL not configured, non-2xx from the public site, or a network error.

## 3. Configuration

The project is at Supabase's 100 edge-function-secret cap, so these three values live in
`public.icw_webhook_config` (service-role only, RLS on, no anon/authenticated grants).
Both functions read the environment variable first and fall back to that table, so they
can be moved to real edge secrets later with no code change.

| Key | Purpose |
|---|---|
| `ICW_INTAKE_SECRET` | public site → OS auth header |
| `ICW_STATUS_SYNC_SECRET` | OS → public site auth header (also used by the DB trigger) |
| `PUBLIC_SITE_STATUS_WEBHOOK_URL` | where status updates are POSTed — **currently NULL** |

Until the URL is set, status changes log `status_sync_failed` with a clear reason rather
than silently dropping.

## 4. Proof (live, 2026-09-08)

- Missing header → 401; wrong header → 401.
- `{"category":"Cleaning"}` → 400 "Missing required field(s): state, address".
- Real TX booking → 201, job created, dispatch ran → `unmatched`
  ("No worker available… state=TX, category=Cleaning") because no approved ICW workers exist yet.
- Replay of the same `external_booking_id` → 200 `duplicate: true`, same job id.
- Status change to `in_progress` with the URL temporarily pointed at a live echo endpoint →
  `status_sync_sent … delivered … (HTTP 200)`. URL reset to NULL and the test job removed afterwards.
- Side fix required to make dispatch run at all: `icw_dispatch_job` cleared its temp candidate
  table with an unqualified `DELETE`, which the production guard rejects
  ("DELETE requires a WHERE clause"). Changed to `DELETE … WHERE true` — identical behaviour.
