# Dynasty Funding Hub — Application Automation: Senior Engineering + QA Final Hardening

**Date:** 2026-08-19
**Scope:** `automation_jobs`, `automation_sessions`, `automation_events`, `automation_checkpoints`,
`supabase/functions/funding-automation-api`, `automation-worker/` (worker.ts, isolation.ts)
**Method:** code audit → live database probes → live API probes → fix → re-probe
**Verdict: GO for controlled operator-supervised use.** No lender may be enabled for
unattended browser submission until the outstanding owner actions in §7 are complete.

---

## 1. Headline finding — security halts were never persisting (CRITICAL, fixed)

Every safety gate in the API (consent missing, client-identity mismatch, QA-fixture
containment) called `haltJob()`. `haltJob()` wrote `failure_class` values that the
`automation_jobs_failure_class_check` constraint did not allow, and it **ignored the
resulting database error**.

Proven on live data before the fix — job C was denied for missing consent and the API
correctly returned 409, but the job row was untouched:

```
id      cccc3333-…ab0c
status  STARTING          ← still live and leasable
failure_class  (null)
requires_human_action  false
```

The gate was therefore **advisory only**: a consent-less job stayed claimable by the next
worker. The only trace was an event row.

**Fixed by:**
- extending the `failure_class` allow-list to cover every code the API actually raises;
- making `haltJob()` verify the write, and, if the primary write is rejected, fall back to
  a write that always unassigns the job and flags it for human action, logging
  `HALT_WRITE_FAILED`.

Proven after the fix, same job, same request:

```
status  BLOCKED
failure_class  CLIENT_CONSENT_REQUIRED
requires_human_action  true
worker_id  (null)
```

---

## 2. Other defects found and fixed

| ID | Severity | Defect | Fix |
|---|---|---|---|
| D-01 | Critical | Safety halts silently discarded (§1) | Constraint widened + verified write + fallback halt |
| D-02 | Critical | `anon` held INSERT/UPDATE/DELETE/TRUNCATE on `automation_sessions`; `authenticated` held DML | Revoked; `authenticated` = SELECT only, `service_role` = ALL, `anon` = none |
| D-03 | High | Terminal sessions could be re-closed and rewritten — audit evidence was mutable | DB trigger rejects any update to a terminal session; API returns 409 `SESSION_ALREADY_TERMINAL` |
| D-04 | High | A worker could resume a session past a `HUMAN_CHECKPOINT` | `WORKER_DRIVABLE_STATES` excludes it; DB trigger raises `SESSION_CHECKPOINT_RESUME_REJECTED` |
| D-05 | High | Worker token could enumerate/read all jobs, and create, cancel or retry jobs, and list all session records | All five actions are now operator-only |
| D-06 | High | Consent was checked only at claim time; withdrawal mid-run was never noticed | Re-verified on every worker heartbeat and again immediately before `READY_TO_SUBMIT`/`SUBMITTING`; revocation halts the job and fails the session |
| D-07 | High | Lender authorization checked at job creation only | Re-verified at claim time; unauthorized lender → `BLOCKED` / `LENDER_NOT_AUTHORIZED` |
| D-08 | High | `purgeWorkspace` swallowed errors — one client's downloads/traces could survive on disk unnoticed | Purge is verified with a `stat`; failure raises a non-retryable `WORKSPACE_PURGE_FAILED` incident |
| D-09 | Medium | `openIsolatedContext` leaked a Chromium process if context creation threw | Browser closed on the failure path |
| D-10 | Medium | False greens: `reportFailure`, `switchToManual`, `reapStale`, `closeSession` and `logEvent` returned 200 on rejected writes | All surface the error (409 / 207) and log audit-write failures |
| D-11 | Medium | API `LIVE_SESSION_STATES` disagreed with the DB partial unique index (`HUMAN_CHECKPOINT`) | Constant now mirrors the index exactly; unique violations map to `SESSION_ALREADY_LIVE` |

---

## 3. Database test results — 17/17 PASS

Recorded in `qa_session_isolation_evidence`, run label `POSTFIX-2026-08-19`.

| Test | Action | Result |
|---|---|---|
| OWN-01 | session matching job/app/client | accepted — PASS |
| OWN-02 | job B session carrying client A | `SESSION_CLIENT_MISMATCH` — PASS |
| OWN-03 | job B session carrying application A | `SESSION_CLIENT_MISMATCH` — PASS |
| OWN-04 | repoint a live session at another job | `SESSION_REUSE_VIOLATION` — PASS |
| OWN-05 | rewrite a session's owning client | `SESSION_REUSE_VIOLATION` — PASS |
| OWN-06 | revive a COMPLETED session | `SESSION_TERMINATED_REUSE_REJECTED` — PASS |
| OWN-07 | second live session for one job | `UNIQUE_VIOLATION` — PASS |
| LIFE-01/02/04 | OPEN→RUNNING→HUMAN_CHECKPOINT→COMPLETED | allowed — PASS |
| LIFE-03 | HUMAN_CHECKPOINT→RUNNING | `SESSION_CHECKPOINT_RESUME_REJECTED` — PASS |
| AUDIT-01 | rewrite a closed session record | rejected — PASS |
| REAPER-05 | new session after a terminal close | allowed — PASS |
| HALT-01 | record a `CLIENT_CONSENT_REQUIRED` halt | allowed — PASS |
| JOB-01 | COMPLETED→QUEUED | rejected — PASS |
| GRANT-01 | anon privileges on `automation_sessions` | none — PASS |
| GRANT-02 | authenticated privileges | SELECT only — PASS |

## 4. Live API probe results — 19/19 PASS

| Probe | Expected | Actual |
|---|---|---|
| AUTH-01 no credentials | 401 | 401 |
| AUTH-02 forged worker token | 401 | 401 |
| AUTH-06/07 worker lists / reads jobs | 403 | 403 Operator only |
| AUTH-08 worker resolves a checkpoint | 403 | 403 |
| AUTH-09/10/11 worker retries / cancels / creates a job | 403 | 403 |
| AUTH-12 worker lists sessions | 403 | 403 |
| AUTH-13 operator lists sessions | 200 | 200 |
| AUTH-15 unknown action | 400 | 400 |
| SESS-01 open a legitimate session | 200 | 200 |
| SESS-02 second live session | 409 | `SESSION_ALREADY_LIVE` |
| SESS-03/04 drive and close | 200 | 200 |
| FG-01 re-close a terminal session | 409 | `SESSION_ALREADY_TERMINAL` |
| FG-02 revive a terminal session | 409 | `SESSION_TERMINATED_REUSE_REJECTED` |
| CONSENT-01 open session, unconsented client | 409 | blocked |
| CONSENT-02 submission-stage event, unconsented client | 409 | `CLIENT_CONSENT_REVOKED` + job BLOCKED |
| CONC-01 five simultaneous `open-session` on one job | exactly 1 winner | 1 × 200, 4 × 409 |
| CONC-02 five simultaneous `claim-job` on one queued job | exactly 1 claim | 1 claim (attempt_count 1), then halted `LENDER_NOT_AUTHORIZED` |

## 5. Unit tests — 28/28 PASS

`src/__tests__/automation-session-isolation.test.ts` (13) and
`src/__tests__/application-automation.test.ts` (15), including the new workspace-purge
regression test.

## 6. Deliberate design decisions (not defects)

- **A retryable failure does not requeue itself.** A failed job waits for an operator
  `retry-job`. Automated re-attempts against a lender are never silent.
- **`reap-stale` is callable by the worker fleet** as well as operators — it is the lease
  recovery path the worker itself runs. It is never callable unauthenticated.
- **No evasion capability was added anywhere.** No proxies, no user-agent or fingerprint
  spoofing, no CAPTCHA solving. CAPTCHA/bot-block detection stops the job and escalates.

## 7. Remaining owner actions before unattended lender submission

1. Written authorization from the lender, on file, before setting
   `lender_automation_config.automation_authorized = true`.
2. Verified selectors in `automation_field_mappings` for that lender.
3. Legal/compliance sign-off on the lender's terms of use.
4. Deploy `automation-worker/` to the dedicated US host and confirm
   `INFRASTRUCTURE_REGION` is reported (currently `UNVERIFIED` by default).
