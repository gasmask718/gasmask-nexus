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
