# Dynasty Capital — End-to-End Integration & Automation Proof
Date: 2026-08-12 · Environment: live project database · Mode: build + test + fix + retest

All lifecycle evidence below was produced against the live database using a
clearly-labelled QA fixture universe. **No real lender was contacted, no external
API was called, and no real client record was touched.**

---

## 1. Fixture universe (isolated by design)

| Record | ID | Flag |
|---|---|---|
| Lender "QA FIXTURE — Dynasty Test Lender (NOT A REAL LENDER)" | `06a6703e…` | `is_qa_fixture = true` |
| Client "QA Fixture A" | `e4657746…` | `is_qa_fixture = true` |
| Client "QA Fixture B" | `7945aa76…` | `is_qa_fixture = true` |
| Lender automation config | `generic_form`, manual | `is_qa_fixture = true`, `automation_authorized = false` |

Both fixture clients have a complete `funding_application_profile` and one
`bank_statement` document on file, so the package can legitimately reach READY.

---

## 2. Test matrix — executed, with results

| ID | Test | Expected | Actual | Result |
|---|---|---|---|---|
| T-MATCH-01 | Match QA client A | QA lender only | `lender_universe=1`, `matched_count=1`, `qa_fixture_mode=true`, `submittable_count=0` | PASS |
| T-MATCH-02 | Match a real client | never sees QA lender | `lender_universe=0` + "NO LENDER DATA" note | PASS |
| T-MATCH-03 | Caller forces `include_qa_fixtures:true` on a real client | ignored | `lender_universe=0` | PASS |
| T-PKG-01 | Build application package | READY, no missing fields/docs | `READY`, `missing_fields=[]`, `missing_documents=[]`, evidence lines present | PASS |
| T-APP-01 | Create application from package | created | `c43db29d…` status `Preparing` | PASS |
| T-APP-02 | Duplicate open application | rejected | `23505 funding_applications_one_open_per_lender` | PASS |
| T-HIST-01 | Timeline on create | 1 row | `→ Preparing`, source `system`, "Application created" | PASS |
| T-JOB-01 | `create-job` | manual (lender not authorized for automation) | `NEEDS_INFORMATION`, `human_action_type=MANUAL_SUBMISSION`, reason "Lender configured for manual submission" | PASS |
| T-JOB-02 | Duplicate `create-job` | 409 | 409 + existing `job_id` | PASS |
| T-AUTH-01 | Unauthenticated API call | 401 | 401 `Unauthorized` | PASS |
| T-WORK-01 | Worker claims a manual job | never claimable | `{"job":null}` | PASS |
| T-CP-01 | Raise OTP checkpoint | job moves to HUMAN_CHECKPOINT | **initially 200 with job unchanged — DEFECT D1** | FAIL → fixed → PASS |
| T-CP-02 | Worker token resolves a checkpoint | 403 | 403 "Only an authorized human operator may resolve a checkpoint" | PASS |
| T-CP-03 | Operator resolves checkpoint | job → READY_TO_SUBMIT | `READY_TO_SUBMIT`, `requires_human_action=false` | PASS |
| T-CP-04 | Resolve the same checkpoint twice | 409 | 409 "Checkpoint already COMPLETED" | PASS |
| T-CP-05 | Unknown `checkpoint_type` | 400, job untouched | 400 with the allowed list; job state unchanged | PASS |
| T-RES-01 | APPROVED page text | job COMPLETED + hub updated | job `COMPLETED/APPROVED`, `$35,000`, ref `QA-REF-12345`; application `Approved`, `approved_amount=35000`, `decision_date=2026-08-12`; history row source `automation` with `event_id` | PASS |
| T-RES-02 | Replay the same `event_id` | no second hub write | 409 `COMPLETED -> READING_RESPONSE`; no duplicate history row | PASS (see UNKNOWN-1) |
| T-RES-03 | Conflicting/ambiguous response | NEEDS_HUMAN_REVIEW, hub untouched | job `NEEDS_HUMAN_REVIEW`, application stays `Preparing`, history still 1 row | PASS |
| T-CAP-01/02 | `get_capital_plan` per client | per-client rows only | A: 1 row `Approved 40000/35000`; B: 1 row `Preparing 30000/0` | PASS |
| T-SEC-anon | Anonymous read of 9 funding/automation tables | all denied | `42501` permission denied on every table | PASS |
| T-SEC-ssn | Full SSN readable from the browser | impossible | `funding_clients` exposes only `ssn_last4`; no plaintext/encrypted SSN column on the table | PASS |
| T-UI-01 | `/funding-machine/automation` | shows real jobs | counters 0 running / 2 waiting / 1 completed / 1 needs review; fixture jobs listed | PASS |
| T-UI-02 | `/funding-machine/applications` | shows real applications | Total 5, Approved `$35,000`, fixture rows in Preparing/Approved columns | PASS |
| Unit tests | 3 suites | pass | 43/43 passed | PASS |
| Typecheck | `tsgo --noEmit` | clean | clean | PASS |

---

## 3. Defects found and fixed this phase

### D1 — Silent state-machine failures reported as success (severity: high)
`raise-checkpoint` inserted a PENDING checkpoint and returned **HTTP 200** while the
job update was rejected by the `automation_job_guard` trigger and the error was
discarded. Evidence: job stayed `NEEDS_INFORMATION / MANUAL_SUBMISSION` after a 200
response. The same swallow existed in `resolve-checkpoint` and in the first update of
`submit-result`.

Fix (`supabase/functions/funding-automation-api/index.ts`):
- `raiseCheckpoint` validates `checkpoint_type` against the schema's allowed list,
  moves the job **first**, returns **409** with `job_status` on rejection, and rewinds
  (or escalates to `NEEDS_HUMAN_REVIEW`) if the checkpoint row cannot be written.
- `resolveCheckpoint` moves the job first and returns 409 instead of marking a
  checkpoint COMPLETED against a job that never moved.
- `submitResult` walks `READY_TO_SUBMIT` / `HUMAN_CHECKPOINT → SUBMITTING → READING_RESPONSE`
  through legal transitions and returns 409 with the blocking status instead of failing quietly.
- Blocking (CAPTCHA/BOT_BLOCK) escalation now logs `ESCALATION_FAILED` if it cannot apply.

### D2 — Manual submissions had no legal checkpoint path (severity: medium)
Manual jobs park in `NEEDS_INFORMATION`, from which the guard allowed only
`QUEUED/CANCELLED/FAILED`, so an operator checkpoint was structurally impossible.
Migration adds `NEEDS_INFORMATION → HUMAN_CHECKPOINT`. No other transition was widened;
terminal states remain terminal.

---

## 4. Proven end-to-end path

```
Client profile (complete)
  -> lender-matching-engine  (QA-isolated universe)
  -> application package     (READY, evidence-backed)
  -> funding_applications    (one open per lender enforced)
  -> automation_jobs         (method resolved from lender config)
  -> human checkpoint        (operator-only resolution)
  -> submit-result           (normalized, never fabricated)
  -> record_application_status RPC  (atomic status + timeline)
  -> get_capital_plan        (per-client aggregation)
  -> Applications + Automation UI   (live, no console errors)
```

---

## 5. Not proven / blocked (honest status)

- **BROWSER automation end-to-end: UNPROVEN.** A pre-existing safety constraint
  (`lender_automation_config_qa_never_authorized`) forbids `automation_authorized = true`
  on any QA fixture, and `create-job` correctly downgrades unauthorized lenders to manual.
  A browser job therefore cannot be created against a fixture. This is correct behaviour,
  not a bug — but it means live browser submission stays unproven until a **real,
  written-authorized lender** with verified selectors exists. The claim/validation logic
  is covered only by unit tests.
- **API submission: UNPROVEN** — no authorized lender API or credential exists.
- **UNKNOWN-1 — replay guard.** The `event_id` replay guard inside
  `record_application_status` was not reached in T-RES-02 because the job had already
  reached the terminal `COMPLETED` state and was rejected earlier, at the state machine.
  Duplicate suppression is therefore proven at the job layer, **not** at the RPC layer.
- **GAP G1 — no inbound lender webhook.** Asynchronous lender decisions still require a
  worker or operator to call `submit-result`. An authenticated, signature-verified inbound
  endpoint should be built alongside the first real lender, not before one exists.
- **GAP G2 — client portal** exists at `/funding-machine/portal` but was not exercised
  under a real portal (magic-link) session in this phase; staff-side reads were.

---

## 6. Cleanup / rollback

- Fixture rows are flagged `is_qa_fixture = true` and are excluded from real-client
  matching; they can be deleted at any time without touching production data.
- Rollback of D1: revert `supabase/functions/funding-automation-api/index.ts` and redeploy.
- Rollback of D2: restore `'NEEDS_INFORMATION' THEN ARRAY['QUEUED','CANCELLED','FAILED']`
  in `public.automation_job_guard()`.

Deploy status: `funding-automation-api` **deployed**; migration **applied**.
