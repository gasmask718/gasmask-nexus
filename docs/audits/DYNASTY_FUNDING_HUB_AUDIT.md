# Dynasty Funding Hub — Master Audit
Read-only. Project: Lovable e9aba3c3 / Supabase qalaaroashbggynpvqct. Grounded in real code, DB rows, and edge functions as of this session. Sister audit: `UBEN_GRANT_SYSTEM_OS_AUDIT.md` (grant lane lives there).

---

## Section 1 — What the hub actually does today

Open `/funding-machine` (`FundingMachineDashboard.tsx`, 703 LOC). It is a real 10-floor console, not a mock:

- **Intake works** (`ClientIntakePage`, `SecureClientIntakePage`) → writes `funding_clients`. **2 real client rows.**
- **Credit repair works partially** — `CreditRepairPage.tsx` calls edge fn `funding-ai-agent` (real Claude/Lovable-AI call) to generate FCRA/FDCPA letters, writes `funding_dispute_rounds` (2 rows) and `funding_mailing_log` (2 rows).
- **Certified mail** — `funding-postgrid` edge fn is real (calls `api.postgrid.com/print-mail/v1/letters`) but returns `NO_API_KEY` because `POSTGRID_API_KEY` is not in vault → no letter has ever physically shipped.
- **Fundability scoring (DFS)** — `funding_dfs_scores` has 2 rows but both clients show `current_dfs_score = 0`. Scoring is manual/placeholder — no edge fn computes it.
- **Lender matching** — `lender-matching-engine` edge fn is real but reads `funding_lender_database` which is **empty (0 rows)**. Auto lane (`match-auto-lenders` → `auto_lenders`) has **17 real lenders**. Credit-union lane (`score-client-for-credit-unions` → `credit_unions`) has **25 lenders / 76 products**.
- **Application submission** — `submit-lender-application` edge fn is real but does not submit anywhere; it creates a `client_reminders` row and marks the match `applied`. No lender API is called.
- **Approval tracking** — `funding_applications` table exists (1 row, manually entered).

**Dead-ends:** DFS auto-scoring, real lender-DB seeding, actual submission, PostGrid key, Stripe billing, cron automation.

---

## Section 2 — Sidebar / reachability

Layout.tsx lines 538–551 register 14 floors under "🏦 Funding Machine" — **all linked**. AppRoutes.tsx lines 2222–2258 register **~30 routes** (14 real pages + 8 `FundingModuleStub` placeholders: `/credit-stacking`, `/sba`, `/cdfi`, `/playbook`, `/pg-rotation`, `/entities`, `/analytics`, `/compliance`).

Orphan: `/os/funding` was removed; redirects to `/funding-machine`.

---

## Section 3 — Database (49 tables scanned)

| Area | Table | Rows | Real |
|---|---|---|---|
| Clients | funding_clients | 2 | ✅ real intake |
| Profile | funding_application_profile | 0 | wired, empty |
| Documents | funding_client_documents | 0 | wired, empty |
| Scoring | funding_dfs_scores | 2 | ⚠️ scores are 0 |
| Credit items | funding_credit_items | 62 | ✅ real |
| Bureau tracking | bureau_response_tracking | 0 | empty |
| Disputes | funding_dispute_rounds | 2 | ✅ real |
| Mail log | funding_mailing_log | 2 | ✅ real, but no tracking ID (PostGrid off) |
| Postgrid config | funding_mailbox_config | 0 | empty |
| Infrastructure | funding_infrastructure_checklist | 14 | ✅ real (LLC/EIN/etc) |
| Tradelines | funding_tradeline_accounts | 0 | empty |
| Tradeline vault | funding_tradeline_vault_cards / _transactions | 0 / 0 | empty |
| Lender DB (master) | funding_lender_database | **0** | ❌ **empty — matching engine has nothing to match** |
| Lender matches | funding_client_lender_matches | 0 | empty |
| Auto lenders | auto_lenders | 17 | ✅ real |
| Credit unions | credit_unions / credit_union_products | 25 / 76 | ✅ real |
| Card DB | funding_card_database | 0 | empty |
| Shelf corps | shelf_corp_tracker / shelf_corp_vendors | 0 / 7 | ⚠️ vendor list only |
| Applications | funding_applications | 1 | ✅ real (1 manual) |
| Tasks | funding_task_cards / funding_tasks | 3 / 0 | partial |
| Automation | funding_autofill_runs | 0 | empty |
| Briefings | funding_morning_briefings | 20 | ✅ real |
| Plaid | funding_plaid_connections / _transactions | 0 / 0 | wired, no key |
| Banking | funding_banking_velocity | 0 | empty |
| ChexSystems | chexsystems_upload_documents | 0 | empty |
| Collections | collection_* (5 tables) | 0 | empty |
| Bills | funding_bills / funding_payment_cards | 0 / 0 | Bill Guardian shell |
| Settings | funding_machine_settings | **0** | ❌ **no keys stored — PostGrid off** |

---

## Section 4 — Intake + DFS scoring

- **Intake:** Real. `ClientIntakePage` (276 LOC) + `SecureClientIntakePage` (226 LOC) both write `funding_clients`. Full field set: SSN-last-4, DOB, EIN, business_type, TIB, revenue, funding_goal. 2 real rows.
- **Credit report upload/parse:** Real. `funding-report-parser` edge fn (85 LOC) sends PDF base64 to Claude Sonnet 4.6 with a strict JSON schema for negative items, inquiries, open accounts, bureau score. Returns for **operator confirmation** (does not auto-insert). This produced the **62 real `funding_credit_items` rows.**
- **DFS algorithm:** ❌ **Not real.** `funding_dfs_scores` has the full 15-column schema (personal credit TU/EQ/EX, tradeline_density, utilization_ratio, entity_quality, funding_ceiling, etc.) but **no edge function computes it**. Both live clients have `current_dfs_score = 0`. Scoring is manual/absent.

---

## Section 5 — Credit repair engine

- **Letter generation:** ✅ Real. `funding-ai-agent` (369 LOC) uses `LOVABLE_API_KEY`, has `analyze_credit_items` (attack-plan JSON) and `generate_letter` actions covering 8 letter types (fcra_609, fcra_611, fcra_623, fdcpa_809, goodwill, mov, pay_for_delete, identity_theft) with legal citations. Not templated — LLM-drafted from the real client row.
- **Round tracking:** ✅ Real. `funding_dispute_rounds` (2 rows) linked to `funding_credit_items` via `credit_item_id`. Round-N increments on regeneration.
- **Certified mail:** ⚠️ Wired, not shipping. `funding-postgrid` (90 LOC) is production-shaped (bureau addresses hardcoded correctly for Equifax/Experian/TransUnion) but bails with `NO_API_KEY`. `funding_mailing_log` has 2 rows with `tracking_number = NULL`.
- **Bureau response tracking:** `bureau_response_tracking` schema exists (0 rows). `bureau-deadline-checker` edge fn (114 LOC) exists — likely a scheduled job, but no cron visible from public schema.
- **"Bill Guardian":** UI-only shell (`BillGuardianPage.tsx`, 337 LOC). `funding_bills` empty. Not wired to Plaid.

---

## Section 6 — Business foundation + tradelines

- **Infrastructure checklist:** ✅ Real. `funding_infrastructure_checklist` has 14 seeded step rows (LLC, EIN, dedicated address, bank account, etc.), read by `BusinessBuilderPage.tsx` (391 LOC).
- **Tradeline builder:** ❌ Reference-only. `shelf_corp_vendors` has 7 seeded NET-30 vendors; `funding_tradeline_accounts` is empty. No reporting-status polling. `TradelineVaultPage` (423 LOC) is a UI over an empty table.
- **Shelf corps:** `ShelfCorpPage` reads `shelf_corp_tracker` (0 rows). Fully manual.

---

## Section 7 — Lender matching (the core)

**This is the biggest gap.**

| Lane | Table | Rows | Matching fn | Verdict |
|---|---|---|---|---|
| Master lender DB | funding_lender_database | **0** | lender-matching-engine (real, 205 LOC) | ❌ **engine has nothing to match** |
| Auto | auto_lenders | 17 | match-auto-lenders (62 LOC) | ✅ real |
| Credit unions | credit_unions / credit_union_products | 25 / 76 | score-client-for-credit-unions (120 LOC) | ✅ real |
| Card stacks | funding_card_database | 0 | none | ❌ absent |
| SBA / CDFI / fintech / PG rotation | — | — | — | `FundingModuleStub` placeholders |

`lender-matching-engine` implements real eligibility filters (`min_credit_score`, `min_revenue`, `min_time_in_business_months`) and writes `funding_client_lender_matches` — the code is honest, the **data is missing**. `FundingMatrixPage.tsx` (270 LOC) renders whatever is there → empty grid today.

Funding lanes as advertised (~11–12): only **2 of ~12** are actually populated (auto, credit unions). The rest are documented (`FundingModuleStub` pages) but not represented as data.

---

## Section 8 — Application generation + submission + tracking

- **Package builder:** ❌ Not built. No edge fn assembles a per-lender submission package from `funding_application_profile` + docs.
- **Submission:** ⚠️ Symbolic. `submit-lender-application` (127 LOC) creates a `client_reminders` row telling the operator to complete the prequal at `lender.prequal_url` and flips the match to `applied`. **No actual lender API is called.** For hard-pull lenders it returns "Manual application required."
- **Approval tracking:** ✅ Real. `funding_applications` schema tracks requested/approved amount, status, decision_date, APR, monthly_payment, term_months, denial_reason. 1 manually entered row.

---

## Section 9 — Automation / AI

- **Morning briefing:** ✅ Real. `funding-morning-briefing` (164 LOC) → `funding_morning_briefings` has **20 real briefings**. Rendered by `MorningBriefingPage`.
- **Bureau deadline checker:** Code exists (`bureau-deadline-checker`, 114 LOC) — presumably meant for cron, but the `cron` schema is not publicly readable here so scheduling status cannot be confirmed.
- **Plaid:** `funding-plaid` (167 LOC) is real but `funding_plaid_connections` is empty — no client has connected a bank account.
- **AI drafter:** ✅ Real (`funding-ai-agent`, Claude/Lovable AI).
- **AI matching:** ⚠️ Deterministic rules only. `lender-matching-engine` scores on hard-coded eligibility thresholds — no LLM.
- **Credit-analysis brain:** `credit-analysis-brain` (176 LOC) exists, not called from any visible page path (unverified caller).

---

## Section 10 — Billing

❌ **Not wired.** No Stripe reference in `RevenueDashboardPage.tsx` (400 LOC) — it reads `funding_clients.funding_received` and totals it as "revenue." That is *funding secured for clients*, not *fees collected*. No `funding_invoices`, no `funding_billing_events`, no Stripe customer id on `funding_clients`. Retainer + success fee model is undocumented in the DB.

---

## Section 11 — Every page / real vs mock

24 files, 9,147 LOC.

| Page | LOC | Reads real | Writes real | Verdict |
|---|---|---|---|---|
| FundingMachineDashboard | 703 | ✅ | — | real KPIs from `funding_clients` + `funding_applications` |
| ClientIntakePage | 276 | — | ✅ | real |
| SecureClientIntakePage | 226 | — | ✅ | real |
| ClientsListPage | 153 | ✅ | — | real |
| ClientProfilePage | 1597 | ✅ (many tables incl. `funding_client_lender_matches`) | ✅ | real |
| CreditRepairPage | 591 | ✅ | ✅ (dispute rounds, mailing log, AI letters) | real |
| DeletionLetterEnginePage | 385 | ✅ | ✅ | real |
| BureauIntelPage | 250 | ✅ | ✅ | real, empty data |
| BusinessBuilderPage | 391 | ✅ | ✅ | real |
| TradelineVaultPage | 423 | ✅ | ✅ | wired, empty table |
| FundingMatrixPage | 270 | ✅ | — | wired, empty lender DB |
| CreditUnionIntelPage | 457 | ✅ | ✅ | real (76 products) |
| AutoFinancingPage | 286 | ✅ | ✅ | real (17 lenders) |
| ShelfCorpPage | 232 | ✅ | ✅ | 7 vendors, no trackers |
| ApplicationsPage | 256 | ✅ | ✅ | real (1 row) |
| VelocityCalculatorPage | 479 | — | — | ⚠️ **client-side calculator only — no DB persistence** |
| FundingQualificationCalculator | 260 | — | — | ⚠️ **calculator only** |
| BillGuardianPage | 337 | ✅ | — | shell, empty |
| MorningBriefingPage | 330 | ✅ | — | real (20 rows) |
| TaskCardsPage | 303 | ✅ | ✅ | real (3 tasks) |
| RevenueDashboardPage | 400 | ✅ | — | ⚠️ **labels "funding secured" as revenue — misleading** |
| FundingMachineSettingsPage | 161 | ✅ | ✅ (funding_machine_settings) | wired, 0 rows saved |
| ClientPortalPage | 343 | ✅ | — | real |
| FundingModuleStub | 38 × 8 routes | — | — | **placeholder** (Credit Stacking, SBA, CDFI, Playbook, PG Rotation, Entities, Analytics, Compliance) |

**Mock-as-real flags:**
1. RevenueDashboard "$X funding secured" = client-side aggregation, not verified against lender approval documents.
2. DFS score `0` on both live clients — dashboard cards may display "0" as if it were a computed value.
3. FundingMatrix renders "0 matches" as if the algorithm ran — the DB is simply empty.

---

## Section 12 — Security / access

- **RoleGuard:** ❌ **Zero.** grep of `AppRoutes.tsx` for `RequireRole|RoleGuard` on any `/funding-machine/*` route returns nothing. Any signed-in user can reach SSN-holding intake, credit reports, and dispute letters.
- **PII in DB:** `funding_clients` stores `ssn_last4`, `date_of_birth`, address. `funding_application_profile` schema (53 cols) is designed for the fuller PII package. **`ssn_last4` is only last-4 — full SSN is not stored** (good).
- **RLS:** Not spot-checked here — must be re-audited before any client is on-boarded. Given the operator-only intent, tables should be `admin`/`accountant`-scoped, not client-self-read.
- **Secrets in client code:** none observed. `LOVABLE_API_KEY`, `POSTGRID_API_KEY`, `ANTHROPIC_API_KEY` are edge-only.
- **PostGrid key missing** — good hygiene (nothing shipped), bad ops (feature dark).

---

## Section 13 — Consolidation readiness (Funding + Grants → "Dynasty Capital")

- **Client model:** `funding_clients` and `grant_business_profiles` are **unbridged**. No shared `capital_client` table, no FK between the two.
- **"Capital secured" tracking:** `funding_applications.approved_amount` and `grant_applications.awarded_amount` live in two different subsystems with no unified view.
- **Verdict:** Siloed. Consolidation would require (a) a `capital_clients` parent table with FKs from both, (b) a `capital_ledger` view unioning grant awards + lender approvals, (c) shared document vault.

---

## Section 14 — Empire HUD connection

`src/lib/empireApi.ts` calls `get-os-metrics` edge fn — not visible whether it reads `funding_clients` / `funding_applications`. Local `FundingMachineDashboard.tsx` aggregates its own KPIs. **Not verified** whether HUD reads the same numbers. Inference: because DFS scores are 0 and lender DB is empty, HUD cannot show meaningful Funding metrics regardless.

---

## Section 15 — Scorecard

| Area | Build % | Notes |
|---|---|---|
| Intake / client model | **85%** | works, PII handling reasonable |
| DFS scoring | **20%** | schema + UI, no compute |
| Credit repair (letters + rounds) | **75%** | best-built area, real AI + tracking |
| Certified mail | **60%** | code done, key missing |
| Business foundation | **65%** | checklist real |
| Tradelines | **20%** | vendor list only, no tracking |
| Lender matching — master DB | **10%** | engine ready, 0 lenders seeded |
| Lender matching — auto/CU lanes | **80%** | real |
| Lender matching — other 10 lanes | **5%** | stubs |
| Application generation | **15%** | none built |
| Submission | **20%** | symbolic reminder, no API |
| Approval tracking | **60%** | schema real, 1 row |
| Automation / cron | **35%** | briefings real, deadline-checker unconfirmed |
| Billing (client fees) | **0%** | no Stripe wiring |
| Security (RoleGuard) | **10%** | routes wide open |
| **Overall build** | **~40%** | |

**Operational readiness: ~20%.**
End-to-end run today (intake → DFS → repair → match → submit → funded) is **not possible**. You can do intake + credit-report parse + AI letter generation + business-foundation tracking. You cannot: score DFS automatically, mail letters (no key), match against a full lender DB (empty), submit an application (no submission API), or bill the client.

**Verdict: partial working engine.** Not shell/reference-only — it's a real credit-repair console with authentic AI letter generation and a well-designed schema — but the funding half (lender DB, matching, submission, billing) is largely unbuilt.

---

## Section 16 — Prioritized task list to 100%

### CRITICAL — Compliance & security (blockers before any live client)
1. **CROA compliance** — Credit Repair Organizations Act requires: written contract with 3-day right of cancellation, no advance fees, specific disclosure ("Consumer Credit File Rights…"). None visible in codebase. **Owner decision + legal review before onboarding paying credit-repair clients.**
2. **Add `RequireRole` guard to every `/funding-machine/*` route** (`admin`, `employee`, `accountant`). Dev-action, 1 hour.
3. **RLS re-audit** on all 49 `funding_*` + related tables, especially `funding_clients`, `funding_credit_items`, `funding_application_profile`. Dev-action.
4. **PostGrid key** — add `POSTGRID_API_KEY` to vault; verify test letter to Equifax. Owner-action.

### CRITICAL — Data foundations
5. **Seed `funding_lender_database`** with the ~11 documented lanes. Without this, `lender-matching-engine` returns 0 matches for every client. Owner-action (data sourcing) + dev-action (import script).
6. **Implement DFS auto-scoring edge fn** reading `funding_credit_items`, `funding_infrastructure_checklist`, `funding_banking_velocity`. Write to `funding_dfs_scores` on client update. Dev-action.

### HIGH — Fee collection & real submission
7. **Stripe billing** — `funding_billing_events` table, Stripe customer per `funding_clients`, retainer + success-fee products. Owner-action (pricing) + dev-action.
8. **Application-package generator** — assemble PDF from `funding_application_profile` + selected `funding_client_documents` per `funding_client_lender_matches` row. Dev-action.
9. **Lender submission** — start with lenders that have a real API (SBA connectors, fintechs like Kabbage/OnDeck/Bluevine). Where no API, generate email-ready package + track via `funding_applications`. Dev-action.

### HIGH — Automation
10. **Confirm/create crons** for `bureau-deadline-checker`, `funding-morning-briefing`, DFS re-scoring, tradeline reporting polls. Owner-action.
11. **Tradeline reporting monitor** — call Nav / DNB / Experian Business APIs to detect tradeline reporting. Owner-action (accounts) + dev-action.

### MEDIUM — Fill placeholder floors
12. Build real pages for the 8 `FundingModuleStub` routes (`credit-stacking`, `sba`, `cdfi`, `playbook`, `pg-rotation`, `entities`, `analytics`, `compliance`). Dev-action.
13. **Revenue Dashboard rename/fix** — distinguish "Client funding secured" from "Dynasty fee revenue"; wire Stripe-derived revenue. Dev-action.

### MEDIUM — Consolidation with Grant System OS
14. Introduce `capital_clients` parent table + FKs from `funding_clients` and `grant_business_profiles`.
15. Build unified `capital_ledger` view.

### LOW — Polish
16. Empire HUD wiring verification against real funding KPIs.
17. Bill Guardian → Plaid transactional wiring.
18. ChexSystems recovery engine (schema exists, no code).

---

### Compliance callout (own callout, per brief)
**Credit repair is federally regulated (CROA) and state-regulated (varies by state, some require bonding).** This hub currently drafts and mails FCRA/FDCPA dispute letters — that is regulated activity. Before any paying credit-repair client: (a) CROA-compliant contract with cancellation notice, (b) no advance fees for credit-repair services, (c) state licensure/bonding check per client state, (d) PII handling agreement, (e) written policy on how bureau reports are stored and purged. This is **owner + legal**, not a dev ticket.

Also: `funding_application_profile` (53 cols) is designed to hold expanded PII beyond `ssn_last4`. Confirm what actually ends up there — if full SSN, DL numbers, or bank account numbers are stored, add column-level encryption (`pgsodium`) or move to a vault schema.
