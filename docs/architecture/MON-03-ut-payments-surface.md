# MON-03 — UT payments surface (Collected has no source)

Status: OPEN
Opened: 2026-08-11
Related: MON-02 (UT revenue dashboard rebuild)

## Problem

The UT revenue dashboard splits revenue into three numbers: Pipeline, Contracted,
Collected. Pipeline and Contracted both trace to `ut_event_bookings` columns.
**Collected has no source.**

What exists today:

- `ut_event_bookings.deposit_paid` (boolean) and `deposit_amount` (numeric) — a flag,
  not a payment record. No amount, no date, no processor reference.
- `ut_event_bookings.stripe_payment_intent_id` — nullable, unpopulated on all 3 rows.
- `ut_orders` — has `payment_status`, `paid_at`, `total_price`. Currently 0 rows.
  This is the closest thing to a real settlement record.
- `business_transactions` — receives settled UT revenue via `ut-ingest` (PIPE-01),
  but only for shop/kit orders, not event bookings.

Live contradiction as of this ticket: booking `8f0751bd-8e7d-4d56-b447-6a238c731c03`
is `status = 'deposit_received'` with `deposit_paid = false` and no payment intent.
Either a payment happened and was never recorded, or the status was set by hand.
The dashboard now renders this contradiction rather than hiding it.

## Resolution options

1. Make `ut_orders` the settlement record for event bookings too (bookings get an
   order row on deposit), and source Collected from `ut_orders` where
   `payment_status = 'paid'`.
2. Source Collected from `business_transactions` where `category = 'Unforgettable Times'`
   once event bookings also flow through `ut-ingest`.

Option 2 is preferred: one revenue surface, already verified end-to-end.

## Until then

`UTRevenueDashboard` renders Collected as `$0 collected` plus the count of bookings
marked confirmed with no payment record. Do not substitute `deposit_amount` or
`full_price` for Collected — that reintroduces the MON-02 class of bug.
