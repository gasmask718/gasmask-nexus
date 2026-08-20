# business_leads — one lead table, one business column, one view per business

Applied 2026-08-20. Replaces `ut_partner_leads` as the base table for all scraped
business leads (UT supply, TopTier prospects, Dynasty prospects, and whatever comes next).

## Shape

- `public.business_leads` — the table. 46,000 rows at migration time, all `business = 'ut'`.
- `business text NOT NULL`, **no default**, CHECK against
  `('ut','toptier','dynasty','brandaro','gasmask','surplus')`. Same rule as the SMS
  class: a lead that lands with no business is a lead nobody will find. A direct
  insert with no business fails.
- `public.ut_partner_leads` — compatibility **view**, `WHERE business = 'ut'`,
  `security_invoker = on`, `WITH CASCADED CHECK OPTION`, and a view-level column
  default of `'ut'` on `business`. It is auto-updatable, so all eight pre-existing
  write paths (`useUTPartnerLeads`, `useUTAIDialer`, `UTLeadImporter`,
  `dc-bland-webhook`, `ut-geocode-backfill`) keep working unchanged. A write that
  tries to file a row under another business through this view is rejected, not
  silently misfiled.
- `v_ut_supply`, `v_toptier_prospects`, `v_dynasty_prospects` — one per business,
  each `SELECT`-only to `authenticated`, `anon` revoked, each registered in
  `public_view_contracts`.

New code should read the per-business view, not the compat view.

## Suppression reaches every business in one check

`isSuppressed()` takes a phone number, not a lead. It reads
`dnc_list.phone_last10` and `opt_out_events.phone_last10` (generated columns) and
fails closed on lookup error, so it has always been business-blind. What one table
buys is that the guarantee can also be enforced in SQL: `business_leads` carries a
generated `phone_last10`, and each per-business view anti-joins both suppression
sources. A view a VA queries cannot return a suppressed number.

Proven, not asserted (2026-08-20):

| step | result |
|---|---|
| Lead `5ca01af8…` "In Napoli Event Hall", `(201) 944-1030` | in `v_ut_supply`, total 46,000 |
| `handle_sms_opt_out('+12019441030','proof_test')` | wrote `dnc_list.phone_last10 = 2019441030` and 1 `opt_out_events` row — the two rows `isSuppressed()` reads |
| Same lead re-queried | still in `business_leads` and in `ut_partner_leads`; **gone** from `v_ut_supply`, total 45,999 |
| Second row for the same number under `business='toptier'` | **also** hidden from `v_toptier_prospects` — one opt-out, every business |

Test suppression and test row removed afterwards; table back to 46,000.

## Duplicate business case — deliberate, not accidental

Unique index is `(external_place_id, business) WHERE duplicate_of IS NULL AND
external_place_id IS NOT NULL`. The same company **is** two rows when two
businesses prospect it: different owner, different outreach state, different
disposition history. Verified: upserting place `ChIJP1azU_f3wokRRgP2L3RYH4I`
under `toptier` when it already existed under `ut` returned `was_insert = true`
and produced a second row; the UT compat view still showed exactly one.

`ut_upsert_partner_lead(p jsonb)` now **requires** `p->>'business'` and raises
without it. Both callers pass it: `ut-run-territory-job` and `UTPlacesLeadFinder`.

## Category vocabulary

Added to the CHECK: `limo`, `chauffeur`, `exotic_car`, `party_bus`, `yacht`,
`nightclub`, `security_firm`, `authenticator`, `private_chef`, `beauty`.

Clean Google `place_type` mappings: `night_club`→nightclub;
`beauty_salon`/`hair_care`/`nail_salon`/`spa`→beauty; `car_rental`→exotic_car
(needs a name filter — most `car_rental` results are Hertz/Enterprise).

**No clean place type — the runner must text-search and set the category from the
query that found it, never from the returned types:** limo, chauffeur, party_bus,
yacht, security_firm, authenticator, private_chef. Google files these under
`point_of_interest`, `establishment`, `travel_agency`, `moving_company`.

## The 43,265 NULL category_groups

They were never unclassified. `category` is NOT NULL and populated on every row;
`category_group` is a rollup that only a later enrichment pass wrote, so the
original 43k Places import (32,922 event halls, 11,561 rental companies) had none.
Backfilled deterministically from `category`. 506 NULLs remain — the rows whose
`category` is literally `other`, which is honest.

Filtering on `category_group` before this backfill would have dropped 94% of the
table while looking like it worked.

## Rename fallout that was caught

`ALTER TABLE ... RENAME` silently rebinds dependent views to the new name. Six views
(`dc_unified_leads`, `ut_category_demand`, `ut_city_demand`,
`ut_territory_intelligence`, `ut_verified_event_halls`,
`ut_verified_rental_companies`) would therefore have started reading the base table
across all businesses — `dc_unified_leads` labels that branch
`'unforgettable_times'`, so TopTier leads would have appeared as UT ones. All six
were rewritten in the same migration to read the UT-filtered compat view.

The six inbound foreign keys (`ut_outreach_logs`, `ut_partner_profiles` ×2,
`ut_partner_onboarding`, `ut_va_tasks`, self) followed the rename automatically and
needed no change — a rename works here precisely because the table survives.
