# SURPLUS / REAL ESTATE — STATE-BY-STATE SCOPE AUDIT

**Date:** 2026-08-27 · **Mode:** READ-ONLY
**OUTREACH / CALLS SENT: 0 · SMS/EMAIL SENT: 0 · PAID API CALLS: 0 · DATA CHANGES MADE: 0**

Method: live DB reads (`supabase--read_query`), source reads of `supabase/functions/*`, `src/pages/surplus-funds/*`, `src/pages/real-estate/*`, `src/routes/AppRoutes.tsx`, and `docs/audits/SURPLUS_FUNDS_OS_HUB_AUDIT.md`. Every number below is a live query result. Anything not evidenced is labelled INFERRED or DOES NOT EXIST.

---

## 1. THE EXACT SIX LANES (as they exist in the live system)

The system does **not** carry a lane label column. Lanes are reconstructed from `surplus_funds_leads.pool`, `holder_type`, and `lead_source`/`source_id` naming. The pool letters are real data (`sf_pool_map`, 39 rows) but carry **no written definition** anywhere in code or DB comments — the mapping below is INFERRED from holder type + source naming and needs Ching's confirmation.

| # | Lane | Live evidence | Rows | States |
|---|---|---|---|---|
| 1 | **Tax-sale / tax-deed surplus (overbid)** | pool A, holders `clerk_of_court`, `tax_commissioner`, `chancery_clerk`; sources `*_taxdeed`, `*_excess`, `*_overbid` | 13,657 | FL, GA, MS, TX |
| 2 | **Mortgage / judicial foreclosure surplus** | pool B, holders `clerk_of_court`, `public_trustee`; sources `*_foreclosure`, `*_surplus`, `*_released`, CO `*_overbid` | 12,901 | CO, IL, IN, NY, OH |
| 3 | **State escheat / unclaimed surplus** | pool C, holder `state_treasurer`; `ny_nassau_escheatment_manual` | 13 | NY |
| 4 | **Foreclosure leads (property, not surplus)** | `re_leads.lead_type` — 1 row `pre_foreclosure`, plus 80 `realestateapi_bulk_import` rows with no state and no lead_type | 107 total | FL, GA, TX, NY, NJ + 80 unknown |
| 5 | **Pre-foreclosure leads** | **effectively DOES NOT EXIST** — exactly 1 row (`re_leads`, FL, csv_upload). No NOD/lis-pendens ingestion anywhere. | 1 | FL |
| 6 | **Attorney-side recruiting (not a lead lane, but a separate pipeline with its own state coverage)** | `sf_recruiting_queue` | 65 | 22 jurisdictions |

Lanes 1–3 are the only ones with real volume. Lane 2 vs Lane 1 separation is only as good as the source naming — OH `*_released` and `*_excess` both sit in pool B, so "tax surplus vs foreclosure surplus" inside Ohio is **not currently distinguishable at row level**.

---

## 2. THE INGESTION MACHINE — WHAT ACTUALLY RUNS

| Component | Where | Status |
|---|---|---|
| County scrapers | **External Railway Python service, not in this repo** | Runs outside the OS; the OS only sees results |
| `scraper-ingest` | edge fn | REAL. Shared-secret (`x-scraper-secret`) → hash-skip → chunked upsert into `raw_scraper_leads` on `dedupe_key` → per-row retry → `raw_scraper_leads_rejects` → writes `scraper_state` + `scraper_runs` |
| `promote-leads` | edge fn | REAL. Validates (surplus_amount>0, case_number present, case_number not a date, claimant_name not junk) → bulk-insert into `surplus_funds_leads` (`status='skip_trace_pending'`, `lead_source='scraper_<source_id>'`) → failures to `raw_scraper_leads_flagged` |
| `sf-lead-import` | edge fn | REAL. Operator CSV path from SFDiscovery |
| `scrape-leads` | edge fn | **DEAD PATH — mock data.** Inserts two hardcoded fake Atlanta leads into `leads_raw`. Should be deleted or clearly quarantined. |
| pg_cron | `cron.job` | **No surplus or real-estate job exists.** Scheduling lives on Railway, outside the OS — so from inside the OS there is no visibility of the schedule. |

Volumes: `raw_scraper_leads` 25,499 · unpromoted **0** (backlog clear) · flagged **793** · rejects **31** · `surplus_funds_leads` 26,571 · `scraper_runs` 125 · `scraper_state` 52 sources.

---

## 3. 50-STATE MATRIX

Statuses: **LIVE** = promoted leads + monitored source. **INGESTED-BLOCKED** = source configured and pulling, but 100% of rows fail validation → 0 usable leads. **BROKEN** = source configured, ingest erroring. **RECRUIT-ONLY** = attorney pipeline presence only. **NONE** = nothing exists.

### LIVE (9 states — the entire working universe)

| State | Lane | Leads | Counties | Phones | Surplus $ | First → Last |
|---|---|---:|---:|---:|---:|---|
| OH | 2 foreclosure surplus | 12,592 | 9 | 4 | $49.4M | 07-22 → 08-14 |
| MS | 1 tax surplus | 10,229 | 1 (Hinds) | 0 | $1.4M | 08-13 |
| FL | 1 tax surplus | 2,196 | 8 | 343 | $32.2M | 07-10 → 08-24 |
| TX | 1 tax surplus | 826 | 6 | 0 | $14.6M | 07-13 → 08-17 |
| GA | 1 tax surplus | 406 | 4 | 56 | $11.9M | 07-14 → 07-27 |
| NY | 2 + 3 | 146 + 13 | 2 + 1 | 0 | $2.9M + $2.1M | 07-18 → 08-19 |
| IN | 2 | 72 | 1 (Allen) | 0 | $0.4M | 08-19 |
| IL | 2 | 70 | 1 (Will) | 41 | $2.0M | 07-27 |
| CO | 2 | 21 | 2 | 0 | $1.3M | 08-13 |

Total promoted: **26,571 leads / ~$118M surplus / 444 phones (1.7%)**.

### INGESTED-BLOCKED (4 states — money already spent scraping, zero usable output)

| State | Source | Raw rows | Promoted | Flag reason |
|---|---|---:|---:|---|
| NJ | `nj_trust_fund_escheat_manual` (130), `nj_statewide_foreclosure` (129) | 259 | **0** | missing or non-positive surplus_amount |
| OK | `ok_tulsa_excess` | 163 | **0** | missing case_number |
| SC | `sc_york_overage` | 120 | **0** | missing case_number |
| MN | Hennepin/Stearns/Ramsey/Pine surplus | 20 | **0** | missing case_number |

This is the single biggest quick win: 562 scraped rows that are one field-mapping fix away from being leads.

### BROKEN (1 source)

- **GA / Cobb — `ga_cobb_foreclosure`**: 30 rows rejected every run.
  Exact error: `Could not find the 'date_of_sale' column of 'raw_scraper_leads' in the schema cache`.
  Root cause confirmed: the table column is **`sale_date`**; the Railway scraper posts **`date_of_sale`**. Fix belongs in the scraper payload (or an alias in `scraper-ingest`), not in the DB. `consecutive_failures` still reads 0, so **the monitor does not treat this as a failure** — it has been silently rejecting since 2026-08-24.
- **FL / Sumter — `fl_sumter_taxdeed`**: 1 reject, `invalid input syntax for type date: "Burney"` (column misalignment).

### RECRUIT-ONLY (attorney pipeline, no leads)

VA(8), NJ(7), MD(7), GA(4), NY(4), NC(6), NV, MN, CO, CA, OH, SC, FL, TN, MS, IL, AZ, MI, MO, PA, KY, DC — 65 records. 28 are `bar_verified` (VA, NJ, MD, GA, NY, NC); the rest `identified`. **`sf_attorney_jurisdiction` = 0 rows**, so none of this verification is bound to a jurisdiction record the app can enforce against. `surplus_funds_attorneys` = **1 row, named "test"**.

### NONE (the remaining 37 states)

AL, AK, AZ*, AR, CA*, CT, DE, HI, ID, IA, KS, KY*, LA, ME, MD*, MA, MI*, MO*, MT, NE, NV*, NH, NM, NC*, ND, OR, PA*, RI, SD, TN*, UT, VT, VA*, WA, WV, WI, WY — no sources, no leads. (* = attorney recruiting presence only.)

---

## 4. WHAT IS DEAD OR DUPLICATED

1. `scrape-leads` — mock data generator writing fake leads to `leads_raw` (4 rows). Dead path, should be removed.
2. Two real-estate front ends: `/real-estate/*` (RE OS hub, current) and `/realestate/*` (legacy department pages, still routed, reading `acquisitions_pipeline` + `leads_raw`). Two UIs over two different data models.
3. Pool letters with no definition — real classification, zero documentation.
4. `scraper_state.consecutive_failures` does not increment on row-level rejects → a source can reject 100% of rows and still read healthy.
5. Downstream surplus tables all empty: cases 0, contracts 0, payments 0, inquiries 0, attorney assignments 0, callback tasks 0, retainer artifacts 0, `bland_call_triggered` **0**.
6. Skip-trace: `re-skip-trace` is hardcoded to `re_leads`. There is **no `sf-skip-trace`**. The 444 surplus phones came in with the source data, not from enrichment.

---

## 5. LAWYER / AUTHORITY CALL PREP (September)

Per LIVE state, what a lawyer must confirm before any of this is workable:

| State | Ask |
|---|---|
| OH (12,592) | Excess-funds claim window and who may file; is a third-party recovery agreement permitted, and is there a fee cap? |
| MS (10,229 Hinds) | Chancery-clerk excess process; statewide vs county rules; assignment legality |
| FL (2,196) | Tax-deed surplus: 12-month/registry rules, F.S. 197.582 fee caps, the surplus-recovery-agent registration requirement |
| TX (826) | Excess proceeds petition process, 2-year window, statutory 10% fee cap |
| GA (406) | Excess funds distribution, interpleader practice, unlicensed-practice risk on claim prep |
| NY (146 + 13) | Foreclosure surplus referee process + Nassau escheatment; NY restrictions on surplus-recovery contracts |
| IN / IL / CO (163 combined) | Tax-sale surplus claim windows; CO public-trustee overbid rules |
| NJ / OK / SC / MN | Whether they are worth unblocking at all before the field fix |

Also needed from counsel, not per-state: fee-cap disclosure language, contingency-agreement template, IOLTA/trust handling, and TCPA posture for calling claimants (`surplus_funds_leads.dnc` exists and is documented as a hard never-dial flag; 4 rows are `do_not_contact`).

---

## 6. RECOMMENDED BUILD ORDER (not executed)

1. Fix `date_of_sale` → `sale_date` in the Cobb scraper payload; make `scraper_state` count row-level rejects as failures so this can never go quiet again.
2. Unblock NJ/OK/SC/MN — 562 rows blocked on two field mappings (`case_number`, `surplus_amount`).
3. Write the pool definitions down and confirm with Ching; add a lane column so tax vs foreclosure surplus is queryable, not inferred from source names.
4. Build `sf-skip-trace` — 98.3% of the universe has no phone, so nothing downstream can move.
5. Attorney layer: populate `sf_attorney_jurisdiction`, replace the "test" attorney, and gate case creation on a verified jurisdiction match — ready for the September calls.
6. Delete `scrape-leads`; decide the fate of the legacy `/realestate/*` pages.
7. Only then: cases → contracts → payments, all of which are still at zero.
