# DYNASTY FUNDING HUB — MASTER SYSTEM AUDIT
**Date:** 2026-08-10 · **Env:** Lovable e9aba3c3 · **Backend project:** qalaaroashbggynpvqct
**Mode:** Phase 1 forensic audit — READ-ONLY. No code, schema, RLS, data, or config was modified.
**Scope:** `/funding-machine/*` only. Grant OS audited only for consolidation readiness (Section 20).

---

## 1. EXECUTIVE SUMMARY

The Funding Hub is a **broad, genuinely-wired CRUD system with a real scoring engine and a fake ending**. Nearly every page reads and writes real tables — there is very little hardcoded UI data, which is unusual and to the build's credit. The Dynasty Fundability Score is a real, weighted, database-resident algorithm operating on real client rows.

But the pipeline does not reach funding. Three hard stops:

1. **`funding_lender_database` contains 0 rows.** The lender matching engine (`lender-matching-engine`) queries this table. With no lenders, matching returns nothing. Every downstream stage — matches, application package, submission, approval, funding — is therefore unreachable regardless of code quality.
2. **`submit-lender-application` does not submit anything.** It creates a reminder, writes a note, and flips the match status to `applied`. There is no lender API call, no browser automation, no package transmission. The UI reports success. **This is a fake success state on a financial action.**
3. **Certified mail is unconfigured.** `funding-postgrid` is a complete, correct PostGrid integration, but `POSTGRID_API_KEY` is not set. Dispute rounds show `sent` while `funding_mailing_log` holds only 2 rows with no dispatch evidence — the disputes were marked sent without provable mailing.

There are **2 client rows, 1 application row, 0 lender rows, 0 documents, 0 tradelines, 0 bills**. The system has never processed a real client end-to-end.

**Verdict: FUNCTIONAL PROTOTYPE.** Real spine, real scoring, real persistence — no lender data and no real submission path.

---

## 2. SYSTEM PURPOSE

Operational engine for client intake → credit assessment (DFS) → credit repair/disputes → certified mail → business foundation → tradelines → lender matching → application → submission → approval → funding tracking, feeding an executive cockpit.

---

## 3. ACTUAL CURRENT ARCHITECTURE

- **Frontend:** React/Vite. 25 pages in `src/pages/funding-machine/`, 8 components in `src/components/funding-machine/`.
- **Routing:** `src/routes/AppRoutes.tsx` (lines 1017–1042 lazy imports, 2252–2281 routes). Guarded by `RequireRole allowedRoles={['owner','admin','employee','accountant']}`.
- **Navigation:** `src/components/Layout.tsx` lines 541–557, group `dynasty-funding-hub`.
- **Database:** ~40 `funding_*` tables plus `credit_unions`, `credit_union_products`, `auto_lenders`, `shelf_corp_*`, `deletion_letter_recipients`, `chexsystems_upload_documents`. All have RLS enabled with ≥1 policy. No `anon` grants on any funding table (verified via `information_schema.role_table_grants` — empty result).
- **Edge Functions (funding-relevant):** `funding-ai-agent`, `funding-postgrid`, `funding-plaid`, `funding-report-parser`, `funding-morning-briefing`, `credit-analysis-brain`, `lender-matching-engine`, `submit-lender-application`, `match-auto-lenders`, `score-client-for-credit-unions`, `encrypt-client-ssn`, `auto-fill-application`, `generate-deletion-letter`.
- **Storage:** buckets `funding-documents` (**public=true**), `customer-documents` (**public=true**), `chexsystems-docs` (private).
- **AI:** two providers in parallel — Lovable AI Gateway (`funding-ai-agent`) and direct Anthropic (`lender-matching-engine`, `credit-analysis-brain`, `funding-report-parser`, `funding-morning-briefing`).

---

## 4. END-TO-END OPERATIONAL FLOW

| Stage | Implementation | Tables | Code / Function | Status | Evidence |
|---|---|---|---|---|---|
| Client Intake | Multi-step form, real insert | `funding_clients`, `funding_dfs_scores`, `funding_infrastructure_checklist` | `ClientIntakePage.tsx` | VERIFIED WORKING | 2 real rows; DFS row inserted at line 95 |
| Secure Intake (SSN) | Edge-function-mediated, last-4 only | `funding_clients` | `SecureClientIntakePage.tsx` → `encrypt-client-ssn` | VERIFIED WORKING | fn line 53 writes via service role |
| Client Profile | Reads safe column list | `funding_clients` | `ClientProfilePage.tsx`, `lib/funding/pii.ts` | VERIFIED WORKING | `FUNDING_CLIENT_SAFE_COLUMNS` excludes ciphertext |
| DFS | Real weighted SQL algorithm | `funding_dfs_weights` (7 rows), `funding_dfs_scores`, `funding_credit_items` | `public.compute_funding_dfs`, `recompute_all_funding_dfs` | VERIFIED WORKING | scores 41 and 37 computed from real items |
| Credit Report Ingest | LLM parse → real inserts | `funding_credit_items` | `CreditReportUploadModal.tsx` → `funding-report-parser` (Anthropic) | PARTIALLY WORKING | Real parser, but no PDF/document persistence of the source report |
| Credit Repair / Disputes | Real CRUD + AI letters | `funding_credit_items` (62), `funding_dispute_rounds` (2) | `CreditRepairPage.tsx` → `funding-ai-agent` | PARTIALLY WORKING | letters generated from real client items; rounds persisted |
| Certified Mail | Full PostGrid client, key absent | `funding_mailing_log` (2) | `funding-postgrid` | BLOCKED | `ping` returns `{configured:false, reason:"POSTGRID_API_KEY is not set"}` |
| Business Foundation | Real per-client checklist | `funding_infrastructure_checklist` (14) | `BusinessBuilderPage.tsx` | PARTIALLY WORKING | Real rows, but checklist only — no verification of LLC/EIN/DUNS |
| Tradelines | Real CRUD, zero data | `funding_tradeline_accounts` (0), `funding_tradeline_vault_cards` (0) | `TradelineVaultPage.tsx` | DISCONNECTED | Write paths exist, never used |
| Lender Matching | Real engine, empty registry | `funding_lender_database` (**0**), `funding_client_lender_matches` (0) | `lender-matching-engine` | BROKEN (no data) | fn line 42 selects from empty table |
| Application Package | Autofill dialog + AI | `funding_autofill_runs` (0) | `AutoFillApplicationDialog.tsx` → `auto-fill-application` | PARTIALLY WORKING | No PDF generation, no versioning, no storage of a package artifact |
| Submission | Reminder + note only | `client_reminders`, `client_notes` | `submit-lender-application` | **MOCK — FAKE SUCCESS** | lines 74–110: no lender call anywhere in file |
| Approval Tracking | Manual fields | `funding_applications` (1) | `ApplicationsPage.tsx` | PARTIALLY WORKING | `approved_amount`, `decision_date` exist and are editable |
| Funding Secured | Manual number on client row | `funding_clients.funding_received` | dashboard `RevenueSnapshot` | PARTIALLY WORKING | Real query, but the input is hand-typed; **no `funded_amount`/`funding_date` column on `funding_applications`** |
| Empire HUD | **No consumer found** | — | — | NOT FOUND | `rg "EmpireHUD|Empire HUD" src` → 0 hits |

### Can a real client be processed from intake through funding tracking today?
**NO.**
Intake, profile, DFS, credit items, and dispute drafting work on real data. The chain breaks at **lender matching (empty registry)** and, even if seeded, at **submission (no real submission mechanism)**. Funding secured is a manually typed number, not a tracked outcome.

---

## 5. ROUTE / PAGE AUDIT

Source of truth: `src/routes/AppRoutes.tsx`; sidebar: `src/components/Layout.tsx` 541–557.

| Page | Route | Registered | Sidebar | Reachable | Protected | Status |
|---|---|---|---|---|---|---|
| Dashboard | `/funding-machine` | Yes | Yes | Yes | Yes | WORKING |
| Morning Briefing | `/funding-machine/briefing` + `/morning-briefing` | Yes (both) | Yes (briefing) | Yes | Yes | WORKING (duplicate route) |
| Clients List | `/funding-machine/clients` | Yes | Yes | Yes | Yes | WORKING |
| Client Intake | `/funding-machine/intake` | Yes | Yes | Yes | Yes | WORKING |
| Client Profile | `/funding-machine/client/:clientId` | Yes | n/a | Yes | Yes | WORKING |
| Credit Repair | `/funding-machine/credit-repair` | Yes | Yes | Yes | Yes | PARTIAL |
| Business Builder | `/funding-machine/business-builder` | Yes | Yes | Yes | Yes | PARTIAL |
| Bureau Intelligence | `/funding-machine/bureau-intel` | Yes | Yes | Yes | Yes | PARTIAL |
| Funding Matrix | `/funding-machine/funding-matrix` | Yes | Yes | Yes | Yes | BROKEN (no lenders) |
| Lenders alias | `/funding-machine/lenders` | Yes | No | URL only | Yes | DUPLICATE of matrix |
| Lender Import | `/funding-machine/lender-import` | Module def only | No | **Not in AppRoutes** | — | NOT FOUND in live router |
| Applications | `/funding-machine/applications` | Yes | Yes | Yes | Yes | PARTIAL |
| Velocity Calculator | `/funding-machine/velocity` | Yes | Yes | Yes | Yes | BLOCKED (Plaid keys absent) |
| Tradeline Vault | `/funding-machine/tradeline-vault` | Yes | Yes | Yes | Yes | DISCONNECTED |
| Tradelines alias | `/funding-machine/tradelines` | Redirect | No | Yes | Yes | OK |
| Task Cards | `/funding-machine/tasks` | Yes | Yes | Yes | Yes | WORKING |
| Revenue Dashboard | `/funding-machine/revenue` | Yes | Yes | Yes | Yes | PARTIAL |
| Settings | `/funding-machine/settings` | Yes | Yes | Yes | Yes | WORKING |
| Bill Guardian | `/funding-machine/bill-guardian` | Yes | **No** | URL only | Yes | ORPHANED |
| Deletion Letter Engine | `/funding-machine/deletion-letters` | Yes | **No** | URL only | Yes | ORPHANED |
| Secure Client Intake | `/funding-machine/secure-intake` | Yes | **No** | URL only | Yes | ORPHANED |
| Credit Union Intel | `/funding-machine/credit-union-intel` | Yes | **No** | URL only | Yes | ORPHANED |
| Auto Financing | `/funding-machine/auto-financing` | Yes | **No** | URL only | Yes | ORPHANED |
| Shelf Corp | `/funding-machine/shelf-corp` | Yes | **No** | URL only | Yes | ORPHANED |
| Grant Funder CRM | `/funding-machine/grants` | Yes | No | URL only | Yes | Cross-system |
| Client Portal | `/funding-machine/portal` | Yes | No | Yes | **Unauthenticated route** | REVIEW |
| Credit Stacking / SBA / CDFI / Playbook | various | Yes | No | URL only | Yes | STUBS (`FundingModuleStub`) |
| Funding Qualification Calculator | — | **No route** | No | **Unreachable** | — | DEAD CODE |

**Finding:** 8 fully-built pages are reachable only by typing the URL. `FundingQualificationCalculator.tsx` (260 lines) has no route at all. `LenderImportPage` is declared in `src/modules/fundingmachine/index.ts` but absent from `AppRoutes.tsx`, which is the live router — **the lender bulk importer, the exact tool needed to fix the empty registry, is not reachable in the running app.**

---

## 6. DATABASE AUDIT

| Table | Rows | Real data | Read by | Written by | In prod flow | Status |
|---|---|---|---|---|---|---|
| funding_clients | 2 | Yes | most pages | ClientIntakePage, encrypt-client-ssn | Yes | ACTIVE |
| funding_dfs_scores | 2 | Yes | DfsBreakdownCard, Matrix | Intake, CreditReportUploadModal, compute_funding_dfs | Yes | ACTIVE |
| funding_dfs_weights | 7 | Yes (config) | DfsWeightsCard, compute_funding_dfs | DfsWeightsCard | Yes | ACTIVE |
| funding_credit_items | 62 | Yes | CreditRepairPage, DFS | CreditReportUploadModal, manual | Yes | ACTIVE |
| funding_dispute_rounds | 2 | Yes (`sent`) | CreditRepairPage | CreditRepairPage | Yes | ACTIVE |
| funding_mailing_log | 2 | Partial | CreditRepairPage | CreditRepairPage, funding-postgrid | Yes | PARTIAL |
| funding_infrastructure_checklist | 14 | Yes | BusinessBuilderPage | BusinessBuilderPage | Yes | ACTIVE |
| funding_task_cards | 3 | Yes | TaskCardsPage, Dashboard | TaskCardsPage | Yes | ACTIVE |
| funding_morning_briefings | 35 | Yes | MorningBriefingPage, Dashboard | funding-morning-briefing | Yes | ACTIVE |
| funding_applications | 1 | Yes | ApplicationsPage | ApplicationsPage | Yes | PARTIAL |
| funding_lender_relationships | 1 | Yes | LenderRelationships | LenderRelationships | Yes | ACTIVE |
| **funding_lender_database** | **0** | — | lender-matching-engine, submit-lender-application, LenderImportPage | LenderImportPage (**unrouted**) | Yes | **EMPTY — BLOCKING** |
| funding_client_lender_matches | 0 | — | Matrix, submit-lender-application | lender-matching-engine | Yes | EMPTY |
| funding_lender_products | 0 | — | — | LenderImportPage | No | EMPTY |
| funding_lender_import_batches | 0 | — | LenderImportPage | LenderImportPage | No | EMPTY |
| funding_tradeline_accounts | 0 | — | BusinessBuilderPage | BusinessBuilderPage | Yes | EMPTY |
| funding_tradeline_vault_cards / _transactions | 0 / 0 | — | TradelineVaultPage | TradelineVaultPage | Yes | EMPTY |
| funding_client_documents | 0 | — | DocumentVault | DocumentVault | Yes | EMPTY |
| funding_plaid_connections / _transactions | 0 / 0 | — | VelocityCalculator | funding-plaid | Yes | BLOCKED (no keys) |
| funding_banking_velocity | 0 | — | VelocityCalculator | VelocityCalculator | Yes | EMPTY |
| funding_bills / funding_payment_cards | 0 / 0 | — | BillGuardianPage | BillGuardianPage | Orphan route | EMPTY |
| funding_autofill_runs | 0 | — | — | auto-fill-application | Yes | EMPTY |
| funding_card_database | 0 | — | BureauIntelPage | — | Yes | **NO WRITE PATH** |
| funding_application_profile | 0 | — | auto-fill-application | — | Partial | NO WRITE PATH |
| funding_machine_settings | 0 | — | SettingsPage | SettingsPage | Yes | EMPTY |
| funding_mailbox_config | 0 | — | — | — | No | ORPHANED |
| funding_tasks | 0 | — | — | — | No | ORPHANED (duplicate of funding_task_cards) |
| funding_daily_briefings_legacy | 0 | — | — | — | No | ORPHANED |
| credit_unions / credit_union_products | 25 / 76 | Reference | CreditUnionIntelPage (orphan route) | — | No | REFERENCE DATA |
| auto_lenders | 17 | Reference | match-auto-lenders | — | No | REFERENCE DATA |
| shelf_corp_vendors / _tracker | 7 / 0 | Reference | ShelfCorpPage (orphan route) | ShelfCorpPage | No | REFERENCE DATA |
| deletion_letter_recipients | 0 | — | DeletionLetterEnginePage (orphan) | same | No | EMPTY |
| chexsystems_upload_documents | 0 | — | DeletionLetterEnginePage | same | No | EMPTY |
| lenders / lender_applications | 0 / 0 | — | — | — | No | **ORPHANED DUPLICATE MODEL** |

**Foreign keys:** solid. 27 FK constraints verified; every client-scoped table references `funding_clients`. `funding_client_lender_matches` correctly references both `funding_clients` and `funding_lender_database`.

**Schema defects:**
- `funding_applications` has `requested_amount`, `approved_amount`, `decision_date` — but **no `funded_amount`, no `funding_date`, no `lender_id` FK, no `funding_lane`**. Approval is trackable; funding is not.
- Three competing lender models: `funding_lender_database` (canonical, empty), `lenders` (empty orphan), `auto_lenders` (17 rows, separate engine), `credit_unions` (25 rows, separate engine). Four matching paths, no unified eligibility.
- `funding_tasks` duplicates `funding_task_cards`.

---

## 7. INTAKE + DFS AUDIT

**Intake — VERIFIED WORKING.** `ClientIntakePage.tsx` performs a real multi-step insert into `funding_clients`, then seeds `funding_dfs_scores` and `funding_infrastructure_checklist`. **No duplicate detection** on email/phone/SSN-last-4 was found.

**Credit report — PARTIAL PARSER.** `funding-report-parser` sends report text to Anthropic and returns structured accounts, which `CreditReportUploadModal.tsx` inserts into `funding_credit_items` (lines 64, 79) and writes the bureau score back to `funding_dfs_scores` (line 93). It extracts accounts, balances, derogatories, inquiries, bureau. It does **not** persist the source document, has no confidence gate, and no human review step before the parsed data drives a score.

**DFS — VERIFIED WORKING (real algorithm).** `public.compute_funding_dfs(_client_id)`:
- Loads active weights from `funding_dfs_weights` (7 components, sum 100).
- `personal_credit`: best of TU/EQ/EX, normalised `((score-300)/550)*100`.
- `derogatories`: `100 - (unresolved_items * 8)`, floored at 0, excluding `hard inquiry`.
- `utilization`: `sum(balance)/sum(limit)` banded 100/85/60/35/10 at ≤10/≤30/≤50/≤75/>75%.
- Plus `inquiries`, `entity_quality`, `time_in_business`, `revenue`.
- Missing components are excluded from `weight_used` and reported in a `missing[]` array — the score is honest about partial input.
- Persisted to `funding_clients.current_dfs_score`; `recompute_all_funding_dfs()` re-scores everyone when weights change.

Verified live: two clients scored 41 and 37 from real credit items. **Not hardcoded, not AI-generated, not static.**

---

## 8. CREDIT REPAIR AUDIT

- Item identification: real rows in `funding_credit_items` (62), prioritised by `deletion_priority`.
- Letter generation: `CreditRepairPage.tsx` line 133/156 → `funding-ai-agent` with actual client and item data. **REAL CLIENT-DATA-DRIVEN**, not a static template.
- Rounds: `funding_dispute_rounds` real inserts (line 182), 2 rows at status `sent`.
- Bureau-specific logic: present via `funding_credit_items.bureau`.
- Deadlines / bureau responses / round 2–3 escalation: **NOT FOUND** — no automated 30-day FCRA clock, no response ingestion.
- Mail: `funding_mailing_log` insert (line 195) then `funding-postgrid`.

**Certified mail — BLOCKED, integration real.** `funding-postgrid/index.ts` is a genuine PostGrid Print-Mail v1 client, forces `certified_return_receipt` (line 23), and writes back `postgrid_letter_id`, `tracking_number`, `cost`, `sent_date`. `POSTGRID_API_KEY` is not configured; ping returns `configured:false`. **Two dispute rounds are marked `sent` with no verifiable dispatch** — an evidentiary gap for FCRA purposes.

**Bill Guardian — EXISTS, ORPHANED.** `BillGuardianPage.tsx` (337 lines) does real CRUD on `funding_bills` and `funding_payment_cards` (both 0 rows), including mark-paid. It is not in the sidebar and has no data. It is a bill/AU-card payment tracker, not a credit product.

---

## 9. BUSINESS FOUNDATION + TRADELINES

**Foundation — CHECKLIST ONLY.** `funding_infrastructure_checklist` (14 rows) tracks per-client items and `funding_clients` carries `business_name`, `ein`, `duns_number`, `business_state`, `time_in_business_months`. These are **self-reported and unverified** — no EIN validation, no D&B lookup, no Secretary-of-State check, no bank-account verification. `entity_quality` feeds DFS from these unverified fields.

**Tradelines — REAL SYSTEM, ZERO DATA.** `funding_tradeline_accounts` and `funding_tradeline_vault_cards`/`_transactions` support vendor, tier, limit, reporting bureau, slots, and occupancy, with real inserts/updates in `TradelineVaultPage.tsx` and AU-slot assignment. All three tables are empty. Age/utilization tracking on tradelines: NOT FOUND.

---

## 10. LENDER DATABASE + MATCHING

**Registry — EMPTY.** `funding_lender_database` has an excellent 40-column schema (`min_credit_score`, `min_revenue`, `min_time_in_business_months`, `funding_lane`, `stack_priority`, `no_pg`, `automation_allowed`, `has_soft_pull_prequal`, `submission_method`, `docs_required`, `inquiry_sensitivity`, `prequal_url`, `application_url`, `reports_to`, …) and **0 rows**.

**Matching — REAL ALGORITHM, STARVED.** `lender-matching-engine/index.ts` loads the client (line 29), loads lenders (line 42), computes eligibility, writes `funding_client_lender_matches` (line 124), then optionally narrates the result with Anthropic (line 161) and logs to `client_notes` (line 185). The algorithm is deterministic and real. With 0 lenders it returns 0 matches, always.

**Parallel engines:** `match-auto-lenders` (17 `auto_lenders` rows) and `score-client-for-credit-unions` (25 CUs / 76 products) are real, data-backed, and functional — but both live on **orphaned routes** and neither writes to `funding_client_lender_matches`, so their results never enter the main pipeline.

**The importer that fixes this is unrouted.** `LenderImportPage.tsx` exists and is declared in `src/modules/fundingmachine/index.ts`, but `/funding-machine/lender-import` is absent from `AppRoutes.tsx`.

---

## 11. FUNDING LANES

`funding_lane` is a free-text column on `funding_lender_database`. With 0 rows, **no lane exists in data.** Lanes appear only as UI stubs.

| Lane | Exists in DB | Matching | Application | Submission | Tracking | Status |
|---|---|---|---|---|---|---|
| Business credit / cards | Column only, 0 rows | Engine ready | Autofill only | Mock | Manual | NOT POPULATED |
| Personal credit | Column only | Engine ready | Autofill only | Mock | Manual | NOT POPULATED |
| Credit unions | `credit_unions` 25 | Real, separate | No | No | No | DISCONNECTED |
| Auto | `auto_lenders` 17 | Real, separate | No | No | No | DISCONNECTED |
| SBA | — | — | — | — | — | STUB PAGE ONLY |
| CDFI | — | — | — | — | — | STUB PAGE ONLY |
| Credit stacking | — | — | — | — | — | STUB PAGE ONLY |
| Shelf corp | `shelf_corp_vendors` 7 | No | No | No | Tracker (0 rows) | REFERENCE ONLY |
| Fintech / LOC / term / equipment | — | — | — | — | — | NOT FOUND |

---

## 12. APPLICATION GENERATION

`AutoFillApplicationDialog.tsx` → `auto-fill-application`, run log table `funding_autofill_runs` (0 rows), profile source `funding_application_profile` (0 rows, **no write path**). There is **no PDF/document generation, no package artifact, no storage write, no versioning, no lender-specific form mapping**. Classification: **PARTIAL — field autofill only, not package generation.**

---

## 13. APPLICATION SUBMISSION

- **Method A (lender API):** NOT FOUND. No lender API client exists in any function.
- **Method B (browser automation):** NOT FOUND — and this is the correct outcome. A codebase-wide scan for `browserbase|skyvern|stagehand|puppeteer|proxy rotation|captcha solving|fingerprint spoofing|stealth` returned **zero matches**. **No fraud-control evasion exists in this codebase.** This is a clean compliance result.
- **Method C (manual):** partially — `submit-lender-application` creates a reminder with the prequal URL and a note, which is a hand-off to a human. It also correctly refuses when `has_soft_pull_prequal === false` ("Manual application required").

**Critical defect:** the function returns `status: 'task_created'` **and simultaneously sets `funding_client_lender_matches.status = 'applied'` with `applied_at = now()`** (lines 90–95). Nothing was applied to. Any downstream count of "applications submitted" is false.

**Human-in-the-loop (OTP, ID, e-sign, CAPTCHA):** not applicable — there is no automation to pause. No checkpoint/resume infrastructure exists.

**Response read-back:** NOT IMPLEMENTED. No parser, no status ingestion, no lender reference ID capture, no approved/funded amount write-back.

---

## 14. APPROVAL + FUNDING TRACKING

`funding_applications` records `requested_amount`, `approved_amount`, `apr`, `term_months`, `monthly_payment`, `status`, `application_date`, `decision_date`, `denial_reason`, `lender_name` (**text, not FK**). Manual entry via `ApplicationsPage.tsx`.

Missing: `funded_amount`, `funding_date`, `lender_id`, `funding_lane`, `lender_reference_id`.

**"Capital Deployed" is a real query**, not a hardcoded number: `RevenueSnapshot` sums `funding_clients.funding_received` and awarded `client_grant_matches`. But `funding_received` is a **manually typed field on the client row with no derivation from any application record** — currently `0` for both clients. The number is real-sourced and untrustworthy at the same time.

**Dashboard stats verified non-mock:** Active Clients, Avg DFS, Pending Tasks, Total Pipeline are all computed from live query results (`FundingMachineDashboard.tsx` lines 530–536).

---

## 15. AUTOMATION / EDGE FUNCTIONS

| Function | Exists | Purpose | Called by | Schedule | Real logic | External API | Status |
|---|---|---|---|---|---|---|---|
| funding-ai-agent | Yes | Letters, plans, task gen | CreditRepair, BusinessBuilder, Tradeline, Tasks, Matrix, Applications | On demand | Yes | Lovable AI Gateway | WORKING |
| funding-postgrid | Yes | Certified mail + ping | Settings, CreditRepair | On demand | Yes | PostGrid | BLOCKED (no key) |
| funding-report-parser | Yes | Credit report extraction | CreditReportUploadModal | On demand | Yes | Anthropic | WORKING |
| funding-plaid | Yes | Bank link + velocity | VelocityCalculator | On demand | Yes | Plaid | BLOCKED (no keys) |
| funding-morning-briefing | Yes | Daily digest | MorningBriefing | Unverified | Yes | Anthropic | PARTIAL — 35 rows exist |
| credit-analysis-brain | Yes | Credit strategy | Unverified caller | On demand | Yes | Anthropic | PARTIAL |
| lender-matching-engine | Yes | Eligibility matching | Matrix | On demand | Yes | Anthropic (narration) | BROKEN (no lender data) |
| submit-lender-application | Yes | "Submit" | Matrix | On demand | **No submission** | None | **MOCK** |
| match-auto-lenders | Yes | Auto lane match | AutoFinancingPage (orphan) | On demand | Yes | None | DISCONNECTED |
| score-client-for-credit-unions | Yes | CU scoring | CreditUnionIntel (orphan) | On demand | Yes | None | DISCONNECTED |
| encrypt-client-ssn | Yes | SSN intake + SMS alert | SecureClientIntake | On demand | Yes | Twilio | WORKING |
| auto-fill-application | Yes | Field autofill | AutoFillApplicationDialog | On demand | Yes | AI | PARTIAL |
| generate-deletion-letter | Yes | ChexSystems letters | DeletionLetterEngine (orphan) | On demand | Yes | AI | DISCONNECTED |

**Scheduled jobs: NOT VERIFIED.** The audit role lacks `USAGE` on schema `cron` (`ERROR: permission denied for schema cron`). `funding_morning_briefings` holding 35 rows is circumstantial evidence of a working schedule, but **no cron job for the Funding Hub could be confirmed.** No dispute-deadline job, credit-monitoring job, or application-reminder job could be verified.

**AI:** genuinely wired for letter drafting, strategy, task generation, document extraction, and match narration. Two providers in parallel (Lovable Gateway + direct Anthropic) — a maintenance and cost-governance split, not a functional defect.

---

## 16. BILLING

**NOT FOUND.** `rg -i stripe src/pages/funding-machine src/components/funding-machine` → **zero matches**. No checkout, no subscription, no retainer, no success-fee record, no webhook, no payment table in the funding schema. `RevenueDashboardPage.tsx` contains no Supabase calls at all. Client billing for the Funding Hub does not exist.

---

## 17. SECURITY / RLS / PII

**Positives (verified):**
- RLS enabled with ≥1 policy on **all 39** funding-related tables.
- **Zero `anon` grants** on any funding table.
- All staff routes wrapped in `RequireRole(['owner','admin','employee','accountant'])`.
- SSN handled last-4-only; `ssn_encrypted` column was dropped in the prior Stage 0 pass; `FUNDING_CLIENT_SAFE_COLUMNS` prevents `select('*')` leakage.
- No service-role key in frontend code. `src/integrations/supabase/client.ts` uses the publishable key only.
- No fraud-evasion or bot-detection-bypass code anywhere in the repo.

**Findings:**
- **CRITICAL — `funding-documents` storage bucket is PUBLIC (`public=true`).** It is the destination for client financial documents via `DocumentVault.tsx`. Public buckets serve objects to anyone with the object path, bypassing RLS. Currently 0 documents, so **no live exposure yet** — this must be closed before any document is uploaded. `customer-documents` is also public and warrants the same review.
- **HIGH — `/funding-machine/portal` is registered outside the protected block** (`AppRoutes.tsx` line 1368) with no `RequireRole` wrapper. Its internal auth needs verification before client PII is served through it.
- **MEDIUM — 8 built pages reachable only by direct URL.** They are role-protected, so this is a discoverability defect rather than an access-control hole, but unrouted/unlisted pages escape QA.
- **MEDIUM — `encrypt-client-ssn` sends an SMS alert to an operator phone on intake** (Twilio, lines 93–103). Confirm no PII is included in the message body.
- **LOW — dual AI providers** means two separate key surfaces and two audit trails for client-data prompts.

Sensitive values were not read or printed at any point in this audit.

---

## 18. DATA INTEGRITY

- Foreign keys: 27 constraints, correctly modelled, no orphan risk detected at current volume.
- Duplicate clients: **no unique constraint on email/phone** — duplicates are possible and undetected.
- Duplicate lender models: 4 competing tables (Section 6).
- `funding_tasks` vs `funding_task_cards`: duplicate model, one unused.
- Invalid statuses: `funding_client_lender_matches.status = 'applied'` will be written by a function that never applies — **a status that structurally cannot be true.**
- Missing ownership: not an issue; every client-scoped table carries `client_id`.
- `funding_card_database` and `funding_application_profile` are read with no write path.

The data model **can** support a production pipeline after adding funding-outcome columns and collapsing the lender models. The current defects are additive, not structural.

---

## 19. EMPIRE HUD INTEGRATION

**DISCONNECTED / NOT FOUND.** No component, route, or file named or referencing `EmpireHUD`/`Empire HUD` exists in `src`. Outside the Funding Hub, only `crmBlueprints.ts` and the Grant OS pages reference `funding_clients`/`funding_applications`. There is no cockpit reading client count, pipeline, approvals, or capital secured from the Funding Hub. The integration described in the brief has no implementation.

---

## 20. GRANT OS CONSOLIDATION READINESS

Read-only assessment; nothing merged or modified.

**Already shared:** the same Supabase project, auth, and role system; `funding_clients` is read by Grant OS pages (`GrantsDashboard.tsx`, `GrantApplicationsPage.tsx`, `GrantApplicationDetail.tsx`); `client_grant_matches.awarded_amount` is already summed into the Funding Hub's "Capital Deployed" card — **a de-facto shared capital-secured model already exists.**

**Conflicting / duplicated:** separate application tables (`funding_applications` vs `grant_applications`), separate document models (`funding_client_documents` vs `grant-documents` bucket), separate task systems, separate AI functions (`funding-ai-agent` vs `strategic-grant-brain`), separate briefings.

**Required before consolidation:** a single `capital_events` table (source, lane, amount, date, client) that both systems write to; a unified document model on one private bucket; a shared task table; a shared audit log. **Risk:** consolidating before the Funding Hub's submission and funding-tracking gaps are closed would propagate false "applied"/"funded" states into Grant OS reporting. **Recommendation: do not consolidate until P0 items are closed.**

---

## 21. BUILD COMPLETION SCORE

Evidence-based: 25% schema exists · 25% write path · 25% read path/UI · 25% flow completes with real data.

| Area | % | Calculation |
|---|---|---|
| Client Intake | 90 | schema+write+read+real rows; −10 no duplicate detection |
| Fundability / DFS | 95 | full SQL algorithm, weights UI, recompute RPC, real scores; −5 no audit history |
| Credit Report Processing | 60 | parser+write+read real; −40 no source-doc persistence, no review gate |
| Credit Repair | 70 | items/rounds/letters real; −30 no FCRA clock, no round 2/3, no response ingestion |
| Certified Mail | 75 | integration complete and correct; −25 unconfigured, unproven |
| Business Foundation | 50 | checklist real; −50 no verification of any claim |
| Tradelines | 50 | schema+UI+write path; −50 zero data, no age/util tracking |
| Lender Database | 25 | schema excellent; −75 zero rows, importer unrouted |
| Lender Matching | 40 | real engine+persistence; −60 no input data, 3 parallel engines disconnected |
| Funding Lanes | 15 | column only; reference data in wrong tables |
| Application Generation | 30 | autofill only; no package artifact/PDF/storage/versioning |
| Application Submission | 15 | reminder+note only; false status write |
| Approval Tracking | 60 | fields+UI real; −40 manual, no lender FK |
| Funding Tracking | 35 | one manual number; no funded_amount/date columns |
| Automation / Edge Fns | 65 | 13 functions, 11 with real logic; −35 crons unverifiable, 3 disconnected |
| AI | 80 | genuinely wired across 6 workflows; −20 dual provider, no output validation |
| Billing | 0 | nothing found |
| Security | 75 | RLS/roles/PII strong; −25 public bucket, unguarded portal route |
| Empire HUD Integration | 0 | nothing found |

**OVERALL BUILD COMPLETION: 49%** (unweighted mean of 19 areas = 48.9%).

---

## 22. OPERATIONAL READINESS SCORE

"Could Dynasty process a real client today?"

| Area | % | Reason |
|---|---|---|
| Intake | 90 | Works now |
| Fundability | 95 | Works now on real data |
| Credit data | 55 | Works, but source docs not retained |
| Credit repair | 55 | Letters real; no deadline discipline |
| Mail | 0 | Cannot mail — no key |
| Business foundation | 40 | Unverified self-report |
| Tradelines | 20 | Empty |
| Lender matching | 5 | Zero lenders |
| Application | 25 | No package |
| Submission | 5 | Fake success |
| Approval | 50 | Manual only |
| Funding tracking | 25 | Manual number, no schema |
| Security | 70 | Strong, one blocking bucket issue |
| Billing | 0 | Cannot invoice a client |

**OPERATIONAL READINESS: 38%**

**Classification: FUNCTIONAL PROTOTYPE.**
It is more than a shell — intake, DFS, and credit-repair drafting operate on real client data end-to-end. It is far from partially operational as a *funding* engine, because the entire second half (lenders → submission → funding) cannot execute, and there is no way to bill a client.

---

## 23. CRITICAL FINDINGS

| ID | Severity | Area | Finding | Evidence | Impact | Recommended action |
|---|---|---|---|---|---|---|
| F-01 | CRITICAL | Submission | `submit-lender-application` performs no submission yet marks the match `applied` and returns success | `supabase/functions/submit-lender-application/index.ts:74–110` | Operators and clients told an application was filed when none was; false pipeline metrics | Rename to `prepare-lender-application`; set status `prequal_task_created`; return `submitted:false` |
| F-02 | CRITICAL | Security | `funding-documents` storage bucket is public | `storage.buckets.public = true` | Client financial documents would be publicly retrievable by path; 0 files today | Make private + signed URLs before any upload |
| F-03 | CRITICAL | Lenders | `funding_lender_database` has 0 rows and the importer route is not registered | table count 0; `LenderImportPage` absent from `AppRoutes.tsx` | Entire matching→funding half of the product is non-functional | Register `/funding-machine/lender-import`, then load the real lender registry (owner) |
| F-04 | HIGH | Mail | `POSTGRID_API_KEY` unset while 2 dispute rounds are marked `sent` | ping `configured:false`; `funding_dispute_rounds` 2 × `sent` | No provable FCRA mailing; disputes may be unactioned | Set key, or block status→`sent` without a `tracking_number` |
| F-05 | HIGH | Security | `/funding-machine/portal` registered outside the role-protected block | `AppRoutes.tsx:1368` | Potential unauthenticated access to client-facing PII surface | Verify in-page auth; move behind an explicit client guard |
| F-06 | HIGH | Funding tracking | `funding_applications` lacks `funded_amount`, `funding_date`, `lender_id` | schema dump | "Capital secured" cannot be derived; it is hand-typed | Add columns + FK; derive `funding_received` |
| F-07 | HIGH | Billing | No Stripe/billing of any kind in the Funding Hub | 0 matches for `stripe` | Cannot charge retainers or success fees | Build billing (owner decision on model first) |
| F-08 | HIGH | Integration | Empire HUD does not exist / reads nothing | 0 matches for `Empire HUD` | Executive reporting layer absent | Define the metric contract, then build the reader |
| F-09 | MEDIUM | Routing | 8 built pages reachable only by direct URL; `FundingQualificationCalculator` has no route | `Layout.tsx:541–557` vs `AppRoutes.tsx:2252–2281` | Built work invisible and untested | Add to sidebar or delete |
| F-10 | MEDIUM | Data model | 4 competing lender models (`funding_lender_database`, `lenders`, `auto_lenders`, `credit_unions`) | schema | Fragmented eligibility; 2 real engines never enter the pipeline | Unify on `funding_lender_database` with a `lane` discriminator |
| F-11 | MEDIUM | Automation | No Funding Hub cron job could be verified | `permission denied for schema cron` | No deadline/monitoring automation confirmed | Grant audit visibility; confirm or create schedules |
| F-12 | MEDIUM | Integrity | No uniqueness on client email/phone | schema | Duplicate clients, split credit histories | Add partial unique index + intake pre-check |
| F-13 | MEDIUM | Credit repair | No FCRA 30-day clock, no round 2/3 escalation, no bureau-response ingestion | no code found | Disputes stall silently | Build round state machine + deadline job |
| F-14 | MEDIUM | Documents | Credit report source files not persisted after parsing | `CreditReportUploadModal.tsx` | No evidence trail behind the score | Store to a private bucket, link to `funding_client_documents` |
| F-15 | LOW | Cleanliness | Orphan tables `funding_tasks`, `funding_mailbox_config`, `funding_daily_briefings_legacy`, `lenders`, `lender_applications` | 0 rows, no read/write | Schema confusion | Deprecate after confirmation |

**CRITICAL: 3 · HIGH: 5 · MEDIUM: 6 · LOW: 1**

**Positive control finding:** no fraud-control evasion, proxy rotation, CAPTCHA solving, or fingerprint spoofing exists anywhere in this codebase.

---

## 24. COMPLIANCE / LEGAL REVIEW REQUIRED

> **HIGH VISIBILITY — the following areas require review by qualified legal/compliance counsel before real client data or real client money is processed. No legal conclusion is offered here.**

- **CROA (Credit Repair Organizations Act):** the system generates and mails dispute letters on behalf of consumers for a fee. Written contracts, 3-day cancellation rights, and the prohibition on advance fees require review — this intersects directly with F-07 (billing model not yet built, so it can still be built compliantly).
- **FCRA:** dispute round handling, 30-day reinvestigation timelines, and the current practice of marking rounds `sent` without provable certified dispatch (F-04).
- **Consumer consent & authorization:** `funding_clients.consent_signed` exists as a boolean; the scope, storage, and retention of the underlying authorization document require review.
- **SSN and financial PII handling:** last-4 storage, the operator SMS alert on intake, retention period, and deletion policy.
- **Credit bureau data:** transmission of consumer report contents to third-party LLM providers (Anthropic, Lovable AI Gateway) for parsing and letter drafting — permissible purpose, data-processing terms, and subprocessor disclosure.
- **Third-party application submission authority:** the authority to prepare or file credit applications on a consumer's behalf, and lender Terms of Service regarding automated or agent-assisted submission (relevant before any Method A/B is built).
- **Success-fee arrangements** and state credit-services-organization registration/bonding.
- **E-signature and certification statements** on lender applications.
- **Data retention** for credit reports, dispute correspondence, and mail records.

---

## 25. FINAL END-TO-END TEST

```
CLIENT            → INTAKE ............................ PASS
INTAKE            → PROFILE ........................... PASS
PROFILE           → DFS ............................... PASS
DFS               → CREDIT DATA ....................... PASS  (parser writes items, score recomputes)
CREDIT DATA       → CREDIT REPAIR ..................... PASS  (letters use real items)
CREDIT REPAIR     → MAIL .............................. FAIL  (POSTGRID_API_KEY absent)
MAIL              → BUSINESS FOUNDATION ............... PARTIAL (checklist, unverified)
BUSINESS FOUND.   → TRADELINES ........................ PARTIAL (system real, zero data)
TRADELINES        → LENDER MATCH ...................... FAIL  ◀── FIRST HARD BREAK: 0 lenders
LENDER MATCH      → APPLICATION PACKAGE ............... PARTIAL (autofill only, no artifact)
APPLICATION PKG   → AUTHORIZED SUBMISSION ............. NOT IMPLEMENTED
SUBMISSION        → HUMAN VERIFICATION ................ NOT IMPLEMENTED
HUMAN VERIF.      → SUBMISSION ........................ NOT IMPLEMENTED (reminder only, false 'applied')
SUBMISSION        → LENDER RESPONSE ................... NOT IMPLEMENTED
LENDER RESPONSE   → APPROVAL .......................... PARTIAL (manual entry)
APPROVAL          → FUNDING ........................... PARTIAL (no funded_amount column)
FUNDING           → CAPITAL SECURED ................... PARTIAL (manual funding_received)
CAPITAL SECURED   → EMPIRE HUD ........................ NOT IMPLEMENTED
```

**First point where the real operational pipeline breaks: LENDER MATCHING — `funding_lender_database` is empty and the bulk importer is not routed in the live application.**

---

## 26. FINAL VERDICT

**WHAT IS ACTUALLY BUILT**
Client intake · secure last-4 SSN intake · client profiles with PII-safe column selection · the Dynasty Fundability Score (a real weighted SQL engine with configurable weights, missing-input honesty, and global recompute) · credit item management · AI dispute-letter generation from real client data · dispute round persistence · morning briefings (35 real rows) · task cards · a complete and correct PostGrid certified-mail client · a real Plaid client · a real credit-report parser · a real lender-matching algorithm with persistence · real auto-lender and credit-union scoring engines · RLS on all 39 funding tables with zero anon grants · role-guarded routes.

**WHAT IS PARTIALLY BUILT**
Credit report processing (no source retention) · credit repair (no FCRA clock, no round 2/3, no response ingestion) · business foundation (unverified checklist) · tradelines (real system, zero data) · application generation (autofill, no package artifact) · approval tracking (manual) · funding tracking (one hand-typed number).

**WHAT IS MOCKED**
`submit-lender-application` — it creates a reminder and a note, writes `status='applied'`, and reports success without contacting any lender. This is the single dishonest surface in the system.

**WHAT IS BROKEN**
Lender matching (empty registry) · certified mail (no key, yet rounds marked `sent`) · Plaid velocity (no keys) · the lender import route (declared in the module, missing from the live router).

**WHAT IS MISSING**
Billing of any kind · Empire HUD · funded_amount/funding_date schema · real submission (API or authorized automation) · lender response read-back · document/package generation · duplicate-client prevention · verified cron automation.

**CAN A REAL CLIENT CURRENTLY GO FROM INTAKE → FUNDING?**
**NO.** A client can be onboarded, scored, and have dispute letters drafted. They cannot be mailed, matched to a lender, submitted anywhere, tracked to funding, or invoiced.

**WHAT IS THE FIRST BLOCKER?**
`funding_lender_database` is empty **and** `/funding-machine/lender-import` is not registered in `AppRoutes.tsx` — so the tool built to fix it cannot be opened.

**WHAT MUST BE FIXED BEFORE REAL CLIENT DATA IS USED?**
F-02 (public `funding-documents` bucket) · F-01 (fake submission success) · F-05 (unguarded portal route) · F-04 (mail dispatch integrity).

**WHAT MUST BE REVIEWED BY LEGAL/COMPLIANCE?**
CROA fee structure and contracts, FCRA dispute handling, consumer consent scope, transmission of credit report data to LLM providers, and authority to prepare third-party credit applications. See Section 24.

This system has an honest, well-built front half and an unfinished back half wearing a success message. Fix the success message first, then load the lenders.

---
*Phase 1 complete. No modifications were made. FIX MODE not entered — awaiting explicit authorization.*
