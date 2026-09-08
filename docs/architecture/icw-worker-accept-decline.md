# ICW worker accept / decline handoff

Built 2026-09-08. Replaces the old dead-end where dispatch ended at `matched`.

## Lifecycle

```
pending ──dispatch──> awaiting_worker_response ──accept──> matched ──> in_progress ──> complete
                                │                              (fires icw-status-sync)
                                ├── decline ─────────> pending (re-dispatch, decliner excluded)
                                └── 30 min no answer ─> pending (same, logged as timeout)
```

Dispatch (`icw_dispatch_job`) now:
- excludes any worker id in `icw_jobs.declined_worker_ids`
- counts `awaiting_worker_response` as active load
- on a match sets `status='awaiting_worker_response'`, `awaiting_response_since=now()` and logs `event='awaiting_response'`
- `unmatched`/`blocked_licensing` behaviour unchanged (the unmatched note now states how many workers were excluded)

## Worker action

`public.icw_worker_respond(_job_id uuid, _accept boolean)` — SECURITY DEFINER, `authenticated` only.
Verifies: signed in → an `icw_workers` row with `user_id = auth.uid()` → worker approved → job assigned to
that worker → job still `awaiting_worker_response`. Anything else raises.

- accept → `status='matched'`, log `worker_accepted` (this status change fires `icw_jobs_status_sync`)
- decline → `status='pending'`, `assigned_worker_id=NULL`, worker appended to `declined_worker_ids`,
  log `worker_declined`; the existing auto-dispatch trigger immediately re-runs

## Timeout safety net

`public.icw_expire_worker_responses(_minutes int default 30)` — same effect as decline,
logged as `worker_response_timeout`. Not callable by anon/authenticated.

pg_cron job `icw-expire-worker-responses`, schedule `*/10 * * * *` (144 runs/day) —
worst-case release is 40 minutes against the 30-minute deadline.

## Access

- `icw_workers.user_id` (unique when set) links a worker to a login. **A worker with no `user_id`
  cannot see or answer jobs** — a manager must link the account.
- New policies: `Workers see their own icw_jobs`, `Workers see their own icw_workers row`.
  The pre-existing `Staff manage icw_*` policies (ALL / authenticated / `true`) are untouched and
  remain the broadest grant; the real ownership gate for accept/decline is inside the RPC.

## UI

- `/os/icw/my-jobs` (`ICWMyJobs.tsx`) — offers with Accept/Decline + countdown, plus confirmed work.
- ICW Command Dashboard shows an `awaiting worker response` count next to blocked/unmatched.

## Proof (live, 2026-09-08, test rows removed afterwards)

Temp TX Cleaning worker + job → dispatch produced `awaiting_worker_response` with
`awaiting_response_since` set. Backdated 45 min → `icw_expire_worker_responses(30)` returned
`{"expired":1}`, job went to `pending`, decliner recorded, re-dispatch logged
"1 worker(s) excluded because they already declined this job" and ended `unmatched` (no other worker exists).
