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

## Corrections (open design question, 2026-08-13)

An accepted payload with a wrong value cannot be repaired from UT's side today.
Replay is idempotent on `(source_system, external_transaction_id)` and returns
`duplicate: true` while ignoring the new body — correct for retries, useless for
corrections. The only repair path is a manual UPDATE on `business_transactions`.

First real instance: `5e22d9f2-8f1f-4042-afac-262dc7695661` booked -445.63 instead
of -345.00, because `stripe-webhook` read `charge.amount_refunded` (cumulative per
charge) for the second member of a BOOK-04 group sharing one PaymentIntent. The
payload was well-formed and the amount was a legal negative number, so no ingest
guard could have caught it. Corrected by hand; reason recorded in
`metadata.correction_reason` with `corrected_from`.

Position: a correction path SHOULD exist. Preferred shape — an explicit
`transaction_type = 'correction'` carrying `original_transaction_id` and the
**delta**, landing as a new append-only row that nets against the original, same
as a refund does. It keeps the ledger append-only (no mutation, no version
bookkeeping) and makes the correction itself auditable and idempotent under the
existing unique key. A `version` field on the payload is rejected: it requires
in-place mutation of a settled row and history the hub does not model.

Not scheduled. Until it is built, corrections stay manual and MUST record
`corrected_from` and `correction_reason` in `metadata`.
