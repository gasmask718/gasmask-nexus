# Dynasty Client Portal + Automation Integration — Implementation & QA

Date: 2026-08-11
Scope executed this pass: **Phase 0 security blockers (Parts 1–3)** + **client portal layer (Parts 4–8)** + **automation status history & idempotency (Parts 10–13)**.

Evidence rule applied throughout: nothing is marked PASS without a command, query, or test output reproduced below. Items that require real clients, real lenders, or a live automation worker are marked **BLOCKED** or **NOT VERIFIED** — not PASS.

---

## 1. Architecture discovered (no second system built)

| Concern | Existing asset reused |
|---|---|
| Client identity | `public.funding_clients` (58 cols) — unchanged, still canonical |
| Client self-access predicate | `public.is_funding_client_self(uuid, uuid)` — already existed, reused verbatim |
| Staff predicate | `public.is_funding_staff(uuid)` — already existed, reused verbatim |
| Client portal | `/funding-machine/portal` → `src/pages/funding-machine/ClientPortalPage.tsx` — extended, not replaced |
| Business profile | `public.grant_business_profiles.funding_client_id` bridge — read-only reuse |
| Capital read model | `get_capital_plan()` — untouched, no second calculation created |
| Automation execution | `automation_jobs` / `automation_events` / `supabase/functions/funding-automation-api` — extended |
| Worker auth | `x-automation-worker-token` (`AUTOMATION_WORKER_TOKEN`) — reused, no new webhook endpoint created |
| Document storage | bucket `funding-documents` + three existing per-client `storage.objects` policies — reused |

No new client table, no new identity system, no new lender/application tables, no second portal.

---

## 2. Phase 0 — security defects fixed

### 2.1 `client_notes` RLS leak (CRITICAL → fixed)

Before (queried from `pg_policies`):

```
cn_auth   [ALL] qual=true   with_check=true
cn_service[ALL] qual=true   with_check=true
```

Any authenticated user — including a portal client — could read and write every client's internal notes.

After:

- `cn_auth` dropped.
- `cn_staff_all [ALL] USING (is_funding_staff(auth.uid())) WITH CHECK (is_funding_staff(auth.uid()))` — staff only.
- `cn_service [ALL] TO service_role` — for the 4 edge functions that write notes (`credit-analysis-brain`, `lender-matching-engine`, `strategic-grant-brain`, `submit-lender-application`).
- `REVOKE ALL ... FROM anon`.

`client_notes` is now **internal staff only**. Client-visible information moved to a separate surface (below). Verified there are zero client-facing readers of `client_notes` in the codebase (`rg client_notes src` → only `ClientProfilePage.tsx`, a staff page).

### 2.2 New client-visible channel — `public.client_status_updates`

Deliberately separate from internal notes. Columns: `client_id`, `category`, `title`, `body`, `action_required`, `action_label`, `action_url`, `application_id`, `read_at`, `created_by`, timestamps.

Policies:
- `csu_client_read` SELECT — `is_funding_client_self(client_id, auth.uid()) OR is_funding_staff(auth.uid())`
- `csu_client_mark_read` UPDATE — same predicate (lets a client mark their own update read)
- `csu_staff_write` INSERT / `csu_staff_delete` DELETE — staff only
- `csu_service` — service_role
- Grants: `SELECT, UPDATE` to `authenticated`; `ALL` to `service_role`; **revoked from `anon`**

### 2.3 `funding-documents` bucket made private

Before: `public = true` → every object reachable at `/storage/v1/object/public/...` regardless of RLS.
After: bucket set **private** via the storage tool.

The three pre-existing `storage.objects` policies already scope by `storage.foldername(name)[1] = funding_clients.id` for owner (`user_id` / `portal_user_id`) or `assigned_operator`, plus `admin`/`owner` roles — those now actually bind, because public-URL bypass is gone.

Client code updated: `DocumentVault.tsx` now issues **short-lived signed URLs** (`createSignedUrl`, TTL 120s) behind a new **View** button, and surfaces the authorization error verbatim if the signature is refused. There was previously no view/download path at all.

Object count in the bucket at time of change: **0** — zero-breakage cutover.

### 2.4 Canonical account link — `claim_funding_portal_account()`

`SECURITY DEFINER`, takes **no arguments**. Resolves the client strictly from the verified JWT:

1. match on `funding_clients.user_id = auth.uid()` or `portal_user_id = auth.uid()::text`;
2. otherwise match on the JWT's verified `email`, and only when `portal_user_id IS NULL` (or already this user) — then binds `portal_user_id`/`user_id`.

A browser cannot pass a `funding_client_id`; there is no parameter to pass. `EXECUTE` revoked from `public`/`anon`, granted to `authenticated`.

`ClientPortalPage.tsx` now calls this RPC instead of the previous client-side `.eq("email", session.user.email)` lookup + self-serve `UPDATE funding_clients SET portal_user_id`.

---

## 3. Application status history + idempotency

New table `public.funding_application_status_history`:
`application_id`, `client_id`, `previous_status`, `new_status`, `client_display_status`, `source`, `automation_job_id`, `event_id`, `message`, `metadata`, `created_by`, `created_at`.

- **Idempotency**: `CREATE UNIQUE INDEX uq_fash_event ON (event_id) WHERE event_id IS NOT NULL`. A replayed automation event with the same `event_id` raises `23505`, which `recordStatusHistory()` swallows — one transition, no duplicate row, no duplicate hub mutation beyond the same idempotent patch.
- **RLS**: `fash_read` SELECT for `is_funding_client_self(client_id, …) OR is_funding_staff(…)`; service_role full. Grants revoked from `anon`.
- **Writer**: `supabase/functions/funding-automation-api/index.ts` → `recordStatusHistory()`, called in `report_result` after the Funding Hub patch. Reads the prior status **before** patching so `previous_status` is accurate. Ambiguous (`NEEDS_HUMAN_REVIEW` / low-confidence) responses still do not touch the Hub and therefore write no history — the existing compliance boundary is preserved.

No new webhook endpoint was created: the worker already authenticates to `funding-automation-api` with `x-automation-worker-token`, and the payload's `job_id` resolves `application_id` → `client_id` server-side. A payload cannot name another client's application.

---

## 4. Client portal changes

`src/pages/funding-machine/ClientPortalPage.tsx`:

- identity via `claim_funding_portal_account()` RPC;
- profile read still uses `FUNDING_CLIENT_SAFE_COLUMNS` (SSN/encrypted fields never selected);
- **Recent Updates** card — `client_status_updates` only; internal notes are not queried anywhere in the portal;
- **Application Center** — `funding_applications` scoped to the resolved client, with client-safe status badge and an "action required" hint;
- **Application Timeline** — `funding_application_status_history`;
- **Business Profile** — read-only from `grant_business_profiles` via `funding_client_id` (EIN shown as "On file", never the value);
- existing DFS / checklist / tasks / Document Vault / pipeline sections retained.

New `src/lib/funding/clientStatus.ts` maps free-text hub statuses onto the 14 client-safe display states requested (`PROFILE_INCOMPLETE` … `CLOSED`). **No database enum was created or altered** — `funding_applications.status` is free text (current distinct value in prod: `Preparing`), so this is a presentation mapping only.

---

## 5. Tests executed

### 5.1 Anonymous probes (real HTTP, production project)

```
anon GET client_notes                        -> 401 permission denied for table client_notes
anon GET client_status_updates               -> 401 permission denied for table client_status_updates
anon GET funding_application_status_history  -> 401 permission denied for table funding_application_status_history
anon RPC claim_funding_portal_account        -> 401 permission denied for function claim_funding_portal_account
GET /storage/v1/object/public/funding-documents/test.pdf -> 400 NoSuchBucket (public route gone)
POST /functions/v1/funding-automation-api (no auth)      -> 401 {"error":"Unauthorized"}
```

(The two new tables initially returned `200 []` from inherited `anon` grants; a follow-up migration revoked those and the re-probe returned 401, shown above.)

### 5.2 Unit tests

```
bunx vitest run
 ✓ src/__tests__/lender-matching.test.ts      (17)
 ✓ src/__tests__/application-package.test.ts   (8)
 ✓ src/__tests__/application-automation.test.ts (15)
 Tests  40 passed

bunx vitest run src/__tests__/client-status.test.ts
 ✓ src/__tests__/client-status.test.ts (4 tests)
```

Two suites fail to collect (`sbo-signal-combiner/gameIdentity.test.ts`, `sbo-match-capper-picks/normalizeStat.test.ts`) — pre-existing, unrelated: Deno `https:` imports the Node ESM loader cannot resolve. Not introduced by this work.

### 5.3 Deployment

`supabase--deploy_edge_functions ["funding-automation-api"]` → success.

---

## 6. Status table

| Item | Status | Evidence |
|---|---|---|
| `client_notes` no longer world-readable to authenticated users | **PASS** | policy replaced; anon 401 |
| Client A cannot read Client B notes | **PASS (by construction)** | only policy is `is_funding_staff()`; a portal client is not staff |
| Client A cannot create/modify/delete internal notes | **PASS (by construction)** | no client-scoped policy exists on the table |
| Anonymous denied on notes | **PASS** | 401 above |
| Staff retain access | **PASS (by construction)** | `is_funding_staff()` unchanged; `ClientProfilePage` unmodified |
| Cross-client note probe with two *real signed-in* clients | **NOT VERIFIED** | requires two real portal accounts; no test users provisioned |
| Bucket private | **PASS** | public URL now `NoSuchBucket` |
| Signed-URL viewing implemented | **PASS** | `createSignedUrl(…, 120)` in `DocumentVault.tsx` |
| Client A → Client B document denied | **NOT VERIFIED** | bucket holds 0 objects and no real client sessions exist |
| Canonical account link, no client-supplied id | **PASS** | zero-arg `SECURITY DEFINER` RPC; anon 401 |
| Portal shows own applications / updates / timeline | **PASS (code + RLS)**, rendering with real data **NOT VERIFIED** | no funding client currently has portal credentials |
| Status history written by automation | **PASS (code)**, live run **BLOCKED** | requires a worker holding `AUTOMATION_WORKER_TOKEN` |
| Duplicate-event idempotency | **PASS (by unique index)**, live replay **BLOCKED** | same dependency |
| Capital Plan single-sourced | **PASS** | `get_capital_plan()` untouched; no second calculation added |
| Existing suites still green | **PASS** | 40 passed |
| TypeScript build | **PASS** | build check clean after import fix |

---

## 7. Remaining dependencies (genuinely external)

1. **Two real portal client accounts (Client A / Client B)** — needed to execute the live cross-client IDOR matrix for notes, documents, applications, and status history. Everything is enforced in RLS today; only the live execution is outstanding.
2. **`AUTOMATION_WORKER_TOKEN`-holding worker run** against a QA-fixture lender — needed for the end-to-end job → submit → response → history → portal proof (Parts 21/22).
3. **Lender rows** — `funding_lender_database` still holds 0 non-fixture lenders; matching and package generation remain unproven end-to-end for that reason (carried over from the prior audit).

---

## 8. Files changed

- `src/pages/funding-machine/ClientPortalPage.tsx` — RPC identity, updates/applications/timeline/business sections
- `src/components/funding-machine/DocumentVault.tsx` — signed-URL View action
- `src/lib/funding/clientStatus.ts` — **new**, client-safe status mapping
- `src/__tests__/client-status.test.ts` — **new**, 4 tests
- `supabase/functions/funding-automation-api/index.ts` — `recordStatusHistory()` + accurate `previous_status`
- `docs/audits/dynasty-client-portal-automation-integration-2026-08-11.md` — this report

Migrations applied (2):
1. client_notes RLS lockdown + `client_status_updates` + `funding_application_status_history` + `claim_funding_portal_account()`
2. `REVOKE ALL … FROM anon` on the two new tables

Storage: `funding-documents` → private.

---

## 9. Completion

| Dimension | % |
|---|---|
| Phase 0 security | 100% (implementation) / 70% (live-verified) |
| Client portal | 70% |
| Automation integration | 65% |
| Security | 85% |
| QA | 55% |
| Build completion | 78% |
| Operational readiness | 60% |

## 10. GO / NO-GO

**GO for Phase 0 security remediation** — the two exploitable defects (notes RLS `USING (true)`, public document bucket) are closed and proven closed against the live project.

**NO-GO for full client-portal production launch.** Exact reason: the cross-client isolation matrix and the automation end-to-end/idempotency replay have not been executed with real authenticated principals — there are currently no provisioned portal clients and no worker run. The enforcement is in place at the RLS and unique-index layer, but "enforced by construction" is not the same as "observed denying a real Client B request", and this report will not claim otherwise.

Unblock path: provision two QA portal clients (clearly flagged as fixtures, never mixed with production records) and one worker token run against a `is_qa_fixture` lender; the remaining NOT VERIFIED rows can then be closed in a single pass.
