# Dynasty Funding Hub — Application Automation: Lease, Heartbeat & Privilege Hardening

**Date:** 2026-08-19 (second, independent pass over the 2026-08-19 hardening audit)
**Scope:** `supabase/functions/funding-automation-api`, `automation-worker/` (worker.ts, isolation.ts),
`automation_jobs`, `automation_sessions`, `automation_events`, `automation_checkpoints`,
`lender_automation_config`
**Method:** code audit → fix → unit/regression tests → migration → live API probes on QA fixtures → fixture restore
**Verdict: GO WITH CONDITIONS** — operator-supervised use only. The owner actions in §7 remain open.

---

## 1. Headline finding — a worker token could act on jobs it did not hold (CRITICAL, fixed)

The previous pass proved that the *caller class* was checked (worker vs operator). It did not check
**which job the calling worker had actually leased**. Any holder of the shared worker token could
post events, raise checkpoints, submit results, open a session or report a failure against **any**
job — including another client's job that a different worker was mid-run on.

That is a cross-client data-integrity hole: a stray or duplicated worker could write client B's
scrape result onto client A's application and drive it to `Approved`.

**Fixed by** `assertWorkerHoldsJob(job, body, caller)`, applied to every worker-callable job endpoint:

- `job.worker_id` must equal the `worker_id` in the request body → else `403 WORKER_NOT_LEASE_HOLDER`
- an expired `lease_expires_at` → `409 WORKER_LEASE_EXPIRED`
- `claim-job` is now worker-only; `heartbeat` is worker-only; operators cannot impersonate a worker

`automation-worker/worker.ts` now sends `worker_id` on **every** call centrally in `api()`, so no
endpoint can be reached anonymously-within-the-fleet.

## 2. Second finding — safety gates were claim-time only (HIGH, fixed)

Consent and lender authorization were verified when the job was claimed. A browser run lasts
minutes; consent withdrawn or lender authorization revoked during that window was never noticed and
the submission still went through.

**Fixed by** a `heartbeat` action that re-reads consent, lender authorization, QA-fixture
containment and the lease, and is called by the worker **before each irreversible stage**:
`page.goto` (first lender contact), `fillFields` (client PII typed into a third party), and
`submit`. A 409/403 aborts the run through `WorkerAborted`, which is deliberately *not* treated as
a browser crash — it never triggers a retry and never rewrites the server's halt reason.

## 3. Other defects fixed this pass

| ID | Severity | Defect | Fix |
|---|---|---|---|
| E-01 | Critical | Worker token could act on any job (§1) | `assertWorkerHoldsJob` on 6 endpoints |
| E-02 | High | No mid-run consent / authorization re-check (§2) | `heartbeat` + `reverifyLenderAuthorization` before navigate/fill/submit |
| E-03 | High | A halt from the server could be overwritten by the worker's own crash handler | `WorkerAborted` / `isAbortError` short-circuits the catch blocks |
| E-04 | Medium | An unleased `report-failure` was silently dropped — a `WORKSPACE_PURGE_FAILED` (client data left on disk) could vanish | Returns `202 {recorded:true}` and always writes an `UNLEASED_FAILURE_REPORT` audit event |
| E-05 | Medium | `authenticated` held `TRIGGER` and `REFERENCES` on all four automation tables; `anon` held residual privileges | Migration revokes both, revokes all `anon` access, keeps `service_role` = ALL |
| E-06 | Low | A halt left the job's live session open | `failLiveSession` terminates it on every safety halt |

## 4. Live API probe results — 13/13 PASS

Run against the deployed function with the real worker token and a real operator session.

| Probe | Expected | Actual |
|---|---|---|
| P1 no credentials | 401 | 401 |
| P2 forged worker token | 401 | 401 |
| P3 operator calls `claim-job` | 403 | 403 Worker only |
| P4 worker `claim-job` | 200, no unsafe job offered | 200 `{job:null}` |
| P5 `report-event` on an unleased job | 403 | `WORKER_NOT_LEASE_HOLDER` |
| P6 `submit-result` on an unleased job (fake approval) | 403, no hub write | `WORKER_NOT_LEASE_HOLDER` |
| P7 `heartbeat` on an unleased job | 403 | `WORKER_NOT_LEASE_HOLDER` |
| P8 `raise-checkpoint` on an unleased job | 403 | `WORKER_NOT_LEASE_HOLDER` |
| P9 unleased `WORKSPACE_PURGE_FAILED` | recorded, not dropped | 202 + `UNLEASED_FAILURE_REPORT` event persisted |
| P10 operator `list-sessions` | 200 | 200 |
| P11 worker `list-sessions` | 403 | 403 Operator only |
| P12 unknown action | 400 | 400 |
| P13 operator `heartbeat` | 403 | 403 Worker only |

**Mid-run deauthorization (L-series):** with the fixture lender briefly flipped, the claim was
halted and the job persisted as `status=BLOCKED`, `failure_class=LENDER_NOT_AUTHORIZED`,
`requires_human_action=true`, `worker_id=null`, with a matching `error`-level event — the halt is
durable, not advisory.

## 5. A safety control that blocked part of the test — and should stay

The leased-holder *happy path* (`heartbeat` → 200) could **not** be exercised against live data.
Every QA-fixture lender is covered by the DB constraint
`lender_automation_config_qa_never_authorized`, which rejects `automation_authorized = true` for a
fixture row outright (23514). No real lender was authorized to work around this, so the happy path
is covered by unit tests only. This is the correct trade-off: the environment is physically unable
to drive a browser at a lender, and that property should not be relaxed for testing.

## 6. Test suite — 32/32 PASS

`src/__tests__/automation-session-isolation.test.ts` (17) and
`src/__tests__/application-automation.test.ts` (15), including four new regression tests:
worker identity is attached to every API call; a 409 consent revocation aborts the run;
a lost lease aborts rather than retries; an ordinary timeout is not misread as an abort.

## 7. Remaining owner actions before unattended lender submission

1. Written lender authorization on file before any `automation_authorized = true`.
2. Verified selectors in `automation_field_mappings` for that lender.
3. Legal/compliance sign-off on the lender's terms of use.
4. Deploy `automation-worker/` to the dedicated US host; `INFRASTRUCTURE_REGION` still reports `UNVERIFIED`.
5. Issue **per-worker** tokens. The lease check now contains a compromised worker to jobs it legitimately
   claimed, but a single shared token still lets any holder claim work.

**No evasion capability exists anywhere in this stack:** no proxies, no user-agent or fingerprint
spoofing, no CAPTCHA solving. Bot-block detection stops the job and escalates to a human.
