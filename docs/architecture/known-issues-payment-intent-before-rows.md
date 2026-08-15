# TICKET: `ut-process-booking-payment` creates the Stripe intent before any row

Status: **OPEN — not scheduled**
Raised: 2026-08-15
Function: `supabase/functions/ut-process-booking-payment/index.ts`
Class: order-of-operations, not error handling

## The shape

The PaymentIntent is created first. Only then are `ut_pub_events` and the
per-item `ut_bookings` rows written. So the sequence is:

```
stripe.paymentIntents.create()   <- Stripe now holds a live intent
insert ut_pub_events             <- may fail
insert ut_bookings  (per item)   <- may fail, partially
```

Every failure below the first line happens with a live intent already at
Stripe. Once the browser confirms that `client_secret`, the customer is
charged for rows that may not exist.

This is the same shape as the destination charge that was removed earlier: an
order of operations that is wrong and has not bitten because the volume is
low. It will bite the first time an insert fails after a customer has been
charged.

## What was done in the errText pass (2026-08-15)

Failure handling only, not ordering. The event insert and each booking insert
now destructure `{ error }` and abort the request, and the thrown message names
the orphaned intent id so it can be found:

```
event record write failed (payment intent pi_... left uncaptured): ...
```

An uncaptured intent expires on its own, so aborting is survivable and strictly
better than returning a `client_secret` for bookings that were never written.
It does not fix the hazard — it only makes the hazard legible in the logs.

## The fix

Invert the order: write `ut_pub_events` and all `ut_bookings` rows first with
`status: 'awaiting_payment'`, create the PaymentIntent last, then attach
`stripe_payment_intent_id` to the rows in one update. A failure before the
intent exists costs nothing but orphan pending rows, which are cheap to sweep
and cannot charge anyone.

Requires: a sweep for stale `awaiting_payment` rows, and confirming nothing
downstream assumes a booking always carries a `stripe_payment_intent_id` at
insert time.

## Trigger to schedule this

Any of: a report of a charge with no booking, booking volume rising past
occasional, or the next change to this function for any reason. Do not add
another feature to this function without inverting the order first.
