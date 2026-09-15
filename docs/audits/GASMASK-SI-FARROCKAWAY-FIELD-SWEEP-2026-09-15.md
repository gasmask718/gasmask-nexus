# GasMask — Staten Island + Far Rockaway field sweep

**Date:** 2026-09-15 · **Backend:** qalaaroashbggynpvqct (Nexus)
**Purpose:** Ching's Staten Island field run with Kash / Javier.

## 1. People audit (no duplicates created, no contact details guessed)

| Person | State found | Evidence |
|---|---|---|
| Javier Smith | Ambassador record active (`546688e9-…`, Smithjavier770@gmail.com), **no app login linked** (`user_id` null). Ambassador invite already exists (`6bf53733-…`, status `pending`) — **not duplicated**. | `ambassadors`, `ambassador_invites` |
| Javier invite delivery | **Failed at the email provider** on 2026-09-11: HTTP 403 "You can only send testing emails to your own email address (gasmaskapprovedllc@gmail.com)". The invite exists but never reached him. | `ambassador_invite_events` |
| Kash | **No person record.** Only business records match the string: store "kash (7 E 32nd st) new spot" (Manhattan), store "KASHAWM (72-20 Forest Ave)" (Flushing), and a store contact named "Kash" (manager, 929-258-8303) at store `8c20bfb4-…`. None is a field-worker identity. | `store_master`, `store_contacts` |

No invite was sent for Kash — that would require guessing an identity and an address/number.

## 2. Sweep (existing ingestion path, extended — not replaced)

`supabase/functions/ingest-openstreetmap` was extended, not rebuilt:

- wholesale / trade / newsagent / kiosk categories added to the OSM type map;
- store vs wholesaler classification (`shop=wholesale|trade`, or wholesale / cash-and-carry / distributor / supply / depot in the name);
- OSM lifecycle prefixes (`disused:`, `was:`, `abandoned:`, `removed:`) excluded as closed;
- phone, website, `place_id` (`osm:node/123`), `scan_source`, `last_scan_at` now persisted (provenance);
- dedupe now runs place_id → prospect address → `store_master` phone (last 10) → `store_master` address;
- **bug fixed:** every OSM row previously failed to insert — `address_type` was written as the raw OSM category, which violates the `commercial|residential|unknown` check constraint, and the row was silently counted as "skipped". Also `neighborhood` (nonexistent column) → `neighborhood_label`;
- optional `elements` body parameter accepts pre-fetched Overpass results (public Overpass rate-limited the function's IP), running the identical normalize/dedupe/insert path.

Categories swept: tobacco, e-cigarette, hookah, convenience, deli, supermarket, newsagent, kiosk, wholesale, trade.

## 3. Results

| | Staten Island | Far Rockaway |
|---|---|---|
| Existing CRM stores before sweep | 32 (6 wholesalers) | 12 |
| OSM candidates found in area | 487 raw | 30 raw |
| New records added | 87 | 16 |
| Of which wholesalers | 4 | 0 |
| Of which field-ready (tobacco-native) | 10 | 0 |
| Needs verification | 73 | 16 |
| Duplicates skipped | 384 | 11 |
| Out-of-area rows re-labelled (NJ / Bay Ridge / Nassau) | 16 | 3 |

Total new records added: **103**. Duplicates skipped: **395**. Needing verification: **89**.

Verification classes: `scouted` = tobacco/vape/hookah shop on OSM evidence, field-ready; `wholesaler` = wholesale/cash-and-carry; `unknown` = convenience/deli/supermarket/kiosk — plausible tobacco outlet, must be eyeballed in person; closed/lifecycle-tagged places were excluded, never ingested. No "open" status was invented — OSM carries no reliable live-open signal.

## 4. Assignments (untouched)

All 32 Staten Island CRM stores are already assigned to **Javier Smith**; the 12 Far Rockaway stores are unassigned. No new assignment was created, and no split between Kash and Javier was made.

## 5. Map readiness

- New candidates: 103 / 103 have coordinates.
- Existing CRM stores: Staten Island 31 / 32 mapped (1 missing coordinates), Far Rockaway 12 / 12.

## 6. Where to look

- `/territory` — territory map, all new candidates appear with coordinates, grouped by borough.
- The GasMask store book / live map for the 44 existing CRM stores.
