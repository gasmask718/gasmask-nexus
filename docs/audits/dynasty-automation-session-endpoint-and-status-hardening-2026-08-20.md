# Dynasty Funding Hub — Application Automation: Session Endpoint & Status-Transition Hardening

**Date:** 2026-08-20 (third independent pass)
**Scope:** `supabase/functions/funding-automation-api`, `supabase/functions/_shared/automation/policy.ts`,
`automation_jobs`, `automation_sessions`, `automation_events`, `automation_checkpoints`,
`automation_job_guard`, `automation_session_guard`
**Method:** full code re-read → live DB probes (constraints, ACLs, RLS, trigger bodies) → fix →
unit/regression tests → deploy → live API probes → state re-verification
**Verdict: GO WITH CONDITIONS** — operator-supervised use only. The owner actions in §6 remain open.

---

## 1. Headline finding — the lease check stopped at the job endpoints (CRITICAL, fixed)

The previous pass added `assertWorkerHoldsJob` to every *job*-keyed worker endpoint. The two
*session*-keyed endpoints were never covered:

- `session-status` — checked only `caller.kind === 'worker'`
- `close-session` — checked only that the caller was a worker or an operator

A session id is not a capability. Any holder of the shared fleet worker token could therefore, on a
**session belonging to another client's job**:

- drive it `OPEN → RUNNING`,
- terminate it (`FAILED`), destroying another worker's live run, and
- with `escalate: true`, drive `haltJob()` on that job — writing an arbitrary
  `failure_class` / `failure_reason` onto another client's application and taking it off the queue.

Live proof against fixture session `5a966dbf…` (job `…ab0e`, unleased), before the fix the call was
accepted; after the fix:

```
session-status  → 403 WORKER_NOT_LEASE_HOLDER
close-session   → 403 WORKER_NOT_LEASE_HOLDER   (escalate never reached haltJob)
session         still OPEN
job             still STARTING, failure_class null
```

**Fixed by** `assertWorkerOwnsSession(session, body, caller)`: resolves the session's owning job and
applies the same lease check (holder identity + lease expiry) before any session write.

---

## 2. Other defects found and fixed this pass

| ID | Severity | Defect | Fix |
|---|---|---|---|
| F-01 | Critical | Session endpoints were not lease-scoped (§1) | `assertWorkerOwnsSession` on `session-status` and `close-session` |
| F-02 | High | `report-event` accepted **any** job status from the worker. Two calls (`RUNNING → READING_RESPONSE → COMPLETED`) walked a job to COMPLETED with `result_status` null, `submission_confirmed` false and **no Funding Hub write** — a false green on an application that was never submitted | `REPORTABLE_STATUSES` progress allow-list; anything else → `400 STATUS_NOT_REPORTABLE` plus an `ILLEGAL_STATUS_REPORT` audit event |
| F-03 | Medium | `resolve-checkpoint` passed `body.next_status` straight into the job update — an operator could park a job in `COMPLETED`/`SUBMITTING` without a lender result | `RESUMABLE_STATUSES` allow-list (`FILLING`, `DOCUMENT_UPLOAD`, `READY_TO_SUBMIT`, `NEEDS_HUMAN_REVIEW`) |
| F-04 | Medium | `create-job`'s duplicate guard used `.maybeSingle()` and **ignored the error**. With two open jobs on one application the read errors, `data` is null, and the guard reads as "no open job" — permitting a duplicate live job and therefore a duplicate lender submission | Guard decided by `decideOpenJob()`, fail **closed**: a failed probe returns 409 `QUERY_FAILED`; multiple rows return 409 with `open_job_count` |

The three rules above now live in `supabase/functions/_shared/automation/policy.ts` as pure
functions so they are unit-testable without a live function.

## 3. Database verification — no change required

Read directly from the live database:

| Check | Result |
|---|---|
| `automation_jobs_status_check` / `failure_class_check` / `result_status_check` | present, cover every code the API raises |
| `automation_sessions_status_check` | includes `OPEN`; matches `LIVE_SESSION_STATES` in code |
| `automation_job_guard` | full transition matrix enforced; `COMPLETED` reachable only from `READING_RESPONSE` or `NEEDS_HUMAN_REVIEW` |
| `automation_session_guard` | ownership fields immutable, terminal sessions immutable, `HUMAN_CHECKPOINT` cannot be resumed into a live state |
| `anon` privileges on all four automation tables | none |
| `authenticated` privileges | SELECT-only on `automation_sessions`; SELECT/INSERT/UPDATE elsewhere, every one gated by an `is_funding_operator()` RLS policy (verified `polwithcheck`) |
| `service_role` | ALL (required by the edge function) |

`automation_events` INSERT by `authenticated` is `WITH CHECK is_funding_operator()` — audit rows
cannot be forged by an ordinary signed-in user.

## 4. Live API probes — 9/9 PASS (post-deploy)

| Probe | Expected | Actual |
|---|---|---|
| H1 `session-status` on an unowned session | 403 | `WORKER_NOT_LEASE_HOLDER` |
| H2 `close-session` + `escalate` on an unowned session | 403, no halt | `WORKER_NOT_LEASE_HOLDER`, job untouched |
| H3 no credentials | 401 | 401 |
| H4 unknown action | 400 | 400 |
| H5 worker `claim-job` | 200, no unsafe job offered | `{job:null}` |
| F3 unknown session id | 404 | `Session not found` |
| F4 `report-event` on an unleased job | 403 | `WORKER_NOT_LEASE_HOLDER` |
| State check — session `5a966dbf…` | unchanged | still `OPEN` |
| State check — job `…ab0e` | unchanged | `STARTING`, `failure_class` null |

## 5. Test suite — 42/42 PASS

`src/__tests__/automation-session-isolation.test.ts` (27) and
`src/__tests__/application-automation.test.ts` (15), including 12 new regression tests covering the
`report-event` allow-list (COMPLETED explicitly rejected), the checkpoint-resume allow-list, and the
fail-closed duplicate-job guard (including the "probe itself errored" path).

**Coverage limitation, stated plainly:** the operator-side 400 responses for F-02/F-03 and the 409
for F-04 could not be exercised against the live function this pass — no operator JWT could be
minted in this environment (`lovable auth-session --user` is restricted to workspace admins/owners).
Those three gates are proven by unit tests over the exact functions the deployed handler calls, and
the worker-side path (403 before the allow-list is reached) was proven live.

## 6. Remaining owner actions before unattended lender submission

Unchanged from the previous pass, all still open:

1. Written lender authorization on file before any `automation_authorized = true`.
2. Verified selectors in `automation_field_mappings` for that lender.
3. Legal/compliance sign-off on the lender's terms of use.
4. Deploy `automation-worker/` to the dedicated US host; `INFRASTRUCTURE_REGION` still reports `UNVERIFIED`.
5. Issue **per-worker** tokens. Job *and* session endpoints are now lease-scoped, which contains a
   compromised worker to work it legitimately claimed — but a single shared token still lets any
   holder claim work in the first place.

**No evasion capability exists anywhere in this stack:** no proxies, no user-agent or fingerprint
spoofing, no CAPTCHA solving. Bot-block detection stops the job and escalates to a human.
