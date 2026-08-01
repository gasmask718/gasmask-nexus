# Step 16 (automated half) — Monthly hosting billing starts at "live"

When a dev flips a paid build job to **live** on `/brandaro/builder`, the client's recurring
hosting subscription is created in Stripe and recorded in `brandaro_subscriptions`. Domain
connection stays manual (out of scope).

## 1. Hosting price — created

A SINGLE flat recurring price of **$99/month** (`Brandaro Hosting & Maintenance`), stored as one
config row in `brandaro_stripe_config` under tier `hosting` — not tiered by starter/pro/custom.
Created by the extended `brandaro-stripe-bootstrap-products` (idempotent, test mode).

## 2. New edge function: `brandaro-start-hosting-subscription`

Internal (`verify_jwt` on, invoked from the admin dashboard by a signed-in dev; the function
also re-checks the caller is an admin). Input: `{ build_job_id, mode? }`. Mode resolves exactly
like `demo-stripe-checkout`: explicit → `STRIPE_MODE` → **test** (safe default).

Flow:
1. Load the job + linked demo. Reject if the job is not paid / has no tier.
2. **Duplicate guard (double-locked):**
   - a `brandaro_subscriptions` row for this `project_id` with status `active`/`trialing`
     → return `{ already: true }` and do nothing;
   - plus a unique index so a race can't create two.
3. Resolve the Stripe customer:
   - retrieve the original Checkout Session (`brandaro_demo_sites.stripe_session_id`) and reuse
     `session.customer` when present;
   - else look up / create a customer by the intake `contact_email`;
   - else fail loudly with `error` (no silent skip) — the dev sees a toast.
4. `stripe.subscriptions.create({ customer, items: [{ price: hostingPriceId }],
   metadata: { build_job_id, demo_id, tier, brandaro: "hosting" } })`.
   Billing starts immediately (the build fee already covered setup).
5. Insert into `brandaro_subscriptions`: `client_id` (job.client_id), `project_id` (job.id),
   `tier`, `service_type = 'hosting'`, `monthly_fee` (dollars), `stripe_subscription_id`,
   `stripe_customer_id`, `status` (from Stripe), `started_at`, `next_billing_at`
   (`current_period_end`).

## 3. Fire only on the transition into `live`

In `PaidBuildsPipeline`'s existing status mutation: after the `build_status` write succeeds, if
the **previous** status was not `live` and the new one is, invoke the function once. Flipping
live → review → live again hits the active-subscription guard in step 2 and no second
subscription is created. Any other status change does nothing. The result is surfaced as a
toast ("Hosting subscription started" / "already active" / the raw error), and the row refetches.

## 4. Database migration

- Unique partial index on `brandaro_subscriptions (project_id)` where
  `status in ('active','trialing','past_due')` — the hard duplicate stop.
- Confirm/limit RLS so only admins read this table (it currently has no app traffic).

No changes to the checkout, webhook, intake, or provisioning functions.

## Technical notes

- Test mode by default; nothing bills a real card until `STRIPE_MODE=live` and live prices are
  bootstrapped.
- Stripe API version `2025-08-27.basil`, same client version as the existing functions.
- Subscription lifecycle events (payment failed, cancelled) are **not** synced in this pass —
  that needs a webhook and is a separate step; say the word and I'll add it after.
