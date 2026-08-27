# Surplus & Real Estate — 50-State Master Scope

**Prepared for:** Ching and the incoming development team
**Verification date:** 2026-08-27
**Document type:** ORGANIZATION / HANDOFF — this is not a new audit
**Source documents:** `docs/audits/SURPLUS-REALESTATE-STATE-SCOPE-AUDIT-2026-08-27.md`, `docs/audits/SURPLUS-REALESTATE-STATE-EXECUTION-SCOPE-2026-08-27.md`

**DATA CHANGES: 0 · OUTREACH / CALLS: 0 · SMS: 0 · EMAIL: 0 · SCRAPERS RUN: 0 · SKIP TRACE RUN: 0 · PAID API CALLS: 0**

Everything below is carried forward from the two verified source documents. Nothing new was queried, changed, promoted, or contacted. Where the evidence is incomplete, this document says so rather than filling the gap.

---

## 1. Executive Summary

**Verified record totals (as of 2026-08-27)**

| Metric | Value |
|---|---|
| Total surplus / real-estate records | **26,682** |
| — promoted surplus leads (`surplus_funds_leads`) | 26,571 |
| — real-estate property leads (`re_leads`) | 107 |
| — mock rows (`leads_raw`, fake, from a dead function) | 4 |
| Raw ingest landing rows (`raw_scraper_leads`) | 25,499 |
| Promotion-rejected rows (`raw_scraper_leads_flagged`) | 793 |
| Ingest-level rejects (`raw_scraper_leads_rejects`) | 31 |
| Attorney recruiting records (`sf_recruiting_queue`) | 65 |

**States currently populated with promoted leads: 9** — OH, MS, FL, TX, GA, NY, IN, IL, CO.
Four further states hold scraped-but-unpromoted rows: NJ, OK, SC, MN.
No state is COMPLETE. Rows existing is not the same as a state being finished.

**Total surplus value: $118,186,489** across the 26,571 promoted surplus leads.

**Phone / address readiness**

| | Count | % of 26,571 |
|---|---:|---:|
| Has a phone number | 444 | 1.67 % |
| Has a last name | 25,022 | 94.2 % |
| Has any address | 1,228 | 4.6 % |
| **Skip-trace-ready (name AND address)** | **1,007** | **3.8 %** |
| `skip_traced = true` | 457 | 1.7 % |
| `dnc = true` (never trace, never dial) | 259 | 1.0 % |

The 444 phones arrived with the source data, not from enrichment. **96 % of the universe cannot be skip-traced today — not for lack of a function, but for lack of an address.**

**Major current blockers**

1. **No address at scrape time.** This, not tooling, is the true ceiling on the whole pipeline.
2. **No surplus skip-trace function.** `re-skip-trace` is hardcoded to `re_leads`; there is no `sf-skip-trace`.
3. **Monitoring is not trustworthy.** `scraper-ingest` writes `consecutive_failures: 0` unconditionally, so a source rejecting 100 % of its rows still reads healthy.
4. **GA Cobb is silently losing 30 rows per run** since 2026-08-22 on a single field-name mismatch.
5. **562 scraped rows in NJ / OK / SC / MN are blocked at promotion** on one or two missing fields.
6. **Legal posture is unconfirmed in every state.** No state has verified claim rules, fee caps, or agent-registration requirements.
7. **Lane classification is inferred, not recorded.** Pools A/B/C are real data with no written definition anywhere.
8. **Nothing has left the lead stage.** Cases, contracts, payments, inquiries, attorney assignments, callbacks, retainers and `bland_call_triggered` are all **0**.

**No-outreach status**

No calls, SMS, emails or Bland campaigns have been sent from this pipeline. `bland_call_triggered = 0`. One latent risk exists and is not yet removed: `re-skip-trace` auto-invokes `re-trigger-bland-campaign` when it finds phone numbers — an outreach trigger sitting inside an enrichment function. It is listed as a P0 repair item. Until legal posture and suppression checks are in place, **no state is cleared for contact**.

---

## 2. Business Scope / Lanes

Lane labels do not exist as a column in the database. They are reconstructed from `surplus_funds_leads.pool`, `holder_type` and `lead_source` naming. The pool letters (`sf_pool_map`, 39 rows) are real data with **zero written definition**.

### Lane 1 — Tax-sale / tax-deed surplus (overbid, excess funds)
- Tables: `surplus_funds_leads` pool A, `raw_scraper_leads`
- Volume: **13,657 rows · $60.05M · 399 phones**
- States: FL 2,196 · MS 10,229 · TX 826 · GA 406
- Source type: public county records (clerk of court, chancery clerk, tax commissioner), scraped
- Evidence: holders `clerk_of_court` / `chancery_clerk` / `tax_commissioner`; sources `*_taxdeed`, `*_excess`, `*_overbid`
- Classification: **lead pipeline** · Confidence **HIGH**

### Lane 2 — Mortgage / judicial foreclosure surplus
- Tables: `surplus_funds_leads` pool B
- Volume: **12,901 rows · $56.01M · 45 phones**
- States: OH 12,592 · NY 146 · IN 72 · IL 70 · CO 21
- Source type: public — clerk of court, Colorado public trustee
- Evidence: sources `*_foreclosure`, `*_surplus`, `*_released`, CO `*_overbid`
- Classification: **lead pipeline** · Confidence **MEDIUM** — Ohio mixes `*_excess` and `*_released` in the same pool, so tax-origin versus foreclosure-origin is **not distinguishable at row level inside Ohio**
- `PENDING CHING CONFIRMATION` — is Ohio "excess funds" the same product as Ohio "released funds"?

### Lane 3 — State escheat / unclaimed funds
- Tables: `surplus_funds_leads` pool C
- Volume: **13 rows · $2.13M · 0 phones**
- States: NY (Nassau) only, via `ny_nassau_escheatment_manual`
- Source type: state treasurer, manual load
- Classification: lead pipeline, **unproven at this volume** · Confidence **LOW** — 13 rows from one manual load is not a pipeline
- `PENDING CHING CONFIRMATION` — real product line, or an experiment?

### Lane 4 — Foreclosure property leads (acquisition, not recovery)
- Tables: `re_leads`
- Volume: **107 rows** (80 are `realestateapi_bulk_import` with no state and no `lead_type`; 26 operator CSV; 1 pre-foreclosure) · 105 have phones
- States: GA 9 · TX 7 · NY 6 · NJ 2 · FL 2 · 80 unknown
- Source type: paid API (RealEstateAPI) + operator CSV
- Classification: lead pipeline, **barely seeded** · Confidence **MEDIUM**
- `PENDING CHING CONFIRMATION` — still in scope for September, or is surplus the only near-term product?

### Lane 5 — Pre-foreclosure / Lis Pendens
- Tables: `re_leads` where `lead_type = 'pre_foreclosure'`
- Volume: **1 row** (FL, csv_upload)
- Source type: **none** — no NOD or lis-pendens ingestion exists anywhere in the system
- Classification: **does not exist yet** · Confidence **HIGH that it does not exist**
- `PENDING CHING CONFIRMATION` — keep as a declared lane, or park it?

### Supporting workstream — Attorney recruiting
- Tables: `sf_recruiting_queue` (65), `surplus_funds_attorneys` (**1 row, named "test"**), `sf_attorney_jurisdiction` (**0 rows**)
- Coverage: 22–24 jurisdictions; 31 records `bar_verified` (VA 8, NJ 7, MD 5, GA 4, NY 4, NC 3), remainder `identified`
- Purpose: obtain licensed counsel per jurisdiction so claims can actually be filed
- **Classification: SUPPORTING / LEGAL-ENABLEMENT WORKSTREAM — not a business data lane.** It produces no claimants, no surplus value and no revenue record; it gates lanes 1–3. It has the wrong shape for a lane: no lead-state coverage, no promotion path, no downstream case.
- Confidence **HIGH** that it is support, not a lane · `PENDING CHING CONFIRMATION` (confirm the demotion)

### On the unresolved "other 2"

The prior audit searched code and data for any further lane with its own table and rows. Nothing qualifies. `leads_raw` is mock data. `acquisitions_pipeline` is a legacy stage table, not a lane. The NJ / OK / SC / MN blocked rows are a *state* of lanes 1 and 2, not a separate lane.

**Live evidence supports three surplus lanes plus two near-empty real-estate lanes plus one supporting workstream. It does not support six.** The meaning of "the other 2" referenced in prior scope conversations is **UNRESOLVED** and is not invented here. See §9.

---

## 3. 50-State Master Matrix

Status vocabulary used consistently throughout: **COMPLETE · PARTIAL · BROKEN · SCRAPED_NOT_PROMOTED · SOURCE_IDENTIFIED_NOT_BUILT · PRIVATE_SOURCE_REQUIRED · BLOCKED · NOT_STARTED · UNKNOWN**.

No state is COMPLETE.

### 3A. States with promoted leads (9)

| State | Lane | Current Records | Surplus Value | Primary Source | Source Type | Level | Counties Covered | Scraper Status | Promotion Status | Address/Contact Readiness | Skip Trace Readiness | Legal/Source Status | Overall Status | Primary Blocker | Next Action | Lawyer/Authority Question | Evidence / Trace |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OH | 2 | 12,592 | $49.40M | 11 `oh_*` county sources | Public | County | 9 of 88 (Cuyahoga 11,688; Montgomery 389; Franklin 278; Medina 136; Butler 61; Coshocton 18; Greene 16; Adams 3; Crawford 3) | PARTIAL (last proven run 2026-08-25) | PARTIAL (22 Cuyahoga rows flagged) | BLOCKED — 4 phones (0.03 %) | NOT_STARTED | UNKNOWN | PARTIAL | No phones; tax-vs-foreclosure origin indistinguishable | Address capture, then `sf-skip-trace`; add lane column | Claim window, who may file, assignment permitted, fee cap | `scraper_state`, `surplus_funds_leads` |
| MS | 1 | 10,229 | $1.39M | `ms_hinds_excess` | Public | County | 1 of 82 (Hinds) | PARTIAL (last run 2026-08-13) | PARTIAL (2 junk-name flags) | BLOCKED — 0 phones | NOT_STARTED | UNKNOWN | PARTIAL | Single county, zero phones, avg $136/record | Confirm record economics before any trace spend | Chancery-clerk excess process; statewide vs county; assignment legality | `scraper_state` |
| FL | 1 | 2,196 | $32.16M | 8 `fl_*` county sources | Public | County | 8 of 67 (Marion 762; Lee 686; Brevard 232; Osceola 231; Sumter 127; St. Lucie 90; Hillsborough 54; Collier 14) | PARTIAL (Sumter 1 reject; last run 2026-08-24) | PARTIAL (Brevard 72 flagged) | PARTIAL — 343 phones (15.6 %), best in system | PARTIAL (source-supplied phones only) | BLOCKED — surplus-recovery-agent registration unconfirmed | PARTIAL | Brevard amounts missing; registration question | Fix Brevard amount mapping; Sumter column alignment | F.S. 197.582 registration requirement and fee cap | rejects + flagged tables |
| TX | 1 | 826 | $14.57M | 7 `tx_*` county sources | Public | County | 6 of 254 (Nueces 312; Dallas 187; Fort Bend 141; Galveston 139; Denton 44; Tarrant 3) | PARTIAL (last run 2026-08-24) | PARTIAL (3 Nueces flagged) | BLOCKED — 0 phones | NOT_STARTED | UNKNOWN — 10 % cap assumed, unverified | PARTIAL | No phones; Harris/Bexar/Travis absent | Address capture + county expansion | Excess-proceeds petition, 2-year window, is 10 % cap statutory | live query |
| GA | 1 | 406 | $11.93M | 5 `ga_*` county sources | Public | County | 4 of 159 (DeKalb 227; Clayton 109; Gwinnett 60; Cobb 10) | **BROKEN** — `ga_cobb_foreclosure` rejects 30/run | PARTIAL (Cobb excess 21 flagged) | PARTIAL — 56 phones (13.8 %) | PARTIAL | UNKNOWN | BROKEN | Cobb `date_of_sale` / `sale_date` mismatch | Alias the field in `scraper-ingest`; backfill 30 rejects | Excess-funds distribution, interpleader, unlicensed-practice risk | `raw_scraper_leads_rejects` |
| NY | 2 + 3 | 146 + 13 | $2.87M + $2.13M | Franklin 106, Broome 40, Nassau 13 (manual) | Public | County + State | 3 of 62 | PARTIAL (last run 2026-08-19) | PARTIAL | BLOCKED — 0 phones | NOT_STARTED | **BLOCKED** — NY restricts surplus-recovery contracts | BLOCKED | Legal posture unknown; downstate absent | Hold build until counsel answers | Are third-party recovery contracts enforceable; Nassau escheat agent rules | live query |
| IN | 2 | 72 | $0.37M | `in_allen_foreclosure` | Public | County | 1 of 92 (Allen) | OK (last run 2026-08-25) | PARTIAL | BLOCKED — 0 phones | NOT_STARTED | UNKNOWN | PARTIAL | Single county, thin volume | Expand to Marion/Lake after P0/P1 | Tax-sale surplus claim window | live query |
| IL | 2 | 70 | $2.03M | Will (promoted), McHenry (111 flagged) | Public | County | 1 of 102 built, 2 attempted | PARTIAL — no run since 2026-07-27 | SCRAPED_NOT_PROMOTED (McHenry 111) | PARTIAL — 41 phones (58.6 %), highest rate | PARTIAL | UNKNOWN | PARTIAL | McHenry rows missing amounts | McHenry amount mapping — recovers 111 rows | Claim window; assignment legality | flagged table |
| CO | 2 | 21 | $1.34M | Arapahoe 15, Denver 6, Adams, Elbert | Public | County (public trustee) | 2 producing of 4 configured, 64 total | OK but thin (last run 2026-08-25) | PARTIAL | BLOCKED — 0 phones | NOT_STARTED | UNKNOWN | PARTIAL | Very low yield vs configured sources | Verify trustee sources return full result sets | Public-trustee overbid rules | `scraper_state` |

### 3B. Scraped but not promoted (4)

| State | Lane | Current Records | Surplus Value | Primary Source | Source Type | Level | Counties Covered | Scraper Status | Promotion Status | Address/Contact Readiness | Skip Trace Readiness | Legal/Source Status | Overall Status | Primary Blocker | Next Action | Lawyer/Authority Question | Evidence / Trace |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| NJ | 1 / 2 | 259 raw, 0 promoted | UNKNOWN — no amounts | `nj_trust_fund_escheat_manual` 130, `nj_statewide_foreclosure` 129 | Public | State | Statewide | OK | SCRAPED_NOT_PROMOTED | UNKNOWN | NOT_STARTED | UNKNOWN | BLOCKED | 100 % missing / non-positive `surplus_amount` | Re-read published source layout before touching validation | Does the published list carry a per-claim amount anywhere? | `raw_scraper_leads_flagged` |
| OK | 1 | 163 raw, 0 promoted | UNKNOWN | `ok_tulsa_excess` | Public | County | 1 (Tulsa) | OK | SCRAPED_NOT_PROMOTED | UNKNOWN | NOT_STARTED | UNKNOWN | BLOCKED | 100 % missing `case_number` | Map the source's case/sale column | Is a case or sale number published in another column or linked page? | `raw_scraper_leads_flagged` |
| SC | 1 | 120 raw, 0 promoted | UNKNOWN | `sc_york_overage` | Public | County | 1 (York) | OK | SCRAPED_NOT_PROMOTED | UNKNOWN | NOT_STARTED | UNKNOWN | BLOCKED | 100 % missing `case_number` | Map the identifier column | Is there an identifier other than the overage row? | `raw_scraper_leads_flagged` |
| MN | 1 | 20 raw, 0 promoted | UNKNOWN | Hennepin 10, Stearns 6, Ramsey 4 (Pine configured, 0 rows) | Public | County | 3 producing of 4 | OK | SCRAPED_NOT_PROMOTED | PARTIAL — 10 of 20 carry `property_address` | NOT_STARTED | UNKNOWN | BLOCKED | Missing `case_number`; gate likely too strict for parcel-keyed data | Lane-scoped identity rule: case number OR parcel/address + name | Is a court case number issued at all, or is the parcel the identifier? | `raw_scraper_leads_flagged` |

### 3C. Attorney-recruiting presence only — no leads (11)

Support workstream only. `sf_attorney_jurisdiction` is empty, so none of this verification is enforceable by the application.

| State | Lane | Current Records | Surplus Value | Primary Source | Source Type | Level | Counties Covered | Scraper Status | Promotion Status | Address/Contact Readiness | Skip Trace Readiness | Legal/Source Status | Overall Status | Primary Blocker | Next Action | Lawyer/Authority Question | Evidence / Trace |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| VA | Support | 0 leads (8 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Bind bar-verified attorneys to `sf_attorney_jurisdiction` | Is the state worth a lead lane at all? | `sf_recruiting_queue` |
| MD | Support | 0 leads (7 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| NC | Support | 0 leads (6 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| NV | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| CA | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| TN | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| AZ | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| MI | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| MO | Support | 0 leads (2 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| PA | Support | 0 leads (1 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |
| KY | Support | 0 leads (1 recruiting) | $0 | none | — | — | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED (support PARTIAL) | No lead source identified | Same | Same | `sf_recruiting_queue` |

*(DC also carries 1 recruiting record. It is not one of the 50 states and is listed here for completeness only.)*

### 3D. Not started — no source, no rows, no scraper (26)

| State | Lane | Current Records | Surplus Value | Primary Source | Source Type | Level | Counties Covered | Scraper Status | Promotion Status | Address/Contact Readiness | Skip Trace Readiness | Legal/Source Status | Overall Status | Primary Blocker | Next Action | Lawyer/Authority Question | Evidence / Trace |
|---|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| AL | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 — only after the per-state checklist exists | Does the state publish surplus lists, and may an agent file? | no rows in any table |
| AK | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| AR | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| CT | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| DE | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| HI | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| ID | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| IA | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| KS | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| LA | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| ME | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| MA | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| MT | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| NE | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| NH | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| NM | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| ND | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| OR | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| RI | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| SD | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| UT | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| VT | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| WA | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| WV | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| WI | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |
| WY | UNKNOWN | 0 | $0 | none identified | UNKNOWN | UNKNOWN | 0 | NOT_STARTED | NOT_STARTED | NOT_STARTED | NOT_STARTED | UNKNOWN | NOT_STARTED | No source identified | P3 | Same | no rows |

**Matrix coverage check:** 9 (promoted) + 4 (scraped, blocked) + 11 (attorney-only) + 26 (not started) = **50 states**.

**One unmapped row:** `scraper_state` carries a source with state code `XX` — **UNKNOWN**, unmapped, worth one look.

---

## 4. Current Working States

### OH — Ohio
- **Records:** 12,592 · **Surplus value:** $49.40M · **Phones:** 4 (0.03 %)
- **Lane(s):** 2 — mortgage / judicial foreclosure surplus (pool B)
- **Sources:** 11 `oh_*` county scrapers on Railway; 4 ran in the last 7 days; last proven run 2026-08-25
- **County coverage:** 9 of 88 — Cuyahoga 11,688 (93 % of the state), Montgomery 389, Franklin 278, Medina 136, Butler 61, Coshocton 18, Greene 16, Adams 3, Crawford 3
- **Working:** ingest, promotion (99.8 % success)
- **Broken:** nothing at ingest level
- **Missing:** phones, lane separation between `*_excess` and `*_released`, every downstream stage
- **Contact/address readiness:** effectively zero — 4 phones against 12,592 rows
- **Next technical action:** address capture at scrape time, then `sf-skip-trace`, Cuyahoga first; add a lane column so excess vs released is queryable

### MS — Mississippi
- **Records:** 10,229 · **Surplus value:** $1.39M · **Phones:** 0
- **Lane(s):** 1 — tax-sale surplus (pool A)
- **Sources:** one — `ms_hinds_excess` (Hinds chancery clerk); last run 2026-08-13
- **County coverage:** 1 of 82
- **Working:** ingest and promotion
- **Broken:** none identified
- **Missing:** phones, all other counties
- **Contact/address readiness:** zero. Average surplus is **$136 per record** — the economics of paid tracing at this scale are unproven
- **Next technical action:** none until the value question is answered — confirm whether Hinds is worth tracing before any spend

### FL — Florida
- **Records:** 2,196 · **Surplus value:** $32.16M · **Phones:** 343 (15.6 %)
- **Lane(s):** 1 — tax-deed surplus (pool A)
- **Sources:** 8 `fl_*` county scrapers; 5 ran this week; last run 2026-08-24
- **County coverage:** 8 of 67 — Marion 762, Lee 686, Brevard 232, Osceola 231, Sumter 127, St. Lucie 90, Hillsborough 54, Collier 14
- **Working:** most of the pipeline end to end
- **Broken:** Brevard (72 rows flagged, no amounts), Sumter (1 reject — `invalid input syntax for type date: "Burney"`, a column misalignment)
- **Missing:** 59 counties; clarity on surplus-recovery-agent registration
- **Contact/address readiness:** best in the system, but source-supplied only — no enrichment has run
- **Next technical action:** fix the Brevard amount mapping and the Sumter column alignment; confirm F.S. 197.582 registration with counsel before any contact

### TX — Texas
- **Records:** 826 · **Surplus value:** $14.57M · **Phones:** 0
- **Lane(s):** 1 — tax-sale excess proceeds (pool A)
- **Sources:** 7 `tx_*` county scrapers; last run 2026-08-24
- **County coverage:** 6 of 254 — Nueces 312, Dallas 187, Fort Bend 141, Galveston 139, Denton 44, Tarrant 3. Harris, Bexar and Travis are absent
- **Working:** ingest
- **Broken:** none at ingest (3 Nueces rows flagged at promotion)
- **Missing:** phones, county breadth, verified fee cap
- **Contact/address readiness:** zero
- **Next technical action:** address capture, then skip trace; expand to the three largest absent counties

### GA — Georgia
- **Records:** 406 · **Surplus value:** $11.93M · **Phones:** 56 (13.8 %)
- **Lane(s):** 1 — tax-sale excess funds (pool A)
- **Sources:** 5 `ga_*` county scrapers; last run 2026-08-24
- **County coverage:** 4 of 159 — DeKalb 227, Clayton 109, Gwinnett 60, Cobb 10. Fulton is absent
- **Working:** DeKalb, Clayton, Gwinnett ingest and promotion
- **Broken:** **`ga_cobb_foreclosure` rejects all 30 rows every run** since 2026-08-22 (see §6); Cobb excess has 21 flagged rows
- **Missing:** 155 counties, Fulton in particular
- **Contact/address readiness:** partial, source-supplied
- **Next technical action:** alias `date_of_sale` → `sale_date` in `scraper-ingest` and backfill the 30 preserved reject payloads

### NY — New York
- **Records:** 146 (lane 2) + 13 (lane 3) = 159 · **Surplus value:** $2.87M + $2.13M = $5.00M · **Phones:** 0
- **Lane(s):** 2 (foreclosure surplus) and 3 (state escheat)
- **Sources:** Franklin 106, Broome 40 (scraped), Nassau 13 (`ny_nassau_escheatment_manual`); last run 2026-08-19
- **County coverage:** 3 of 62; downstate entirely absent
- **Working:** ingest for the three sources
- **Broken:** none technically
- **Missing:** downstate coverage, phones, and above all a legal answer
- **Contact/address readiness:** zero
- **Next technical action:** **none — hold.** NY restricts third-party surplus-recovery contracts; counsel answers first, build second

### IN — Indiana
- **Records:** 72 · **Surplus value:** $0.37M · **Phones:** 0
- **Lane(s):** 2 — foreclosure surplus (pool B)
- **Sources:** `in_allen_foreclosure`; running as of 2026-08-25
- **County coverage:** 1 of 92 (Allen)
- **Working:** end to end, just very small
- **Broken:** none
- **Missing:** volume, phones
- **Contact/address readiness:** zero
- **Next technical action:** add Marion and Lake counties after P0/P1 are stable

### IL — Illinois
- **Records:** 70 · **Surplus value:** $2.03M · **Phones:** 41 (58.6 %, highest rate in the system)
- **Lane(s):** 2 — foreclosure surplus (pool B)
- **Sources:** Will County (promoted, manual ingest), McHenry County (111 rows, **all flagged** for missing amount); no run since 2026-07-27
- **County coverage:** 1 built of 2 attempted, 102 total
- **Working:** Will County promotion; the best phone-coverage rate anywhere
- **Broken:** McHenry amount mapping; the source has been idle for a month
- **Missing:** 100 counties, Cook County above all
- **Contact/address readiness:** best rate, tiny base
- **Next technical action:** McHenry amount mapping — 111 rows recovered for one field fix

### CO — Colorado
- **Records:** 21 · **Surplus value:** $1.34M · **Phones:** 0
- **Lane(s):** 2 — public-trustee overbid (pool B)
- **Sources:** 4 public-trustee sources configured; only Arapahoe (15) and Denver (6) produced rows; Adams and Elbert produced none; last run 2026-08-25
- **County coverage:** 2 producing of 4 configured, 64 total
- **Working:** ingest for two counties
- **Broken:** nothing erroring, but two configured sources return nothing — likely empty-page parsing
- **Missing:** almost everything; yield is suspiciously low
- **Contact/address readiness:** zero
- **Next technical action:** verify the trustee sources are actually returning full result sets rather than empty pages

---

## 5. Scraped But Blocked

**562 rows across 4 states. Nothing promoted. Nothing changed by this document.**

Important correction carried from the execution-scope document: these rows **were** run through `promote-leads` — `promoted_at` is stamped and they sit in `raw_scraper_leads_flagged`. They were **rejected by validation**, not skipped.

| | NJ — 259 | OK — 163 | SC — 120 | MN — 20 |
|---|---|---|---|---|
| **Source** | `nj_trust_fund_escheat_manual` (130) + `nj_statewide_foreclosure` (129) | Tulsa County excess (`ok_tulsa_excess`) | York County overage (`sc_york_overage`) | Hennepin 10 / Stearns 6 / Ramsey 4 (Pine configured, 0 rows) |
| **Gate that rejected them** | `surplus_amount` null or ≤ 0 on 100 % of rows | `case_number` empty on 100 % | `case_number` empty on 100 % | `case_number` empty on 100 %; 10 rows also lack `claimant_name` |
| **Missing field** | `surplus_amount` | `case_number` | `case_number` | `case_number` (and name on 10) |
| **Available from source?** | **UNKNOWN** — must re-read the published list. An escheat list may genuinely publish no per-claim amount | **LIKELY** — Tulsa excess lists normally carry a case or sale number; suspect a column-mapping miss | **LIKELY** — same pattern | **UNLIKELY** — MN surplus lists are often parcel-keyed, not case-keyed. 10 of 20 rows do carry `property_address` |
| **Is the gate valid?** | **YES.** A surplus lead with no amount cannot be valued or prioritised | **YES.** The case number is the claim identifier for a court-held fund | **YES.** Same reasoning | **NO — too strict here.** A county-held tax surplus keyed by parcel has no court case number; `parcel_id` / `property_address` should satisfy identity |
| **Retain as partial leads?** | Yes — as unvalued research rows, never as callable leads | Yes | Yes | Yes — strongest candidates for a relaxed, lane-scoped gate |
| **Current location** | `raw_scraper_leads` (`promoted_at` set) + `raw_scraper_leads_flagged` | same | same | same |
| **Recommended next action** | Re-inspect the source layout before touching validation. **Do not default amounts to 0** | Map the source's case/sale column in the Railway scraper | Same | Introduce a lane-scoped identity rule: `case_number` **OR** (`parcel_id` / `property_address` + `claimant_name`) |
| **Risk if done wrong** | Fabricated amounts poison prioritisation and any claim math | A wrong identifier means the wrong claim is filed | Same | Relaxing the rule globally would let junk into OH and MS — it must be per-lane, per-source |

---

## 6. Known Technical Defects

1. **GA Cobb `date_of_sale` / `sale_date` mismatch.** The Railway Cobb foreclosure scraper posts a field named `date_of_sale`; `raw_scraper_leads` has the column **`sale_date`**. PostgREST returns `PGRST204 — Could not find the 'date_of_sale' column of 'raw_scraper_leads' in the schema cache`, and every row in the batch fails. 30 rows lost per run since 2026-08-22. Minimal safe fix: accept `date_of_sale` as an alias in the `scraper-ingest` row normaliser — one mapping line, no DB change, no scraper redeploy. **Backfill is possible:** the rejected payloads are preserved in `raw_scraper_leads_rejects.row_payload`.

2. **`scraper-ingest` failure-counter defect (systemic).** `scraper-ingest` writes `consecutive_failures: 0` **unconditionally** on every completed HTTP call, regardless of how many rows were rejected. A source can reject 100 % of its rows forever and still read healthy. Cobb is simply the first case this hid. Fix: derive the counter from the actual reject count (`rejected > 0 && inserted === 0` → increment).

3. **Misleading source-health reporting.** Following from defect 2, every health judgement in the system — including the "last proven run" values in §3 — is only as trustworthy as a monitor that cannot detect total rejection. A human has to read `scraper_state.last_error` to see the truth.

4. **Missing address capture.** Only 1,228 of 26,571 surplus rows (4.6 %) carry any address; only 1,007 (3.8 %) have both a name and an address. Addresses are not being captured at scrape time. This is the single largest structural constraint in the pipeline and it sits in the Railway scrapers, outside this repository.

5. **Skip-trace architecture limitations.** `re-skip-trace` is the only trace function and is hardcoded to `re_leads` (line 34 and all four update paths). There is **no `sf-skip-trace`**, so the entire 26,571-row surplus universe is unsupported. The existing function has: no per-record attempt history, no cost ledger, no re-trace cooldown, no budget cap, no dry-run, no per-run cost estimate, no pacing or resume token, no state or lane restriction, and it consults only the provider's DNC flag rather than `dnc_list` / `opt_out_events`.

6. **`re-skip-trace` Bland / outbound risk.** The function **auto-invokes `re-trigger-bland-campaign`** when phones are found (lines 132–142). An enrichment function can therefore start outbound calling with no operator action, outside the outreach switchboard. Nothing has fired to date (`bland_call_triggered = 0`), but the path exists and is a P0 removal.

7. **Legacy `/realestate/*` and `/real-estate/*` split.** Two real-estate front ends over two different data models. `/real-estate/*` (12 pages, `re_leads`) is sidebar-linked and is the keeper. `/realestate/*` (8 legacy pages, reading `acquisitions_pipeline` and `leads_raw`) is still mounted in `AppRoutes.tsx` but is **not in the sidebar** — reachable by direct URL only. The comment at `AppRoutes.tsx:1988` says "Legacy Real Estate routes removed"; **the comment is wrong**, the routes are mounted about 90 lines below it.

8. **Mock `scrape-leads` path.** The `scrape-leads` edge function is a mock data generator that inserts two hardcoded fake Atlanta leads into `leads_raw` (4 rows present). It is not called from any `src/` code. It writes to production tables and should be deleted or explicitly quarantined.

9. **Undocumented pool classification.** `sf_pool_map` (39 rows) is real classification data with no definition in code, comments or documentation. Everything in §2 is inferred from source-name spelling.

10. **Attorney layer is not enforceable.** `sf_attorney_jurisdiction` has 0 rows and `surplus_funds_attorneys` has 1 row named "test", so the 31 bar-verified recruiting records are bound to nothing the application can check.

11. **No schedule visibility.** County scrapers run on an external Railway Python service outside this repository. No `pg_cron` job exists for surplus or real estate, so the OS has no view of the schedule.

12. **FL Sumter column misalignment.** 1 reject: `invalid input syntax for type date: "Burney"` — a name landing in a date column. Same parser family as Cobb.

---

## 7. Execution Priority

### P0 — Repair existing broken work

| # | State / Lane | Task | Dependency | Expected output | Legal / source dependency |
|---|---|---|---|---|---|
| 1 | All / all | Fix `consecutive_failures` accounting in `scraper-ingest` so row-level rejects count as failures | None | Honest monitoring; a 100 %-reject source reads as failing | None |
| 2 | GA / lane 1 | Alias `date_of_sale` → `sale_date` in `scraper-ingest`; backfill the 30 preserved reject payloads | Item 1 (to prove the fix) | Cobb foreclosure flowing again; 30 rows recovered | Confirm with Cobb sheriff/clerk whether the sale date is published under a different label |
| 3 | FL / lane 1 | Fix the Sumter column misalignment (`"Burney"` into a date) | None | Clean FL rejects | None |
| 4 | All / all | Remove the auto-`re-trigger-bland-campaign` call from `re-skip-trace` | None | Enrichment can no longer initiate outbound calling | None — this is a compliance repair |

### P1 — Unlock already-collected data

| # | State / Lane | Task | Dependency | Expected output | Legal / source dependency |
|---|---|---|---|---|---|
| 5 | FL + IL / lanes 1, 2 | Amount mapping for FL Brevard (72) and IL McHenry (111) | Source re-inspection | +183 promoted leads in already-live states | None |
| 6 | OK + SC / lane 1 | Map the case/sale-number column in the Tulsa and York scrapers | Source-access answers (§8) | +283 leads, or a documented "the source does not publish it" | County clerk / tax office confirmation |
| 7 | MN / lane 1 | Lane-scoped identity rule: `case_number` OR (`parcel_id` / `property_address` + `claimant_name`) | Ching confirmation + county confirmation | +20 leads and a reusable rule for parcel-keyed states | County tax office: is a case number issued at all? |
| 8 | NJ / lanes 1, 2 | Resolve the missing-amount question for 259 rows | Source re-read must come first | Promote, or formally park with a reason | State authority / clerk: does the list publish per-claim amounts? |
| 9 | All | Write down the pool definitions; add a lane column to `surplus_funds_leads` | Ching answers on pools and Ohio | Lanes become queryable facts instead of inferred spelling | None |

### P2 — Finish partial state coverage

| # | State / Lane | Task | Dependency | Expected output | Legal / source dependency |
|---|---|---|---|---|---|
| 10 | All live states | **Address capture at scrape time** (per-source Railway scraper work) | P0 stable | Skip-trace-ready population rises from 3.8 % | None |
| 11 | All live states | Build `sf-skip-trace`: table-scoped to `surplus_funds_leads`, no auto-campaign trigger, eligibility view `v_sf_skip_trace_ready`, `sf_skip_trace_attempts` ledger, dry-run default, hard budget cap, state/lane allow-list, suppression check against `dnc_list` / `opt_out_events` | Item 10, plus legal clearance per state | Callable leads — in cleared states only | Per-state legal clearance before any state is enabled |
| 12 | FL, GA, TX, OH | County expansion inside proven states — FL 59 remaining, GA Fulton absent, TX Harris/Bexar/Travis absent, OH 79 remaining | P0/P1 stable | Depth where the process already works | Source-access questions per county |
| 13 | All / support | Make the attorney layer real: populate `sf_attorney_jurisdiction`, replace the "test" attorney, gate case creation on a verified jurisdiction match | September attorney calls | Recruiting output becomes usable instead of inert | Bar verification per jurisdiction |
| 14 | All | Build the downstream stages: cases → contracts → payments (all currently 0) | Counsel-approved contract language | An actual revenue path | Fee-cap disclosure, contingency template, IOLTA/trust handling |

### P3 — Expand remaining states

| # | State / Lane | Task | Dependency | Expected output | Legal / source dependency |
|---|---|---|---|---|---|
| 15 | New states | Produce a repeatable per-state checklist (source → ingest → promote → address → trace → legal → attorney) **before** adding any state | Items 1–13 | The checklist itself is the first deliverable, not the next state | Per-state legal posture |
| 16 | New states | Add states one at a time against that checklist | Item 15 | Controlled expansion | Per-state |
| 17 | Legacy cleanup | Resolve `/realestate/*`, `scrape-leads` and `leads_raw`; correct the wrong comment at `AppRoutes.tsx:1988` | Ching decision on the real-estate lanes | One real-estate data model | None |
| 18 | UNKNOWN | Investigate the `XX` state code on 1 `scraper_state` row | None | One unmapped source explained | None |

No hour estimates are given — no evidence in the system supports them.

---

## 8. September Lawyer / Authority Call Preparation

**No one has been contacted. This is preparation material only.**

### Legal / licensing questions

| State | Lane | Question | Why It Matters | Current Evidence | Technical / Legal / Source Access | Who Should Answer |
|---|---|---|---|---|---|---|
| FL | 1 | Does F.S. 197.582 require registration as a surplus-recovery agent, and what is the fee cap? | FL has our best phone coverage (343) — it is the first state we could realistically call | 2,196 leads · $32.16M | Legal | Lawyer |
| NY | 2, 3 | Are third-party surplus-recovery contracts enforceable in NY, and does the Nassau escheat process allow an agent? | Blocks all 159 NY leads entirely | 146 + 13 rows · $5.00M | Legal | Lawyer |
| OH | 2 | Excess-funds claim window, who may file, is assignment permitted, is there a fee cap? | Largest pool in the system | 12,592 leads · $49.40M | Legal | Lawyer / clerk of court |
| MS | 1 | Chancery-clerk excess process; statewide vs Hinds-specific; assignment legality | 10,229 leads at $136 average — we need to know whether a claim is even economic | $1.39M | Legal | Lawyer / chancery clerk |
| TX | 1 | Excess-proceeds petition process, the 2-year window, and whether the 10 % fee cap is statutory | 826 leads are unpriceable without the cap | $14.57M | Legal | Lawyer |
| GA | 1 | Excess-funds distribution and interpleader practice; does claim preparation risk unlicensed practice? | 406 leads, and the state is currently BROKEN at ingest | $11.93M | Legal | Lawyer |
| IN | 2 | Tax-sale surplus claim window and assignment legality | 72 leads | $0.37M | Legal | Lawyer |
| IL | 2 | Claim window and assignment legality | 70 leads, highest phone coverage rate | $2.03M | Legal | Lawyer |
| CO | 2 | Public-trustee overbid rules and claim window | 21 leads | $1.34M | Legal | Lawyer / public trustee |
| NJ, OK, SC, MN | 1, 2 | Are these states worth pursuing at all before we invest in unblocking them? | 562 blocked rows and unknown source completeness | §5 | Legal + source | Lawyer |
| ALL | 1, 2, 3 | Fee-cap disclosure language, contingency-agreement template, IOLTA / trust handling | No contract can be sent until this exists; contracts table = 0 | 0 contracts | Legal | Lawyer |
| ALL | 1, 2, 3 | TCPA posture for calling claimants — is a claimant on a public list a "customer"? | 259 rows already flagged `dnc`; no calling may start without this | `dnc` flag | Legal | Lawyer |

### Source-access questions

| State | Lane | Question | Why It Matters | Current Evidence | Technical / Legal / Source Access | Who Should Answer |
|---|---|---|---|---|---|---|
| NJ | 1, 2 | Does the published escheat / foreclosure list include a per-claim amount anywhere? | 259 rows are blocked purely on missing amounts | 100 % null/≤0 `surplus_amount` | Source access | State authority / clerk |
| OK | 1 | Does the Tulsa excess list publish a case or sale number in another column or a linked page? | 163 rows blocked on one identifier | 100 % empty `case_number` | Source access | Clerk / tax office |
| SC | 1 | Is there an identifier for York County overages other than the overage row itself? | 120 rows blocked | 100 % empty `case_number` | Source access | Clerk |
| MN | 1 | Is a court case number issued at all, or is the parcel the identifier? | Determines whether our validation gate is simply wrong | 10 of 20 rows carry `property_address` | Source access | County tax office (Hennepin / Ramsey / Stearns) |
| GA | 1 | Does the Cobb foreclosure list publish the sale date under a different label than we parse? | 30 rows lost per run | `raw_scraper_leads_rejects` | Technical + source | Sheriff / clerk |
| FL | 1 | Is bulk or API access available rather than page scraping? | Would make 59 remaining counties tractable | 8 of 67 counties built | Source access | Clerk of court |
| ALL live | 1, 2 | Do the published lists carry the owner's mailing address? | 96 % of the universe cannot be skip-traced for want of an address | 1,228 of 26,571 have any address | Source access | County clerks |

### Technical questions — internal, no lawyer needed

Cobb field alias · `consecutive_failures` accounting · Brevard and McHenry amount mapping · Sumter column alignment · address capture at scrape time · `sf-skip-trace` design · lane column · empty `sf_attorney_jurisdiction` · the "test" attorney row · legacy route disposition · the `XX` state code.

---

## 9. Decisions Needed From Ching

1. **`the other 2` — UNRESOLVED.** Prior scope refers to six lanes. Live evidence supports **three surplus lanes** (tax-deed surplus, foreclosure surplus, escheat), **two near-empty real-estate lanes** (foreclosure property leads at 107 rows, pre-foreclosure at 1 row), and **one supporting workstream** (attorney recruiting). We have not invented a sixth. **What are the other 2 meant to be?**

2. **Pools A, B and C — confirm or correct.** We infer A = tax-deed surplus, B = foreclosure surplus, C = escheat, from holder type and source naming only. There is no written definition anywhere.

3. **Ohio: is "excess funds" the same product as "released funds"?** Both sit in pool B and are indistinguishable at row level. Affects 12,592 leads and how the call is scripted.

4. **Attorney recruiting — confirm the demotion to a supporting workstream** rather than a data lane.

5. **Are property acquisition (`re_leads`) and pre-foreclosure in scope for September**, or is surplus the only near-term product? Pre-foreclosure has 1 row and no ingestion.

6. **State priority order.** Volume says OH/MS; money says OH/FL; readiness says FL/IL. Which order do you want built?

---

## 10. Traceability / Evidence Appendix

**Verification date:** 2026-08-27. All figures were read live on that date by the two source audits. No figure in this document was re-queried; nothing was written.

### Tables

| Table | Rows | Role |
|---|---:|---|
| `surplus_funds_leads` | 26,571 | Promoted surplus leads — the working universe |
| `raw_scraper_leads` | 25,499 | Ingest landing table |
| `raw_scraper_leads_flagged` | 793 | Promotion-rejected rows (includes the 562 in §5) |
| `raw_scraper_leads_rejects` | 31 | Ingest-level rejects — GA 30, FL 1; payloads preserved |
| `re_leads` | 107 | Real-estate property leads (105 with phones) |
| `leads_raw` | 4 | Mock output of `scrape-leads` — fake Atlanta rows |
| `acquisitions_pipeline` | legacy | Legacy real-estate stage table, read by `/realestate/*` only |
| `sf_recruiting_queue` | 65 | Attorney recruiting, 22–24 jurisdictions, 31 bar-verified |
| `surplus_funds_attorneys` | 1 | Single row named "test" |
| `sf_attorney_jurisdiction` | 0 | Empty — nothing is enforceable |
| `sf_pool_map` | 39 | Source → pool mapping, **no definitions** |
| `scraper_state` | 52 sources | Per-source health (see defect 2) |
| `scraper_runs` | 125 | Run history |
| Downstream: cases, contracts, payments, inquiries, attorney assignments, callback tasks, retainer artifacts | **0 each** | Nothing has left the lead stage |

### Scrapers / functions

| Component | Location | Status |
|---|---|---|
| County scrapers | **External Railway Python service — not in this repository** | Runs outside the OS; the OS only sees results |
| `scraper-ingest` | Edge function | REAL. Shared secret (`x-scraper-secret`) → hash-skip → chunked upsert into `raw_scraper_leads` on `dedupe_key` → per-row retry → rejects table → writes `scraper_state` + `scraper_runs`. **Carries the `consecutive_failures` defect** |
| `promote-leads` | Edge function | REAL. Validates `surplus_amount > 0`, `case_number` present and not a date, `claimant_name` not junk → bulk insert into `surplus_funds_leads` (`status='skip_trace_pending'`, `lead_source='scraper_<source_id>'`) → failures to `raw_scraper_leads_flagged` |
| `sf-lead-import` | Edge function | REAL. Operator CSV path from SFDiscovery |
| `re-skip-trace` | Edge function | REAL, `re_leads`-only. Provider BatchSkipTracing (`BATCH_SKIP_TRACE_API_KEY`). **Auto-triggers `re-trigger-bland-campaign`** |
| `sf-skip-trace` | — | **Does not exist** |
| `scrape-leads` | Edge function | **DEAD / MOCK** — inserts fake Atlanta leads into `leads_raw`. Not called from `src/` |
| `re-trigger-bland-campaign` | Edge function | Outreach trigger. `bland_call_triggered = 0` — never fired |

### Source configs

52 sources registered in `scraper_state` across 14 source states. Naming conventions carry the only lane signal: `*_taxdeed`, `*_excess`, `*_overbid` (lane 1); `*_foreclosure`, `*_surplus`, `*_released` (lane 2); `*_escheat*` (lane 3). One row carries state code `XX` — unmapped, UNKNOWN.

### Record counts (headline)

26,682 total records · 26,571 promoted surplus leads · $118,186,489 surplus value · 444 phones (1.67 %) · 1,007 skip-trace-ready (3.8 %) · 259 `dnc` · 562 scraped-but-blocked · 793 flagged · 31 rejects · 9 populated states.

### Monitoring / jobs

- **No `pg_cron` job exists** for surplus or real estate. Scheduling lives on Railway, outside the OS — the OS has no visibility of the schedule.
- `scraper_state` is the only health surface, and it **under-reports** (defect 2).
- `scraper_runs` (125 rows) holds run history.

### Known issues carried into this document

Defects 1–12 in §6. Unresolved lane taxonomy in §2 and §9. Unverified legal posture in every state. Unknown source completeness in NJ, OK, SC, MN, and for the CO trustee sources.

### Front-end surfaces

- `/real-estate/*` — RE OS hub, 12 pages, sidebar-linked, reads `re_leads`. **This is the keeper.**
- `/realestate/*` — 8 legacy pages, still mounted in `AppRoutes.tsx` (~lines 3899–3907), **not** in the sidebar, reads `acquisitions_pipeline` + `leads_raw`. The comment at `AppRoutes.tsx:1988` claiming these were removed is incorrect.
- Surplus hub — `src/pages/surplus-funds/*`.

---

## Handling notes for the reader

This document reorganises two verified audits. It adds no new findings and resolves no open question. Where the two source documents disagreed, the corrected value from the execution-scope pass is used (notably: `dnc = true` on 259 rows, and 31 bar-verified attorneys rather than 28).

**Preserve the uncertainty.** The six-lane model is not proven. Three surplus lanes plus two thin real-estate lanes plus one supporting workstream is what the data shows. Anyone building from this should treat every UNKNOWN in the matrix as work to be scoped, not as an oversight to be quietly filled in.

**DATA CHANGES: 0 · OUTREACH / CALLS / SMS / EMAIL: 0**
