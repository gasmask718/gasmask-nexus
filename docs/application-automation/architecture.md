# Dynasty Application Automation Engine — Architecture

**Status:** INTEGRATION READY
**Last updated:** 2026-08-10

---

## 1. Current Funding Hub architecture (audited, not assumed)

Funding Hub is the **system of record**. It lives at `/funding-machine/*` and is registered in
`src/routes/AppRoutes.tsx` behind `RequireRole allowedRoles={['owner','admin','employee','accountant']}`.
Navigation is defined in `src/components/Layout.tsx` (the "Floors" list).

### Tables reused (nothing duplicated)

| Concern | Existing table | Notes |
|---|---|---|
| Clients | `funding_clients` | Identity, revenue, DFS score, SSN **last 4 only** |
| Canonical application data | `funding_application_profile` | Legal name, EIN, NAICS, revenue, owner block, `extra_fields` |
| Applications | `funding_applications` | `lender_name`, `product_type`, `status`, `approved_amount`, `decision_date` |
| Lenders | `funding_lender_database` | Already has `submission_method`, `automation_allowed`, `application_url` |
| Lender products | `funding_lender_products` | |
| Lender/client matching | `funding_client_lender_matches` | |
| Documents | `funding_client_documents` | Storage paths, signed-URL access |
| Package generation / manual fallback | `funding_autofill_runs` | `filled_package`, `missing_fields`, `submission_method` |
| Scoring | `funding_dfs_scores`, `funding_dfs_weights`, `compute_funding_dfs()` | |

### Existing integrations
Edge functions: `funding-ai-agent`, `funding-postgrid`, `funding-plaid`,
`funding-report-parser`, `funding-morning-briefing`. Playwright (`@playwright/test`)
is already a dev dependency; no browser-automation service existed before this work.

### Security posture found
- All Funding Hub tables have RLS enabled.
- **Finding (fixed here):** the `public` schema grants default privileges to `anon`.
  Every new automation table therefore had `anon` explicitly `REVOKE`d.
- Full SSN storage was previously removed (Option A, last-4 only) — the canonical
  field layer exposes `owner_ssn_last4` only.

---

## 2. Proposed automation architecture

```text
                 FUNDING HUB (source of truth)
                          │  HTTPS + Supabase JWT
                          ▼
             funding-automation-api (Edge Function)
                          │
                     Job Queue (automation_jobs)
                          │  lease + claim
             ┌────────────┴────────────┐
             ▼                         ▼
      Browser Worker             API Worker
   (isolated container)        (isolated container)
             │                         │
             ▼                         ▼
      Lender Portal              Lender API
             └────────────┬────────────┘
                          ▼
                 Response Normalizer
                          ▼
              funding_applications UPDATE
                          ▼
                     Empire HUD
```

The Automation Engine owns **only** execution state. It never creates a client,
business, lender, application, approval or funding record.

---

## 3. Data flow

1. Operator (or Funding Hub logic) calls `create-job` with an `application_id`.
2. The API loads `funding_applications` + `funding_clients` + `funding_application_profile`
   and builds the **canonical bundle** (`_shared/automation/canonical.ts`).
3. Lender execution config is resolved from `lender_automation_config`
   (keyed to `funding_lender_database.id`).
4. Method resolution: a lender that is not `automation_authorized`, or has
   `funding_lender_database.automation_allowed = false`, is **always** `manual`.
5. Field mappings are validated. Missing/invalid → `NEEDS_INFORMATION`, job never queues.
6. A worker claims the job with a 15-minute lease and receives **only** validated,
   mapped values — never the full client profile.
7. Result is normalized and written back to `funding_applications`.

---

## 4. API flow

Single authenticated Edge Function `funding-automation-api`, action-dispatched:

| Action | Caller | Purpose |
|---|---|---|
| `create-job` | operator | Create an execution job for a Hub application |
| `list-jobs` / `get-job` | operator | Read job, events, checkpoints |
| `cancel-job` / `retry-job` | operator | Admin controls |
| `switch-to-manual` | operator | Manual fallback |
| `resolve-checkpoint` | **operator only** | Human confirms a human-only action |
| `claim-job` | worker | Lease the next queued job |
| `report-event` | worker | Structured progress + state transition |
| `raise-checkpoint` | worker | Pause for a human / stop on bot block |
| `submit-result` | worker | Normalized read-back → Funding Hub |
| `report-failure` | worker | Classified failure + retry eligibility |
| `reap-stale` | worker | Recover expired leases |

Auth: Supabase JWT with `owner|admin|employee|accountant` role, **or**
`x-automation-worker-token` matching the `AUTOMATION_WORKER_TOKEN` secret.

---

## 5. Browser automation flow

`CREATE JOB → VALIDATE → LOAD CONFIG → BROWSER START → OPEN URL → DETECT FORM →
MAP FIELDS → VALIDATE MAPPING → FILL → UPLOAD DOCS → DETECT CHECKPOINT → PAUSE →
NOTIFY → HUMAN COMPLETES → RESUME → FINAL REVIEW → SUBMIT → READ RESPONSE →
NORMALIZE → UPDATE FUNDING HUB → COMPLETE`

Implemented in `automation-worker/worker.ts` with per-lender adapters in
`automation-worker/adapters/`. The worker launches a standard headless Chromium:
**no proxy rotation, no IP rotation, no fingerprint or user-agent spoofing.**

---

## 6. Human checkpoint flow

`detectCheckpoint()` scans the rendered page for OTP, SMS/email verification,
identity/selfie verification, e-signature, "I certify" language, CAPTCHA and bot
blocks. On detection the worker calls `raise-checkpoint` and **exits**.

- CAPTCHA / bot block → job goes `BLOCKED` → `NEEDS_HUMAN_REVIEW`. Never circumvented.
- Any lender config with `requires_final_certification`, `requires_signature`,
  `requires_otp` or `requires_identity_verification` stops **before** submission.
- Only an authenticated operator can call `resolve-checkpoint`; the workers'
  token is explicitly rejected for that action.
- `automation_checkpoints` records what, why, who, when, and whether it resumed.

---

## 7. Security model

| Control | Implementation |
|---|---|
| No frontend secrets | UI only calls `supabase.functions.invoke` with the user's JWT |
| Service role isolation | `SUPABASE_SERVICE_ROLE_KEY` used only inside the Edge Function |
| Worker auth | Shared `AUTOMATION_WORKER_TOKEN`, server-to-server only |
| RLS | All 5 tables: `TO authenticated` + `is_funding_operator()` |
| Anonymous access | Explicitly `REVOKE`d — verified 401 on all 5 tables |
| Append-only audit | `UPDATE`/`DELETE` revoked on `automation_events` |
| Job immutability | `DELETE` revoked on `automation_jobs`; cancel, never erase |
| Data minimization | Worker receives mapped values only, keyed by `application_id` |
| Log redaction | `redact()` strips ssn/otp/token/secret/password/card keys recursively |
| Sensitive fields | Only `owner_ssn_last4` exists; full SSN was removed project-wide |

---

## 8. Database changes

New tables (execution-only): `automation_jobs`, `automation_events`,
`automation_checkpoints`, `lender_automation_config`, `automation_field_mappings`.
New functions: `is_funding_operator()`, `automation_job_guard()` (state machine
trigger), `automation_touch_updated_at()`.
Partial unique index `idx_automation_jobs_one_open_per_app` guarantees at most one
open job per Funding Hub application.

**No existing Funding Hub table was altered.**

---

## 9. Integration points

- Read: `funding_applications`, `funding_clients`, `funding_application_profile`,
  `funding_lender_database`, `funding_client_documents`.
- Write: `funding_applications.status / approved_amount / decision_date / application_date`
  — and only for decisive, high-confidence results.
- UI: `/funding-machine/automation`, registered in `AppRoutes.tsx` and `Layout.tsx`.
- Empire HUD is unaffected: it continues reading Funding Hub tables.

---

## 10. Deployment architecture

- **Automation API** — Lovable Cloud Edge Function (already deployed).
- **Worker** — `automation-worker/` deploys separately to an isolated
  container/VM (Fly.io, Railway, ECS). It is *not* bundled into the Vite app and
  must never run in a user's browser. Environment: `AUTOMATION_API_URL`,
  `AUTOMATION_WORKER_TOKEN`, `WORKER_ID`.
- Horizontal scaling is safe: claiming uses a conditional update on
  `status='QUEUED'`, so two workers cannot take the same job.
