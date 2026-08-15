# Group A — money-path unread writes: per-function review

Date: 2026-08-15
Status: **REVIEW ONLY — no behaviour changed in these six functions yet**

Six functions were pulled out of the 85-site Group A backlog because a swallowed
write on them means money moved and the record didn't. Each is described below:
what the write is, what happens today when it fails, and what should happen.

The governing asymmetry, stated once:

- **Stripe retries webhooks.** A non-2xx from a webhook is not "the error was
  reported", it is "Stripe will send this again, on a backoff, for days". So a
  webhook may only fail the request for a write that a retry could actually
  repair. A failed audit/telemetry insert must not 5xx — that is an infinite
  retry loop over a log line.
- **Caller-invoked functions do not retry.** For those, a swallowed write is
  final. They should fail loudly.

---

## 1. `ut-stripe-webhook` — Stripe-retried

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `ut_bookings.update({status:'confirmed'})` on `payment_intent.succeeded` | Silent. Card charged, booking stays `pending` forever. | **Fail the request (5xx).** Retry is the correct repair: the update is idempotent, and Stripe replaying it is exactly what we want. |
| B | `ut_bookings.update({status:'cancelled'})` on `payment_intent.payment_failed` | Silent. Booking stays `pending`, blocks inventory. | **Fail the request.** Same reasoning — idempotent, retryable. |
| C | `ut_vendors.update({verified})` on `account.updated` | Silent. Vendor shows unverified. | **Log, return 200.** Not tied to a charge; the next `account.updated` corrects it. Retrying the whole event for this is disproportionate. |
| D | `ut_bookings.update({stripe_transfer_id})` on `transfer.created` | Silent. Payout untraceable to a booking. | **Fail the request.** This is the only record linking a transfer to a booking; there is no second source. |

Also note: the confirmation and invoice `fetch` calls at A are fire-and-forget
with `.catch(console.error)`. Those are correct as-is — a failed confirmation
email must not roll back a paid booking — but the failure currently logs an
object. That is Group B and was fixed.

**Net: three writes gain a 5xx path, one stays best-effort.**

## 2. `ut-process-booking-payment` — caller-invoked, no retry

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `ut_pub_events.insert(...)` | Silent; `event?.id` becomes `undefined` and every booking below is written with a null `event_id`. | **Abort before creating bookings.** |
| B | `ut_bookings.insert(...)` per item | Silent; the id is simply absent from `bookingIds`. The caller gets a `client_secret` and a short list and cannot tell. | **Abort the whole request.** |
| C | `ut_event_builds.update({status})` | Silent; build stays re-payable. | **Log, still return.** By this point the PaymentIntent exists and the caller needs the `client_secret`; losing it is worse than a stale build status. |

The sharp edge here is ordering, not logging: the Stripe PaymentIntent is created
at line 36, **before** any row is written. So A and B fail *after* Stripe has a
live intent. Failing the request leaves an orphan intent — acceptable (an
uncaptured intent expires), and strictly better than handing the browser a
`client_secret` for bookings that do not exist. The real fix is to create rows
first and the intent last; that is a larger change and is called out here rather
than done silently.

## 3. `ut-process-refund` — caller-invoked, no retry

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `ut_bookings.update({status:'cancelled', refund_amount})` | Silent. **The Stripe refund has already been issued at this point.** Money left the account and the booking still reads as active and paid. | **Fail loudly, and say the refund succeeded.** The response must distinguish "no refund issued" from "refund issued, record not updated" — the second needs a human, and the caller must not retry it into a double refund. |
| B | vendor notification email | Wrapped in the outer try; a send failure 500s the whole call *after* the refund went out. | **Catch and log.** An email must never fail a completed refund. |

This is the worst of the six. It is the only one where a swallowed write follows
an irreversible money movement, and the only one where the current error
handling can make things worse by inviting a retry.

## 4. `ut-verify-payment` — caller-invoked, polled

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `ut_orders.update({payment_status:'paid', ...})` | Silent, then returns `{status:"paid"}`. The client believes the order is paid; the row says otherwise. | **Fail the request.** Safe: the function is idempotent (it early-returns on `payment_status === 'paid'`) and is polled, so the next poll repairs it. |
| B | `ut_payments.insert(...)` | Silent. No payment record for a paid order — this is the row the revenue surface reads. | **Fail the request**, but only after A has committed, so a retry does not double-insert. Needs a uniqueness guard on `stripe_payment_intent_id` first. |
| C | `ut_event_requests.update({status:'paid'})` | Silent. Downstream request stays unpaid. | **Log, return 200.** Derived state; the order is the truth. |

## 5. `ut-track-ambassador-sale` — caller-invoked

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `ut_pub_referrals.insert(...)` | Silent. Commission never owed. Ambassador is not paid and nobody finds out. | **Fail the request.** |
| B | `ut_pub_ambassadors.update({total_sales, total_earned, tier})` | Silent. Totals drift from the referral rows. | **Fail the request** — but note this write is a read-modify-write of a running total and is *already* racy under concurrent sales. Errors are the smaller of its two problems; the totals should be derived from `ut_pub_referrals`, not accumulated. Flagged, not fixed. |
| C | Twilio SMS notification | best-effort | **Correct as-is.** |

## 6. `book-experience` — caller-invoked

Mostly already correct: `experiences_master` and `experience_bookings` both
destructure `{ error }` and return 404/500 with an alert. Remaining gaps:

| # | Write | Today on failure | Should be |
|---|---|---|---|
| A | `experience_bookings.update({supplier_confirmation, booking_status:'confirmed'})` after a successful Viator call | Silent. **Viator has a live booking we have no reference to.** | **Fail loudly, and alert.** Same class as refund: the external side already committed. |
| B | `experience_customers` insert/update | Silent. CRM totals drift. | **Log, return 200.** No money attached; must not fail a confirmed booking. |
| C | `logAlert()` → `experience_alerts.insert` | Silent — and this is the failure path's own reporting. If it fails, the alert about the failure disappears too. | **Log, never throw.** Wrap the insert; a failing alert table must not mask the error it was describing. |

---

## Summary of the decision, by class

| Class | Functions | Rule |
|---|---|---|
| Write repairable by retry, before money moved | webhook A/B/D, verify A/B, booking-payment A/B | **Fail the request** |
| Write after an irreversible external commit | refund A, book-experience A | **Fail loudly + alert + say the external side succeeded** so nobody retries it |
| Derived / cosmetic / notification | webhook C, booking-payment C, verify C, amb C, book-exp B/C, all emails and SMS | **Log with `errText`, return 200** |

Two structural problems surfaced that logging cannot fix and that are out of
scope for this pass:

1. `ut-process-booking-payment` creates the Stripe intent before the rows.
2. `ut_pub_ambassadors` accumulates totals instead of deriving them.
