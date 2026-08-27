# SURPLUS / REAL ESTATE — STATE EXECUTION SCOPE (PHASE 2)

**Date:** 2026-08-27 · **Mode:** READ / ORGANIZE ONLY
**DATA CHANGES: 0 · OUTREACH / CALLS: 0 · SMS/EMAIL: 0 · PAID API CALLS: 0 · PAID SKIP TRACE: 0**

Base: `docs/audits/SURPLUS-REALESTATE-STATE-SCOPE-AUDIT-2026-08-27.md`. Every figure below was re-queried live today; where this pass corrects the earlier audit it is marked **[CORRECTED]**.

---

## 1. CURRENT VERIFIED TOTALS

| Metric | Value |
|---|---|
| TOTAL SURPLUS / REAL ESTATE RECORDS | **26,682** (26,571 surplus leads + 107 `re_leads` + 4 `leads_raw` mock) |
| TOTAL STATES (with promoted surplus leads) | **9** (OH, MS, FL, TX, GA, NY, IN, IL, CO) |
| TOTAL SURPLUS VALUE | **$118,186,489** |
| ROWS WITH PHONE (surplus) | **444** |
| PHONE COVERAGE % (surplus) | **1.67 %** |
| ROWS WITH PHONE (`re_leads`) | 105 of 107 (98 %) |

### By pipeline / pool / table — not combined

| Table / pool | Rows | States | Surplus $ | Phones | Notes |
|---|---:|---|---:|---:|---|
| `surplus_funds_leads` pool **A** | 13,657 | FL, GA, MS, TX | $60.05M | 399 | FL 2,196 · MS 10,229 · TX 826 · GA 406 |
| `surplus_funds_leads` pool **B** | 12,901 | CO, IL, IN, NY, OH | $56.01M | 45 | OH 12,592 · NY 146 · IN 72 · IL 70 · CO 21 |
| `surplus_funds_leads` pool **C** | 13 | NY | $2.13M | 0 | escheat, `state_treasurer` |
| `raw_scraper_leads` | 25,499 | 14 source states | — | — | ingest landing table |
| `raw_scraper_leads_flagged` | 793 | — | — | — | promotion-rejected |
| `raw_scraper_leads_rejects` | 31 | GA(30), FL(1) | — | — | ingest-level rejects |
| `re_leads` | 107 | FL,GA,NY,TX,NJ + 80 null-state | — | 105 | property leads, not surplus |
| `leads_raw` | 4 | GA (fake Atlanta) | — | — | mock output of `scrape-leads` |
| `sf_recruiting_queue` | 65 | 22 jurisdictions | — | — | attorney recruiting |
| `sf_pool_map` | 39 | — | — | — | source→pool map, **no definitions** |
| `surplus_funds_attorneys` | 1 | — | — | — | row named "test" |
| `sf_attorney_jurisdiction` | 0 | — | — | — | empty |

Downstream (cases, contracts, payments, inquiries, assignments, callbacks, retainers, `bland_call_triggered`) = **0 across the board**. Nothing has left the lead stage.
`dnc = true` on **259** surplus leads [CORRECTED — earlier audit said 4 `do_not_contact`; that was a status value, `dnc` flag is 259].

---

## 2. CANDIDATE SIX-LANE TAXONOMY

Pool letters A/B/C are real data with **zero written definition**. The lane mapping is INFERRED from `holder_type` + `lead_source` naming. Not final.

### Lane 1 — Tax-deed / tax-sale surplus (overbid / excess funds)
- LIVE TABLE(S): `surplus_funds_leads` (pool A), `raw_scraper_leads`
- ROW COUNT: 13,657 · $60.05M · 399 phones
- STATES: FL (2,196), MS (10,229), TX (826), GA (406)
- PURPOSE: recover overbid from tax sales for the former owner
- SOURCE TYPE: public county records (clerk of court, chancery clerk, tax commissioner), scraped
- LIVE EVIDENCE: holders `clerk_of_court`/`chancery_clerk`/`tax_commissioner`; sources `*_taxdeed`, `*_excess`, `*_overbid`
- LEAD PIPELINE or SUPPORT: **lead pipeline**
- CONFIDENCE: **HIGH** · NEEDS CHING: **NO**
- QUESTION: none

### Lane 2 — Mortgage / judicial foreclosure surplus
- LIVE TABLE(S): `surplus_funds_leads` (pool B)
- ROW COUNT: 12,901 · $56.01M · 45 phones
- STATES: OH (12,592), NY (146), IN (72), IL (70), CO (21)
- PURPOSE: surplus after a foreclosure sale exceeds the debt
- SOURCE TYPE: public — clerk of court, CO public trustee
- LIVE EVIDENCE: sources `*_foreclosure`, `*_surplus`, `*_released`, `*_overbid` (CO)
- LEAD PIPELINE or SUPPORT: **lead pipeline**
- CONFIDENCE: **MEDIUM** — Ohio mixes `*_excess` and `*_released` in the same pool, so tax-vs-foreclosure origin is **not distinguishable at row level** inside OH
- NEEDS CHING: **YES**
- QUESTION: is Ohio "excess funds" the same lane as Ohio "released funds", or two products?

### Lane 3 — State escheat / unclaimed funds
- LIVE TABLE(S): `surplus_funds_leads` (pool C)
- ROW COUNT: 13 · $2.13M · 0 phones
- STATES: NY (Nassau) only
- SOURCE TYPE: state treasurer, manual
- LEAD PIPELINE or SUPPORT: **lead pipeline (unproven at this volume)**
- CONFIDENCE: **LOW** — 13 rows from one manual load is not a pipeline
- NEEDS CHING: **YES** — is escheat a real product line or an experiment?

### Lane 4 — Foreclosure property leads (acquisition, not recovery)
- LIVE TABLE(S): `re_leads`
- ROW COUNT: 107 (80 = `realestateapi_bulk_import` with **no state and no lead_type**; 26 csv `Owner`; 1 pre-foreclosure)
- STATES: GA 9, NY 6, TX 7, NJ 2, FL 2 + 80 unknown
- SOURCE TYPE: paid API (RealEstateAPI) + operator CSV
- LEAD PIPELINE or SUPPORT: **lead pipeline, barely seeded**
- CONFIDENCE: **MEDIUM** · NEEDS CHING: **YES**
- QUESTION: is property acquisition still in scope for September, or is surplus the only near-term product?

### Lane 5 — Pre-foreclosure leads
- LIVE TABLE(S): `re_leads` (`lead_type='pre_foreclosure'`)
- ROW COUNT: **1** (FL, csv_upload)
- SOURCE TYPE: none — no NOD / lis-pendens ingestion exists anywhere
- LEAD PIPELINE or SUPPORT: **does not exist yet**
- CONFIDENCE: **HIGH that it does not exist** · NEEDS CHING: **YES** — keep as a lane or drop?

### Lane 6 candidate A — Attorney recruiting
- LIVE TABLE(S): `sf_recruiting_queue` (65), `surplus_funds_attorneys` (1 = "test"), `sf_attorney_jurisdiction` (0)
- STATES: 24 jurisdictions; `bar_verified` in VA 8, NJ 7, MD 5, GA 4, NY 4, NC 3 (31 verified) [CORRECTED — 31, not 28]
- PURPOSE: obtain licensed counsel per jurisdiction so claims can be filed
- LEAD PIPELINE or SUPPORT: **SUPPORTING / LEGAL-ENABLEMENT WORKSTREAM — not a business data lane.** It produces no claimants, no surplus value, no revenue record; it gates lanes 1–3. It also has the wrong shape for a lane: no state coverage of leads, no promotion path, no downstream case.
- CONFIDENCE: **HIGH** that it is support, not a lane · NEEDS CHING: **YES** (confirm the demotion)

### Lane 6 candidate B — the better-supported sixth lane already in the system
- **Ingested-but-blocked surplus (NJ / OK / SC / MN)** is *not* a lane, it is a state of lane 1/2 rows.
- Searching code and data for any other candidate with its own table + rows: nothing qualifies. `leads_raw` is mock. `acquisitions_pipeline` is the legacy RE model (see §8) and is a *stage* table, not a lane.
- **Conclusion: there is no evidenced sixth lane.** There are five candidate data lanes (two of them near-empty) plus one support workstream. Do not invent a sixth.

---

## 3. 50-STATE MASTER MATRIX

Statuses: COMPLETE · PARTIAL · SOURCE_IDENTIFIED_NOT_BUILT · SCRAPED_NOT_PROMOTED · BROKEN · BLOCKED · PRIVATE_SOURCE_REQUIRED · NOT_STARTED · UNKNOWN.
No state is COMPLETE. Rows exist ≠ complete.

### A. States with promoted leads

| State | Lane | Rows | Surplus $ | Ph | Ph% | Source identified | Source name | Pub/Priv | Level | Counties built | Counties remaining | Scraper/fn | Last proven run | Run status | Promotion | Skip trace | Legal | Blocker | Next technical action | Ching? | Lawyer? | Trace |
|---|---|---:|---:|---:|---:|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| OH | 2 | 12,592 | $49.40M | 4 | 0.03% | YES | 11 `oh_*` sources | Public | County | 9 (Cuyahoga 11,688; Montgomery 389; Franklin 278; Medina 136; Butler 61; Coshocton 18; Greene 16; Adams 3; Crawford 3) | 79 of 88 | Railway + `scraper-ingest` | 2026-08-25 | PARTIAL (22 Cuyahoga rows flagged) | PARTIAL | NOT_STARTED | UNKNOWN | no phones; tax-vs-foreclosure indistinguishable | build `sf-skip-trace`; add lane column | YES | YES | `scraper_state`, `surplus_funds_leads` |
| MS | 1 | 10,229 | $1.39M | 0 | 0% | YES | `ms_hinds_excess` | Public | County | 1 (Hinds) | 81 | Railway | 2026-08-13 | PARTIAL (2 junk-name flags) | PARTIAL | NOT_STARTED | UNKNOWN | single county, zero phones, avg $136/record | verify record value before spending on trace | YES | YES | `scraper_state` |
| FL | 1 | 2,196 | $32.16M | 343 | 15.6% | YES | 8 `fl_*` sources | Public | County | 8 (Marion 762; Lee 686; Brevard 232; Osceola 231; Sumter 127; St. Lucie 90; Hillsborough 54; Collier 14) | 59 of 67 | Railway | 2026-08-24 | PARTIAL (Brevard 72 flagged; Sumter 1 reject) | PARTIAL | PARTIAL (source-supplied phones only) | BLOCKED — surplus-recovery-agent registration | Brevard amounts missing | fix Brevard amount mapping; Sumter column alignment | NO | YES | rejects + flagged tables |
| TX | 1 | 826 | $14.57M | 0 | 0% | YES | 7 `tx_*` sources | Public | County | 6 (Nueces 312; Dallas 187; Fort Bend 141; Galveston 139; Denton 44; Tarrant 3) | 248 | Railway | 2026-08-24 | PARTIAL (3 Nueces flagged) | PARTIAL | NOT_STARTED | UNKNOWN — 10% statutory cap assumed, unverified | no phones | skip trace | NO | YES | live query |
| GA | 1 | 406 | $11.93M | 56 | 13.8% | YES | 5 `ga_*` sources | Public | County | 4 (DeKalb 227; Clayton 109; Gwinnett 60; Cobb 10) | 155 | Railway | 2026-08-24 | **BROKEN** (Cobb foreclosure 30/run rejected; Cobb excess 21 flagged) | PARTIAL | PARTIAL | UNKNOWN | §6 Cobb field mismatch | fix `date_of_sale`→`sale_date` | NO | YES | `raw_scraper_leads_rejects` |
| NY | 2 + 3 | 146 + 13 | $2.87M + $2.13M | 0 | 0% | YES | Franklin 106, Broome 40, Nassau 13 | Public | County + State | 3 | 59 | Railway + manual | 2026-08-19 | PARTIAL | PARTIAL | NOT_STARTED | BLOCKED — NY restricts surplus-recovery contracts | legal posture unknown | hold until counsel | YES | YES | live query |
| IN | 2 | 72 | $0.37M | 0 | 0% | YES | `in_allen_foreclosure` | Public | County | 1 (Allen) | 91 | Railway | 2026-08-25 | OK | PARTIAL | NOT_STARTED | UNKNOWN | single county | expand counties after P0/P1 | NO | YES | live query |
| IL | 2 | 70 | $2.03M | 41 | 58.6% | YES | Will (promoted), McHenry (111 flagged) | Public | County | 1 of 2 attempted | 100 | manual ingest | 2026-07-27 | PARTIAL | SCRAPED_NOT_PROMOTED (McHenry) | PARTIAL | UNKNOWN | McHenry missing amounts | McHenry amount mapping | NO | YES | flagged table |
| CO | 2 | 21 | $1.34M | 0 | 0% | YES | Arapahoe 15, Denver 6, Adams, Elbert | Public | County (public trustee) | 2 producing of 4 configured | 60 | Railway | 2026-08-25 | OK but thin | PARTIAL | NOT_STARTED | UNKNOWN | very low yield | verify trustee source completeness | NO | YES | `scraper_state` |

### B. Scraped, zero promoted — SCRAPED_NOT_PROMOTED

| State | Rows | Sources | Blocker | Next action | Lawyer? |
|---|---:|---|---|---|---|
| NJ | 259 | `nj_trust_fund_escheat_manual` 130, `nj_statewide_foreclosure` 129 | 100% missing/non-positive `surplus_amount` | §5 | YES |
| OK | 163 | `ok_tulsa_excess` | 100% missing `case_number` | §5 | YES |
| SC | 120 | `sc_york_overage` | 100% missing `case_number` | §5 | YES |
| MN | 20 | Hennepin 10, Stearns 6, Ramsey 4 (+ Pine source, 0 rows) | missing `case_number` (10 also missing `claimant_name`) | §5 | YES |

### C. Attorney-recruiting presence only — support workstream, no leads

VA 8, NJ 7, MD 7, NC 6, GA 4, NY 4, then 2 each: NV, MN, CO, CA, OH, SC, FL, TN, MS, IL, AZ, MI, MO, MD; 1 each: PA, KY, DC. Status **PARTIAL (support)** — `sf_attorney_jurisdiction` is empty so none of it is enforceable.

### D. NOT_STARTED — the remaining states

AL, AK, AR, CT, DE, HI, ID, IA, KS, LA, ME, MA, MT, NE, NH, NM, ND, OR, RI, SD, UT, VT, WA, WV, WI, WY — no source, no rows, no scraper. Plus AZ, CA, KY, MD, MI, MO, NC, NV, PA, TN, VA — **NOT_STARTED for leads**, attorney presence only.
`XX` appears as a state code on 1 `scraper_state` row — **UNKNOWN**, unmapped source, worth one look.

---

## 4. NINE WORKING-STATE EXECUTION CARDS

**OH** — Lanes 2. 12,592 rows · $49.40M · 0.03% phones. Sources: 11 county scrapers, 4 ran in last 7 days. Working: ingest, promotion (99.8%). Broken: none at ingest. Missing: phones, lane separation (excess vs released), any downstream case. Counties: 9 of 88; Cuyahoga is 93% of the state. **READY FOR NEXT BUILD: NO** — biggest pool in the system with 4 phones. Next: skip-trace architecture, then Cuyahoga-first.

**MS** — Lane 1. 10,229 rows · $1.39M · 0 phones. One source (Hinds chancery clerk), last run 08-13. Working: ingest+promotion. Missing: phones, additional counties. Average surplus **$136/record** — the economics of tracing this at scale are unproven. **READY: NO.** Next: Ching decides whether Hinds is worth tracing at all before any spend.

**FL** — Lane 1. 2,196 rows · $32.16M · 15.6% phones (best coverage). 8 counties, 5 ran this week. Working: most of the pipeline. Broken: Brevard (72 flagged, no amounts), Sumter (1 date/column misalignment). Missing: 59 counties, agent registration clarity. **READY: NO — closest to ready.** Next: fix Brevard mapping; confirm F.S. 197.582 registration with counsel.

**TX** — Lane 1. 826 rows · $14.57M · 0 phones. 6 counties of 254. Working: ingest. Missing: phones, county breadth. **READY: NO.** Next: skip trace + county expansion (Harris, Bexar, Travis absent).

**GA** — Lane 1. 406 rows · $11.93M · 13.8% phones. **BROKEN** — Cobb foreclosure rejects every row (§6); Cobb excess 21 flagged. Counties: 4 of 159, and Fulton is absent. **READY: NO.** Next: §6 fix.

**NY** — Lanes 2 + 3. 159 rows · $5.00M · 0 phones. Franklin, Broome, Nassau. Missing: downstate entirely; legal posture on surplus-recovery contracts is the hard gate. **READY: NO.** Next: counsel first, build second.

**IN** — Lane 2. 72 rows · $0.37M · 0 phones. Allen county only, running 08-25. Working end-to-end, just tiny. **READY: NO (thin).** Next: Marion/Lake counties.

**IL** — Lane 2. 70 rows · $2.03M · 58.6% phones (highest %). Will promoted; McHenry's 111 rows all flagged for missing amount. No run since 07-27. **READY: NO.** Next: McHenry amount mapping — 111 rows recovered for one field fix.

**CO** — Lane 2. 21 rows · $1.34M · 0 phones. 4 public-trustee sources configured, 2 produced rows. **READY: NO.** Next: verify the trustee sources are actually returning full result sets, not empty pages.

---

## 5. 562 SCRAPED-BUT-BLOCKED ANALYSIS

Important correction: these rows **were run through `promote-leads`** — `promoted_at` is stamped and they sit in `raw_scraper_leads_flagged`. They were rejected by validation, not skipped. Nothing was promoted.

| | NJ (259) | OK (163) | SC (120) | MN (20) |
|---|---|---|---|---|
| ROWS SCRAPED | 130 escheat + 129 foreclosure | 163 | 120 | 10 Hennepin / 6 Stearns / 4 Ramsey |
| SOURCE | NJ trust-fund escheat (manual) + statewide foreclosure | Tulsa County excess | York County overage | 3 county surplus lists |
| WHY PROMOTION FAILED | `surplus_amount` null or ≤ 0 on 100% | `case_number` empty on 100% | `case_number` empty on 100% | `case_number` empty on 100%; 10 also lack `claimant_name` |
| MISSING FIELD | `surplus_amount` | `case_number` | `case_number` | `case_number` (+ name) |
| AVAILABLE FROM SOURCE? | **UNKNOWN** — must re-read the published list. An escheat list may genuinely publish no per-claim amount. | **LIKELY** — Tulsa excess lists normally carry a case/sale number; suspect a column-mapping miss. | **LIKELY** — same pattern. | **UNLIKELY for all** — MN surplus lists are often parcel-keyed, not case-keyed. 10 of 20 rows do carry `property_address`. |
| TRULY REQUIRED FOR THIS LANE? | Amount is required — a surplus lead with no amount cannot be valued or prioritised. **Gate is valid.** | Case number is the claim identifier for a court-held fund. **Valid for foreclosure surplus.** | Same. | **Gate is too strict here** — a county-held tax surplus keyed by parcel has no court case number. `parcel_id`/`property_address` should satisfy identity. |
| RETAIN AS PARTIAL LEADS? | Yes, as unvalued research rows — never as callable leads. | Yes. | Yes. | Yes — these are the strongest candidates for a relaxed gate. |
| CURRENT LOCATION | `raw_scraper_leads` (promoted_at set) + `raw_scraper_leads_flagged` | same | same | same |
| RECOMMENDED FIX | Re-inspect source layout before touching validation. Do **not** default amounts to 0. | Map the source's case/sale column in the Railway scraper. | Same. | Introduce an identity rule: `case_number` **OR** (`parcel_id`/`property_address` + `claimant_name`), lane-scoped. |
| RISK | Fabricating amounts poisons prioritisation and any claim math. | Wrong identifier = wrong claim filed. | Same. | Relaxing globally would let junk into OH/MS; must be per-lane, per-source. |

Nothing promoted in this pass.

---

## 6. GA COBB FAILURE PLAN

- **ROOT CAUSE:** the Railway Cobb foreclosure scraper posts a field named `date_of_sale`; `raw_scraper_leads` has **`sale_date`** (confirmed in `information_schema`). PostgREST returns `PGRST204 — Could not find the 'date_of_sale' column of 'raw_scraper_leads' in the schema cache`, and every row in the batch fails.
- **AFFECTED FUNCTION:** `scraper-ingest` (per-row retry path) · **source_id** `ga_cobb_foreclosure`
- **AFFECTED TABLE:** `raw_scraper_leads` (write target); failures land in `raw_scraper_leads_rejects`
- **ROWS CURRENTLY LOST:** 30 per run, all 30 rejects in the table dated up to 2026-08-22; source last ran 2026-08-24 and still shows the same 30-row error in `scraper_state.last_error`. Cumulative loss is unmeasurable from inside the OS because rejects dedupe on the same rows.
- **MONITORING BUG:** `scraper-ingest` writes `consecutive_failures: 0` **unconditionally** on every completed HTTP call (line ~136), regardless of how many rows were rejected. A source can reject 100% of its rows forever and read healthy. This is the systemic defect; Cobb is just the first case it hid.
- **MINIMAL SAFE FIX:** (a) accept `date_of_sale` as an alias for `sale_date` in `scraper-ingest`'s row normaliser — one mapping line, no DB change, no scraper redeploy needed; (b) set `consecutive_failures` from the actual reject count (`rejected > 0 && inserted === 0` → increment) instead of hardcoding 0.
- **BACKFILL POSSIBLE: YES** — the rejected payloads are preserved in `raw_scraper_leads_rejects.row_payload`.
- **BACKFILL SOURCE EXISTS: YES** — 30 rows locally, plus the live Cobb list re-scrapes.

Not implemented in this pass.

---

## 7. SKIP-TRACE READINESS

- **CURRENT FUNCTION(S):** `re-skip-trace` only. Provider: BatchSkipTracing (`BATCH_SKIP_TRACE_API_KEY`).
- **SUPPORTED TABLES:** `re_leads` — hardcoded at line 34 and in all four update paths.
- **UNSUPPORTED TABLES:** `surplus_funds_leads` (the entire 26,571-row universe). **No `sf-skip-trace` exists.**
- **FIELDS REQUIRED:** `first_name`, `last_name`, `property_address`, `city`, `state`, `zip`.
- **FIELDS WRITTEN:** `phone`, `email`, `skip_traced`, `status` (`new` / `dnc` / `skip_trace_failed` / `skip_trace_pending`).
- **DEDUPING:** only `skip_traced = false AND phone IS NULL`. No per-record attempt history, no cost ledger, no re-trace cooldown.
- **COST CONTROLS:** **none.** No budget cap, no dry-run, no per-run cost estimate.
- **BATCH CONTROLS:** `limit(200)`, provider batches of 25. No pacing, no resume token.
- **STATE / LANE RESTRICTIONS:** **none** — and it **auto-invokes `re-trigger-bland-campaign`** when phones are found (lines 132–142). That is an outreach trigger inside an enrichment function.
- **DNC:** honoured only via the provider's own flag; it does not consult `dnc_list` / `opt_out_events`.

**Readiness of surplus records against the required identity fields:**

| | Count | % of 26,571 |
|---|---:|---:|
| has last_name | 25,022 | 94.2% |
| has any address (`property_address` or `address`) | 1,228 | 4.6% |
| **has name AND address — skip-trace-ready** | **1,007** | **3.8%** |
| already has a phone | 444 | 1.7% |
| `skip_traced = true` | 457 | 1.7% |
| `dnc = true` (never trace, never dial) | 259 | 1.0% |

**96% of the surplus universe cannot be skip-traced today** — not for lack of a function, but for lack of an address. Building `sf-skip-trace` first would burn credits on 1,007 rows and stall. The real prerequisite is address capture at scrape time.

**Proposed safe architecture (not built):**
1. `sf-skip-trace` as a sibling of `re-skip-trace`, table-scoped to `surplus_funds_leads`, **no auto-campaign trigger** — enrichment never initiates outreach.
2. Eligibility view `v_sf_skip_trace_ready`: name + address present, `phone IS NULL`, `dnc = false`, `skip_traced = false`, lane/state allow-list.
3. `sf_skip_trace_attempts` ledger keyed on lead id + provider + attempt date: enforces one paid attempt per record, records cost, supports a hard monthly budget cap read from config, fails closed when the cap is hit.
4. `dry_run: true` default returning eligible counts and estimated cost with **zero provider calls**; explicit `confirm: true` required to spend.
5. State/lane gate so no state is traced before its legal posture is confirmed (§9).
6. Writes only `phone`, `phone_type`, `phone_carrier`, `all_phones`, `email`, `trace_provider`, `trace_completed_at`, `skip_trace_attempted_at`, `skip_traced` — columns that already exist on `surplus_funds_leads`.
7. Suppression check against `dnc_list` / `opt_out_events` before any number is marked callable.

No provider was called. No credits spent.

---

## 8. LEGACY SYSTEM TRACE

| Item | Currently referenced | Writes production data | Used by live UI | Mock/Real | Safe to deprecate later | Dependencies |
|---|---|---|---|---|---|---|
| `scrape-leads` (edge fn) | not called from any `src/` code | YES — inserted 4 fake Atlanta rows into `leads_raw` | NO | **MOCK** | YES | `leads_raw` |
| `leads_raw` (table) | read by `/realestate/leads` | 4 rows, all mock | only via legacy page | MOCK content | YES, after confirming no real import ever landed | `lead_scores`, `seller_profiles`, `acquisitions_pipeline` |
| `/realestate/*` routes (8 pages) | routed in `AppRoutes.tsx` 3899–3907 | reads only (pipeline page reads `acquisitions_pipeline`) | **NOT in the sidebar** — `Layout.tsx` links only `/real-estate/*`; reachable by direct URL only | REAL tables, orphan model | YES | `RealEstateLayout`, `acquisitions_pipeline`, `leads_raw`, `lead_scores`, `seller_profiles` |
| `/real-estate/*` (RE OS hub, 12 pages) | sidebar-linked, current | reads `re_leads` | YES | REAL | **NO — this is the keeper** | `re_leads`, `re_*` functions |
| `acquisitions_pipeline` | legacy pipeline page only | yes historically | legacy page only | REAL | needs a row count + owner decision before any move | `leads_raw`, `profiles` |
| `AppRoutes.tsx:1988` comment "Legacy Real Estate routes removed" | — | — | — | — | **the comment is wrong** — the routes are still mounted 90 lines below | — |
| `sf_pool_map` | used for classification | no | no | REAL, undocumented | no — document it instead | pool letters |
| Two invite/lead models side by side | — | — | — | — | — | resolve after Ching confirms lanes |

Nothing deleted or disabled.

---

## 9. LAWYER-CALL PREP MATRIX (September — no calls made)

### LEGAL / LICENSING QUESTIONS

| State | Lane | Question | Why it blocks | Evidence | Who answers |
|---|---|---|---|---|---|
| FL | 1 | Does F.S. 197.582 require registration as a surplus-recovery agent, and what is the fee cap? | FL has our best phone coverage (343) — it is the first state we would actually call | 2,196 leads, $32.16M | lawyer |
| NY | 2,3 | Are third-party surplus-recovery contracts enforceable in NY, and does the Nassau escheat process allow an agent? | Blocks 159 leads entirely | 146 + 13 rows | lawyer |
| OH | 2 | Excess-funds claim window, who may file, is an assignment permitted, fee cap? | Largest pool, 12,592 | $49.40M | lawyer / clerk of court |
| TX | 1 | Excess-proceeds petition process, 2-year window, is the 10% cap statutory? | 826 leads unpriceable without the cap | live query | lawyer |
| GA | 1 | Excess-funds distribution and interpleader; does claim preparation risk unlicensed practice? | 406 leads | live query | lawyer |
| MS | 1 | Chancery-clerk excess process; statewide vs Hinds-specific; assignment legality | 10,229 leads at $136 average — need to know if it is even worth a claim | $1.39M | lawyer / chancery clerk |
| IN, IL, CO | 2 | Claim windows; CO public-trustee overbid rules | 163 combined | live query | lawyer / public trustee |
| NJ, OK, SC, MN | 1,2 | Worth pursuing at all before we invest in unblocking? | 562 blocked rows | §5 | lawyer |
| ALL | 1,2,3 | Fee-cap disclosure language, contingency-agreement template, IOLTA/trust handling | No contract can be sent until this exists; contracts table = 0 | 0 contracts | lawyer |
| ALL | 1,2,3 | TCPA posture for calling claimants; is a claimant on a public list a "customer"? | 259 `dnc` rows already; no calls may start without this | `dnc` flag | lawyer |

### SOURCE-ACCESS QUESTIONS

| State | Question | Who answers |
|---|---|---|
| NJ | Does the published escheat/foreclosure list include a per-claim amount anywhere? | state authority / clerk |
| OK Tulsa | Does the excess list publish a case or sale number in another column or a linked page? | clerk / tax office |
| SC York | Same — is there an identifier other than the overage row? | clerk |
| MN (Hennepin/Ramsey/Stearns) | Is a court case number issued at all, or is the parcel the identifier? | county tax office |
| GA Cobb | Does the foreclosure list publish the sale date under a different label than we are parsing? | sheriff / clerk |
| FL (all) | Is bulk/API access available rather than page scraping? | clerk of court |

### TECHNICAL QUESTIONS (internal — no lawyer needed)

Cobb field alias · `consecutive_failures` accounting · Brevard and McHenry amount mapping · Sumter column alignment · address capture at scrape time · `sf-skip-trace` · lane column · empty `sf_attorney_jurisdiction` · the "test" attorney row · legacy route disposition.

---

## 10. BUILD ORDER

### P0 — FIX EXISTING BROKEN WORK
1. **`consecutive_failures` accounting in `scraper-ingest`.** WHY NOW: every other health judgement in this document is untrustworthy until a source that rejects 100% of rows reads as failing. COMPLEXITY: LOW. DEPENDENCY: none. OUTPUT: honest monitoring; Cobb visible without a human reading `last_error`.
2. **GA Cobb `date_of_sale` alias + backfill 30 rejects.** WHY NOW: actively losing rows every run since 08-22. COMPLEXITY: LOW. DEPENDENCY: item 1 to prove the fix. OUTPUT: Cobb foreclosure flowing, 30 rows recovered.
3. **FL Sumter column misalignment (1 reject, `"Burney"` into a date).** WHY NOW: same parser family as Cobb, cheap while in there. COMPLEXITY: LOW. OUTPUT: clean FL rejects.
4. **Remove the auto-`re-trigger-bland-campaign` call from `re-skip-trace`.** WHY NOW: an enrichment function can start outbound calling with no operator action — an outreach path outside the switchboard. COMPLEXITY: LOW. OUTPUT: enrichment cannot dial.

### P1 — UNBLOCK EXISTING DATA
5. **FL Brevard (72) and IL McHenry (111) amount mapping.** WHY NOW: 183 rows in already-live states, one field each. COMPLEXITY: LOW. DEPENDENCY: source re-inspection. OUTPUT: +183 leads.
6. **OK / SC case-number mapping.** WHY NOW: 283 rows, likely a column miss. COMPLEXITY: MEDIUM (needs source re-read). DEPENDENCY: source-access answers §9. OUTPUT: +283 or a documented "source does not publish it".
7. **MN lane-scoped identity rule (parcel/address instead of case number).** WHY NOW: the gate is probably wrong, not the data. COMPLEXITY: MEDIUM. DEPENDENCY: Ching + county confirmation. OUTPUT: +20, and a reusable rule for parcel-keyed states.
8. **NJ amount question.** WHY NOW: 259 rows, but only after we know the source publishes amounts. COMPLEXITY: UNKNOWN. DEPENDENCY: §9. OUTPUT: promote or formally park.
9. **Write down the pool definitions and add a lane column.** WHY NOW: everything in this document is inferred from source-name spelling. COMPLEXITY: LOW-MEDIUM. DEPENDENCY: Ching Q1/Q2. OUTPUT: lanes become queryable facts.

### P2 — COMPLETE PARTIAL STATES
10. **Address capture at scrape time.** WHY NOW: 96% of the universe cannot be skip-traced for want of an address; no enrichment spend makes sense before this. COMPLEXITY: MEDIUM-HIGH (per-source scraper work on Railway). OUTPUT: skip-trace-ready population rises from 3.8%.
11. **`sf-skip-trace` with the §7 ledger, dry-run and budget cap.** WHY NOW: 1.7% phone coverage is the hard ceiling on every downstream stage. COMPLEXITY: MEDIUM. DEPENDENCY: item 10 + legal clearance per state. OUTPUT: callable leads in cleared states only.
12. **County expansion inside live states** — FL (59 remaining), GA (Fulton absent), TX (Harris/Bexar/Travis absent), OH (79 remaining). COMPLEXITY: MEDIUM per county. DEPENDENCY: P0/P1 stable. OUTPUT: depth where the process is already proven.
13. **Attorney layer made real** — populate `sf_attorney_jurisdiction`, replace the "test" attorney, gate case creation on a verified jurisdiction. WHY NOW: September calls produce attorneys with nowhere to land. COMPLEXITY: MEDIUM. OUTPUT: recruiting output becomes usable.
14. **Downstream stages** (cases → contracts → payments), all currently zero. COMPLEXITY: HIGH. DEPENDENCY: counsel-approved contract language.

### P3 — NEW STATE EXPANSION
15. New states only after items 1–13. COMPLEXITY: MEDIUM each. DEPENDENCY: a repeatable per-state checklist that does not yet exist (source → ingest → promote → address → trace → legal → attorney). OUTPUT: the checklist itself is the first deliverable, not the next state.
16. Resolve legacy `/realestate/*` + `scrape-leads` + `leads_raw`. COMPLEXITY: LOW. DEPENDENCY: Ching Q4. OUTPUT: one real-estate data model.

No hour estimates — no evidence supports them.

---

## 11. QUESTIONS FOR CHING (5)

1. **What are pools A, B and C?** We infer A = tax-deed surplus, B = foreclosure surplus, C = escheat, from holder type and source naming only. Confirm or correct — and tell us what the "other 2" lanes are meant to be, because live evidence only supports three surplus lanes plus two near-empty real-estate ones.
2. **Attorney recruiting — lane or support?** Our reading: a legal-enablement workstream that gates lanes 1–3, not a data lane (no claimants, no value, no downstream). Confirm the demotion.
3. **Is Ohio "excess funds" the same product as Ohio "released funds"?** Both sit in pool B and are indistinguishable at row level. It affects 12,592 leads and how we script the call.
4. **Are property acquisition (`re_leads`) and pre-foreclosure still in scope for September, or is surplus the only near-term product?** Pre-foreclosure has exactly 1 row and no ingestion; we would rather park it than pretend.
5. **State priority order.** Code has no ranking. Volume says OH/MS; money says OH/FL; readiness says FL/IL (best phone coverage). Which order do you want us to build in?

---

## DATA CHANGES: 0
## OUTREACH / CALLS: 0
