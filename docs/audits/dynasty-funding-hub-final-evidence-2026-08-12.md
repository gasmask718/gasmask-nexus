# Dynasty Funding Hub — Final End-to-End Evidence Report
Date: 2026-08-12 (UTC) · Scope: lender data pipeline → matching → package → application → automation

## 1. Live baseline (measured, not assumed)

| Table | Rows |
|---|---|
| funding_clients | 4 |
| funding_applications | 3 |
| funding_lender_database | 0 |
| funding_lender_products | 0 |
| funding_client_lender_matches | 0 |
| lender_automation_config | 0 |
| automation_field_mappings | 0 |
| automation_jobs | 2 |

The lender universe is still empty. Every lender-dependent claim below is therefore
proven at the logic and schema level, not against production lender records.

## 2. What changed this pass

**Product-aware matching (Phases 3–4).** `lenderMatch.ts` gained
`expandLenderProducts()`. A lender with published `funding_lender_products` rows is
evaluated once per active product, product thresholds overriding lender defaults;
a lender with no products is evaluated exactly as before, so an empty products table
changes nothing. `MatchResult.product_id` carries the evaluated product through.
Inactive products are excluded from the universe.

`lender-matching-engine/index.ts` now loads products for the fetched lenders and
matches on the expanded universe. Because `funding_client_lender_matches` is keyed
by lender, only the highest-scoring product per lender is persisted — a multi-product
lender can no longer collide on upsert. The persisted `match_reasons` records which
product was evaluated. The response reports `lender_universe`, `lender_records` and
`product_records` separately.

**Package → application bridge (Phase 6).** `useCreateApplicationFromPackage`
creates a real `funding_applications` row from a READY package, writing `lender_id`,
`submission_method`, `package_status` and `created_from_match_id`. A package that is
not READY, or whose submission method is UNKNOWN, cannot produce an application —
the guard is in the hook, not only in the disabled button. Duplicate protection is
enforced by `funding_applications_one_open_per_lender`; a 23505 surfaces as a plain
message naming the lender rather than a silent duplicate.

**IDOR fix.** The Dynasty Capital automation query fetched `automation_jobs` with no
client filter. It is now scoped with `.eq('client_id', clientId)`.

## 3. Verification evidence

**Unit tests — 47/47 pass** (`npx vitest run src/__tests__`): lender matching (20,
incl. 3 new product-expansion tests), application automation (15), application
package (8), client status (4).

**Typecheck** — `tsgo --noEmit -p tsconfig.app.json`: clean.

**Anonymous REST probes** — all 401 `42501 permission denied`:
`funding_clients`, `funding_applications`, `client_notes`, `automation_jobs`,
`automation_events`, `funding_lender_database`, `funding_client_documents`,
`grant_applications`.

**Anonymous edge probes** — `lender-matching-engine` → 401 `{"error":"unauthorized"}`;
`funding-automation-api` → 401 `{"error":"Unauthorized"}`.

**RLS posture** — every table in the funding/automation surface has RLS enabled with
policies present: client-self policies on `funding_clients`, `funding_applications`,
`funding_application_profile`, `funding_application_status_history`,
`funding_client_documents`, `funding_client_lender_matches`, `client_status_updates`,
`automation_jobs`, `automation_events`, `grant_applications`,
`grant_business_profiles`; staff-only on `client_notes`, `funding_lender_database`,
`funding_lender_products`, `lender_automation_config`, `automation_field_mappings`.

**Two-client A/B isolation** — proven live on 2026-08-11 with
`qa.client.a@dynastyos.app` / `qa.client.b@dynastyos.app`
(`docs/audits/dynasty-client-portal-automation-integration-2026-08-11.md`, Part 21).
Not re-run this pass; the policy set behind it is unchanged and re-confirmed above.

## 4. Readiness

| Dimension | % | Basis |
|---|---|---|
| Build completion | 88% | Intake → DFS → matching → package → application → automation job all exist and are wired. Missing: lender-product admin UI, automation adapter certification. |
| QA completion | 78% | 47/47 unit tests, live auth/RLS probes, A/B isolation. Missing: end-to-end run against a real lender record. |
| Security completion | 92% | Anonymous denied everywhere, staff/client split enforced in DB, IDOR closed, documents bucket private, self-update guard trigger live. Residual: project-wide ungated-function backlog (SEC-018) outside this hub. |
| Operational readiness | 55% | No lender rows, no `lender_automation_config`, no field mappings, worker not deployed to an isolated host. |
| Production readiness | 60% | Code and security are release-grade; the system cannot transact until lender data and written lender authorization exist. |

## 5. Release decision — CONDITIONAL GO (staff-only)

Safe to operate today for client intake, DFS, packaging and manual submission.
**Not** cleared for automated lender submission. Blockers, in order:

1. Load `funding_lender_database` (+ `funding_lender_products`) with real lenders.
2. Written lender authorization before any browser automation is enabled.
3. `lender_automation_config` + verified `automation_field_mappings` per lender.
4. Deploy `automation-worker/` to an isolated host with `AUTOMATION_WORKER_TOKEN`.
5. One full live submission, recorded here, before the hub is called production-ready.
