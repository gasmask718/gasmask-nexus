# UBEN OS HUB — Master Operator-Console Audit

**Scope:** UBEN HQ + Grant System operator surface inside Dynasty OS (Lovable `e9aba3c3`, Supabase `qalaaroashbggynpvqct`).
**Mode:** Read-only, grounded in real code + prior DB counts. Complements (does not repeat) `UBEN_GRANT_SYSTEM_OS_AUDIT.md`.
**Date:** 2026-07-25

---

## SECTION 1 — WHAT THE HUB IS TODAY

Entry route: **`/os/uben`** → `src/pages/os/uben/UbenHQ.tsx` (1,202 LOC). It is a **tabbed operator console**, not a mock dashboard: an admin lands on a single dark-luxury dashboard (gold/black theme) with KPI cards (programs, participants served, ambassadors, upcoming deadlines) driven by real `supabase.from('uben_*')` queries, plus internal tab-style panels for Impact, Ambassadors, Partners, Compliance, Documents. All KPI cards, tables, and "Add / Log / Archive / Mark complete / Upload" buttons are wired to real inserts/updates on the corresponding `uben_*` tables. It is a **real console layered over an almost-empty database**: the plumbing works, the substance doesn't exist yet (1 program, 0 rows everywhere else per prior audit).

From UbenHQ the admin reaches (via sidebar, not internal links): Grant Tracker, Applications, Programs, Impact, Donors, Compliance, Documents, Commissions — each a separate 500–1,200 LOC page. Separately, the Grant System operator console lives under **`/os/grants/*`** (8 pages, ~3,800 LOC).

Verdict: **working operator console** for CRUD + logging + uploads, sitting on top of a mostly empty tracker DB and a partial grant engine.

---

## SECTION 2 — SIDEBAR / REACHABILITY

Both hubs are registered in **`src/components/Layout.tsx`** (the live nav — verified), not orphaned. Real entries:

`DYNASTY_NAVIGATION.ubenHq` (Layout.tsx:554–566):
- `/os/uben` — UBEN Dashboard
- `/os/uben/grants` — Grant Tracker
- `/os/uben/applications` — Applications
- `/os/uben/programs` — Programs
- `/os/uben/impact` — Impact Reports
- `/os/uben/donors` — Donors
- `/os/uben/compliance` — Compliance
- `/os/uben/documents` — Documents
- `/os/uben/commissions` — Commissions

Grant System nav (Layout.tsx:611–616):
- `/os/grants/dashboard`, `/opportunities`, `/applications`, `/funder-crm`, `/businesses`, `/eligibility`

Every route above resolves to a registered `<Route>` in `src/routes/AppRoutes.tsx` (2207–2266). **No orphans.**

Orphan / URL-only routes (registered but NOT in the sidebar):
- `/os/grants/approved`, `/os/grants/pending` — alias routes to `GrantApplicationsPage`.
- `/os/grants/businesses/:id`, `/os/grants/apply/:packageId`, `/os/grants/:id` — detail routes reachable only by row-click.
- `/os/grants/eligibility-matrix` — alias.

None of these are bugs — detail views legitimately live off list pages.

---

## SECTION 3 — COMPLETE PAGE / TAB INVENTORY

### UBEN Tracker side

| Route | File | LOC | Purpose | Reachable | Status |
|---|---|---|---|---|---|
| `/os/uben` | `UbenHQ.tsx` | 1202 | Main dashboard w/ KPIs + inline Impact/Ambassador/Partner/Compliance/Docs panels | ✅ sidebar | **FULLY WORKING (empty DB)** |
| `/os/uben/grants` | `UbenGrantTracker.tsx` | 498 | UBEN-owned grant applications register | ✅ | **PARTIAL** — writes to `uben_grant_applications` (cast `as any`; separate from `grant_applications`) |
| `/os/uben/applications` | `UbenApplications.tsx` | 677 | Ambassador application queue (from public site) — approve / deny / enroll as beneficiary | ✅ | **FULLY WORKING (empty)** |
| `/os/uben/programs` | `UbenPrograms.tsx` | 881 | Program CRUD + beneficiary enrollment | ✅ | **FULLY WORKING (1 row)** |
| `/os/uben/impact` | `UbenImpact.tsx` | 732 | Impact log entry + aggregated stats | ✅ | **FULLY WORKING (empty)** |
| `/os/uben/donors` | `UbenDonors.tsx` | 884 | Donor + donation CRUD, notes | ✅ | **PARTIAL** — email button explicitly says "coming soon — connect Resend" |
| `/os/uben/compliance` | `UbenCompliance.tsx` | 731 | Compliance calendar (990, charity reg, disclosures) | ✅ | **FULLY WORKING (14 seeded rows per prior audit)** |
| `/os/uben/documents` | `UbenDocuments.tsx` | 574 | Storage-backed document vault (bucket `uben-docs`) | ✅ | **FULLY WORKING (empty)** |
| `/os/uben/commissions` | `UbenCommissions.tsx` | 852 | Ambassador commission ledger | ✅ | **UI-ONLY / UNVERIFIED** — no direct `supabase.from(...)` calls detected in file scan; likely reads via shared `AmbassadorNetworkTab.tsx` hooks (991 LOC, real writes to `uben_commission_ledger` / `_config` / `_recruiters`). Standalone page needs a spot-check. |

### Grant System operator surface

| Route | File | LOC | Purpose | Status |
|---|---|---|---|---|
| `/os/grants` + `/dashboard` | `GrantsDashboard.tsx` | 460 | KPIs, pipeline, submitted-today, batch eligibility trigger | **FULLY WORKING** |
| `/os/grants/opportunities` | `GrantOpportunities.tsx` | 326 | List + insert `grant_opportunities` (11 seeded) | **FULLY WORKING** |
| `/os/grants/applications` (+ `/approved`, `/pending`) | `GrantApplicationsPage.tsx` | 272 | Application list w/ status filter (`approved`/`awarded`) | **FULLY WORKING (empty)** |
| `/os/grants/funder-crm` | `funding-machine/grants/GrantFunderCRMPage` | — | Funder CRM (outside `/os/grants/`) | not re-audited here |
| `/os/grants/businesses` | `BusinessProfiles.tsx` | 278 | Entity profile list + "Run Eligibility" bulk/per-row | **FULLY WORKING (11 profiles)** |
| `/os/grants/businesses/:id` | `BusinessProfileDetail.tsx` | 543 | Edit a profile | **FULLY WORKING** |
| `/os/grants/eligibility` (+ `-matrix`) | `EligibilityMatrix.tsx` | 629 | 110 matches grid, run-check, auto-apply | **FULLY WORKING** |
| `/os/grants/apply/:packageId` | `ApplicationPackage.tsx` | 420 | Wraps `grant-auto-apply` fn | **PARTIAL** — depends on funder-facing submission endpoints |
| `/os/grants/:id` | `GrantApplicationDetail.tsx` | 787 | Draft with `generate-grant-draft`, upload docs to `grant-documents`, submit via `submit-grant-application` | **FULLY WORKING** |

No pages found for: **post-award funder reporting, award ledger, team/board management (`uben_team_members`)**. See §7.

---

## SECTION 4 — EVERY BUTTON / CONTROL / FORM

All references file:line. Only dead/questionable controls are flagged; unflagged buttons are wired to real Supabase inserts/updates verified in code.

### `UbenHQ.tsx`
- **Real writes:** `addProgram`, `addImpact`, `archiveProgram`, `markComplete` (compliance), `addAmbassador`, `addPartner`, `addDeadline`, doc upload to `uben-docs` storage + `uben_documents` insert (lines 330, 534–566, 667–688, 902–909, 1003–1013).
- **`copyReport` button (1116, 1151):** Real — copies impact narrative text to clipboard. Not a dead button, but not "generate PDF report" either.

### `UbenApplications.tsx`
- All buttons wired: `updateStatus` (reviewing / approved / denied), `saveNotes`, `enrollBeneficiary` insert into `uben_beneficiaries` (223), deny requires ≥10-char reason (581). **No dead buttons.**

### `UbenDonors.tsx`
- Wired: `addDonor` (259), `addDonation` (304), notes save (662).
- **Dead:** "Email donor" button — line 691 shows literal toast: *"Email feature coming soon — connect Resend to enable donor notifications"*. Explicitly disabled functionality.

### `UbenPrograms.tsx`, `UbenImpact.tsx`, `UbenCompliance.tsx`, `UbenDocuments.tsx`
- All Add / Upload / Mark-complete / Enroll buttons wired to real writes. **No dead buttons detected.**

### `UbenGrantTracker.tsx`
- Insert (151) writes to `uben_grant_applications` with `as any` type cast — schema fine but decoupled from the real Grant System (`grant_applications` table). **Confusing duplication**, functional but forks data.

### `UbenCommissions.tsx`
- No direct DB calls found in the file (may render only). Ambassador commission logic is real in `AmbassadorNetworkTab.tsx` (391, 399, 552, 569 → `uben_commission_ledger`, `_config`, `_recruiters`). **Needs manual verification that the standalone page is not a shell.**

### Grant System pages
- **`GrantsDashboard.tsx`:** "Run Eligibility (all clients)" button (241) → real invoke of `grant-eligibility-check`.
- **`GrantOpportunities.tsx`:** Insert form (164) writes to `grant_opportunities`.
- **`BusinessProfiles.tsx`:** "Run Eligibility" per row + `runAll` (80, 102, 156, 257) → real invoke of `grant-eligibility-checker`.
- **`EligibilityMatrix.tsx`:** Run-check + Auto-apply (170, 187, 209) real invokes.
- **`GrantApplicationDetail.tsx`:**
  - **Generate Draft** (322) → real `generate-grant-draft` invoke (verified in prior audit: Lovable Gateway + Claude).
  - **Save Draft** (502) → real DB update.
  - **Email / Manual Submit** (552, 559) → real `submit-grant-application` invoke.
  - **Upload / Delete document** (167, 204) → real `grant-documents` storage + `grant_documents` row.
- **`ApplicationPackage.tsx`:** "Auto-Apply" (127) → real `grant-auto-apply` invoke.

**Only two dead controls in the entire hub:** the Donors "email" button (labeled coming-soon), and `UbenCommissions.tsx` standalone page (unverified — likely OK, but no direct writes in file scan).

---

## SECTION 5 — REAL DATA vs MOCK (per screen)

Every UBEN and Grants list/count comes from `supabase.from('uben_*' | 'grant_*')` — no hardcoded arrays, no faker data. Verified across all 18 pages.

**Seed-shown-as-real risk:**
- **UbenHQ dashboard KPIs:** With DB = 1 program / 0 impact / 0 ambassadors, cards show `0 / 1 / 0`. That is honest — not seed-as-real.
- **`uben_compliance_calendar` (14 rows):** These are *seeded deadlines* (990, charity reg, disclosures) but no admin has marked any complete or written any real status. An operator glancing at the compliance page could mistake seeded due-dates for tracked reality. **Flag: honest-zero on status, but seeded rows are indistinguishable from operator-entered rows.** Recommend a `source: 'seed' | 'operator'` column or a "First-run: confirm these deadlines" gate.
- **Grant System:** 11 opportunities + 11 profiles + 110 matches are the *real* engine output — legitimate.

No dashboard is inventing numbers.

---

## SECTION 6 — THE TRACKER SIDE (operator functions)

| Capability | State |
|---|---|
| **Programs CRUD** | Real. `UbenPrograms.tsx` insert (215) + `UbenHQ` archive (683). No edit-in-place UI on `UbenPrograms` verified — only Add + Archive. |
| **Impact entry** | Real. `UbenHQ.addImpact` (534) + `UbenImpact.tsx` (277) both insert `uben_impact_log`. |
| **Public-site flow-through** | **NOT VERIFIED as wired.** No code path found in this audit that reads `uben_programs` / `uben_impact_log` from the marketing site's `/impact` page. Inferred, not confirmed — needs cross-check on the public site codebase. |
| **Compliance tracking** | Real. 14 seeded rows, `mark complete` + `add deadline` wired. |
| **Team management** | **MISSING.** `uben_team_members` table exists (referenced by public site) but **no admin page** in the hub reads or writes it. Confirmed by grep. |
| **Ambassador applications queue** | Real. `UbenApplications.tsx` reads `uben_ambassador_applications`, approve → auto-creates `uben_ambassadors` row + logs activity (752–767). Queue is empty because public form has not submitted. |

---

## SECTION 7 — GRANT-SYSTEM OPERATOR SURFACE

| Capability | State |
|---|---|
| **Opportunities view/add** | Real (11 rows, search + insert form). |
| **Entity profile view/edit** | Real (11 profiles + detail edit). |
| **110 matches** | Real (EligibilityMatrix + BusinessProfiles), per-row + bulk re-check. |
| **AI drafter from console** | Real. `GrantApplicationDetail.tsx:322` invokes `generate-grant-draft`; result rendered in editable textarea, save writes back to `grant_applications`. Verified real in prior audit (Claude via Lovable Gateway). Does **not** currently pull from `grant-documents` vault into the prompt — inferred, unconfirmed. |
| **Applications: draft → submitted → awarded** | Statuses tracked (`GrantApplicationsPage` filter includes `awarded`), submission flow real. |
| **Post-award reporting** | **CONFIRMED MISSING from the console.** No page, no tab, no button. Aligns with prior engine audit. |
| **Document vault from hub** | Real upload/delete against `grant-documents` bucket for grants; `uben-docs` bucket for tracker. Both bucket contents are essentially empty (prior audit). |

---

## SECTION 8 — WIRING MAP (hub ↔ engine ↔ public site)

```
PUBLIC SITE (uben marketing)
  ├── /apply form  ─────►  uben_ambassador_applications  ◄──── UbenApplications.tsx (queue)
  ├── /impact      ─────►  uben_programs / uben_impact_log  (READ path NOT VERIFIED in this audit)
  └── /team        ─────►  uben_team_members  ◄── NO HUB WRITER

HUB (operator)
  UbenHQ ──────► uben_programs, _impact_log, _partner_activity, _compliance_calendar,
                 _documents, _ambassadors, _ambassador_sales, _activity_log
  UbenGrantTracker ──► uben_grant_applications   (SEPARATE from grant_applications)
  UbenDonors ─────► uben_donors, uben_donations
  UbenCommissions/AmbassadorNetworkTab ──► uben_commission_ledger, _config, _staff_recruiters

  GrantsDashboard ─► grant_applications, grant_opportunities  (+ invoke grant-eligibility-check)
  GrantOpportunities ─► grant_opportunities
  BusinessProfiles ─► grant_business_profiles + grant-eligibility-checker fn
  EligibilityMatrix ─► grant_eligibility_results + grant-auto-apply fn
  GrantApplicationDetail ─► grant_applications, grant_documents + generate-grant-draft, submit-grant-application fns
```

**Disconnects:**
1. `uben_team_members` — table exists, **no hub writer**.
2. `uben_grant_applications` (UBEN's own tracker) vs `grant_applications` (Grant System) — **two parallel tables**, unbridged.
3. Public site `/impact` read path from `uben_programs` / `_impact_log` — **not verified** in this audit.
4. Post-award reporting — no table, no page, no function.

---

## SECTION 9 — SECURITY / ACCESS

**CRITICAL FINDING.** Grep of `src/routes/AppRoutes.tsx` for `RoleGuard|ProtectedRoute|RequireAuth` on `/os/uben*` and `/os/grants*` routes returns **zero matches**. All 18 routes are registered as bare `<Route path=... element={<Page/>} />` with **no role gating at the route level**. Any signed-in user can reach the hub, incl. drivers/bikers/customers.

Additional:
- No `RoleGuard` component invocation inside the UBEN or Grants page files themselves either.
- Storage buckets `uben-docs` and `grant-documents` — RLS status not re-verified this pass (prior audit confirms they exist).
- No secrets in client code (edge functions use `LOVABLE_API_KEY` server-side, verified in prior audit).

**This contradicts the "internal / private" positioning of the Grant System OS.** RLS on `uben_*` / `grant_*` tables likely still blocks non-authorized reads, so this may be a defense-in-depth failure rather than a full breach — but the UX (page loads, empty screens, forbidden inserts) is broken and access-control intent is unenforced at the route layer.

---

## SECTION 10 — SCORECARDS

### Build completion %

| Area | % | Notes |
|---|---|---|
| Tracker: Dashboard (`UbenHQ`) | 85% | All CRUD wired; missing team page + PDF report |
| Tracker: Programs | 80% | Add + Archive; no in-place edit UI |
| Tracker: Impact | 90% | Entry + rollups wired |
| Tracker: Compliance | 85% | Seed + operator flow; needs seed-vs-operator flag |
| Tracker: Team | **0%** | No page |
| Tracker: Applications (ambassador queue) | 95% | Fully wired |
| Tracker: Donors | 75% | Email action is a dead button |
| Tracker: Documents | 90% | Real storage; empty vault |
| Tracker: Commissions | 60% | AmbassadorNetworkTab real; standalone page unverified |
| Grants: Dashboard | 95% |  |
| Grants: Opportunities | 90% |  |
| Grants: Business Profiles | 90% |  |
| Grants: Eligibility Matrix | 95% |  |
| Grants: AI Drafter + App Detail | 85% | No vault-in-prompt pipeline confirmed |
| Grants: Applications list | 90% |  |
| Grants: Post-award reporting | **0%** | Missing |
| Grants: Document vault UI | 90% |  |
| **Overall build** | **~72%** | Console is largely built; two capabilities (team, post-award reporting) don't exist |

### Operational-readiness %

**~35%.** An admin can *technically* click through every button, but cannot actually **run UBEN end-to-end** today because:
- No real programs / impact / documents / donors / applications entered.
- Team management surface doesn't exist (public `/team` cannot be updated from the hub).
- Grant post-award reporting doesn't exist — first funder award has nowhere to be tracked.
- Public site ↔ tracker read path unverified.
- Ambassador email action is a dead button.
- Routes have no admin gating.

**Verdict: PARTIAL working operator console.** The plumbing is real (not a shell), but two must-have capabilities are absent and the console is unlocked.

---

## SECTION 11 — PRIORITIZED TASK LIST TO 100%

### CRITICAL (dev)
1. **Wrap all `/os/uben/*` and `/os/grants/*` routes in `RoleGuard`** (owner/admin only). Overlaps with governance standard.
2. **Build Team management page** at `/os/uben/team` — CRUD over `uben_team_members`, wired to the public `/team` reader.
3. **Build post-award reporting surface** — new table (or extend `grant_applications`), page under `/os/grants/reporting`, edge function for funder-required interim reports. Overlaps with grant-engine roadmap.
4. **Resolve `uben_grant_applications` vs `grant_applications` fork** — either merge or document why they coexist. Currently confusing dual-tracking.

### HIGH (dev)
5. **Verify + fix public-site read path** for `/impact`, `/programs`, `/team` from `uben_*` tables. If not wired, wire it.
6. **`UbenCommissions.tsx` standalone page** — audit and, if a shell, either wire it or route to `AmbassadorNetworkTab`.
7. **Remove "coming soon" email dead button** on `UbenDonors.tsx:691` OR wire it to Resend (secret exists per prior vault audit).
8. **Ambassador application → beneficiary handoff** — path exists (`enrollBeneficiary`) but no confirmation dialog / audit trail beyond `uben_activity_log`. Harden.
9. **Feed `grant-documents` vault into `generate-grant-draft` prompt** so drafts cite the org's real EIN letter / 501(c)(3) / financials.

### MEDIUM (dev)
10. Program in-place edit UI (not just Add + Archive).
11. Compliance-calendar `source: seed|operator` distinction.
12. UbenHQ "copyReport" → real PDF export via edge function.

### CRITICAL (owner-action, not dev)
13. Upload real org documents to `uben-docs` (501(c)(3) letter, EIN, latest 990, insurance, board resolution).
14. Enter real programs + historical impact numbers into the tracker so the hub stops showing zeros.
15. Register on SAM.gov + provide UEI (blocks federal grant submissions from `submit-grant-application`).
16. Populate `uben_team_members` with real leadership (blocks public `/team`).
17. Confirm the 14 seeded compliance deadlines against real filing calendar; mark completed items complete.

### LOW
18. Add "Empty state" onboarding banners on UbenHQ when DB is empty (currently just shows 0s).
19. Consolidate `/os/uben/grants` (`UbenGrantTracker`) into `/os/grants` if fork is resolved.
20. Add unit tests around approve→ambassador auto-creation flow.

---

**File path:** `docs/audits/UBEN_OS_HUB_AUDIT.md`
