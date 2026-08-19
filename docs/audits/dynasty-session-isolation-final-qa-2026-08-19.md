# Dynasty Funding Hub — Session Isolation Final Hardening + QA Remediation

**Date:** 2026-08-19
**Scope:** `automation_sessions`, `funding-automation-api`, `automation-worker/`, operator UI session panel
**Method:** read the shipped implementation first, then execute negative tests against the live database and the unit suite. No system was rebuilt.

---

## 1. Verdict

**GO, after one critical fix.**

The session isolation design was correct end to end, but it was **inoperable in production**: the API opened sessions with a status value the database refused. Every `open-session` call would have failed with a check-constraint violation, meaning no isolated session was ever recorded and the audit trail behind the worker was empty (`automation_sessions` row count at audit start: **0**, with 4 automation jobs on record).

That is fixed, and the full ownership/reuse/consent chain is now proven by execution, not by reading code.

---

## 2. Critical defect found and fixed

### SESSION-CRIT-01 — Session status vocabulary mismatch (blocking)

| | |
|---|---|
| **Severity** | Critical — feature non-functional, silent |
| **Root cause** | The migration's `CHECK` constraint allowed `CREATED, RUNNING, HUMAN_CHECKPOINT, COMPLETED, FAILED, CLOSED, NEEDS_HUMAN_REVIEW`. `funding-automation-api` inserts `status: 'OPEN'`, and every live-session query filtered on `('OPEN','RUNNING')`. The partial unique index `uq_automation_sessions_live_job` also excluded `OPEN`. |
| **Blast radius** | `open-session` → 409 for every job. Worker never opened a browser. Duplicate-live-session protection would not have applied to `OPEN` rows had they existed. The lease reaper's session force-close never matched a row. |
| **Fix** | Migration: `OPEN` added to the status check **and** to the live-session unique index. API: single `LIVE_SESSION_STATES` constant (`CREATED, OPEN, RUNNING`) used by `open-session`, `session-status` and the reaper (reaper also sweeps `HUMAN_CHECKPOINT`). |

### SESSION-HIGH-02 — Terminated session could be walked back to live via the API

`session-status` filtered on `('OPEN','RUNNING')` and ignored the affected-row count, so a call against a closed session returned `ok: true` while writing nothing — a false green. Now it returns `409 SESSION_TERMINATED_REUSE_REJECTED` when no live row matched.

### SESSION-MED-03 — Browser downloads were not pinned to the job workspace

`openIsolatedContext()` created `<workspace>/downloads` but then launched the context with a plain `{ acceptDownloads: true }`, ignoring `contextOptionsFor()`. Downloaded lender artifacts landed in Playwright's temp area, outside the directory that `purgeWorkspace()` wipes — a cross-job residue path. The worker now builds its context **from** `contextOptionsFor()`, so the options the tests assert are the options that actually run, and downloads/screenshots/traces all live under the purged workspace.

### SESSION-MED-04 — Operators could write session rows

`automation_sessions` granted `INSERT`/`UPDATE` to `authenticated` with operator-only policies. Sessions are execution-layer evidence and must be written only by the backend. Grants revoked; operators retain `SELECT` for the job-drawer panel. Service role unchanged.

---

## 3. Executed test results

### 3.1 Database ownership chain (live, against real job/client rows, self-cleaning)

| ID | Expectation | Result | Evidence |
|---|---|---|---|
| SESSION-01 | An `OPEN` session is accepted | **PASS** | Row created (was rejected pre-fix) |
| SESSION-02 | Session pointed at client B on client A's job is rejected | **PASS** | `SESSION_CLIENT_MISMATCH` |
| SESSION-03 | A second live session for one job is rejected | **PASS** | `uq_automation_sessions_live_job` violation |
| SESSION-04 | An existing session cannot be re-pointed at another client | **PASS** | `SESSION_CLIENT_MISMATCH` |
| SESSION-05 | A `COMPLETED` session cannot be revived to `RUNNING` | **PASS** | `SESSION_TERMINATED_REUSE_REJECTED` |
| SESSION-06 | After a clean close, a fresh session for the same job is allowed (retry path) | **PASS** | New row accepted |
| SESSION-07 | No test data left behind | **PASS** | `automation_sessions` returned to 0 rows; scratch results table dropped |

### 3.2 Worker-side gate and unit suite

`bunx vitest run src/__tests__/` → **59 passed / 59**, including 12 session-isolation cases:

- ownership accepted when job + application + client all agree;
- `SESSION_CLIENT_MISMATCH` on a foreign client and on a foreign application;
- `SESSION_REUSE_VIOLATION` when a session belongs to another job;
- `SESSION_TERMINATED_REUSE_REJECTED` for `COMPLETED` / `FAILED` / `CLOSED`;
- live states (`CREATED/OPEN/RUNNING/HUMAN_CHECKPOINT`) accepted — the regression guard for SESSION-CRIT-01;
- one workspace per job, path traversal (`../../etc`) refused;
- no `storageState`, no `proxy`, no `userAgent` in context options;
- downloads, traces and screenshots all resolve inside the job workspace;
- credentials/PII (`password`, `session_cookie`, `otp_code`, `client_ssn`, `access_token`) refused in session audit records.

### 3.3 Client A / Client B isolation walkthrough (four independent layers)

1. **Claim** — `checkOwnershipChain()` compares `job.application_id`/`job.client_id` against the loaded Funding Hub application; drift halts the job with `SESSION_CLIENT_MISMATCH` and clears the lease. No lender contact.
2. **Open session** — the same chain is re-evaluated server-side, plus the live-session check, before a row exists.
3. **Worker gate** — `assertSessionOwnership()` runs before `chromium.launch()`. A mismatch closes the session with `escalate: true` and returns without opening a page, so no client data is typed anywhere.
4. **Database trigger** — `automation_session_guard()` re-derives the truth from `automation_jobs` and rejects mismatch, re-pointing, and terminal revival regardless of caller.

A session cannot carry client A's identity into client B's job at any layer, and each job gets its own throwaway Chromium context with zero inherited cookies/localStorage/sessionStorage, destroyed in `finally` alongside a full workspace purge.

### 3.4 Consent enforcement

`checkConsent()` blocks at **claim** and again at **open-session**: a client without `consent_signed = true` halts to `BLOCKED` / `CLIENT_CONSENT_REQUIRED`, requires human action, and never reaches a lender page. Two of the four jobs on record belong to clients with `consent_signed = false` and are both parked in non-executable states (`NEEDS_INFORMATION`, `CANCELLED`) — consistent with the gate.

QA-fixture containment is intact: a `is_qa_fixture` client may only be pointed at an `is_qa_fixture` lender configuration, otherwise the job is halted with `QA_FIXTURE_CONTAINMENT`.

---

## 4. Compliance posture (unchanged, re-verified)

- No CAPTCHA solving, no bot-detection evasion, no proxy or IP rotation, no user-agent/fingerprint fabrication anywhere in `automation-worker/`. Detected CAPTCHA or bot block raises a checkpoint and stops — `NEVER_AUTO_RETRY` prevents an automatic second attempt.
- Human-only steps (OTP, identity, selfie, e-signature, final certification) pause the job and close the session as `CLOSED`; only an authenticated operator can resolve them.
- The worker receives only mapped, validated values — never the raw client profile, never the SSN.
- Session records reject credential/PII fields by construction.

---

## 5. Residual risks / follow-ups (non-blocking)

1. **Workspace purge is best-effort.** `purgeWorkspace()` swallows errors so a failed wipe cannot mask a job result. A disk-full or permission failure would leave artifacts on the worker host. Recommend a startup sweep of `automation-runs/*` older than one hour and an alert on purge failure.
2. **Shared worker token.** Any holder of `AUTOMATION_WORKER_TOKEN` can call `session-status`/`close-session` for any session id. The ownership chain still prevents cross-client data flow, but per-worker tokens would tighten attribution.
3. **`infrastructure_region` is self-reported** by the worker (`US-EAST` by design, recorded never spoofed). It is evidence, not enforcement — US-cloud residency must be guaranteed by where the container is deployed.
4. Project-wide linter findings (security-definer views, broad `EXECUTE` grants) predate this work and are tracked separately.

---

## 6. Changes shipped in this pass

- Migration: `OPEN` added to the session status check + live-session unique index; operator write grants revoked.
- `supabase/functions/funding-automation-api/index.ts`: `LIVE_SESSION_STATES`, affected-row assertion in `session-status`, reaper state list widened. Redeployed.
- `automation-worker/worker.ts`: context built from `contextOptionsFor()`; downloads/screenshots pinned to the purged workspace.
- `src/__tests__/automation-session-isolation.test.ts`: +2 regression tests (live-state acceptance, workspace-pinned artifacts).
