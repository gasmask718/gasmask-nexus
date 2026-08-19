# Line-Type Verdict — Contact Book Sweep (2026-08-19)

**Source:** Twilio Lookup, 3,437 numbers, zero API errors.
**Home:** `public.twilio_lookup_results` (keyed on last-10, one row per number, `checked_on` date).
**Read surfaces:** `v_contact_line_intel` (per contact) and `v_store_line_coverage` (per store).

## Vocabulary

`twilio_lookup_results.status`:
- `live` — number is assigned and carrier + line type returned.
- `stop` — invalid, or valid with no carrier (toll-free / disconnected shell). Do not dial without verification.
- `unknown` — never checked.

Line type is a property of the **number**. `store_contacts.responsiveness_status` stays a property of the
**behaviour** (did anyone answer). They are never merged; suppression continues to read
`dnc_list` / `opt_out_events`, unchanged by this sweep.

## Decay

`v_contact_line_intel` exposes `line_check_age_days` and `line_check_stale` (> 180 days, and `true` when
never checked). A verdict is true on the day it was taken; treat a stale row as unknown, not as clean.

## Distribution

| line_type | count |
|---|---|
| mobile | 2,365 |
| landline | 520 |
| fixedVoip | 369 |
| nonFixedVoip | 158 |
| tollFree | 7 |
| none returned (stop) | 18 |

The 18 `stop` rows = 3 invalid + 15 valid-with-no-carrier (toll-free shells). The 6 "no line type"
in the raw count are inside those 15, not additional.

## Coverage against the book

- 2,056 of 3,437 numbers match a live store phone (`store_contacts` + `stores.phone/alt_phone` + `store_master.phone`).
- 186 more match soft-deleted contacts.
- **~1,439 numbers exist in no store record at all** — they came from the source list and were never ingested.

## Stores that lose their last number

- Stores with at least one checked number: **2,053**
- Stores dropping to zero surviving numbers: **2** — `moe owner's brother (9627 Farragut Rd)`, `Fulton (1200 Nostrand Ave)`
- Of those, with an open balance: **0** ($0)

The dead-number exercise recovers no receivable.

## The list with money behind it

Stores whose every surviving number is a **mobile** (no landline / fixedVoip left):

- **990 stores**
- **157 of them carry an open balance, totalling $42,924.50**

These ring in a pocket, not behind a counter — which is what the "no answer" notes have been recording.
That is the door-visit list, ordered by `open_balance` in `v_store_line_coverage`.

## Caution

A line-type verdict says a number is **assigned**, not that it still belongs to our contact. It removes the
certainly-dead. It does not confirm who picks up. Owner confirmation stays a human step.
