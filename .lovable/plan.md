# Wire Real Revenue into Revenue Analytics

Close the disconnect found in the audit: money moves through Stripe and lands in
`brandaro_clients` / `brandaro_subscriptions`, but `brandaro_revenue_tracking`
(the only source the Revenue Analytics page reads) is never written by the paid
pipeline. Nothing built today is removed or rerouted — this only adds a ledger
write alongside the existing writes.

## 1. Ledger schema (one migration)

`brandaro_revenue_tracking` today has no way to tie a row to a client or to a
Stripe object, so a webhook retry would double-count. Add:

- `client_id uuid` -> `brandaro_clients(id)` ON DELETE SET NULL
- `subscription_id uuid` -> `brandaro_subscriptions(id)` ON DELETE SET NULL
- `stripe_reference text` — the Stripe object id that caused the row
  (checkout session id, invoice id, or subscription id)
- `source text` default `'manual'` — `'stripe_checkout'`, `'stripe_invoice'`,
  `'hosting_start'`, `'manual'`
- Unique index on `stripe_reference` where it is not null (idempotency guard)

Existing columns, RLS, and the single frontend query are unchanged, so the page
keeps working with no code change on those columns. Nothing is backfilled —
`brandaro_revenue_tracking` is currently empty and no real payment has happened.

## 2. Shared writer: `_shared/brandaroRevenue.ts`

One helper, `recordRevenue()`, mirroring the `brandaroClient.ts` pattern
(never throws, logs, safe inside best-effort webhook paths). It:

- skips silently when `stripe_reference` already exists (retry-safe)
- writes amount, `revenue_type`, `client_id`, `lead_id`, `attributed_industry`
  and `attributed_campaign` (so the Description/Source columns are not blank)

## 3. One-time build payment — `demo-stripe-webhook`

After the existing `ensureClientForJob(...)` call (which stays exactly as is),
add a `recordRevenue()` call:

- amount = `session.amount_total / 100`
- `revenue_type` = `website_starter` / `website_pro` / `website_custom`,
  derived from the tier metadata (falls back to `website_build`)
- `stripe_reference` = the checkout session id
- description = business name, source = the demo's industry

Failure is logged only — the 200-always contract with Stripe is preserved.

## 4. Recurring hosting revenue

Your instinct is right: `brandaro-start-hosting-subscription` only fires once,
at activation, so it cannot represent months 2..N. Both halves get wired:

- **Activation** (`brandaro-start-hosting-subscription`): after
  `syncClientMRR(...)`, record a `hosting_monthly` row for the first charge,
  keyed on the Stripe subscription id.
- **Ongoing** (new function `brandaro-billing-webhook`, public, signature
  verified with the same live/test dual-secret pattern already used by
  `demo-stripe-webhook`): handles `invoice.payment_succeeded` — one ledger row
  per paid invoice keyed on the invoice id — plus
  `customer.subscription.updated/deleted` to flip
  `brandaro_subscriptions.status` and re-run `syncClientMRR`, so cancellations
  actually drop the run-rate.

  The activation row and the first invoice both exist in Stripe, so the first
  invoice's id is checked against the activation row's reference to avoid a
  duplicate first month.

  This is a NEW endpoint — it does not touch the `demo-stripe-webhook`
  endpoint or its signing secret. You will need to add one webhook endpoint in
  the Stripe dashboard afterwards; I will give you the URL and the exact event
  list, and request the signing secret at that point.

## 5. True MRR on the Revenue Analytics page

Replace the current "sum every row whose type contains 'monthly' forever" logic
in `src/pages/brandaro/RevenueAnalyticsPage.tsx` with a run-rate read from the
same source we already made canonical:

```
MRR = sum(brandaro_subscriptions.monthly_fee) where status in
      ('active','trialing','past_due')
```

This is exactly what `syncClientMRR` writes into
`brandaro_clients.monthly_recurring`, so the War Room and this page will agree.
The other three cards (Total, This Month, This Week) keep reading
`brandaro_revenue_tracking` as actual cash collected. The MRR card gets a
"Active subscriptions" sublabel so the difference in meaning is explicit.

Also adds an "Active subs" count and keeps the calendar-week definition as-is
(Sunday start) — flagged in the audit, not a bug.

## Conflict check

- `demo-stripe-webhook`: one additive call after the existing client write; no
  reordering, no change to signature handling or the always-200 contract.
- `brandaro-start-hosting-subscription`: one additive call after
  `syncClientMRR`; idempotency guards and the existing early-return path for an
  already-active subscription are untouched.
- `_shared/brandaroClient.ts`: unchanged.
- The older proposal path (`brandaro-post-payment`, `brandaro-stripe-webhook`)
  stays untouched, as agreed.

## Verification

Insert a simulated paid checkout + a simulated invoice through the helpers,
confirm the page shows correct Total / This Month / MRR, confirm a repeated
Stripe reference produces no second row, then delete the test rows and confirm
the ledger returns to empty.
