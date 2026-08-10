# DYNASTY FUNDING HUB — REMEDIATION ROADMAP
**Date:** 2026-08-10 · Companion to `funding-hub-master-audit-2026-08-10.md` and `funding-hub-qa-matrix-2026-08-10.md`
**Status:** plan only. No changes were made. FIX MODE not entered — awaiting explicit authorization.

---

## OWNER ACTIONS vs DEVELOPER ACTIONS

### OWNER ACTIONS (cannot be done by a developer)
| # | Action | Unblocks |
|---|---|---|
| O-1 | Provide the **real lender registry** — lender names, minimum credit score, minimum revenue, minimum time in business, funding lane, max amount, prequal/application URL, soft-pull availability, docs required, whether automated submission is permitted. XLSX is fine; the importer maps columns. | The entire matching → funding half of the product |
| O-2 | Supply `POSTGRID_API_KEY` (PostGrid account, test or live) | Certified mail, FCRA dispatch proof |
| O-3 | Decide the **client billing model** — retainer, monthly, success fee, or hybrid — and confirm it against CROA counsel before build | Billing (F-07) |
| O-4 | Supply `PLAID_CLIENT_ID` / `PLAID_SECRET`, or confirm Velocity stays manual | Banking velocity |
| O-5 | Confirm per-lender **authorization** for any programmatic or agent-assisted submission; obtain written permission or declare the lane manual | Any real submission (F-01) |
| O-6 | Engage qualified legal/compliance counsel on the Section 24 list (CROA, FCRA, consent, LLM transmission of bureau data, submission authority, success fees, retention) | Real client onboarding |
| O-7 | Define the **Empire HUD metric contract** — exactly which numbers the cockpit shows | F-08 |
| O-8 | Confirm the client authorization/consent document and its retention period | Consent storage |

### DEVELOPER ACTIONS
Everything in the P0–P3 tables below.

---

## P0 — CRITICAL (must be fixed before any real client data)

### P0-1 — Stop the fake submission success
- **Area:** Application submission
- **Problem:** `supabase/functions/submit-lender-application/index.ts` creates a reminder and a note, sets `funding_client_lender_matches.status='applied'`, and returns success — without contacting any lender.
- **Why it matters:** An operator or client is told a credit application was filed when it was not. Every downstream count of "applications submitted" is false. This is the most dangerous line in the system.
- **Dependency:** none — fix immediately, before O-1.
- **Developer action:** Rename the function to `prepare-lender-application`. Change the status write to a new value `prequal_task_created` (do not reuse `applied`). Return `{ submitted: false, next_action: 'manual_prequal', prequal_url }`. Update the Funding Matrix UI copy from "Submit" to "Prepare prequal task" and render the returned `submitted:false` explicitly. Backfill: audit any existing `applied` rows (currently 0) before changing the enum value.
- **Owner action:** none.
- **Acceptance:** No code path can write `status='applied'` without a recorded lender interaction. UI never says "submitted" when `submitted === false`.
- **Complexity:** S · **Compliance impact:** HIGH — misrepresentation of a financial action.

### P0-2 — Make `funding-documents` private
- **Area:** Security / storage
- **Problem:** `storage.buckets.funding-documents.public = true`; it receives client financial documents from `DocumentVault.tsx`. `customer-documents` is also public.
- **Why it matters:** Public buckets serve objects by path regardless of RLS. Currently 0 files, so there is **no live exposure** — this is the last safe moment to fix it.
- **Dependency:** none.
- **Developer action:** Set `public=false` on `funding-documents`. Add storage RLS policies scoping objects to staff roles and the owning client. Convert all read paths in `DocumentVault.tsx` to `createSignedUrl` with a short TTL. Review `customer-documents` under the same standard.
- **Owner action:** none.
- **Acceptance:** Unauthenticated fetch of an object path returns 400/403. Authenticated staff still download successfully.
- **Complexity:** S · **Compliance impact:** CRITICAL — financial PII.

### P0-3 — Route the lender importer and load the registry
- **Area:** Lender database
- **Problem:** `funding_lender_database` has 0 rows; `LenderImportPage.tsx` exists and is declared in `src/modules/fundingmachine/index.ts` but is **absent from `src/routes/AppRoutes.tsx`**, the live router. The tool that fixes the blocker cannot be opened.
- **Why it matters:** This is the first hard break in the pipeline. Nothing downstream can be built or tested without lender rows.
- **Dependency:** O-1 for the data; the route fix is independent and should ship first.
- **Developer action:** Add the lazy import and a `RequireRole`-wrapped route for `/funding-machine/lender-import`; add it to the `dynasty-funding-hub` group in `src/components/Layout.tsx`. Verify importer writes to `funding_lender_database` + `funding_lender_import_batches`, that `external_ref` update-in-place works, and that `automation_allowed` defaults to false on import.
- **Owner action:** O-1.
- **Acceptance:** Importer reachable from the sidebar; an XLSX upload produces rows; re-uploading the same file updates rather than duplicates; `lender-matching-engine` then returns non-zero matches for an existing client.
- **Complexity:** S (route) / M (import QA) · **Compliance impact:** LOW.

### P0-4 — Guard the client portal route
- **Area:** Security / routing
- **Problem:** `/funding-machine/portal` is registered at `AppRoutes.tsx:1368`, outside the role-protected block, with no wrapper.
- **Dependency:** none.
- **Developer action:** Verify `ClientPortalPage.tsx` enforces its own session + client-scoping. If it relies on the route guard, add an explicit client-auth guard that resolves `portal_user_id` against the session and renders nothing until resolved.
- **Acceptance:** Signed-out access shows a login gate, never client data. A signed-in client cannot load another client's `clientId`.
- **Complexity:** S · **Compliance impact:** CRITICAL.

### P0-5 — Mail dispatch integrity
- **Area:** Credit repair / FCRA
- **Problem:** `POSTGRID_API_KEY` unset, yet 2 `funding_dispute_rounds` are marked `sent` with no `tracking_number`.
- **Dependency:** O-2 for automation; the integrity guard is independent.
- **Developer action:** Prevent `funding_dispute_rounds.status='sent'` unless a linked `funding_mailing_log` row has a non-null `tracking_number` (validation trigger, not a CHECK — the rule references related rows). Add a `manually_mailed` path that requires the operator to enter a USPS tracking number. Reconcile the 2 existing rows to `pending_dispatch` or attach real tracking numbers — **do not delete them.**
- **Acceptance:** No round can reach `sent` without provable dispatch evidence.
- **Complexity:** M · **Compliance impact:** HIGH — FCRA evidence.

---

## P1 — HIGH (required for operational functionality)

### P1-1 — Funding outcome schema
- **Problem:** `funding_applications` has no `funded_amount`, `funding_date`, `lender_id`, `funding_lane`, or `lender_reference_id`. "Capital secured" is a hand-typed number on `funding_clients.funding_received`.
- **Developer action:** Additive migration adding those columns (`lender_id` FK → `funding_lender_database`, nullable to preserve the existing row). Add a `capital_events` table (client_id, source `funding|grant`, lane, amount, event_date, application_id) with GRANTs + RLS. Derive `funding_received` from `capital_events` via a view; keep the manual column readable during transition.
- **Acceptance:** Recording an approval and a funding on an application updates Capital Deployed with no manual entry. Existing row and both client rows unchanged.
- **Complexity:** M · **Dependency:** none · **Compliance:** LOW.

### P1-2 — Unify the four lender models
- **Problem:** `funding_lender_database` (canonical, empty), `lenders` (empty orphan), `auto_lenders` (17 real), `credit_unions`/`credit_union_products` (25/76 real). Two working engines never write to `funding_client_lender_matches`.
- **Developer action:** Keep `funding_lender_database` canonical with `funding_lane` as discriminator. Make `match-auto-lenders` and `score-client-for-credit-unions` write their results into `funding_client_lender_matches` with `lane='auto'` / `lane='credit_union'` and a `source_table` reference — **do not migrate or delete the reference tables.** Deprecate `lenders`/`lender_applications` only after confirming zero readers.
- **Acceptance:** A single client view shows matches from all lanes in one ranked list.
- **Complexity:** M · **Dependency:** P0-3 · **Compliance:** LOW.

### P1-3 — Surface the orphaned pages
- **Problem:** Bill Guardian, Deletion Letters, Secure Intake, Credit Union Intel, Auto Financing, Shelf Corp are URL-only; `FundingQualificationCalculator.tsx` has no route at all.
- **Developer action:** Add each to `src/components/Layout.tsx` group `dynasty-funding-hub` under a logical sub-heading, or delete the page if the capability is abandoned. Decide explicitly on `FundingQualificationCalculator` — route it or remove it.
- **Acceptance:** No built, role-protected page is reachable only by typing a URL. `scripts/check-sidebar-routes.mjs` passes.
- **Complexity:** S · **Dependency:** none.

### P1-4 — Application package generation
- **Problem:** `auto-fill-application` fills fields; there is no artifact, no storage, no versioning. `funding_application_profile` has no write path.
- **Developer action:** Add a package generator that assembles client + business + financial data + required documents into a stored artifact in the **private** `funding-documents` bucket, records it in `funding_client_documents` with a version number, and links it to the application. Give `funding_application_profile` a real write path from intake/profile.
- **Acceptance:** For a client with a lender match, an operator produces a downloadable, versioned, lender-specific package containing real client data.
- **Complexity:** L · **Dependency:** P0-2, P0-3 · **Compliance:** MEDIUM.

### P1-5 — Client billing
- **Problem:** No billing of any kind in the Funding Hub.
- **Developer action:** After O-3 and O-6, implement Stripe with the approved model: customer record on `funding_clients`, checkout/subscription creation, webhook → payment table → client status. **Do not implement advance fees before CROA sign-off.**
- **Acceptance:** A client can be charged and the payment is traceable to their record.
- **Complexity:** L · **Dependency:** O-3, O-6 · **Compliance:** CRITICAL.

### P1-6 — Empire HUD reader
- **Problem:** No implementation exists.
- **Developer action:** After O-7, build a single metrics query (client count, active clients, applications by status, approvals, capital secured from `capital_events`, open tasks, alerts) and the cockpit component that reads it.
- **Acceptance:** Cockpit numbers reconcile exactly with Funding Hub pages.
- **Complexity:** M · **Dependency:** P1-1, O-7.

### P1-7 — Credit repair round state machine
- **Problem:** No FCRA 30-day clock, no round 2/3 escalation, no bureau-response ingestion.
- **Developer action:** Add `response_due_date` (dispatch + 30d) and `bureau_response` to `funding_dispute_rounds`; a scheduled job that flags overdue rounds into `funding_task_cards`; an operator flow to record the bureau response and open the next round with prior-round context.
- **Acceptance:** A round mailed today produces an escalation task on day 31 if unanswered.
- **Complexity:** M · **Dependency:** P0-5 · **Compliance:** HIGH.

---

## P2 — MEDIUM (production maturity)

| ID | Area | Problem | Developer action | Dependency | Complexity |
|---|---|---|---|---|---|
| P2-1 | Data integrity | No duplicate-client prevention | Partial unique index on normalised email and phone; pre-submit lookup in `ClientIntakePage` showing the existing match | none | S |
| P2-2 | Credit data | Source credit report discarded after parsing | Store the uploaded file in the private bucket, link to `funding_client_documents`, reference from parsed items | P0-2 | M |
| P2-3 | Credit data | Parser output drives DFS with no review gate | Add a review/confirm step before parsed items are committed; store parser confidence | P2-2 | M |
| P2-4 | Automation | No Funding Hub cron verifiable (`permission denied for schema cron`) | Expose a read-only job inventory to the audit role; confirm or create: morning briefing, dispute deadlines, application reminders, DFS refresh | none | S |
| P2-5 | Business foundation | EIN/LLC/DUNS self-reported yet feed the DFS `entity_quality` component | Add `verified_at` + `verification_source` per checklist item; discount unverified inputs in scoring | none | M |
| P2-6 | AI governance | Two providers (Anthropic direct + Lovable Gateway) across 6 workflows | Consolidate onto the Gateway; add output schema validation before any DB write | none | M |
| P2-7 | Schema hygiene | Orphans: `funding_tasks`, `funding_mailbox_config`, `funding_daily_briefings_legacy`, `lenders`, `lender_applications`, `funding_card_database` (no write path) | Confirm zero readers, then deprecate — non-destructive, rename-and-observe first | P1-2 | S |
| P2-8 | Duplicate routes | `/briefing` + `/morning-briefing`; `/lenders` aliasing the matrix | Collapse to one canonical route with redirects | none | S |
| P2-9 | Security | `encrypt-client-ssn` sends an operator SMS on intake | Verify no PII in the message body; log the alert to the audit trail | none | S |
| P2-10 | Revenue page | `RevenueDashboardPage.tsx` has no DB calls | Wire to `capital_events` or remove the page | P1-1 | M |
| P2-11 | Typing | `ShelfCorpPage` uses `as any` casts on both queries | Regenerate types and remove casts | none | S |
| P2-12 | Tradelines | No age or utilization tracking on tradelines | Add `opened_at`, `current_balance`, derived age/utilization; feed into DFS | none | M |

---

## P3 — LOW (optimization / UX)

| ID | Item |
|---|---|
| P3-1 | DFS score history + trend chart per client (`client_score_history` already exists) |
| P3-2 | Match explanation UI — surface why a lender qualified or failed, per criterion |
| P3-3 | Bulk client actions on the Clients list |
| P3-4 | Loading/empty/error states audit across the 8 newly-surfaced pages |
| P3-5 | Consolidate `FundingModuleStub` pages (`/sba`, `/cdfi`, `/credit-stacking`, `/playbook`) into lanes of the unified lender model rather than standalone routes |
| P3-6 | Export: client funding summary PDF |

---

## DEPENDENCY ORDER (execution sequence)

```
1.  P0-2  private bucket            ── independent, do first
2.  P0-1  kill fake submission      ── independent
3.  P0-4  guard portal route        ── independent
4.  P0-5  mail dispatch integrity   ── independent (automation needs O-2)
5.  P0-3  route importer            ── then O-1 supplies lender data
        │
6.      P1-2  unify lender models ──┐
7.      P1-1  funding outcome schema┤
8.      P1-3  surface orphan pages  │  (parallel)
9.      P1-7  dispute state machine ┘
        │
10. P1-4  application package  (needs P0-2, P0-3)
11. P1-6  Empire HUD           (needs P1-1, O-7)
12. P1-5  billing              (needs O-3, O-6 — legal gate)
        │
13. P2 block
14. P3 block
```

**Shortest path to "a real client can be processed":** P0-2 → P0-1 → P0-3 + O-1 → P1-2 → P1-1 → P1-4 → O-5. Certified mail requires O-2 in parallel. Billing requires O-3 and O-6 and is on the legal critical path, not the engineering one.

---

## GUARDRAILS FOR FIX MODE

- No destructive migrations. Preserve the 2 clients, 62 credit items, 2 dispute rounds, 1 application, 35 briefings, and all reference data (25 credit unions, 76 products, 17 auto lenders, 7 shelf-corp vendors).
- Every new public-schema table: CREATE → GRANT → ENABLE RLS → CREATE POLICY, in that order.
- Never weaken RLS or add `USING (true)` to reach a green result.
- Never fabricate a lender, approval, or funding record to make a screen look populated.
- Never resolve a blocked integration by simulating it. If a key is missing, the surface must say so — as the Settings page already correctly does.
- Time-dependent rules use validation triggers, not CHECK constraints.
- Every fix ships with its regression check from `funding-hub-qa-matrix-2026-08-10.md` Part B.
