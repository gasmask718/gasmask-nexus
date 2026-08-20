# OSM Brooklyn ↔ store_master overlap measurement (2026-08-20)

Read-only. Nothing was written to `store_master`, `business_leads`, or any lead table.

## Sets compared

**OSM side** — Overpass, Brooklyn admin boundary, `shop=` convenience, tobacco,
e-cigarette, kiosk, newsagent, supermarket, grocery, deli, variety_store.
Pull taken 2026-08-20: **2,172 features** (2,095 named, 904 with a phone,
1,143 with housenumber + street + postcode). Within a few dozen of the
2,160/2,083/894/1,140 figures quoted — OSM edits between the two pulls.

**store_master side** — live rows (`deleted_at is null`) where `city ilike
'brooklyn'` or `zip like '112%'`: **1,196 rows**. Phones taken from
`store_master.phone_last10` plus all `store_contacts.phone` on the store
(1,464 distinct last-10 numbers).

**Match rule** — phone last-10 where both sides have one; otherwise normalized
`housenumber + street` + 5-digit zip (suffix/ordinal/directional normalization
both sides).

## 1. Three counts

| | count |
|---|---|
| OSM feature already in store_master | **90** (33 by phone, 57 by address+zip) |
| New to us | **2,082** |
| In store_master, absent from OSM | **1,109** of 1,196 |

Overlap is 4.1% of the OSM set and 7.3% of our Brooklyn set. The 2,172 − 1,971
gap was never the yield, and neither is the 2,082 — see the matchability caveat
below.

## 2. Of the new ones, how many are callable

**858 of the 2,082 new features carry a phone** (856 of those also have a name;
530 also have a full street address). Export:
`brooklyn_osm_new_callable.csv`.

That is the honest ceiling *before* dedupe risk. **687 of the 2,082 "new"
features have neither a phone nor a full address**, so they could not have
matched anything by construction — they are unverifiable, not confirmed-new.
Every one of the 858 callable ones does have a phone, so those were genuinely
tested against our 1,464 numbers and did not hit.

## 3. Free enrichment on stores we already know

**12** matched stores have an OSM phone we do not hold on the store or any of
its contacts; **2** of those have no phone at all on file today. Export:
`brooklyn_osm_phone_enrichment.csv`. (45 of the 90 matches had an OSM phone;
33 of them were the phone that produced the match.)

For scale: 252 live Brooklyn stores currently have no phone. OSM closes 2 of
them. Enrichment value here is ~zero.

## Read on the decision

Brooklyn is the densest, best-mapped borough in the country for this store
class. It yields **858 callable new numbers**, not 400 and not 40 — but with
caveats that change the shape of the answer:

- Yield is **phone-bearing OSM POIs**, and OSM phone coverage (42%) will be
  materially worse outside NYC. Buffalo, Rochester, Newark, Philadelphia,
  Baltimore will not hold 42%.
- The 687 name-only features are the Google enrichment bill for this metro:
  they need a Places lookup each to become anything. At the metered
  $0.0868/call that is ~$60 for Brooklyn, and it buys phones for a subset.
- Category noise is real — supermarkets, chain groceries and delis are in the
  set. The 858 needs a category/name pass before it is dialled, not after.

This is a **pipeline, not a supplement, in dense mapped metros**, and a
supplement everywhere else. The sane next step is to run the identical
measurement (not a build) against one non-NYC Grabba metro before committing:
if OSM phone coverage there lands under ~20%, the metro is a Google job with an
OSM seed list, and should be budgeted as such.

## Licence — record this

OpenStreetMap data is **ODbL 1.0**. Internal use — enrichment of our own
records, outreach, routing — is unrestricted. **Publishing or selling a derived
list, or exposing it on a public surface, triggers share-alike**: the derived
database must be offered under ODbL with attribution. Any table that ingests
this must carry `source = 'osm'` per row so a derived-list obligation can be
traced, and OSM-sourced rows must never be included in `show_on_public_site`
surfaces or in any list sold or handed to a partner.
