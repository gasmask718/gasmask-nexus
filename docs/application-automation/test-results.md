# Application Automation Engine — Test Results

**Run date:** 2026-08-10 · **Environment:** Lovable Cloud (live project database)

## 1. Unit tests — 15/15 PASSED

`bunx vitest run src/__tests__/application-automation.test.ts`

```
✓ src/__tests__/application-automation.test.ts (15 tests) 14ms
Test Files  1 passed (1)
     Tests  15 passed (15)
```

| Suite | Test | Result |
|---|---|---|
| canonical mapping | derives fields from Hub records without inventing data | PASS |
| canonical mapping | falls back to client record when profile absent | PASS |
| canonical mapping | exposes only known canonical keys | PASS |
| validation | formats valid currency/date/phone data | PASS |
| validation | reports missing required fields instead of submitting | PASS |
| validation | rejects invalid dropdown values | PASS |
| validation | rejects malformed emails | PASS |
| redaction | secrets never reach logs (recursive) | PASS |
| normalization | explicit API approval with amount + reference | PASS |
| normalization | unknown API status → NEEDS_HUMAN_REVIEW | PASS |
| normalization | clear browser approval, amount + reference parsed | PASS |
| normalization | ambiguous text never fabricated into a result | PASS |
| normalization | conflicting signals → NEEDS_HUMAN_REVIEW | PASS |
| normalization | "under review" → PENDING, no amount | PASS |
| hub mapping | only decisive results map to Hub statuses | PASS |

## 2. State machine / idempotency — ALL ASSERTIONS PASSED

Executed as a single transactional SQL block against the live database using a
real `funding_applications` row, then cleaned up (no residue, Hub untouched).

| Assertion | Result |
|---|---|
| Job created for an existing Hub application | PASS |
| Second **open** job for the same application rejected (unique_violation) | PASS |
| Valid transitions CREATED→QUEUED→STARTING→RUNNING→FORM_DETECTED→FILLING→HUMAN_CHECKPOINT | PASS |
| Invalid transition HUMAN_CHECKPOINT→COMPLETED rejected by trigger | PASS |
| Checkpoint recorded with completion metadata | PASS |
| READY_TO_SUBMIT→SUBMITTING→READING_RESPONSE→COMPLETED | PASS |
| Terminal COMPLETED cannot be reopened to QUEUED | PASS |
| Test rows removed; `funding_applications` unmodified | PASS |

## 3. Security tests — PASSED

Live probes with the anonymous key:

```
automation_jobs            401
automation_events          401
automation_checkpoints     401
automation_field_mappings  401
lender_automation_config   401
funding-automation-api     401 (unauthenticated POST)
```

| Control | Verified |
|---|---|
| RLS enabled on all 5 new tables | YES (`relrowsecurity = true`) |
| Policies scoped `TO authenticated` + `is_funding_operator()` | YES (8 policies) |
| `anon` privileges revoked | YES (grant audit + live 401) |
| Audit trail append-only (no UPDATE/DELETE for `authenticated`) | YES |
| Jobs cannot be deleted by staff | YES |
| No service-role key or worker token in frontend code | YES (frontend only calls `functions.invoke`) |
| Checkpoint resolution rejects worker token (operator only) | YES (code-enforced 403) |

## 4. Failure-handling tests — CODE-VERIFIED, NOT YET EXERCISED AGAINST A LIVE LENDER

Implemented and unit/logic verified; awaiting an authorized lender sandbox for
live exercise: network error, browser crash, worker restart mid-submit
(`NEEDS_HUMAN_REVIEW`), missing field, CAPTCHA, bot block, OTP, identity
verification, e-signature, unknown response, duplicate submission.

## 5. Browser tests — NOT RUN

**Blocked:** no authorized lender sandbox and no signed lender authorization
exists yet. Running browser automation against a live lender portal without that
authorization would violate the compliance guardrails in this project's spec.

## 6. Regression — PASSED

`/funding-machine/applications`, Funding Hub schema, and Empire HUD reads are
unchanged. No existing table was altered.

---

## Overall QA verdict

**INTEGRATION READY.** Not Production Ready: the end-to-end proof
(real application → authorized lender → human checkpoint → legitimate response →
Hub update) cannot be completed until a lender authorization and portal
credentials exist.
