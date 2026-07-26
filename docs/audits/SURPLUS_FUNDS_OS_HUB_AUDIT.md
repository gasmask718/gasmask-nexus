# SURPLUS FUNDS OS HUB — MASTER AUDIT #1

**Scope:** `/surplus-funds/*` hub only. Excludes Dynasty Connect calling engine and public dynastyrecovery.com site (separate audits).
**Method:** Read-only against real code (`src/pages/surplus-funds/`, `supabase/functions/sf-*`, `re-skip-trace`), live DB (Supabase `qalaaroashbggynpvqct`), sidebar (`Layout.tsx`), routes (`AppRoutes.tsx`). Anything "not found" is called out; inferences are labeled.

---

## SECTION 1 — WHAT THE HUB DOES TODAY

Plain-language walk of the pipeline against reality:

| Stage | Designed | Reality |
|---|---|---|
| County-clerk discovery | Weekly cron scraper | ❌ **No scraper, no cron.** Leads land via manual CSV/XLSX upload in `SFDiscovery` or via the `sf-lead-import` edge function (called by the Discovery "Import Leads" button, not a scheduler). The 3,788 rows tagged `scraper_fl_*`, `scraper_oh_*`, `scraper_tx_*`, `scraper_ga_*` are **manually-labeled bulk uploads**, not live scrapes. |
| Store as leads | `surplus_funds_leads` | ✅ Real. 3,788 rows, 21 lead-source tags across FL/OH/TX/GA/NY counties. Oldest 2026-07-02, newest 2026-07-24 — this is a **~3-week manual seeding sprint**, not an ongoing feed. |
| Skip-trace | BatchSkipTracing | ⚠️ Wire exists but **surplus is not on it**. `re-skip-trace` is hardcoded to `re_leads` (real estate). No `sf-skip-trace` function. Result: **9 / 3,788 rows (0.24%) have a phone**, 3,769 rows stuck at `status='skip_trace_pending'`. |
| Queue to Dynasty Connect | AI calling campaign | ⚠️ `sf-trigger-bland-campaign` exists and has a real SF outreach prompt, but only **8 leads have ever been triggered** (`bland_call_triggered=true`) and only **1 got a Bland call ID**. |
| Live transfer / interested | Human takes over | ⚠️ `SFHumanQueue.tsx` reads `surplus_funds_leads` and can update. Real page, but **1 lead flagged `interested`** total. |
| Contingency signed | DocuSign e-sign | ⚠️ `sf-send-contract` is real DocuSign JWT code, gated on 4 secrets. **`surplus_funds_contracts = 0 rows`** — has never fired. |
| Case created | `surplus_funds_cases` | ❌ **0 rows.** No case has ever been opened. |
| Attorney handoff | Assignment | ❌ **0 rows** in `surplus_funds_attorney_assignments`. |
| Funds recovered | IOLTA disbursement | ❌ **0 rows** in `surplus_funds_payments`. |

**Verdict:** The hub is a **console wired to a real backend, over an empty pipeline.** Every stage past raw lead import is dead-end at zero.

---

## SECTION 2 — SIDEBAR / REACHABILITY

`src/components/Layout.tsx` (lines 779–790): `surplusFundsOs` group registered, listed in dashboard grid (line 878) and in Dynasty rollup (1194). 8 sidebar entries:

- `/surplus-funds` — Command Center
- `/surplus-funds/leads` — Floor 1 Lead Intelligence
- `/surplus-funds/campaigns` — Floor 2 Dynasty Connect
- `/surplus-funds/cases` — Floor 3 Case Management
- `/surplus-funds/attorneys` — Floor 4 Attorney Network
- `/surplus-funds/documents` — Floor 5 Documents
- `/surplus-funds/automation` — Floor 6 AI & Automation
- `/surplus-funds/analytics` — Floor 7 Analytics

**Orphans (real pages, NOT in sidebar):** `SFDiscovery` (`/surplus-funds/discovery`), `SFContracts` (`/surplus-funds/contracts`), `SFHumanQueue` (`/surplus-funds/human-queue`). All three are registered in `AppRoutes.tsx` and in the SF-local sidebar (`SFLayout.tsx`) — so reachable once inside the hub, but invisible from the OS-level sidebar. **Note:** `Layout.tsx` is the memory-declared source of truth; these three are effectively hidden to a first-time operator on the main sidebar.

Guard: `AppRoutes.tsx:3726` wraps `/surplus-funds` in `RequireRole allowedRoles={['owner','admin','va','employee','staff']} showLocked` — **role-guarded** ✅.

---

## SECTION 3 — DATABASE

All 7 tables **exist with RLS enabled**:

| Table | Rows | Purpose | Real vs mock |
|---|---:|---|---|
| `surplus_funds_leads` | **3,788** | Raw leads + skip-trace state + Bland call tracking | Real bulk-uploaded, mostly unenriched |
| `surplus_funds_cases` | **0** | Signed cases (client, court #, surplus, attorney, filing dates, funds released) | Empty — schema is real and complete |
| `surplus_funds_contracts` | **0** | DocuSign / HelloSign contract envelope tracking | Empty |
| `surplus_funds_attorneys` | **1** | Attorney directory (bar #, states, fee split, IOLTA confirmed) | **1 row named `test`, firm `test`, FL, 35% split, `application_status=application_received`** — that is the entire network. |
| `surplus_funds_attorney_assignments` | **0** | Case ↔ attorney with fee % | Empty |
| `surplus_funds_payments` | **0** | Recovery amount, our fee, attorney fee, claimant net, disbursement dates | Empty |
| `surplus_funds_inquiries` | **0** | Public contact form | Empty |

**Missing tables (designed but never built):** `counties` / `sf_counties` (config registry), `sf_skip_trace_results` (audit log of API responses), `sf_documents` (case-packet files — the `documents` column on `cases` is a JSON dump, not a proper table), `sf_contingency_agreements` (`contracts` doubles for this).

Field completeness on `surplus_funds_leads` is **excellent** (48 columns covering property, skip-trace, Bland call, transcript, AI summary, consent, UTM, DNC). This is not a stub.

---

## SECTION 4 — LEAD DISCOVERY (county-clerk scraping)

**Designed:** weekly cron scraper across county clerk sites, surplus > $5,000, filed <90 days.

**Reality:**
- **No scraper edge function exists.** `ls supabase/functions/ | grep -iE 'surplus|county|scraper'` returns only `re-skip-trace` and `sf-*` — none of them fetch external county pages.
- **No cron scheduled** for `sf-lead-import` (function is exposed but only invoked from `SFDiscovery`'s "Import Leads" button and by the public inbound endpoints `dynasty-recovery-claimant-intake` / `sf-lead-import` POST).
- Leads with `lead_source LIKE 'scraper_%'` are **manually-tagged CSV uploads**, not live scrapes. Naming convention (`scraper_fl_lee_taxdeed_manual`, `scraper_tx_nueces_excess_manual`) even admits `_manual` on some.
- **Filters:** `surplus_amount > 5000` returns 2,148 of 3,788 (57%) — the $5k floor is **NOT enforced on insert**; 1,627 rows sit under it (or NULL). Recency filter: not enforced anywhere; `foreclosure_date` isn't validated.
- **County registry:** hardcoded string tags. No `counties` config table. Adding a county = coining a new source tag by hand.

**Verdict:** Discovery is **manual upload dressed up to look automated**. Real county scraping is unbuilt.

---

## SECTION 5 — SKIP TRACING

- **Function `re-skip-trace`** is real, calls `https://api.batchskiptracing.com/api/v1/skip-trace` in batches of 25 with `BATCH_SKIP_TRACE_API_KEY` — **but it queries `re_leads`, not `surplus_funds_leads`**. This is the Real Estate skip-tracer, not surplus.
- **No `sf-skip-trace` function exists.**
- Result in data: `skip_traced=true` on **12 rows** (0.3%); 9 have phones. 3,769 rows sit forever at `status='skip_trace_pending'`.
- **9 phones on 3,788 leads is the single biggest blocker to the entire pipeline.**

**Verdict:** Skip-tracing for surplus is **not wired**. The infrastructure exists on a sibling module; it just needs a `sf-skip-trace` (or a table swap in `re-skip-trace`).

---

## SECTION 6 — LEAD SCORING / PRIORITIZATION

- Columns exist: `interest_level`, `interest_score`, `ai_summary`, `recommended_action`, `call_outcome`.
- **These are all populated post-call by `sf-post-call-analysis`**, not on ingest. No pre-call score for "surplus size × recency × contactability".
- `SFLeadPipeline.tsx` (883 LOC — the largest page) ranks by table columns; no scoring RPC or view found.

**Verdict:** No pre-call prioritization. Scoring only happens *after* a call, on 8 rows total.

---

## SECTION 7 — CASE MANAGEMENT PIPELINE

- **Lifecycle columns are all present** on `surplus_funds_cases` (`agreement_signed_at`, `filed_at`, `hearing_date`, `approved_at`, `funds_released_at`, `amount_received`). Schema is production-grade.
- **Zero cases** ever created. `SFCases.tsx` (141 LOC) renders an empty table.
- **Contingency + e-sign:** `sf-send-contract` is real DocuSign JWT integration keyed on `DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_TEMPLATE_SF_CLAIM_ID`. **Unable to verify without secrets access whether those keys are populated** — but 0 rows in `surplus_funds_contracts` implies it has never successfully executed. HelloSign column present but no `sf-hellosign-*` function.
- **Case packet generation** (the packet an attorney needs — pleading, agreement, ID, proof of interest, court case #): **not built.** The `documents` JSON column exists but no generator function, no storage bucket write, no template.

**Verdict:** Lifecycle *schema* is real. Lifecycle *execution* is 0/0/0/0/0.

---

## SECTION 8 — ATTORNEY NETWORK + HANDOFF

- `surplus_funds_attorneys`: **1 row**, `name='test'`, `firm='test'`, states `{FL}`, split 35%, `application_status='application_received'`. This is a smoke-test row, not a network.
- `dynasty-recovery-attorney-intake` edge function exists (160 LOC) — accepts applications from the public recruitment page. Feeds this table.
- `SFAttorneys.tsx` (98 LOC) reads/lists them.
- `sf-assign-attorney` function exists (100 LOC): writes to `surplus_funds_attorney_assignments`. **Never executed** (0 rows).
- Fee-split modeling: `attorney_fee_percentage` on assignments, `our_percentage` on cases, `our_fee_amount` / `attorney_fee_amount` / `claimant_net_amount` on payments. **Schema is correct** (three-way split modeled). Just unused.

**Verdict:** Handoff logic exists as code + tables; **the network to hand off to does not exist** (n=1 test row).

---

## SECTION 9 — RECOVERY / FEE TRACKING

- `surplus_funds_payments`: correctly modeled as **tracking-only** (`disbursement_date`, `our_fee_received_date`, `payment_method` — no card processor fields). ✅ IOLTA-through-attorney conceptual model is preserved.
- `sf-payment-handler` (140 LOC) exists to log inbound reconciliations.
- **0 payment rows.** Never used.

**Verdict:** Correctly designed for the "attorney holds funds, Dynasty just tracks its cut" reality. Unused.

---

## SECTION 10 — PAGE INVENTORY

| Page | LOC | Real vs stub | Notes |
|---|---:|---|---|
| `SFCommandCenter` | 203 | Real reads | Reads from real tables; numbers will be honest (mostly 0). |
| `SFLeadPipeline` | 883 | Real | Largest page. Table over 3,788 leads. |
| `SFDiscovery` | 183 | Real (import) / **mock** (search) | "Search Public Records" button is a **dead UI** — no handler; only CSV/XLSX upload + `sf-lead-import` invoke actually work. |
| `SFCampaigns` | 118 | Real | Reads `dc_campaign_*`; shows "No campaigns yet" (accurate — 0 SF campaigns). |
| `SFCases` | 141 | Real | Empty table. |
| `SFAttorneys` | 98 | Real | Shows the 1 test row. |
| `SFDocuments` | 236 | Real | Renders docs from `cases.documents` JSON. Empty. |
| `SFContracts` | 114 | Real | Reads `surplus_funds_contracts`. Empty. |
| `SFAutomation` | 344 | Config UI | Unclear if actions actually fire cron; **flag: verify triggers wire to real jobs**. |
| `SFAnalytics` | 123 | Real | Charts over empty pipeline — will show ~0 everywhere. |
| `SFHumanQueue` | 277 | Real | Reads leads, allows disposition update. Works — but 1 `interested` lead. |

**Mock-as-real risks:** "Search Public Records" button on `SFDiscovery` (no wire), the "scraper_*" `lead_source` tags (implies automation that doesn't exist), and analytics zero-values that read as "healthy pipeline" instead of "empty pipeline".

---

## SECTION 11 — CONNECTION TO DYNASTY CONNECT

- `sf-trigger-bland-campaign` is real (332 LOC). Ships an SF-specific outreach prompt referencing "Dynasty Recovery Group" and county/amount variables. Writes `bland_call_triggered`, `bland_call_id`, `dc_campaign_id` back onto `surplus_funds_leads`.
- Return path: `dc-bland-webhook` and `sf-post-call-analysis` reference `surplus_funds_leads` (grep confirmed) — hub side of the wire is closed.
- Actual usage: **8 leads ever triggered, 1 got an ID.** Wire works; nobody's pulling the trigger, and it can't fire without phones (see §5).

**Verdict:** Wire is real; **starved of phones upstream**.

---

## SECTION 12 — COMPLIANCE (⚠️ CALLOUT)

Surplus recovery is state-regulated. Real gaps:

- **No state rule table.** `sf_state_rules` / fee caps / waiting-period columns: **not found.** Every state uses whatever `our_percentage` is entered on the case — no enforcement.
- **DocuSign template `DOCUSIGN_TEMPLATE_SF_CLAIM_ID`** is a single template across states. Doesn't switch by state. Uniform disclosures where states demand different ones.
- **"Dynasty is recovery firm, not attorney"** distinction: prompt in `sf-trigger-bland-campaign` says *"Dynasty Recovery Group... specializes in recovering these funds"* — acceptable, does not claim to be counsel. But the contract template and public site are separate audits, so **cannot certify** the generated PDF preserves the distinction.
- **CROA-equivalent surplus-recovery statutes** (e.g., TX Occ. Code §1156, FL §717 property registration, NY §1136 tax-lien surplus, GA §48-4-5): no code path acknowledges any of them.
- **Licensing:** several states (FL, NY, GA) require the recovery firm itself to register / hold a license. Not tracked anywhere.

**Compliance status: unbuilt.** Recommend legal review *before* any real case runs.

---

## SECTION 13 — SECURITY / ACCESS

- **Route guard:** `AppRoutes.tsx:3726` — `RequireRole` on the whole `/surplus-funds` subtree. ✅
- **RLS:** all 7 tables have `rowsecurity=t`. Policies are `authenticated`-scoped for cases/attorneys/leads (team select/insert/update, admin delete). ✅
- **Service-role bypass:** `contracts`, `payments`, `attorney_assignments`, `inquiries` grant `Service role full access` — correct pattern for edge functions.
- **PII surface:** `surplus_funds_leads` holds `first_name`, `last_name`, `phone`, `email`, `property_address`, `call_transcript`, `ai_summary`, `ip_address`. All under RLS; no client-side service-role key found on grep. ✅
- **DNC:** `dnc` boolean column present, 4 rows flagged. Wire to `sf-trigger-bland-campaign` **should** honor it — **not verified** in this pass.

**Overall security posture: reasonable.** Two follow-ups: (1) confirm Bland trigger honors `dnc=true`, (2) confirm claimant `call_transcript` isn't exposed to non-admin roles.

---

## SECTION 14 — SCORECARD

| Area | Build % | Notes |
|---|---:|---|
| Discovery / scraper | **10%** | Manual upload only. No cron, no scraper, no county registry, no $5k enforce. |
| Skip-trace | **15%** | Sibling function exists; not pointed at surplus. |
| Lead scoring | **10%** | Post-call only; no pre-call prioritization. |
| Case pipeline | **60%** (schema) / **0%** (execution) | Tables + edge fns exist; 0 rows through. |
| Contingency e-sign | **40%** | DocuSign wired; unverified secrets; 0 envelopes. |
| Attorney network + handoff | **30%** | Code exists; network = 1 test row. |
| Fee / recovery tracking | **50%** | Correctly modeled IOLTA-out; unused. |
| Compliance / state rules | **0%** | Not encoded anywhere. |
| Security / RLS | **80%** | Guards + policies in place; DNC honor unverified. |
| Sidebar / UX shell | **75%** | 3 real pages orphaned from OS sidebar. |

**Overall build completion: ~35%.**
**Operational readiness: ~10%.** Could not run a real lead discovery → signed → attorney handoff today. Blockers, in order: no scraper, no skip-trace, no funded attorney network, no compliance rules, unverified DocuSign secrets.

**One-line verdict: real console + real schema over a mostly-empty, manually-fed pipeline. It's a shell of an engine, not a running engine.**

---

## SECTION 15 — PRIORITIZED TASK LIST TO 100%

### 🚨 COMPLIANCE CALLOUT (owner + counsel — do BEFORE any live case)
- **C1.** Engage counsel to enumerate per-state surplus-recovery rules (fee caps, disclosures, waiting periods, licensing) for target states (FL/OH/TX/GA/NY). **BLOCKER.**
- **C2.** Confirm Dynasty is licensed / registered as a recovery firm in each active state.
- **C3.** Legal review of the DocuSign SF claim template — one template per state, not one master.
- **C4.** Confirm public + call scripts preserve the "recovery firm, not attorney" distinction in writing.

### CRITICAL (dev, blocks pipeline)
1. **Wire skip-trace for surplus.** Fork `re-skip-trace` → `sf-skip-trace` targeting `surplus_funds_leads`. Drain the 3,769 `skip_trace_pending` backlog. *(depends: `BATCH_SKIP_TRACE_API_KEY` already set — confirm.)*
2. **Fund an attorney network.** Ship the attorney recruitment path end-to-end; owner action to replace the 1 `test` row with real attorneys per active state.
3. **Verify DocuSign secrets** (`DOCUSIGN_INTEGRATION_KEY`, `DOCUSIGN_SECRET_KEY`, `DOCUSIGN_ACCOUNT_ID`, `DOCUSIGN_TEMPLATE_SF_CLAIM_ID`). Owner action: obtain + `add_secret`.
4. **Enforce ingest filters** in `sf-lead-import`: reject `surplus_amount < 5000`, reject `foreclosure_date` older than 90 days (config-driven).

### HIGH (dev)
5. **Build real scraper cron.** One edge function per county source (start with the top 5 by row-count: FL Lee, FL Marion, OH Montgomery, TX Nueces, FL Brevard). Weekly cron via `pg_cron`. Register in a new `sf_counties` config table.
6. **Pre-call lead scoring view/RPC.** Formula: `surplus_amount × recency × has_phone × has_email`. Sort `SFLeadPipeline` by score.
7. **`sf_state_rules` table** + validation trigger enforcing max fee % per state on `surplus_funds_cases.our_percentage`.
8. **Case-packet generator** (edge fn): assembles pleading, contingency PDF, court case #, ID scan into a storage bundle for the assigned attorney.
9. **Sidebar parity.** Add `/surplus-funds/discovery`, `/surplus-funds/contracts`, `/surplus-funds/human-queue` to `Layout.tsx` surplusFundsOs group.
10. **Confirm DNC honor** in `sf-trigger-bland-campaign`; add explicit `dnc=true` guard + test row.

### MEDIUM
11. Kill the dead "Search Public Records" button on `SFDiscovery` (or wire it to a real search endpoint).
12. Add `sf_skip_trace_results` audit table so we can see API responses, cost, and per-lead attempt history.
13. Split `cases.documents` JSON into a real `sf_documents` table.
14. Post-award reporting surface: quarterly per-attorney recovery report.

### LOW
15. Enable HelloSign as fallback (schema already ready; no function).
16. `SFAutomation` — verify each toggle actually maps to a real automation, not a config UI stub.
17. Analytics on `SFAnalytics` — add explicit "empty pipeline" states so 0 doesn't read as healthy.

### OWNER ACTIONS (not code)
- **O1.** Choose initial scraper county targets (dev needs the list).
- **O2.** Recruit 3–5 attorneys per active state; get IOLTA + bar # + fee split.
- **O3.** Provide DocuSign integration secrets.
- **O4.** State-by-state legal opinion on §12 compliance items.
- **O5.** Decide fee caps per state (input for §7).

---

**End of audit. Path:** `docs/audits/SURPLUS_FUNDS_OS_HUB_AUDIT.md`
