# Dynasty Connect — lead/account flow audit (2026-09-07)

Audit only. Nothing migrated, deleted, deduped or reconnected.

## 1. Real sales lead sources

| Source table | Role | Reaches dialer? |
|---|---|---|
| `store_master` / `stores` + `store_contacts` (via `v_store_summary`, `v_store_who_to_contact`) | Canonical GasMask/Grabba account book — the ONLY source wired into the Power Dialer, through `dialer-call-list-builder` → `dialer_campaigns` → `outbound_call_queue` | YES |
| `dc_leads` (996) | Dynasty Connect pipeline leads (CSV upload + pipeline intake, `DCCampaignBuilder`) | NO — feeds `ai_call_campaigns` + Bland, never `outbound_call_queue` |
| `dc_unified_leads` (view, 327,539) | Read-only union used by DC Lead Inbox / Disposition Manager / Compliance | Read-only, NO |
| `business_leads` (297,010, all `business='ut'`) | Scraped business leads, surfaced to DC via `ut_partner_leads` branch of the union | NO |
| `surplus_funds_leads` (26,575), `re_leads` (107), `crm_partners` (3,223), `brandaro_qualified_leads` (532), `wholesalers` (40), `sales_prospects` (52) | Per-vertical sources feeding the union | NO (own Bland triggers only) |
| `hw_leads` (10,871), `leads` (128,583), `icw_candidate_leads` (7) | Raw/other ingestion, not in the union | NO |

## 2. Counts by business (from `dc_unified_leads`)

| business_unit_key | source_table | leads | with phone |
|---|---|---|---|
| unforgettable_times | ut_partner_leads | 297,010 | 275,490 |
| surplus_funds | surplus_funds_leads | 26,575 | 444 |
| top_tier | crm_partners | 3,223 | 3,105 |
| brandaro | brandaro_qualified_leads | 532 | 521 |
| real_estate | re_leads | 107 | 107 |
| gasmask | sales_prospects | 52 | 42 |
| dynasty_direct | wholesalers | 40 | 37 |

Store book: 3,261 `store_master` rows (2,056 with a phone), 3,900 contacts.
`dc_leads` by pipeline: TopTier 940, Real Estate 27, Dynasty Direct 18, Dynasty Recovery 8, UT 3 — all status `queued`, only 1 attached to a campaign.

## 3. Visible in Dynasty Connect: YES (read-only)

DC Lead Inbox, Disposition Manager, Compliance Dashboard all read `dc_unified_leads`. A manager can see and disposition leads. Rep Performance shows activity, not leads.

## 4. Available to Power Dialer: NO (except the store book)

`VAPowerDialer` dials only `outbound_call_queue` rows for the selected `dialer_campaigns` row, and enriches from `store_master`. Queue today: 52 queued (51 Flatlands/Canarsie + 1 CHING test), 126 historical. Nothing in `dc_unified_leads` can enter that queue — there is no builder path from any DC source into `outbound_call_queue`.

## 5. Lead sources not connected

Two disconnected engines:
- Power Dialer lane: store book → `dialer-call-list-builder` → `dialer_campaigns` → `outbound_call_queue` → human caller.
- Dynasty Connect lane: `dc_leads` / verticals → `ai_call_campaigns` → Bland AI (`dc-bland-webhook`, `re-trigger-bland-campaign`, `sf-trigger-bland-campaign`).

Not connected to either dialer: `business_leads` (297k UT), `hw_leads`, `leads`, `icw_candidate_leads`, `giy_leads`/`svc_leads` (empty), `outreach_leads` (empty).

## 6. Duplicate / orphan / ID issues

- `business_leads`: 12,675 phone groups with >1 live row (cross-business duplicates are deliberate; same-business ones are not audited here).
- `outbound_call_queue`: 123 of 175 rows have no `store_id` — historical hand-loaded numbers with no canonical account. All 52 current queued rows carry both `store_id` and `contact_id`.
- 0 duplicate numbers among queued rows.
- `store_master`: 143 rows with NULL `business_id`; 1,205 with no phone.
- `dc_unified_leads` has no canonical account id — leads are not linked to `store_master`, so a DC lead cannot become a dialer account without a promotion step.

## 7. Ambassador / recruiting leads: separate

`ambassador_leads` (0 rows), `ut_recruiting_leads` (0), `icw_candidate_leads` (7), `sf_recruiting_queue`, `playboxxx` recruiting ingest — all recruiting lanes, none in `dc_unified_leads`, none dialable by the Power Dialer. No contamination of sales leads.

Old Brandaro wiring (`brandaro_raw_leads` → `brandaro_leads_master` → `brandaro_qualified_leads`, plus `brandaro_call_queue`) is a self-contained pipeline; only the qualified table surfaces in the DC union.

## 8. Exact gap / safest next fix

Gap: Dynasty Connect can SEE 327k leads but can DIAL none of them, because the Power Dialer's only feeder (`dialer-call-list-builder`) reads the store book, and DC leads have no canonical account id to hand it.

Safest next fix (smallest, additive, reversible): extend `dialer-call-list-builder` with a `source: 'dc_unified_leads'` mode that builds a `dialer_campaigns` + `outbound_call_queue` list filtered by `business_unit_key`, with phone present, `compliance_hold=false`, `phone_invalid=false`, and the same build-time suppression check. Store `lead_id`/`source_table` on the queue row and leave `store_id` NULL where no canonical account exists rather than inventing one. No table changes, no migration, no dedupe.
