# PIPE-01 — ut-ingest request contract (authoritative)

Endpoint: `POST /functions/v1/ut-ingest`
Auth: `Authorization: Bearer ${UT_INGEST_SECRET}`

## Accepted `transaction_type`

`booking` | `shop_order` | `kit_order` | `refund`

`refund` was added 2026-08-13 after a contract mismatch: UT was sending it,
the hub only accepted the first three.

## Fields

| field | required | notes |
|---|---|---|
| `transaction_id` | yes | UT-side id. Unique per `(source_system, external_transaction_id)` — replay is idempotent and returns `duplicate: true`. |
| `transaction_type` | yes | one of the four above |
| `amount` | yes | number. Must be **negative** when `transaction_type = 'refund'`. |
| `occurred_at` | yes | ISO timestamp; preserved as UT's time, not ingest time |
| `original_transaction_id` | required for `refund` | accepted at top level or inside `metadata`; always persisted to `metadata.original_transaction_id` |
| `entity_id`, `entity_type`, `currency`, `description`, `region`, `customer_email`, `line_items`, `metadata` | no | passed through |

## How a refund lands on the hub

- `business_transactions.transaction_type` = `'expense'` (driven by sign of `amount`, not by the UT type)
- `subcategory` = `'refund'` — the distinct event is preserved here
- `metadata.ut_transaction_type` = `'refund'`
- `metadata.original_transaction_id` links back to the original UT transaction

Nothing is mutated on the original row. The ledger stays append-only: a refund
is a second row that nets against the first.

## Corrections (deliberate manual path, 2026-08-13)

An accepted payload with a wrong value cannot be repaired from UT's side today.
Replay is idempotent on `(source_system, external_transaction_id)` and returns
`duplicate: true` while ignoring the new body — correct for retries, useless for
corrections.

**Current answer: corrections are a DM and a hand-patch.** This is a deliberate
tradeoff, not a gap. There has been one correction in the history of this pipe;
it was fixed by hand in two minutes. A money-mutating write path would be the
most dangerous endpoint in the system and would have to be guarded forever. It
is not worth that risk at this volume.

First real instance: `5e22d9f2-8f1f-4042-afac-262dc7695661` booked -445.63 instead
of -345.00, because `stripe-webhook` read `charge.amount_refunded` (cumulative per
charge) for a second member of a BOOK-04 group sharing one PaymentIntent. The
payload was well-formed and the amount was a legal negative number, so no ingest
guard could have caught it. Corrected by hand to -345.00; reason recorded in
`metadata.correction_reason` with `corrected_from`.

When a correction endpoint is eventually built, the spec must include from day one:
- an explicit `transaction_type = 'correction'` carrying `original_transaction_id`
  and a **delta** amount, landing as a new append-only row that nets against the
  original (same pattern as a refund);
- a **bounded window** after which corrections are rejected or require escalation;
- a **large-delta flag** that blocks or escalates corrections above a configured
  threshold.

A `version` field on the payload is rejected: it requires in-place mutation of a
settled row and history the hub does not model. Until then, corrections stay
manual and MUST record `corrected_from` and `correction_reason` in `metadata`.
