# Customer Surfaces

**Status:** Canonical. Two surfaces, two customer realities, **parallel by design.**

The OS serves two distinct customer relationships through two distinct portals. Each is the source of truth for its own world. They are not redundant and must not be merged.

## Surface 1 — Dynasty Direct Account Pages (D2C canonical)

- **Path:** `/account/*` on the Dynasty Direct storefront
- **Audience:** consumers who bought from DD (one-click checkout, cart-based, marketplace-source-agnostic)
- **Identity:** `customer_profiles` keyed on `auth.users.id`; addresses in `addresses`; payment methods in `customer_payment_methods`
- **Order universe:** `marketplace_orders` + `marketplace_order_items` (polymorphic across `products_all` and `products` via Grabba Bridge)
- **Source of truth for:**
  - Consumer purchase history
  - Saved addresses, default shipping
  - Loyalty / referral / DD account state
  - D2C support messages (`order_messages`)
- **Pricing:** retail tier from `pricing_tiers`
- **Authentication:** standard email/password + Google OAuth

## Surface 2 — Customer Portal (B2B / invoiced canonical)

- **Path:** `/portal/customer/*`
- **Audience:** wholesale + invoiced accounts (stores, partners, repeat B2B buyers)
- **Identity:** `customer_sites` keyed on the business relationship (account-level, not consumer-level); `customer_portal_sessions` for login
- **Order universe:** `customer_orders` + `customer_invoices` + `customer_receipts` + `customer_balance` (terms-based, not cart-based)
- **Source of truth for:**
  - Invoice ledger (immutable, finalized via `finalize_invoice`)
  - Account balance + receivables
  - B2B change requests (`customer_change_requests`)
  - Wholesale pricing (store/wholesale tier from `pricing_tiers`)
  - Repeat-order intake (`customer_intake_forms`)
- **Pricing:** store or wholesale tier — never retail
- **Authentication:** account-scoped portal sessions (magic link / scoped token)

## Why parallel by design

| | DD Account | Customer Portal |
|---|---|---|
| Buying model | Cart, one-click, mixed catalog | Invoice, terms, recurring |
| Pricing tier | Retail | Store / Wholesale |
| Order table | `marketplace_orders` | `customer_orders` / `customer_invoices` |
| Ledger truth | Settled on charge | Settled on invoice finalize |
| Failure mode if merged | B2B sees retail pricing, breaks margin | D2C sees terms/balance, breaks UX |

A B2B account placing a wholesale order via the DD storefront would either be wrongly billed at retail, or would require the storefront to leak terms/balance logic into the consumer flow. A consumer auto-charged via the portal would lose the immutable-invoice contract that finance depends on. Neither can absorb the other without breaking its own standard.

## Crossover (rare, deliberate)

A user can legitimately be **both** a DD consumer and a Customer Portal account holder. When that happens:

- Linkage lives in `customer_profiles.linked_customer_site_id` (nullable)
- Each surface still reads its own ledger — no cross-surface mutation
- Reporting joins are explicit and audit-tagged

Two surfaces. Two truths. One linkage column when the same human shows up on both sides.
