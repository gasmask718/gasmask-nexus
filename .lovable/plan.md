
## GATING DEPENDENCY — read first

Dispatch can't go anywhere if no partners exist for the service. Current count in `tt_partners`:

| Service | Required `partner_type` | Partners loaded |
|---|---|---|
| slingshot | `novelty_operator` | **0** |
| jetski | `watercraft_operator` | **0** |
| helicopter | `helicopter_operator` | **1** (seed row `TEST_Heli_NY`, phone `+15550000006` — placeholder, not a real driver) |

**Net: there is effectively nobody to dispatch to for any of the three services today.** Build the flow now (so it's ready), but the live verify steps (real SMS → real partner taps Accept → capture fires) cannot run end-to-end until you load real partners for these three service types — same playbook as the batch-2 black-truck import.

Second flag: `tt_service_routing.helicopter` is currently `pricing_strategy='quote'`, `fulfillment_model='quote_then_dispatch'`. You asked for **fixed partner pricing** on helicopter. We will flip it to `fixed` + `auto_dispatch` to match slingshot/jetski. If you'd rather keep helicopter quote-first, say so and we'll branch.

---

## What's built today (relevant pieces)

- `create-tt-booking` inserts `tt_bookings` (status `confirmed`, `payment_status='paid'`) and a `tt_dispatches` row. No Stripe call here — payment happens upstream on the public site (`stripe_payment_intent_id` is passed in already-charged).
- `tt-smart-dispatch` fans the magic-link SMS to matching partners.
- `tt-partner-response` + SQL RPC `tt_claim_dispatch` is the race-safe atomic claim used by black trucks.
- `tt_bookings` has `payment_hold_status` + `payment_status` columns already (good — no schema migration needed for status, only `stripe_payment_intent_id` if missing — will check & add).

## What changes

### 1. Public-site booking submit (slingshot, jetski, helicopter)

Switch from "charge on book" / "no payment" to **auth-only hold**:

- Create Stripe `PaymentIntent` with `capture_method:'manual'`, `confirm:true`, amount = fixed partner price.
- Booking is created (via existing `create-tt-booking`) with new status `authorized_pending_confirmation`, `payment_status='authorized'`, `payment_hold_status='held'`, `stripe_payment_intent_id` stored.
- Affiliate attribution + notification-failure wiring from the last round is preserved (the only changed line is mode of payment).

This lives on the public-site repo. I'll ship the changes there in the same diff (the proxy/pub-site files are reachable from this project's edge functions; if the public-site repo is separate I'll mark exactly which file to copy over).

### 2. `create-tt-booking` — accept the new fields

Add optional inputs: `stripe_payment_intent_id`, `payment_mode` (`'auth_hold' | 'paid'`). When `auth_hold`:
- Set `status='authorized_pending_confirmation'`, `payment_status='authorized'`, `payment_hold_status='held'`.
- Insert `tt_dispatches` with `status='pending'` then invoke `tt-smart-dispatch`.

Black-truck path is unchanged (defaults to current behaviour).

### 3. `tt-partner-response` (+ `tt_claim_dispatch`) — capture on accept

After the atomic claim succeeds and dispatch flips to `accepted`:
- Look up booking's `stripe_payment_intent_id` + `payment_hold_status`.
- If `held`: call Stripe `paymentIntents.capture(pi)`.
  - Success → booking `status='confirmed'`, `payment_status='captured'`, `payment_hold_status='captured'`, accrue affiliate commission on captured amount (reuse existing `ambassador-sale-webhook` / commission write — same pattern as black truck).
  - Failure (card declined at capture, auth expired) → booking `status='capture_failed'`, log to `tt_notifications_log` as `capture_failure_alert` (channel `internal`), also SMS the customer + ops. Dispatch stays `accepted` so the partner isn't confused, but the booking is flagged loud.
- If already `captured` or `released` → no-op.

The claim RPC itself stays atomic; capture happens in the edge function right after, wrapped so a capture failure doesn't roll back the partner win.

### 4. Release path — `tt-release-expired-auths` (new edge function + cron)

- Run every 15 min. For every booking where `payment_hold_status='held'` AND (`expires_at < now()` OR all dispatches `declined`):
  - Cancel PaymentIntent (`stripe.paymentIntents.cancel(pi)`).
  - Booking → `status='unavailable'`, `payment_hold_status='released'`, `payment_status='released'`.
  - SMS customer: "No partner available for your <service> at <time>. Your card was never charged."
  - Log `auth_released` to `tt_notifications_log`.

"Window" defaults to **2 hours** from booking creation (configurable per service via a new `tt_service_routing.auth_hold_window_minutes`, default 120). Stored on the dispatch as `expires_at`.

### 5. 7-day expiry surfacing — `tt-stale-auth-alert` (new)

Same cron, separate query: any booking still `held` with `created_at < now() - interval '5 days'` → fire internal alert + surface in Penthouse ops as a "must capture or release" list. Stripe auths die at ~7 days, so 5-day warning gives runway.

### 6. Service routing fix

`UPDATE tt_service_routing SET pricing_strategy='fixed', fulfillment_model='auto_dispatch' WHERE slug='helicopter';`
(Confirm before I run.)

---

## Files to touch

- `supabase/functions/create-tt-booking/index.ts` — accept `payment_mode`, set auth-hold statuses.
- `supabase/functions/tt-partner-response/index.ts` — after successful `tt_claim_dispatch`, call Stripe capture; handle success/failure paths.
- `supabase/functions/tt-release-expired-auths/index.ts` — **new**, cron-driven.
- `supabase/functions/tt-stale-auth-alert/index.ts` — **new**, cron-driven (or fold into above).
- DB migration:
  - add column `tt_bookings.stripe_payment_intent_id text` if not present
  - add column `tt_dispatches.expires_at timestamptz` if not present (already exists for black truck; confirm)
  - add column `tt_service_routing.auth_hold_window_minutes int default 120`
  - extend the `tt_bookings.status` allowed-values check to include `authorized_pending_confirmation`, `capture_failed`, `unavailable` (if a CHECK exists)
- Data update (separate `insert` call): flip helicopter routing to fixed/auto_dispatch.
- Cron schedule (via `supabase--insert` + `pg_cron`/`pg_net`) for the two new functions.
- Public-site booking submit: switch slingshot/jetski to manual-capture PI, add same PI flow to helicopter.

## Secrets

`STRIPE_SECRET_KEY` is already wired (used by other TT edge functions). No new secret needed.

## Verify (real Stripe test mode)

Once partners are loaded for the three service types, run these end-to-end:

1. Book slingshot (test card `4000002500003155` for 3DS-skip, fixed price) → Stripe shows **uncaptured** PI, booking `authorized_pending_confirmation`, magic-link SMS sent to test partner.
2. Test partner taps Accept → Stripe shows PI **succeeded** (captured), booking `confirmed`, affiliate commission row created if `?ref=` was set.
3. Book a second one, let the auth window lapse with zero accepts → cron fires, Stripe shows PI **canceled**, booking `unavailable`, customer SMS sent.
4. Repeat for jetski + helicopter.
5. Negative path: book, partner accepts, but use Stripe test card `4000000000000259` (charges fail on capture) → booking `capture_failed`, ops alert fires, no silent held-state.

## Open questions before I build

1. **Auth hold window** — default 2 hours OK, or do you want a different window per service (jetski day-of vs helicopter 24h+ lead time)?
2. **Helicopter pricing** — flip to fixed/auto_dispatch as above, or keep quote-first and add auth-hold only after admin confirms the quote? (I recommend fixed/auto_dispatch since you said "fixed partner pricing, no quote".)
3. **Partner loading** — want me to also draft the partner-import migration for slingshot/jetski/helicopter (mirroring batch-2 black truck), or is that a separate task once you have the supplier list?

Say go (with answers to 1–3) and I'll ship the diff.
