# Application Automation Engine — Operations Guide

## Where things live

| Piece | Path |
|---|---|
| Operator UI | `/funding-machine/automation` (`src/pages/funding-machine/ApplicationAutomationPage.tsx`) |
| UI data hooks | `src/hooks/useAutomationJobs.ts` |
| Automation API | `supabase/functions/funding-automation-api/index.ts` |
| Canonical fields + validation | `supabase/functions/_shared/automation/canonical.ts` |
| Response normalizer | `supabase/functions/_shared/automation/normalize.ts` |
| Worker (deployed separately) | `automation-worker/` |

## Onboarding a lender

1. Confirm **written authorization** from the lender for assisted/third-party submission.
   Without it, leave `automation_authorized = false` — the engine forces `manual`.
2. Create a `lender_automation_config` row linked to `funding_lender_database.id`:
   - `submission_method` = `api` | `browser` | `manual`
   - `application_url` (browser) or `api_base_url` + `api_secret_name` (API)
   - `adapter_key` = the adapter in `automation-worker/adapters/`
   - Set `requires_otp` / `requires_identity_verification` / `requires_signature` /
     `requires_final_certification` honestly — each one forces a human stop.
3. Add `automation_field_mappings` rows: lender label + selector → canonical field,
   with `field_kind`, `required`, and `allowed_values` for dropdowns.
4. Dry run on one real application and watch the audit trail.

## Running the worker

```bash
cd automation-worker
AUTOMATION_API_URL=https://<project>.functions.supabase.co/funding-automation-api \
AUTOMATION_WORKER_TOKEN=<secret> \
WORKER_ID=worker-1 \
node --loader tsx worker.ts
```

Deploy on an isolated container. Never in the browser, never on the frontend host.
Multiple workers are safe — claiming is atomic.

## Daily operator routine

1. Open `/funding-machine/automation`.
2. Clear **Waiting for Human** first: open the job, perform the OTP / identity /
   e-signature / certification step yourself in the lender's own interface, then
   write a confirmation note and click *I completed this — resume*.
   You are certifying a real action you personally performed.
3. **Needs Information** — fix the listed fields in the client's Funding Hub
   profile, then retry.
4. **Blocked** (CAPTCHA / bot block) — do not retry automation. Switch to manual.
5. **Needs Review** — read the audit trail, verify with the lender whether a
   submission actually landed, then either record the result manually in
   `/funding-machine/applications` or cancel.

## Hard rules

- Never solve or bypass a CAPTCHA, never spoof a fingerprint, never rotate IPs.
- Never certify accuracy on a client's behalf.
- Never retry a job whose `submission_confirmed = true` — confirm with the lender first.
- Never paste SSNs, OTPs, passwords, or API keys into notes; they are stored in the audit trail.

## Manual fallback

*Switch to manual* on any job. The Funding Hub application stays intact, the job
becomes a human work item, and the operator records the outcome on the
application record. Automation failure never loses an application.

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| 409 "job already open" | One open job per application by design | Cancel or finish the existing job |
| 409 "already has a confirmed submission" | Duplicate-submission guard | Verify with the lender, resolve manually |
| Job stuck `STARTING` | Worker died | `reap-stale` runs each worker tick; lease expires in 15 min |
| Every job resolves to `manual` | Lender not authorized or no config row | Complete lender onboarding above |
| 401 from the API | Missing JWT or non-operator role | Sign in as owner/admin/employee/accountant |

## Session isolation (production)

One job = one client = one throwaway browser session = one workspace.

| Guarantee | Where it is enforced |
|---|---|
| Job → application → client chain agrees | `checkOwnershipChain()` at `claim-job` and `open-session` |
| Client signed the automation authorization | `checkConsent()` — no consent, job goes `BLOCKED`, no lender contacted |
| QA fixture clients never reach a real lender | fixture client + non-fixture config → `BLOCKED` |
| One live session per job | partial check in `open-session` + `automation_sessions` DB trigger |
| No inherited cookies/localStorage/cache | `openIsolatedContext()` — fresh context, no `storageState` |
| Per-job workspace, destroyed on success *and* failure | `workspacePathFor()` + `purgeWorkspace()` in `finally` |
| Dead worker cannot leave a session live | `reap-stale` force-closes `OPEN`/`RUNNING` sessions |
| No credentials or PII in session rows | `assertNoSensitiveSessionFields()` |

Violation codes: `SESSION_CLIENT_MISMATCH`, `SESSION_REUSE_VIOLATION`,
`SESSION_TERMINATED_REUSE_REJECTED`, `CLIENT_CONSENT_REQUIRED`,
`QA_FIXTURE_CONTAINMENT`. All halt the job for human review — none auto-retry.

There is deliberately **no** proxy, IP rotation, user-agent spoofing, fingerprint
fabrication, or CAPTCHA handling anywhere in the worker. Bot protection is a stop
signal, not an obstacle.

Set `INFRASTRUCTURE_REGION` on the worker host (e.g. `US-EAST`). It is recorded on
every session row as an audit fact — it is never used to alter apparent location.

Operator view: the job drawer at `/funding-machine/automation` lists every session
with status, provider, region, owner, and any isolation error code.
