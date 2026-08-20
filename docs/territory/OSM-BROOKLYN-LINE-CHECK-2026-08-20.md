# Brooklyn OSM callable list — line-type check (2026-08-20)

## One-time pull, not a job

**This is a one-time pull per metro. Do not schedule it.** Overpass is queried by hand,
measured once, filtered once, line-checked once, and the result is handed to the field
team as a static list. There is no cron, no runner, no ingestion lane, and none should be
built. OSM churn on this store class does not justify re-running, and a recurring job
would re-import features we have already judged and re-bill Twilio lookups we already
hold. If a metro needs refreshing, someone re-runs it deliberately and says so in a doc.

## Reporting rule, permanent

**Unmeasurable is always its own line, never folded into "new."** Brooklyn is
**90 matched / 1,395 new-and-measurable / 687 unmeasurable** — not "1,395 new." A feature
with no phone and no full address could not have matched anything by construction;
counting it as new asserts a comparison that was never run. This holds for every metro
measurement from here on.

## Rebuild of the filtered set

Re-pulled 2026-08-20 (same 9 `shop=` categories, Brooklyn admin boundary):
2,172 features. Match rule unchanged — phone last-10 against 1,466 of our Brooklyn
numbers (`store_master.phone` / `phone_last10` + `store_contacts.phone`), else normalized
housenumber + street + 5-digit zip against 1,196 live Brooklyn `store_master` rows.

- matched **90**
- new and measurable **1,395**
- unmeasurable **687**
- of the new, carrying a phone **858**

Category filter as agreed — drop `shop=supermarket`, drop anything tagged `brand` /
`brand:wikidata` / `operator`, drop by chain-name regex, drop any name appearing 3+ times
in the metro. `grocery` and `variety_store` stay in: mappers use both for exactly the
independent bodegas we want.

**858 → 578 rows / 575 distinct numbers.** (577 last time; the delta is OSM edits between
the two pulls, not a rule change.) The name-3+-times rule again caught zero after the
first three steps — kept anyway. It costs nothing and it is the only step that catches a
chain nobody here has heard of.

## What Twilio Lookup did to the number

575 distinct numbers, `line_type_intelligence`, one transient connection reset that was
retried. Zero API errors after retry. Written back to `public.twilio_lookup_results`
keyed on last-10, `checked_on = 2026-08-20`.

| verdict | rows |
|---|---|
| live — fixedVoip | 282 |
| live — landline | 198 |
| live — mobile | 78 |
| live — nonFixedVoip | 19 |
| stop (no carrier) | 1 |

**The list does not collapse. It inverts the fear.**

- **480 rows sit on a desk line** (landline 198 + fixedVoip 282). That is the real callable
  list, and it is 83% of the set.
- **78 are mobile** — 13.5%. Against the existing book, where 990 stores are mobile-only
  and 157 of those owe $42,924.50, this set is materially healthier.
- 19 nonFixedVoip: dialable, but weakest provenance — call them last.
- 1 dead number.

fixedVoip being the largest bucket is expected and is not a warning: it is what a
storefront looks like when the counter phone is a VoIP box (Ooma, Vonage, RingCentral,
Spectrum Voice) rather than copper. Treat fixedVoip as a desk line.

Desk-line rows by category: convenience 366, deli 54, variety_store 37, tobacco 10,
grocery 7, e-cigarette 3, newsagent 2, kiosk 1.

## Caveats that survive the check

A line-type verdict says the number is **assigned and what kind of line it is**. It does
not say the business still holds it, and it does not say who answers. Owner confirmation
stays a human step. The verdict decays — treat it as unknown past 180 days
(`v_contact_line_intel.line_check_stale`).

The list has also had **no suppression check**. Nothing here may be dialled until it
passes the same `dnc_list` / `opt_out_events` gate as everything else, enforced at the
TwiML endpoint.

## Licence

OSM data is ODbL 1.0. Internal enrichment, outreach and routing only. Any row ingested
from this must carry `source = 'osm'`, must never appear on a public surface, and must
never be sold or handed to a partner. Publishing a derived list triggers share-alike.

## Export

`brooklyn_osm_callable_linechecked_2026-08-20.csv` — 578 rows, sorted desk lines first,
with `status`, `line_type`, `carrier`, `source = osm`.

## Suppression check — RAN 2026-08-20

All 578 rows were run against the same gate a dialer hits: `dnc_list` and
`opt_out_events`, matched on the last-10 key (`phone_last10`) plus the legacy
`phone_number` / `phone_e164` columns, i.e. the exact logic of
`supabase/functions/_shared/dnc.ts → isSuppressed()`.

| source | hits |
|---|---|
| dnc_list (last-10) | 0 |
| dnc_list (legacy columns) | 0 |
| opt_out_events (last-10) | 0 |
| opt_out_events (legacy) | 0 |
| **total dropped** | **0** |

Zero is the expected number — suppression currently holds two rows total — but the
gate ran, and that is the last check before a human dials. It does not replace the
runtime gate: the TwiML endpoint still enforces suppression before `<Dial>`, fail-closed.

## Batching — 480 now, 19 held

The nonFixedVoip 19 are **not** the tail of batch 1. A VA works a list top to bottom and
does not reorder it; nineteen weak-provenance numbers at the bottom of a 480-row list get
dialled at the end of a bad afternoon and colour the whole exercise. Separate list,
separate decision.

- `brooklyn_batch1_desk_lines_480_2026-08-20.csv` — **the deliverable.** 480 desk lines
  (fixedVoip 282 + landline 198), suppression-clear, sorted landline first.
- `brooklyn_hold_nonfixedvoip_19_2026-08-20.csv` — held, not queued.
- 78 mobile and 1 dead number remain out of both.

Every row in both files carries a `dial_caveat` column stating in plain language that a
line type says the number is **assigned**, not that the business still holds it — so the
first three calls reaching a different business reads as expected decay, not a bad list.
The VA sees the caveat on the row; it does not live only in this doc.
