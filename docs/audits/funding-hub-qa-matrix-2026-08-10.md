# DYNASTY FUNDING HUB — QA MATRIX
**Date:** 2026-08-10 · Companion to `funding-hub-master-audit-2026-08-10.md`
**Method:** static trace of handler → API/DB operation → persistence. Runtime execution was not performed (read-only phase), so "Actual result" is derived from code and database state, and rows depending on live execution are marked NOT TESTABLE.

---

## PART A — PAGE / BUTTON INVENTORY

Status key: WORKING · PARTIAL · DEAD · MOCK · BROKEN · DISCONNECTED · NOT TESTABLE

### `/funding-machine` — FundingMachineDashboard.tsx
| Element | Handler → operation | Status | Note |
|---|---|---|---|
| Stat: Active Clients | query `funding_clients` | WORKING | real count (2) |
| Stat: Avg DFS Score | mean of `current_dfs_score` | WORKING | real (41, 37) |
| Stat: Pending Tasks | `funding_task_cards` | WORKING | real (3) |
| Stat: Total Pipeline | sum `target_funding_amount` | WORKING | real, currently null-heavy |
| Widget: Capital Deployed | `funding_clients.funding_received` + `client_grant_matches.awarded_amount` | PARTIAL | real query, manually-entered input |
| Widget: Morning Briefing / Reminders / Pipeline / Score Wins / Velocity | live queries | WORKING | |
| "New Client" button | navigate `/funding-machine/intake` | WORKING | |
| 8 module tiles | navigate | WORKING | |

### `/funding-machine/intake` — ClientIntakePage.tsx
| Element | Operation | Status |
|---|---|---|
| Multi-step form submit | insert `funding_clients` | WORKING |
| DFS seed | insert `funding_dfs_scores` (L95) | WORKING |
| Infrastructure checklist seed | insert `funding_infrastructure_checklist` | WORKING |
| Duplicate check | **none found** | DEAD (missing control) |

### `/funding-machine/secure-intake` — SecureClientIntakePage.tsx *(orphan route)*
| Element | Operation | Status |
|---|---|---|
| Submit | invoke `encrypt-client-ssn` (L47) → service-role write + Twilio SMS | WORKING |
| Sidebar entry | — | DEAD (not listed) |

### `/funding-machine/credit-repair` — CreditRepairPage.tsx
| Element | Operation | Status |
|---|---|---|
| Add credit item | insert `funding_credit_items` (L107) | WORKING |
| Generate dispute letter | invoke `funding-ai-agent` (L133/156) with real client+items | WORKING |
| Create dispute round | insert `funding_dispute_rounds` (L182) | WORKING |
| Log mailing | insert `funding_mailing_log` (L195) | PARTIAL |
| Send via PostGrid | invoke `funding-postgrid` | BROKEN — key absent |
| Mark round sent | status update | **MOCK RISK** — can set `sent` with no tracking number |

### `/funding-machine/bureau-intel` — BureauIntelPage.tsx
| Element | Operation | Status |
|---|---|---|
| DFS breakdown panel | `DfsBreakdownCard` reads `funding_dfs_scores` | WORKING |
| Card database list | reads `funding_card_database` (0 rows, **no write path**) | DISCONNECTED |

### `/funding-machine/business-builder` — BusinessBuilderPage.tsx
| Element | Operation | Status |
|---|---|---|
| Client select | `funding_clients` | WORKING |
| Foundation checklist | `funding_infrastructure_checklist` (14 rows) | WORKING |
| Tradeline tier list | `funding_tradeline_accounts` (0) | DISCONNECTED |
| AI build plan (L93/116) | `funding-ai-agent` | WORKING |
| EIN / DUNS / LLC verification | **none** | DEAD (missing control) |

### `/funding-machine/funding-matrix` — FundingMatrixPage.tsx
| Element | Operation | Status |
|---|---|---|
| Client + DFS load (L108/119) | real queries | WORKING |
| Run lender matching | `lender-matching-engine` → `funding_lender_database` (**0 rows**) | BROKEN |
| Match list | `funding_client_lender_matches` (0) | BROKEN |
| Submit application | `submit-lender-application` | **MOCK — fake success** |
| AI narrative (L136) | `funding-ai-agent` | WORKING |

### `/funding-machine/applications` — ApplicationsPage.tsx
| Element | Operation | Status |
|---|---|---|
| List | `funding_applications` (1 row) | WORKING |
| Create (L42) | insert | WORKING |
| Update status/approved amount (L61) | update | WORKING |
| AI remediation plan (L74/84) | `funding-ai-agent` → persists `remediation_plan` | WORKING |
| Record funded amount / date | **no such columns** | DEAD (schema gap) |

### `/funding-machine/tradeline-vault` — TradelineVaultPage.tsx
| Element | Operation | Status |
|---|---|---|
| Add vault card (L112) | insert | WORKING (0 rows exist) |
| Assign AU slot (L179/192) | insert txn + increment `occupied_slots` | WORKING |
| Complete txn (L198) | update | WORKING |
| AI matching (L150) | `funding-ai-agent` | WORKING |
| Overall | DISCONNECTED — zero data, never used |

### `/funding-machine/velocity` — VelocityCalculatorPage.tsx
| Element | Operation | Status |
|---|---|---|
| Connect bank (L129/149) | `funding-plaid` | BLOCKED — `PLAID_CLIENT_ID`/`PLAID_SECRET` absent |
| Save velocity plan (L246) | upsert `funding_banking_velocity` | WORKING |
| AI plan (L262) | `funding-ai-agent` | WORKING |

### `/funding-machine/tasks` — TaskCardsPage.tsx
| Element | Operation | Status |
|---|---|---|
| List / complete / reopen (L88/102/109) | real CRUD | WORKING |
| AI task generation (L125/138) | `funding-ai-agent` → insert | WORKING |

### `/funding-machine/settings` — FundingMachineSettingsPage.tsx
| Element | Operation | Status |
|---|---|---|
| PostGrid status badge | live `ping` to edge function | WORKING (reports `Not configured` — truthful) |
| Re-check button | refetch | WORKING |
| DFS weights editor + Save & recompute | update `funding_dfs_weights` → `recompute_all_funding_dfs()` | WORKING |
| Operator phone / email save | upsert `funding_machine_settings` | WORKING (0 rows stored) |
| Portal URL field | read-only display | WORKING |

### `/funding-machine/revenue` — RevenueDashboardPage.tsx
| Element | Operation | Status |
|---|---|---|
| All content | **no `supabase.` calls in file** | NOT TESTABLE / likely static |

### `/funding-machine/bill-guardian` *(orphan)* — BillGuardianPage.tsx
| Add bill (L57) / add card (L82) / mark paid (L103) | real inserts + update | WORKING but 0 rows, DISCONNECTED from pipeline |

### `/funding-machine/deletion-letters` *(orphan)* — DeletionLetterEnginePage.tsx
| Add recipient (L94) / generate (L109) / mark sent (L124) / upload doc (L134) | real CRUD + `generate-deletion-letter` | WORKING but DISCONNECTED (0 rows) |
| Mark sent | sets `letter_status='sent'` with no dispatch proof | MOCK RISK |

### `/funding-machine/credit-union-intel` *(orphan)* — CreditUnionIntelPage.tsx
| Load CUs/products (L61/62) | 25 / 76 real rows | WORKING |
| Score client (L99) | `score-client-for-credit-unions` | WORKING but results never reach `funding_client_lender_matches` — DISCONNECTED |

### `/funding-machine/auto-financing` *(orphan)* — AutoFinancingPage.tsx
| Match (L66) | `match-auto-lenders` over 17 real `auto_lenders` | WORKING but DISCONNECTED from main pipeline |

### `/funding-machine/shelf-corp` *(orphan)* — ShelfCorpPage.tsx
| Vendors (L79) / tracker (L88) | 7 / 0 rows, cast `as any` (untyped) | PARTIAL |

### Unrouted / stubs
| Item | Status |
|---|---|
| `FundingQualificationCalculator.tsx` (260 lines) | DEAD — no route anywhere |
| `LenderImportPage.tsx` | DEAD IN LIVE APP — declared in `src/modules/fundingmachine/index.ts`, absent from `AppRoutes.tsx` |
| `/credit-stacking`, `/sba`, `/cdfi`, `/playbook` | STUB (`FundingModuleStub`) |

### Fake success states — explicit flag list
1. `submit-lender-application` → returns success, sets match `status='applied'`, nothing submitted. **CRITICAL.**
2. Dispute round → `sent` with no `tracking_number` and PostGrid unconfigured. **HIGH.**
3. Deletion letter → `letter_status='sent'` with no dispatch proof. **MEDIUM.**

---

## PART B — TEST PLAN

### Functional QA
| ID | Preconditions | Steps | Expected | Actual (static) | Status | Sev | Code/Table |
|---|---|---|---|---|---|---|---|
| FQ-01 | Staff role | Complete intake form | Client row created | Insert present, 2 real rows | PASS | — | ClientIntakePage / funding_clients |
| FQ-02 | Existing client email | Submit intake with same email | Duplicate rejected | No uniqueness or pre-check | **FAIL** | MED | funding_clients |
| FQ-03 | Client exists | Upload credit report | Items inserted, score updated | Insert L64/79, score write L93 | PASS | — | funding-report-parser |
| FQ-03b | Same | Locate original file after parse | Source retrievable | Not persisted | **FAIL** | MED | CreditReportUploadModal |
| FQ-04 | Items exist | Read DFS | Score from real items | 41 / 37 computed | PASS | — | compute_funding_dfs |
| FQ-05 | Settings | Change weight, save | All clients recomputed | `recompute_all_funding_dfs()` invoked | PASS | — | DfsWeightsCard |
| FQ-06 | Weights ≠ 100 | Attempt save | Blocked | Save disabled unless total = 100 | PASS | — | DfsWeightsCard |
| FQ-07 | Client + items | Generate dispute letter | Letter contains client's real items | Real payload to funding-ai-agent | PASS | — | CreditRepairPage L133 |
| FQ-08 | Round created | Send certified mail | Letter dispatched, tracking stored | Key absent → refuses | **BLOCKED** | HIGH | funding-postgrid |
| FQ-09 | Key absent | Mark round `sent` anyway | Should be prevented | Permitted; 2 rows already `sent` | **FAIL** | HIGH | funding_dispute_rounds |
| FQ-10 | Client | Run lender matching | Ranked eligible lenders | 0 lenders → 0 matches | **FAIL** | CRIT | funding_lender_database |
| FQ-11 | Staff | Open `/funding-machine/lender-import` | Importer loads | Route not registered | **FAIL** | CRIT | AppRoutes.tsx |
| FQ-12 | Match exists | Click Submit Application | Application filed with lender | Reminder + note only; status→`applied`; success returned | **FAIL (fake success)** | CRIT | submit-lender-application |
| FQ-13 | Application | Record funded amount | Persisted | No `funded_amount` column | **FAIL** | HIGH | funding_applications |
| FQ-14 | Funded client | Capital Deployed reflects it | Derived from applications | Sums manual `funding_received` | PARTIAL | HIGH | RevenueSnapshot |
| FQ-15 | Client | Add tradeline / AU slot | Persisted | Writes exist | PASS (untested, 0 data) | LOW | TradelineVaultPage |
| FQ-16 | Client | Connect bank via Plaid | Link token returned | Plaid keys absent | **BLOCKED** | MED | funding-plaid |
| FQ-17 | Client | Generate application package | PDF/artifact stored | No generation, no storage | **FAIL** | HIGH | auto-fill-application |
| FQ-18 | Client | Invoice/charge the client | Payment recorded | No billing code exists | **FAIL** | HIGH | — |
| FQ-19 | Client | Business foundation verified (EIN/LLC) | Verified flag from source | Self-report only | **FAIL** | MED | funding_infrastructure_checklist |
| FQ-20 | Dispute round age > 30d | Escalation prompt | Round 2 triggered | No clock, no round logic | **FAIL** | MED | — |

### Security QA
| ID | Steps | Expected | Actual | Status | Sev |
|---|---|---|---|---|---|
| SQ-01 | Anon query any `funding_*` table | Denied | No anon grants on any funding table | PASS | — |
| SQ-02 | Verify RLS enabled on funding tables | All enabled | 39/39 enabled, all ≥1 policy | PASS | — |
| SQ-03 | Non-staff role opens `/funding-machine/*` | Blocked | `RequireRole` on all staff routes | PASS | — |
| SQ-04 | Fetch object from `funding-documents` bucket by path, unauthenticated | Denied | Bucket `public=true` → would serve | **FAIL** | CRIT |
| SQ-05 | Same for `customer-documents` | Denied | `public=true` | **FAIL** | HIGH |
| SQ-06 | Open `/funding-machine/portal` signed out | Blocked or client-auth gate | Registered outside protected block (L1368) | **FAIL** | HIGH |
| SQ-07 | Search frontend for service-role key | None | None found; publishable key only | PASS | — |
| SQ-08 | Client A reads Client B's credit items | Denied | RLS present; **runtime cross-tenant test not executed** | NOT TESTABLE | HIGH |
| SQ-09 | Search for full SSN storage | Last-4 only | `ssn_encrypted` dropped; safe column list enforced | PASS | — |
| SQ-10 | Scan for fraud-evasion tooling | None | 0 matches (browserbase/skyvern/stagehand/puppeteer/captcha/proxy/fingerprint/stealth) | PASS | — |
| SQ-11 | Check operator SMS body for PII | No PII | `encrypt-client-ssn` L93–103 not fully reviewed for body content | NOT VERIFIED | MED |

### Integration QA
| ID | Target | Expected | Actual | Status |
|---|---|---|---|---|
| IQ-01 | Supabase client | Publishable key, RLS enforced | Confirmed | PASS |
| IQ-02 | `funding-postgrid` ping | `configured:true` | `configured:false — POSTGRID_API_KEY is not set` | BLOCKED |
| IQ-03 | Plaid | Link token | Keys absent | BLOCKED |
| IQ-04 | Anthropic-backed functions | 200 + structured output | Key present; **live call not executed** | NOT TESTABLE |
| IQ-05 | Lovable AI Gateway (`funding-ai-agent`) | 200 | Key present; live call not executed | NOT TESTABLE |
| IQ-06 | Stripe / billing | Charge recorded | No integration | FAIL |
| IQ-07 | Any lender API | Application accepted | None implemented | FAIL |
| IQ-08 | Empire HUD reads funding metrics | Metrics displayed | No consumer exists | FAIL |
| IQ-09 | Cron schedules for funding | Jobs active | `permission denied for schema cron` | NOT TESTABLE |

### Regression QA (run after any remediation)
| ID | Check |
|---|---|
| RQ-01 | All 20+ `/funding-machine/*` routes still resolve under `RequireRole` |
| RQ-02 | Both existing `funding_clients` rows intact with DFS 41 / 37 |
| RQ-03 | 62 `funding_credit_items` and 2 `funding_dispute_rounds` preserved |
| RQ-04 | `compute_funding_dfs` and `recompute_all_funding_dfs` unchanged in output for existing clients |
| RQ-05 | Dashboard stat cards still return live values, not errors |
| RQ-06 | 27 FK constraints still present |
| RQ-07 | RLS still enabled on all 39 tables; still zero anon grants |
| RQ-08 | Auth/login and role routing unaffected |
| RQ-09 | Grant OS pages reading `funding_clients` still function |
| RQ-10 | 35 `funding_morning_briefings` rows still readable |
