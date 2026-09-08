# 50-State Completion Map — Surplus Funds, Mortgage Surplus, Foreclosure, Lis Pendens, Real Estate

**Prepared:** 2026-09-08 · **Type:** AUDIT ONLY
**DATA CHANGES: 0 · INGESTS RUN: 0 · SCRAPERS RUN: 0 · OUTREACH: 0 · PAID API CALLS: 0**

All figures below are live queries against the Nexus/Dynasty OS database on 2026-09-08.
Where a prior document disagrees with live data, live data wins and the disagreement is named in §7.

---

## 1. Vertical definitions and canonical tables

The database has **no vertical column**. Verticals are reconstructed from
`surplus_funds_leads.pool` + `holder_type` + `lead_source`, and from `re_leads.lead_type`.
This reconstruction is the auditor's, not the system's — see Blocker B-7.

| # | Vertical | Canonical table | Selector | Provenance fields |
|---|---|---|---|---|
| V1 | **Surplus Funds** (tax-sale / tax-deed overbid, excess funds) | `public.surplus_funds_leads` | `pool = 'A'` | `lead_source`, `holder_type`, `pool`, `raw_scraper_leads.source_url` |
| V2 | **Mortgage Surplus** (judicial/mortgage foreclosure surplus recovery) | `public.surplus_funds_leads` | `pool = 'B'` | same |
| V3 | **Foreclosure** (property acquisition leads) | `public.re_leads` | `lead_type` in `pre_foreclosure`/foreclosure | `lead_source`, `raw_payload`, `imported_batch_id` |
| V4 | **Lis Pendens / NOD** | *none exists* | — | — |
| V5 | **Real Estate** (general acquisition) | `public.re_leads` | all rows | `lead_source`, `realestateapi_property_id` |

Support tables: `raw_scraper_leads` (25,541 landing rows), `raw_scraper_leads_flagged` (796),
`raw_scraper_leads_rejects` (31), `scraper_state` (53 sources), `scraper_runs` (137),
`sf_pool_map` (39), `sf_recruiting_queue` (65), `surplus_funds_attorneys` (**1 row, named "test"**),
`sf_attorney_jurisdiction` (**0**).

Pipeline functions: `scraper-ingest`, `scrape-leads`, `sf-lead-import`, `re-lead-import`,
`re-intake-webhook`, `re-skip-trace`. **There is no `sf-skip-trace`.** There is no lis-pendens/NOD
ingestion function anywhere in `supabase/functions/`.

---

## 2. Headline live totals

| Metric | Live value |
|---|---:|
| `surplus_funds_leads` | **26,610** |
| — V1 Surplus Funds (pool A) | 13,661 |
| — V2 Mortgage Surplus (pool B) | 12,936 |
| — pool C (state escheat, NY only) | 13 |
| `re_leads` (V3 + V5) | **107** |
| Lis Pendens rows (V4) | **1** (a single FL CSV row, no source) |
| `surplus_funds_cases` / `_contracts` / `_payments` / `_inquiries` | **0 / 0 / 0 / 0** |
| Jurisdictions with any surplus lead | **9 states** (CO, FL, GA, IL, IN, MS, NY, OH, TX) |
| Jurisdictions with zero rows in every vertical | **42** (41 states + DC) |

**No state is DONE in any vertical.** Not one.

---

## 3. Completion map — 50 states + DC

Legend: **D** DONE · **P** PARTIAL · **S** SOURCE IDENTIFIED · **B** BLOCKED · **N** NOT STARTED

### 3a. States with live data

| State | V1 Surplus | V2 Mtg Surplus | V3 Foreclosure | V4 Lis Pendens | V5 Real Estate |
|---|---|---|---|---|---|
| CO | N | **P** — 21 rows, 2 of 64 counties | N | N | N |
| FL | **P** — 2,199 rows, 8 of 67 counties | N | **P** — 1 row | **B** — 1 row, no source | **P** — 2 rows |
| GA | **P** — 406 rows, 4 of 159 counties | **B** — Cobb source live but 0 rows land | N | N | **P** — 10 rows |
| IL | N | **P** — 70 rows, 1 of 102 counties (Will) | N | N | N |
| IN | N | **P** — 72 rows, 1 of 92 counties (Allen) | N | N | N |
| MN | N | **B** — 20 scraped, all rejected | N | N | N |
| MS | **P** — 10,229 rows, 1 of 82 counties (Hinds) | N | N | N | N |
| NJ | N | **B** — 259 scraped, all rejected | N | N | **P** — 2 rows |
| NY | N | **P** — 146 rows, 3 of 62 counties (+13 escheat) | N | N | **P** — 6 rows |
| OH | N | **P** — 12,627 rows, 9 of 88 counties | N | N | N |
| OK | **B** — 166 scraped, all rejected | N | N | N | N |
| SC | **B** — 120 scraped, all rejected | N | N | N | N |
| TX | **P** — 827 rows, 6 of 254 counties | N | N | N | **P** — 7 rows |

Plus **80 `re_leads` rows (V5) with no state at all** — `realestateapi_bulk_import`, unattributable
to any jurisdiction. They are 75% of the entire real-estate universe and cannot be assigned to a state.

### 3b. All remaining jurisdictions — NOT STARTED in all five verticals

AK, AL, AR, AZ, CA, CT, DC, DE, HI, IA, ID, KS, KY, LA, MA, MD, ME, MI, MO, MT, NC, ND, NE, NH,
NM, NV, OR, PA, RI, SD, TN, UT, VA, VT, WA, WI, WV, WY — **38 jurisdictions, zero records, zero
identified county source, zero scraper entry.**

Six of these (VA, MD, NC + the already-listed NJ, GA, NY) have **attorney-recruiting records only**
(`sf_recruiting_queue`, 31 bar-verified). Attorney coverage is not data coverage — those states stay
NOT STARTED on the data axis.

### 3c. Vertical-level rollup

| Vertical | DONE | PARTIAL | SOURCE ID'd | BLOCKED | NOT STARTED |
|---|---:|---:|---:|---:|---:|
| V1 Surplus Funds | 0 | 4 (FL, GA, MS, TX) | 0 | 2 (OK, SC) | 45 |
| V2 Mortgage Surplus | 0 | 6 (CO, IL, IN, NY, OH, GA*) | 0 | 3 (NJ, MN, GA) | 42 |
| V3 Foreclosure | 0 | 1 (FL) | 0 | 0 | 50 |
| V4 Lis Pendens | 0 | 0 | 0 | 1 (FL) | 50 |
| V5 Real Estate | 0 | 5 (FL, GA, NJ, NY, TX) | 0 | 0 | 46 |

\* GA is both PARTIAL on V1 and BLOCKED on V2 — the Cobb foreclosure source runs and lands nothing.

---

## 4. Per-source detail (all 53 registered sources)

Every registered source lives in `scraper_state`. Counties are single-county scrapers except
`nj_statewide_foreclosure`. Sources producing zero promoted rows:

| Source | State | Status | Rows landed | Blocker |
|---|---|---|---:|---|
| `ok_tulsa_excess` | OK | BLOCKED | 0 | 166 rows rejected — `missing case_number` |
| `sc_york_overage` | SC | BLOCKED | 0 | 120 rows rejected — `missing case_number` |
| `nj_statewide_foreclosure` | NJ | BLOCKED | 0 | 129 rows rejected — `missing or non-positive surplus_amount` |
| `nj_trust_fund_escheat_manual` | NJ | BLOCKED | 0 | 130 rows rejected — same |
| `mn_hennepin/ramsey/stearns/pine_surplus` | MN | BLOCKED | 0 | 20 rows rejected — `missing case_number` |
| `ga_cobb_foreclosure` | GA | BLOCKED | 0 | **Code defect** — writes `date_of_sale`, a column that does not exist on `raw_scraper_leads`. 30 rows lost per run since 2026-08-22. Still failing as of 2026-08-31. |
| `il_mchenry_surplus_manual` | IL | BLOCKED | 0 | 111 rows rejected — missing surplus_amount |
| `oh_crawford_foreclosure_manual` | OH | BLOCKED | 0 | 0 new records since 2026-07-27 |
| `_probe_38df04` | XX | test artifact | 1 | Test row sitting in production `raw_scraper_leads` |

**796 rows are stranded in `raw_scraper_leads_flagged` across 13 sources.** Every one of them fails on
one or two missing fields, not on data quality — these are recoverable with a field-mapping fix, not a
re-scrape.

---

## 5. Duplicate and overlapping datasets

| Finding | Evidence |
|---|---|
| **OH holds 1,872 exact duplicate leads** | 1,841 groups sharing identical `last_name + first_name + court_case_number + surplus_amount`. 1,803 pairs, 38 triples, 1 quadruple. ~15% of the Ohio universe. |
| **39 OH cases appear under more than one source** | Same name+case number arriving from both `oh_cuyahoga_excess` and `oh_cuyahoga_released` — the two Cuyahoga feeds overlap. |
| **NY case numbers are 62% duplicated** | 159 rows, only 60 distinct `court_case_number`. |
| **TX has 36 repeated case numbers** | 827 rows, 791 distinct. |
| **FL is nearly clean** | 2,199 rows, 2,196 distinct case numbers. |
| Landing-table dedupe works | `raw_scraper_leads.dedupe_key` has **zero** collisions — duplication is entering at *promotion*, not at scrape. |
| **Ohio pool-B mixes two products** | `*_excess` (tax origin) and `*_released` (foreclosure origin) both sit in pool B. Tax vs mortgage origin is **not distinguishable at row level inside Ohio**, so the V1/V2 split above understates V1 by an unknown Ohio amount. |

---

## 6. Missing sources

- **38 jurisdictions have no identified county source at all** (§3b). No shortlist, no URL, no scraper stub.
- **Lis Pendens / NOD: no source anywhere in the system**, in any state. The one FL row is a manual CSV
  line with `lead_source = 'csv_upload'`. There is no ingestion function, no landing table, no registered
  source. This vertical does not exist as a pipeline.
- **Foreclosure acquisition (V3) has no recurring source** — 1 row, CSV origin.
- **Real Estate (V5) depends on a paid API** (`realestateapi_bulk_import`) whose 80 rows carry no state,
  so its coverage is unmeasurable.
- Even inside the 9 live states, county coverage is thin: MS 1/82, IL 1/102, IN 1/92, CO 2/64,
  NY 3/62, GA 4/159, TX 6/254, FL 8/67, OH 9/88. **35 counties out of roughly 3,000 nationally.**

---

## 7. Docs claiming completion without live-data support

| Claim | Source doc | Live reality |
|---|---|---|
| "562 scraped rows in NJ / OK / SC / MN are blocked at promotion" | `SURPLUS-REALESTATE-50-STATE-MASTER-SCOPE-2026-08-27.md` §1 | Now **565**, and the number grew — OK reached 166 on 2026-09-01. Still blocked 12 days later. Directionally right, stale. |
| "GA Cobb is silently losing 30 rows per run" | same | **Confirmed and still live** as of the 2026-08-31 run. Unfixed. |
| "Total: 26,571 promoted surplus leads" | same | Now **26,610**. |
| `raw_scraper_leads.promoted_at` is set on **all 25,541 rows**, including the 565 that were rejected | database | **Misleading field.** `promoted_at` means "processed", not "promoted" — `promoted_to_lead_id` is NULL for every NJ/OK/SC/MN row. Any dashboard or report counting `promoted_at` will overstate coverage by 565 rows. |
| `scraper_state.consecutive_failures = 0` on every source, including `ga_cobb_foreclosure` which has been failing for 17 days | database | **Health monitoring is not trustworthy.** `scraper-ingest` writes `0` unconditionally. A source rejecting 100% of rows reads healthy. |
| `scraper_runs` holds 137 rows since 2026-07-10, but `scraper_state` shows ~40 sources running daily | database | Run logging captures a small fraction of actual runs. Run history cannot be used for coverage evidence. |
| Surplus Funds hub shows a case/contract/payment pipeline | `SURPLUS_FUNDS_OS_HUB_AUDIT.md`, hub UI | `surplus_funds_cases`, `_contracts`, `_payments`, `_inquiries` are **all 0**. Nothing has ever left the lead stage. `surplus_funds_attorneys` holds 1 row named "test"; `sf_attorney_jurisdiction` is empty. |

---

## 8. Blockers

| ID | Blocker | Scope | Severity |
|---|---|---|---|
| B-1 | `ga_cobb_foreclosure` writes a nonexistent column `date_of_sale` | GA | High — silent daily data loss |
| B-2 | Promotion requires `case_number` + positive `surplus_amount`; OK/SC/MN sources don't supply case numbers, NJ/IL don't supply amounts | OK, SC, MN, NJ, IL | High — 796 stranded rows |
| B-3 | No `sf-skip-trace` function; `re-skip-trace` is hardcoded to `re_leads` | all surplus states | High — surplus leads cannot be enriched |
| B-4 | ~96% of surplus leads have no property address, so they are not skip-traceable even with a function | all | **Highest — this is the true ceiling** |
| B-5 | 1,872 duplicate OH leads; promotion has no dedupe | OH, NY, TX | High — inflates every count and would double-dial |
| B-6 | `consecutive_failures` always 0; `scraper_runs` under-logs | all | High — coverage cannot be trusted |
| B-7 | Verticals/pools A/B/C have zero written definition; Ohio tax vs mortgage origin indistinguishable | all | Medium — classification is inferred |
| B-8 | Legal posture unverified in every state: claim rules, fee caps, agent registration | all 51 | **Blocking for outreach** — no state is cleared for contact |
| B-9 | `re-skip-trace` auto-invokes `re-trigger-bland-campaign` on finding phones — an outreach trigger inside an enrichment function | V3/V5 | High — latent unconsented outreach |
| B-10 | No lis-pendens/NOD ingestion exists | all 51 | Vertical does not exist |
| B-11 | 80 of 107 `re_leads` have no state | V5 | Medium — unmeasurable |
| B-12 | Test rows in production (`_probe_38df04`, attorney "test") | — | Low |

---

## 9. Handoff work packages

Ordered so each package is self-contained and one person can own it end to end.

**WP-1 — Recover the 796 stranded rows** *(OK, SC, MN, NJ, IL · ~1 day)*
Relax or field-map the promotion gate in `scraper-ingest`: OK/SC/MN need a synthetic or alternate case
identifier; NJ/IL need the surplus amount located in the source row. Unblocks 5 states at once.
Verify by `raw_scraper_leads_flagged` count dropping and `surplus_funds_leads` gaining NJ/OK/SC/MN rows.

**WP-2 — Fix `ga_cobb_foreclosure`** *(GA · hours)*
Map `date_of_sale` to the existing `sale_date` column. Backfill the runs lost since 2026-08-22.

**WP-3 — Make monitoring honest** *(all · ~1 day)*
Stop writing `consecutive_failures: 0` unconditionally; increment on reject-rate > 0. Log every run to
`scraper_runs`. Rename or stop setting `promoted_at` on rejected rows. Until this ships, no coverage
number from this system is trustworthy.

**WP-4 — Deduplicate Ohio (then NY, TX)** *(OH · ~1 day)*
1,872 exact duplicates. Add a promotion-time dedupe key (`state + court_case_number + last_name +
surplus_amount`) and reconcile the existing rows. Also decide whether Cuyahoga `_excess` and `_released`
are one product or two, and split pool B accordingly.

**WP-5 — Address acquisition** *(all · the real project)*
B-4 is the ceiling: 96% of leads have no address. Either (a) source county parcel data to join on
`parcel_id`, or (b) change the scrapers to capture the property address at scrape time. Nothing
downstream — skip trace, outreach, claim filing — works until this is solved. **Highest value package.**

**WP-6 — Build `sf-skip-trace`** *(all · ~2 days, blocked by WP-5)*
Mirror `re-skip-trace` against `surplus_funds_leads`. Do **not** copy its Bland auto-invoke (B-9).

**WP-7 — Remove the outreach trigger from `re-skip-trace`** *(V3/V5 · hours)*
Enrichment must not initiate contact. P0 safety item.

**WP-8 — County expansion, per state** *(one package per state)*
Each is independent and assignable: MS 81 remaining counties · IL 101 · IN 91 · CO 62 · NY 59 ·
GA 155 · TX 248 · FL 59 · OH 79. Highest surplus-per-county states first (OH, FL).

**WP-9 — New-state entry** *(38 jurisdictions · one package per state)*
For each: identify the surplus-holding office, confirm the data is published, register a source in
`scraper_state`, write the scraper. Suggested first tier — states with bar-verified attorneys already in
`sf_recruiting_queue`: **VA (8), NJ (7), MD (5), NC (3)**.

**WP-10 — Legal posture per state** *(all 51 · research, not code)*
Claim rules, fee caps, agent-registration requirements, statute of limitations. **B-8 gates all outreach.**
No state may be dialed until its row here is complete.

**WP-11 — Decide Lis Pendens** *(owner decision)*
Either fund a real NOD/lis-pendens source (none exists today, and it is a distinct data product from
surplus) or formally park the vertical. Right now it is a declared lane with one orphan row.

**WP-12 — Fix the 80 stateless `re_leads`** *(V5 · hours)*
Backfill state from `raw_payload` / `realestateapi_property_id`, or mark the batch unusable.

---

## 10. What "DONE" should mean

Nothing in the system currently defines it, which is why no state can be marked DONE. Proposed gate,
for the incoming owner to accept or change:

A state is **DONE** for a vertical when — every surplus-holding county has a registered source in
`scraper_state`; each source has completed a run with a non-zero reject-free result; promoted rows carry
a name, an address and an amount; duplicates are zero; and the state's legal-posture row (WP-10) is
verified. **Under that definition, zero of 255 state×vertical cells are DONE today.**
