# Application Automation Engine — QA Plan

## 1. Unit tests (`src/__tests__/application-automation.test.ts`)
- Canonical derivation from Hub records; profile-absent fallback; no invented values
- Field validation: currency, date, email, phone, dropdown allow-lists
- Missing required field → job blocked, not submitted
- Redaction of ssn / otp / token / secret / password / card keys (recursive)
- API response normalization, including unknown status → `NEEDS_HUMAN_REVIEW`
- Page-text normalization: clear approval, ambiguous text, conflicting signals
- Hub status mapping: only decisive results map; `FAILED`/`UNKNOWN`/review map to `null`

## 2. State machine / integration tests (SQL, executed against the live database)
- Valid path `CREATED → QUEUED → STARTING → RUNNING → FORM_DETECTED → FILLING →
  HUMAN_CHECKPOINT → READY_TO_SUBMIT → SUBMITTING → READING_RESPONSE → COMPLETED`
- Invalid transition (`HUMAN_CHECKPOINT → COMPLETED`) must raise
- Terminal states are terminal (`COMPLETED → QUEUED` must raise)
- Duplicate open job for the same `application_id` must violate the unique index

## 3. Security tests
- Anonymous REST read on each of the 5 tables must return 401
- Unauthenticated call to the Automation API must return 401
- Authenticated non-operator must see zero rows (RLS `is_funding_operator()`)
- `resolve-checkpoint` with a worker token must return 403
- No secret appears in any response body, event row, or `raw_response`

## 4. Failure tests
| Scenario | Expected |
|---|---|
| Network error / API timeout | `FAILED`, retryable |
| Browser crash | `FAILED`, retryable within `max_attempts` |
| Worker restart mid-fill | lease expires → `FAILED` |
| Worker restart mid-submit | lease expires → `NEEDS_HUMAN_REVIEW` (never resubmit) |
| Missing required field | `NEEDS_INFORMATION`, never submitted |
| Missing document | `NEEDS_INFORMATION` |
| CAPTCHA / bot block | `BLOCKED` → `NEEDS_HUMAN_REVIEW`, no circumvention |
| OTP / identity / e-signature | `HUMAN_CHECKPOINT`, operator resolves |
| Unknown lender response | `NEEDS_HUMAN_REVIEW`, Hub untouched |
| Duplicate submission attempt | 409 with prior `lender_reference` |
| Retry after confirmed submission | 409, blocked |

## 5. Browser tests (requires an authorized lender sandbox — NOT YET AVAILABLE)
Field mapping, dropdowns, checkboxes, document upload, error handling,
checkpoint pause/resume, submission state, response extraction.

## 6. Regression tests
- `/funding-machine/applications` unchanged
- No new columns or rows in Funding Hub tables beyond decisive status updates
- Empire HUD reads unchanged
