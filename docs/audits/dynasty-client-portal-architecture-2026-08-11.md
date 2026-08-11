# Dynasty Client Portal — Phase 1/2 Architecture & Dependency Report
Date: 2026-08-11 · Status: READ-ONLY INSPECTION (no code or schema changed)

## 1. What already exists (reuse, do not rebuild)

| Concern | Existing asset | Verdict |
|---|---|---|
| Client identity | `funding_clients` (58 cols) + `portal_user_id`, `user_id` | REUSE — single source of truth |
| Identity predicate | `is_funding_client_self(client_id, uid)` (SECURITY DEFINER; matches user_id, portal_user_id, or verified JWT email) | REUSE |
| Staff predicate | `is_funding_staff(uid)`, `is_grants_staff()` | REUSE |
| Client portal UI | `/funding-machine/portal` → `src/pages/funding-machine/ClientPortalPage.tsx` (magic link, DFS score, checklist, tasks, DocumentVault) | EXTEND — already the portal shell |
| Staff profile UI | `ClientProfilePage.tsx` (1,566 lines, 9 tabs, notes) | KEEP as staff surface |
| Applications | `funding_applications` (17 cols), `grant_applications` (22 cols, has `funding_client_id`) | REUSE |
| Business profile | `grant_business_profiles` (102 cols, `funding_client_id` bridge) | REUSE as the business profile of record |
| Documents | `funding_client_documents` + `funding-documents` bucket | REUSE (see risk R2) |
| Automation | `automation_jobs` (35 cols, idempotency_key, checkpoints, human action), `automation_events`, `automation_checkpoints` | CONSUME ONLY |
| Capital read model | `get_capital_plan(client_id)` + `src/hooks/useCapitalPlan.ts` | CONSUME ONLY |
| Lender matching | `lender-matching-engine` + `_shared/lenderMatch.ts` (17/17 tests) | CONSUME ONLY |
| Inbound event pattern | `receive-*` functions using `x-shared-secret`; `_shared/tenancy.ts`, `_shared/errText.ts` | REUSE pattern |

Live data: 2 funding clients (0 linked to a portal auth user), 1 funding application, 6 grant applications, 0 automation jobs, 0 client documents, 0 lenders.

## 2. Confirmed gaps (what must be built)

- **G1 — Grant side has no client access.** `grant_applications` and `grant_business_profiles` are staff-only (`is_grants_staff()`). A client cannot see their own grants.
- **G2 — Automation invisible to clients.** `automation_jobs` / `automation_events` are `is_funding_operator()` only. The portal cannot show "submitting / needs human review / submitted".
- **G3 — No status history.** `funding_applications.status` is a flat column; no transition log, so no timeline and no audit of who changed what.
- **G4 — No integration event layer.** No `integration_events` table and no inbound endpoint for APPLICATION_* / AUTOMATION_* events with signature, timestamp, replay protection and idempotency.
- **G5 — No profile completion engine.** Nothing computes personal/business/document/readiness completeness.
- **G6 — No client notifications.**
- **G7 — Portal is partial.** No personal profile editor, no business profile section, no applications page, no capital plan panel.

## 3. Security findings (pre-existing, blocking a client-facing launch)

- **R1 — CRITICAL: `client_notes` RLS is `USING (true)` for `authenticated`.** Every logged-in user — including any portal client — can read and write *all* clients' internal notes. Must be scoped to staff before any client account exists.
- **R2 — CRITICAL: `funding-documents` storage bucket is PUBLIC.** Bank statements, IDs and tax docs are readable by anyone with the object URL. Must become private with per-client `storage.objects` policies and signed URLs.
- **R3 — HIGH: 0 of 2 clients have `portal_user_id` set;** identity currently resolves through the JWT-email fallback. Acceptable (email is verified by Supabase auth) but linking must be made canonical and the fallback kept as a one-time claim path.
- **R4 — MEDIUM: no cross-client IDOR test exists.** Anonymous 401 has been verified; authenticated A→B has not.

## 4. Target architecture (no new client database)

```
funding_clients (identity, ONE)
   ├─ personal      funding_clients columns (safe subset only, SSN never leaves server)
   ├─ business      grant_business_profiles (funding_client_id)
   ├─ funding apps  funding_applications
   ├─ grant apps    grant_applications (funding_client_id)
   ├─ documents     funding_client_documents + private bucket
   ├─ notes         client_notes (staff-only) + client_messages (new, client-visible)
   ├─ status        application_status_events (new, append-only)
   ├─ events        integration_events (new, signed inbound)
   └─ capital       get_capital_plan(client_id)  ← single calculation
```

Deployment: **no new domain or frontend.** The portal stays in this app under `/funding-machine/portal` (already routed, already magic-link authed). A separate Vite app would duplicate auth, the Supabase client and the design system for zero security gain — RLS is the boundary, not the origin.

## 5. Proposed build order

1. **Phase 0 (security, must precede clients):** fix R1 (`client_notes` staff-scope), R2 (private bucket + object policies), canonical portal_user_id claim RPC.
2. **Phase 3:** client-scoped read access for grants + automation (G1, G2) via new RLS policies using `is_funding_client_self`.
3. **Phase 4:** portal pages — Personal Profile, Business Profile, Applications, Documents, Capital Plan.
4. **Phase 5:** profile completion engine (deterministic, DB-driven).
5. **Phase 6:** `integration_events` + `capital-ingest` signed webhook (HMAC + timestamp + replay + idempotency), `application_status_events` append-only history.
6. **Phase 7:** notifications + realtime.
7. **Phase 9/10:** authenticated cross-client IDOR tests with two fixture identities, full QA doc.

## 6. External dependencies that will block full E2E proof
- 0 rows in `funding_lender_database` → lender matching E2E stays UNPROVEN (data dependency, not a code defect).
- 0 automation jobs → automation→portal status flow can only be proven with a labelled test fixture.
- A shared secret for the inbound event endpoint (project is at 97/100 secrets; 1 slot needed).
