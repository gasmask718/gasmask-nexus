# UBEN OS Tracker + Private Grant System OS — Master Audit #2

**Scope:** Read-only. Dynasty OS (Lovable e9aba3c3) + Supabase `qalaaroashbggynpvqct`.
**Covers:** (A) UBEN non-profit tracker; (B) private Grant System OS.
**Does NOT cover:** Public UBEN website.
**Method:** Live DB counts, edge function source, App route registrations, `Layout.tsx` sidebar config.

---

## HEADLINE

The prior "5% mock dashboard" state is **obsolete**. The Grant System OS is now backed by **10 real tables, 10 edge functions, 11 seeded opportunities, 11 seeded entity profiles, 110 pre-computed eligibility results, and both a real AI drafting path (Lovable Gateway → Claude) and a real AI eligibility scorer**. UBEN Tracker likewise has **11 real tables** with UI reading/writing them.

However, **operational readiness is still gated** by three things:
1. `next_deadline` is NULL on 10/11 grant opportunities (deadline reminders can't fire).
2. Grant document vault (`grant-documents` bucket + `grant_documents` table) contains only **2 seed rows** — real EIN/501c3/990/W-9 documents have not been uploaded.
3. No external grant-source API (SAM.gov / Grants.gov) is wired — the opportunity table is human-seeded only.

**Verdict:** No longer a mock. It is a **working internal engine with empty document vault and no external ingestion**. A grant round could be drafted today for an existing seeded opportunity, but discovery is manual and post-award reporting is not built.

---

## SECTION 1 — WHAT EXISTS TODAY

**UBEN Tracker (`/os/uben/*`)** — 10 pages, all reading/writing real `uben_*` tables via `supabase.from(...)` + React Query:
`UbenHQ, UbenGrantTracker, UbenApplications, UbenPrograms, UbenImpact, UbenDonors, UbenCompliance, UbenDocuments, UbenCommissions, AmbassadorNetworkTab`.

**Grant System OS (`/os/grants/*`)** — 8 pages, all backed by `grant_*` tables:
`GrantsDashboard, GrantOpportunities, GrantApplicationsPage, GrantApplicationDetail, BusinessProfiles, BusinessProfileDetail, EligibilityMatrix, ApplicationPackage` (+ `GrantFunderCRMPage` referenced by route).

Not placeholders. Wired reads/writes confirmed in source (e.g. `UbenHQ.tsx:45,56,67,78,89,100,111,122`, `UbenImpact.tsx:166,277`, `UbenGrantTracker.tsx:151`, `UbenDocuments.tsx:192`).

## SECTION 2 — REACHABLE IN THE OS

Both are registered in **`src/components/Layout.tsx`** (source of truth):
- `ubenHq` (id `uben-hq`) lines 554–566 — 9 sidebar entries.
- `grantOS` (id `grant-os`) lines 607–616 — 6 sidebar entries.
- Both included in the visible hub list at Layout.tsx:878.

Routes registered in `src/routes/AppRoutes.tsx` (lines 2207–2219 grants; 2258–2266 UBEN). No orphans among the sidebar entries.

## SECTION 3 — DATABASE (prior gap = ZERO tables)

**Grant System — 10 tables, all populated:**
| table | rows |
|---|---|
| grant_opportunities | 11 |
| grant_funders | 10 |
| grant_business_profiles | 11 |
| grant_applications | 5 |
| grant_application_packages | 1 |
| grant_documents | 11 |
| grant_eligibility_results | 110 |
| grant_requirements | 10 |
| grant_tasks | 8 |
| grant_funder_interactions | 0 |

`grant_business_profiles` has **100 columns** — including EIN, entity_type, and the profile fields required for eligibility matching (already used by `grant-eligibility-checker`). Field naming is `naics_code` (singular) per NAICS column, not `naics_codes`.

`grant_eligibility_results` has **110 rows = 11 opportunities × 10 profiles** (roughly), with `eligibility_score`, `ai_recommendation`, `ai_success_probability`, `requirements_met/missing/failed`. Confirmed the matrix is **precomputed and stored**, not fake-generated in the UI.

**UBEN — 17 tables:**
| table | rows |
|---|---|
| uben_programs | 1 (only "as / ad" placeholder) |
| uben_impact_log | 1 |
| uben_beneficiaries | 12 |
| uben_donations | 2 |
| uben_donors | 2 |
| uben_documents | **0** |
| uben_compliance_calendar | 14 |
| uben_grant_applications | 5 |
| uben_activity_log | 0 |
| uben_ambassador_sales / _ambassadors / _staff_recruiters / _partner_activity / _commission_ledger / _commission_config / _sync_config / _ambassador_applications | (present) |

**Prior "zero tables" claim is fully retired.** New gap: `uben_documents = 0` and `uben_programs = 1` junk row.

## SECTION 4 — UBEN TRACKER

- **Programs / Impact:** Real table, real UI read/write, but **1 program record and it is placeholder text ("as/ad")**. Impact log has 1 row. Mechanism = BUILT+REAL; **data = essentially empty**.
- **Beneficiaries:** 12 rows (real).
- **Compliance calendar:** 14 rows with `title / due_date / category / status`. UI reads and can mark completed (`UbenHQ.tsx:332`). Schema is minimal — no columns for jurisdiction, filing type (990 / state charity registration / disclosure), fiscal year, or attachment. **PARTIAL** — mechanism exists, taxonomy shallow.
- **Compliance/reporting for funders:** No post-award reporting table found (no `uben_grant_reports` or equivalent). **MISSING.**

## SECTION 5 — GRANT DISCOVERY + OPPORTUNITIES

- `grant_opportunities` — 11 rows, all human-seeded (Comcast RISE, Amber, FedEx, Hello Alice, NASE, NAACP Powershift, Verizon Digital Ready, IFundWomen, SBA Growth Accelerator, MBDA, SBA 2026). Real content, but **10 of 11 have NULL `next_deadline`** — only "SBA Small Business Growth Grant 2026" has a deadline (`2026-12-31`).
- **No SAM.gov / Grants.gov ingestion.** `grant-opportunity-intake` edge function exists (206 lines) and uses `LOVABLE_API_KEY` — inference: it's an **AI text-parser for opportunity blurbs** (paste a description → structured row), NOT an API pull. No cron, no scheduled sync.
- **Funder intelligence:** `grant_funders` — 10 real funders. `grant_funder_interactions = 0` rows. **PARTIAL** — funder catalog real, relationship history empty.

## SECTION 6 — ENTITY PROFILES + ELIGIBILITY

- 11 Dynasty entities in `grant_business_profiles`: iClean WeClean, Dynasty Connect, Grabba R Us, Hot Mama Grabba, Playboxxx, TopTier Experience, Unforgettable Times USA, Dynasty Recovery Group, GasMask Approved, Dynasty Credit Shield, QA Autosave Test 2069.
- 10 of 11 have EINs populated. Playboxxx missing EIN.
- 100-column profile (NAICS, ownership flags, revenue, certifications, entity_type) — real, not aspirational.
- **Eligibility matrix (`grant_eligibility_results`)**: 110 stored rows produced by `grant-eligibility-checker` (448 lines). Includes AI recommendation, action plan, success probability. **BUILT+REAL.**

## SECTION 7 — APPLICATION WORKFLOW + APPROVALS

- `grant_applications` = 5 real rows with `status, deadline, application_date, award_date, report_due, amount_requested, amount_awarded, ai_draft, contact_email`, plus `uben_source_id` (cross-linked to UBEN when applicable).
- `grant_application_packages` = 1 row → drives `/os/grants/apply/:packageId` (`ApplicationPackage.tsx`).
- `grant_tasks` = 8 rows (task pipeline exists).
- `submit-grant-application` (212 lines) and `grant-auto-apply` (314 lines) edge functions exist. Approval / David-approval gate is modeled via `grant_eligibility_results.david_approved_at`.
- **`report_due` column exists but no post-award reporting UI or function was found.** Pipeline draft→review→submit→track: **PARTIAL/REAL.** Post-award reporting: **MISSING.**

## SECTION 8 — AI GRANT-DRAFTING ENGINE

**BUILT+REAL.**
- `generate-grant-draft/index.ts` (200 lines) uses `LOVABLE_API_KEY` → Lovable AI Gateway, with `ANTHROPIC_API_KEY` fallback and a deterministic-heuristic fallback when neither is present.
- `strategic-grant-brain/index.ts` (158 lines) uses `ANTHROPIC_API_KEY` with `claude-sonnet-4-6` explicitly for strategy.
- `grant-eligibility-checker/index.ts` uses `claude-haiku-4-5` and gracefully degrades to heuristic scoring when the key is missing.
- Drafter pulls from `grant_business_profiles` + `grant_opportunities`, writes to `grant_applications.ai_draft`.
- **Weakness:** the drafter does not read `grant_documents` — so drafts do NOT ground themselves in the vault (once the vault has real files).

## SECTION 9 — PAGE / BUTTON / REAL vs MOCK

| Page | Data source | Status |
|---|---|---|
| `/os/grants/dashboard` | `grant_*` reads | REAL |
| `/os/grants/opportunities` | `grant_opportunities` | REAL (but deadlines null) |
| `/os/grants/applications` | `grant_applications` | REAL, 5 rows |
| `/os/grants/businesses` | `grant_business_profiles` | REAL, 11 entities |
| `/os/grants/eligibility` | `grant_eligibility_results` | REAL, 110 rows |
| `/os/grants/apply/:packageId` | `grant_application_packages` | REAL (1 package) |
| `/os/grants/funder-crm` | `grant_funders` / `grant_funder_interactions` | PARTIAL — funders yes, interactions 0 |
| `/os/uben` (UbenHQ) | 8 uben tables | REAL wiring; some tables empty |
| `/os/uben/programs` | `uben_programs` | REAL wiring, **1 placeholder row** |
| `/os/uben/impact` | `uben_impact_log` | REAL wiring, **1 row** |
| `/os/uben/donors` | `uben_donors/donations` | REAL, 2 rows each |
| `/os/uben/compliance` | `uben_compliance_calendar` | REAL, 14 rows |
| `/os/uben/documents` | `uben_documents` | Wiring REAL; **0 rows** |
| `/os/uben/grants` | `uben_grant_applications` | REAL, 5 rows |
| `/os/uben/commissions` | uben ambassador/commission tables | REAL wiring |

**No mock-as-real found** (prior audit's headline sin is gone). What looks empty **is** empty and is honestly rendered as such by the queries.

## SECTION 10 — INTEGRATIONS / WIRING / SECURITY

- **AI:** Lovable Gateway (`LOVABLE_API_KEY`) primary + `ANTHROPIC_API_KEY` — wired in `generate-grant-draft`, `grant-eligibility-checker`, `grant-opportunity-intake`, `strategic-grant-brain`. Secrets are read from `Deno.env` (not client). ✅
- **SAM.gov / Grants.gov:** **NOT wired.** No fetch calls to `sam.gov`, `grants.gov`, or `api.usaspending.gov` in any of the 10 grant functions.
- **Document storage:** buckets `grant-documents` (private) and `uben-docs` (private) exist. `grant_documents.storage_path` uses `seed/*.pdf` — placeholder seed. No uploads observed.
- **Email/deadline reminders:** `grant-deadline-reminder/index.ts` (85 lines) exists — **no** `resend`/`sendgrid`/email API references found; likely writes DB flags only. **PARTIAL.**
- **Cron:** `cron.job` not readable to app role; cannot confirm whether `grant-deadline-reminder` or `grant-auto-pipeline` are scheduled. **Inference: no scheduled ingestion job — none seen in prior cron audits.**
- **RoleGuard:** grant/UBEN routes in `AppRoutes.tsx` (2207–2219, 2258–2266) are **NOT** wrapped in `RoleGuard`. They rely on the global `RoleRouteGuard` in `src/components/security/RoleRouteGuard.tsx`, whose logic grants full access to `owner/admin/ceo` and denies non-elevated roles by redirect. Effective for isolation, but there is **no per-page permission gate** (e.g., accountant-only). Matches project standard, not a regression.

## SECTION 11 — TWO PERCENTAGES + SCORECARD

**Build completion:**
| Area | % |
|---|---|
| UBEN tracker (schema + UI wiring) | 75% |
| UBEN tracker (real data loaded) | 15% |
| Grant DB (schema + seed) | 85% |
| Grant discovery (external ingest) | 10% |
| Entity profiles | 90% |
| Eligibility matching | 85% |
| Application workflow (pre-award) | 70% |
| Post-award reporting | 5% |
| AI drafting engine | 80% |
| Document vault | 20% (buckets exist, no real files, not fed to drafter) |
| Deadline/reminder | 25% |
| **OVERALL** | **~55%** |

**Operational readiness — could you run search → draft → submit → track today?**
- **Search:** Manual only. Discovery is 11 seeded opps. → **partial**.
- **Match:** Yes — 110 precomputed matches exist. ✅
- **Draft:** Yes — `generate-grant-draft` produces a draft grounded in profile + opportunity. ✅
- **Submit:** Model exists (`submit-grant-application`), but 10/11 opportunities have no application URL / deadline populated, and vault docs are seed placeholders. → **partial**.
- **Track:** Statuses + `report_due` field exist. Reminder path incomplete.

**Verdict: PARTIAL — internal engine, not a mock. Real end-to-end grant round is possible only when (a) a real deadline+URL exists on the target opportunity and (b) real EIN/501c3/990 documents are uploaded to `grant-documents` bucket.**

## SECTION 12 — PRIORITIZED TASK LIST TO 100%

### CRITICAL (dev)
1. **Backfill `grant_opportunities.next_deadline` + `application_url`** on the 10 opportunities missing them — without this, `grant-deadline-reminder` is silent and Submit is a dead end.
2. **Wire `grant-deadline-reminder` to an email transport** (Resend) and to `cron.job` (daily). Currently 85 LOC with no send call visible.
3. **Feed `grant_documents` into `generate-grant-draft`** — drafter should attach or reference vault docs; today it reads only profile + opportunity.
4. **Post-award reporting model** — add `grant_award_reports` (or reuse `grant_tasks` typed = `report`) + a form. `report_due` exists but has no UI to fulfill it. Missing federal reports = future grants die.

### CRITICAL (owner action — not dev)
5. **SAM.gov registration** — flagged prior audit; 10–14 day activation. Still required before any federal opportunity can be submitted.
6. **Upload real vault documents** (EIN letters, 501(c)(3) determination for UBEN, most recent 990, board roster, W-9, financials) into the `grant-documents` and `uben-docs` buckets, then insert `grant_documents` rows. **Blocks item 3.**
7. **Populate real `uben_programs`** (currently 1 placeholder row "as/ad") and populate `uben_impact_log` with the actual program history. Without this, UBEN is not funder-credible.
8. **Apply to Comcast RISE, Verizon Digital Ready, Amber Grant** — opportunities exist, entities profiled; owner action to actually submit once vault + deadlines land.

### HIGH (dev)
9. **Integrate Grants.gov v2 API** for federal opportunity ingest (public API, no auth for search). Removes dependency on manual paste-in via `grant-opportunity-intake`.
10. **Integrate SAM.gov Entity Management API** (needs SAM.gov API key after item 5) to auto-sync entity active-status.
11. **Post-award funder reporting per opportunity** (Section 13 addendum).
12. **`grant_funder_interactions` UI** — table has 0 rows, no CRM screen for logging calls/emails to funders.
13. Fix `uben_programs` schema — `name/description` are placeholder-tolerant; add `program_code`, `funding_source`, `budget_annual`.

### MEDIUM
14. Retire the "QA Autosave Test 2069" row from `grant_business_profiles`.
15. Missing EIN on `Playboxxx` profile.
16. Wrap grant/UBEN routes in an explicit `RoleGuard allowedRoles={['owner','admin','accountant']}` to lock non-elevated staff out of finance-sensitive UI even if RoleRouteGuard is bypassed later.

---

# ADDENDUM — COMPLIANCE, VAULT, DEADLINES, MATCHING, MULTI-ENTITY

## SECTION 13 — Compliance & Impact Reporting

- **Impact tracking:** BUILT+REAL mechanism (`uben_impact_log`, `UbenImpact.tsx:277` writes real rows). **DATA = 1 row.** Program-participant math in `UbenImpact.tsx:166` sums `uben_programs.participant_count` — accurate but currently reflects only the 1 placeholder program.
- **Post-award grant reporting (funder reporting after money lands):** **MISSING.** `grant_applications.report_due` exists as a date field, but no `grant_award_reports` table, no report-authoring UI, no submission flow. This is the highest-severity gap for renewability.
- **UBEN's own compliance state (990 status, state charity reg, disclosures):** **PARTIAL.** `uben_compliance_calendar` has 14 rows but only `title/due_date/category/status/notes` — no jurisdiction, no filing type enum, no attachment reference to the actual filed form. Enough to see "something is due"; not enough to prove it was filed.

## SECTION 14 — Grant Document Vault

- Buckets **exist and are private**: `grant-documents`, `uben-docs`.
- Table `grant_documents` has 11 rows — **2 confirmed as seed placeholders** (`storage_path='seed/sba-*.pdf'`); no evidence real EIN/501c3/990/W-9 files have been uploaded.
- `uben_documents` table has **0 rows**.
- Vault is **NOT wired to `generate-grant-draft`** — drafter reads profile + opportunity, not docs.
- Status: **PARTIAL** (infrastructure present, content and wiring absent).

## SECTION 15 — Deadline & Task Management

- `grant_opportunities.next_deadline`: 1 of 11 populated. `grant_applications.deadline` + `report_due`: present.
- `grant_tasks` table has 8 rows.
- Edge function `grant-deadline-reminder` exists (85 LOC) but shows **no email/notification API calls**. Whether it is on cron is unknowable from the app role (`permission denied for schema cron`). Prior cron audits did not show it scheduled.
- Status: **MISSING (effective).** Deadlines are stored but nothing is watching them.

## SECTION 16 — Eligibility Matching Engine

- **BUILT+REAL.** `grant-eligibility-checker/index.ts` (448 lines) runs opportunity × profile scoring with AI narrative + heuristic fallback. Persists to `grant_eligibility_results` (110 rows, ~1 per opportunity per profile).
- `EligibilityMatrix.tsx` reads this table and surfaces "which grants fit which entity right now."
- **Gap:** No visible re-scoring cron — matrix is stale until manually re-triggered.

## SECTION 17 — Multi-Entity Structure

- **BUILT+REAL (multi-entity).** `grant_business_profiles` holds 11 distinct Dynasty entities. `grant_eligibility_results` keys on `business_profile_id`. `grant_applications` keys applications to `funding_client_id` (per-entity). Per-entity views in `BusinessProfileDetail.tsx`.
- No co-mingling observed. Adding a 12th entity is a row insert, not a schema change.

## SECTION 18 — Addendum Summary + Task List

| Area | Status |
|---|---|
| Impact tracking (mechanism) | BUILT+REAL |
| Impact tracking (data loaded) | EMPTY |
| Post-award funder reporting | **MISSING** |
| UBEN own-compliance detail | PARTIAL |
| Document vault infra | PARTIAL |
| Vault → drafter wiring | MISSING |
| Deadline detection | PARTIAL |
| Deadline alerting | MISSING |
| Eligibility matching | BUILT+REAL |
| Matching freshness (cron) | MISSING |
| Multi-entity handling | BUILT+REAL |

### Addendum task priorities

**CRITICAL (dev)** — overlaps main list items 1, 2, 3, 4:
- A1. Build `grant_award_reports` table + reporting flow (blocks renewability).
- A2. Extend `uben_compliance_calendar` with jurisdiction, filing_type enum (`990`, `990-N`, `990-EZ`, `state_charity_reg`, `disclosure`), and `filed_document_id` FK to `uben_documents`.
- A3. Wire deadline reminder function to Resend + daily cron.
- A4. Feed vault into drafter (Section 14).
- A5. Nightly re-run of `grant-eligibility-checker` for active opportunities (matrix freshness).

**CRITICAL (owner)** — same as main list items 5, 6, 7:
- SAM.gov registration.
- Upload real EIN, 501(c)(3) determination, latest 990, W-9, financials.
- Populate real UBEN programs + historical impact data.

**HIGH (dev):**
- A6. Grants.gov v2 opportunity API poller (removes manual paste-in).
- A7. Funder interactions CRM (currently 0 rows).

**MEDIUM (dev):**
- A8. Purge `QA Autosave Test 2069` from `grant_business_profiles`.
- A9. Explicit per-page `RoleGuard` wrapper for grant/UBEN routes.

---

**End of audit. No files changed. Evidence: live DB counts, `Layout.tsx`, `AppRoutes.tsx`, 10 grant edge functions + `uben-sync-donation`, and 15 UBEN/grant page components.**
