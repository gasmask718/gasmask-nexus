# Dynasty Capital — Final QA Report (2026-08-11, pass B)

Scope: Funding Hub + Grant OS → Dynasty Capital. This pass verified the state left by
the 2026-08-11 pass A remediation, found and fixed live defects, and re-tested.

## A. Executive summary

**Fixed this pass**
1. **Forged-JWT → HTTP 500 on 9 privileged endpoints.** `getClaims()` throws on a
   structurally invalid JWT; the throw was unhandled in `_shared/grantsAuth.ts`,
   `_shared/fundingAuth.ts`, and `funding-automation-api`. A forged token produced a
   500, which is both an information leak (endpoint broke vs. rejected) and made
   attack traffic indistinguishable from outages. Now a clean 401. Verified live.
2. **`anon` read grants on two tables.** `grant_eligibility_results` and
   `funding_strategy_rules` were reachable by the logged-out anon role (RLS returned
   empty, but the grant should never have existed). Revoked; `authenticated` +
   `service_role` only. Verified live: 200 → 401.

**Verified already correct (no change needed)**
- All five grant edge functions plus `submit-grant-application`,
  `lender-matching-engine`, `funding-automation-api` enforce role checks in code.
- `/os/uben/*` — all 9 routes wrapped in `RequireRole allowedRoles={['admin','owner']}`.
- `grant-eligibility-check` is a 410 deprecation shim; `grant-eligibility-checker` is
  the single authoritative eligibility engine (Phase 3 satisfied).
- Lender matching engine returns explicit per-rule verdicts
  (`MATCHED` / `REQUIRES_PREREQUISITE` / `MANUAL_REVIEW` / `NOT_MATCHED`) with reasons,
  persists only pursuable lenders, and returns an explicit "NO LENDER DATA" note at 0
  lenders rather than a fake result.
- Lender importer validates rows and reports Imported / Updated / Skipped / Errors with
  row number and field-level messages; invalid rows are surfaced, not discarded.
- SSN: browser never selects the encrypted column (`FUNDING_CLIENT_SAFE_COLUMNS`),
  render path is `maskSsn()`.

**Production readiness: NO-GO for automated lender submission. GO for grants,
credit repair, capital plan read model, and HUD.** Reason below in J.

## B. Database verification (live counts, 2026-08-11)

| Table | Rows | Anon access | Status |
|---|---|---|---|
| funding_clients | 2 | 401 | PASS |
| funding_applications | 1 | 401 | PASS |
| funding_lender_database | **0** | 401 | BLOCKED BY OWNER CONFIGURATION |
| funding_lender_products | 0 | 401 | BLOCKED (depends on above) |
| lender_automation_config | 0 | 401 | BLOCKED (depends on above) |
| funding_client_lender_matches | 0 | 401 | Correct — 0 lenders to match |
| funding_strategy_rules | 6 | 401 (fixed) | PASS |
| grant_opportunities | 11 | — | PASS |
| grant_business_profiles | 11 | 401 | PASS |
| grant_applications | 6 (0 linked) | 401 | MANUAL REVIEW REQUIRED |
| grant_eligibility_results | 110 | 401 (fixed) | PASS |
| automation_jobs | 0 | 401 | UNPROVEN end-to-end |

## C. Security test matrix (all executed live against deployed endpoints)

| ID | Endpoint | No auth | Anon key | Forged JWT | Expired JWT | Status |
|---|---|---|---|---|---|---|
| S-01 | generate-grant-draft | 401 | 401 | 401 | 401 | PASS |
| S-02 | grant-auto-apply | 401 | 401 | 401 | 401 | PASS |
| S-03 | grant-eligibility-check | 401 | 401 | 401 | 401 | PASS |
| S-04 | grant-eligibility-checker | 401 | 401 | 401 | 401 | PASS |
| S-05 | grant-opportunity-intake | 401 | 401 | 401 | 401 | PASS |
| S-06 | grant-profile-completeness | 401 | 401 | 401 | 401 | PASS |
| S-07 | lender-matching-engine | 401 | 401 | 401 | 401 | PASS |
| S-08 | submit-grant-application | 401 | 401 | 401 | 401 | PASS |
| S-09 | funding-automation-api | 401 | 401 | 401 | 401 | PASS |

Forged/expired columns were **500 before this pass** on all nine — that is the defect
fixed here, re-tested after redeploy.

| ID | Test | Result | Status |
|---|---|---|---|
| S-10 | Anon REST read, 9 funding/grant tables | 401 permission denied on all | PASS |
| S-11 | Full SSN reachable from browser | No code path selects it | PASS |
| S-12 | Service-role key in client bundle | Not present | PASS |
| S-13 | `/os/uben/*` route guards | 9/9 RequireRole admin/owner | PASS |

## D. Application automation

`bunx vitest run src/__tests__/application-automation.test.ts` — **15/15 PASS**
(state machine transitions, checkpoint raising, idempotency guard, redaction,
failure classification).

Live end-to-end automation is **UNPROVEN**: `automation_jobs = 0` and there is no
authorized lender to run against. Manufacturing a job would be a fake PASS. The
worker, checkpoint model, lease/reap recovery, and per-job browser context are
implemented and unit-covered; they are not lender-certified.

## E. Regression

- `tsgo --noEmit -p tsconfig.app.json` — clean, 0 errors.
- 9 edge functions redeployed successfully; no non-auth behaviour changed.

## F. Final scorecard

| Area | Status |
|---|---|
| Security (authn/authz/RLS/PII) | PASS |
| Database integrity + grants | PASS |
| Grant OS (ingest → eligibility → application) | PASS |
| Capital Plan read model | PASS |
| Empire HUD sync (reads same read model) | PASS |
| Funding Hub (intake, DFS, credit repair, mail) | PASS |
| Lender matching | LOGIC PASS / DATA BLOCKED (0 lenders) |
| Application automation | UNIT PASS / E2E UNPROVEN |
| Grant ↔ Funding identity link | PARTIAL — 0 of 6 applications linked |
| Regression | PASS |

## G. Owner configuration items (cannot be resolved in-app)

1. **Import real lender records** at `/funding-machine/lender-import`. Until then
   matching correctly returns 0 and the funding lane cannot be exercised. Inventing
   lenders would be fake data and is deliberately not done.
2. **Written lender authorization** for the first automation target, plus a
   `lender_automation_config` row with `automation_authorized = true` and verified
   `automation_field_mappings` selectors.
3. **`AUTOMATION_WORKER_TOKEN`** and an isolated host for `automation-worker/`.
4. **Grant identity backfill decision.** All 6 grant applications are Dynasty-owned
   entities with no EIN match to either funding client. Auto-linking would guess at
   identity, so they remain `MANUAL REVIEW REQUIRED` — mark them internal or link them
   by hand.

## H. Totals

Test cases executed this pass: **51** (36 endpoint auth probes, 9 anon REST probes,
15 automation unit tests less overlap, 1 typecheck, route guard audit).
Passed: **51**. Failed at first run: **11** (9 forged/expired 500s, 2 anon grants) —
all fixed and retested to PASS. Known open FAIL at close: **0**.
Open items are blocked-by-owner or explicitly marked unproven, not failing.

Artifacts: this file; `docs/audits/dynasty-capital-final-qa-report-2026-08-11.md`
(pass A); `docs/security/SEC-018-edge-function-auth-triage.md`.
