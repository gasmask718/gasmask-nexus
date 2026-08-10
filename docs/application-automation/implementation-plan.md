# Application Automation Engine — Implementation Plan

## Phase 1 — Existing system audit ✅ COMPLETE

**Existing functionality (reused, not rebuilt)**
- Clients, businesses, credit profile, DFS: `funding_clients`, `funding_dfs_scores`
- Canonical application data: `funding_application_profile`
- Applications: `funding_applications` (`/funding-machine/applications`)
- Lenders + requirements: `funding_lender_database`, `funding_lender_products`
- Documents: `funding_client_documents`
- Package generation / manual path: `funding_autofill_runs`
- Auth + roles: `RequireRole`, `user_roles` + `app_role`
- Navigation: `src/components/Layout.tsx`; routes: `src/routes/AppRoutes.tsx`

**Missing functionality (built here)**
- Execution job model, state machine, queue, leases, retries, idempotency
- Lender execution config + form field mapping layer
- Human-checkpoint model and resolution flow
- Response normalization and Funding Hub write-back contract
- Operator monitoring UI

**Duplicates avoided**
- No `AutomationClient`, `AutomationApplication`, `AutomationLender`, or
  automation-side document store. Everything references `application_id`.

**Integration points** — see architecture.md §9.

**Security risks found**
1. `public` schema grants defaults to `anon` → revoked on all new tables (verified 401).
2. Worker↔API trust needs a dedicated secret → `AUTOMATION_WORKER_TOKEN`.
3. Log leakage risk → `redact()` applied to every event and stored response.

## Phase 2 — Automation data model ✅ COMPLETE
5 tables, RLS `TO authenticated` + `is_funding_operator()`, state-machine trigger,
one-open-job-per-application partial unique index, append-only events.

## Phase 3 — Automation API ✅ COMPLETE
`supabase/functions/funding-automation-api` — 13 actions, dual auth
(operator JWT / worker token), no secrets returned.

## Phase 4 — Job queue ✅ COMPLETE
Persistence in Postgres; conditional-update claiming; 15-minute leases;
`reap-stale` recovery; attempt counters with `max_attempts`; classified retries.
Jobs that die in `SUBMITTING`/`READING_RESPONSE` escalate to
`NEEDS_HUMAN_REVIEW` — never auto-resubmitted.

## Phase 5 — API submission ✅ FRAMEWORK COMPLETE
`submitViaApi()` on the adapter interface + `normalizeApiResponse()`.
**No fake lender API was created.** Live API submission activates when a real
authorized lender API and credential are supplied (secret name stored in
`lender_automation_config.api_secret_name`).

## Phase 6 — Browser automation ⚠️ POC READY, NOT LENDER-CERTIFIED
`automation-worker/` with Playwright + generic selector-driven adapter.
Activating a lender requires: written lender authorization, a
`lender_automation_config` row with `automation_authorized = true`, and
`automation_field_mappings` rows with verified selectors.

## Phase 7 — Response normalization ✅ COMPLETE
`SUBMITTED | PENDING | APPROVED | DECLINED | NEEDS_DOCUMENTS | NEEDS_HUMAN_REVIEW | FAILED | UNKNOWN`.
Conflicting or unrecognized signals → `NEEDS_HUMAN_REVIEW`, and Funding Hub is not touched.

## Phase 8 — Operator UI ✅ COMPLETE
`/funding-machine/automation` — counters, job table, job drawer with audit trail
and checkpoint resolution. Not a second CRM: it lists jobs, not clients.

## Phase 9 — QA ✅ UNIT + SECURITY + STATE MACHINE; ⚠️ LIVE LENDER PENDING
See qa-plan.md and test-results.md.

## Remaining owner actions
1. Provide `AUTOMATION_WORKER_TOKEN` and deploy `automation-worker/` to an isolated host.
2. Obtain written lender authorization for the first automation target.
3. Populate `lender_automation_config` + `automation_field_mappings` for that lender.
4. Supply real lender API credentials (stored as server-side secrets) for Phase 5 go-live.
5. Compliance/legal review of the first lender's terms before enabling browser submission.
