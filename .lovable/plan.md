# Wire the "Get This Site" claim CTA end-to-end

Goal: a prospect on a live demo can click one button, land on Stripe, and pay — with the demo_id attached so `demo-stripe-webhook` can mark the demo sold.

Today the two halves exist but nothing connects them: `demo-stripe-checkout` works when invoked directly, and the demo sites render fine, but no shipped demo contains a claim button and the Vercel builds receive no checkout data.

## Part 1 — What goes into gasmask718/brandaro-base

### Tier strategy: one headline tier + an upgrade line

Do not build a three-column pricing table into the demo. The demo's job is to sell the site, not to make the prospect comparison-shop. Recommended:

- Sticky/hero CTA button → **Starter**, one click, straight to Stripe.
- Directly beneath the button, a single quiet line: "Need e-commerce, booking, or custom pages? See Pro & Custom" → opens a small modal with the three tiers, each with its own buy button.

That keeps the primary path to a single click while Pro/Custom remain reachable. All three tiers are already valid inputs to `demo-stripe-checkout`.

### Components to add

1. `ClaimSiteButton` — the primary CTA. Placement: sticky bar (reuse the bar already added today) plus one placement at the end of the page. Label: "Get This Site — $499" (price read from env, not hardcoded).
2. `ClaimTiersModal` — renders the tier list from `VITE_CLAIM_TIERS_JSON`; each row calls the same handler with a different tier.
3. `useClaimCheckout()` — the single fetch path:

```ts
const res = await fetch(`${import.meta.env.VITE_CHECKOUT_URL}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    demo_id: import.meta.env.VITE_DEMO_ID,
    tier,                       // "starter" | "pro" | "custom"
    customer_email: email || undefined,   // optional, prefilled if collected
  }),
});
const { checkout_url, error } = await res.json();
if (checkout_url) window.location.href = checkout_url;
```

No auth header is needed — the function runs with `verify_jwt = false` and its CORS allowlist is `*`.

### Behavior rules for the template

- Render the CTA **only** when `VITE_DEMO_ID` and `VITE_CHECKOUT_URL` are both present. A missing var must hide the button, never render a dead one.
- Button shows a spinner while the request is in flight and disables on click (double-submit guard).
- On a non-200 or a payload with `error`, show the returned message inline rather than failing silently. The function already returns human-readable strings ("This demo has already been purchased", "Pricing not configured for tier…").
- The prospect is anonymous; do not gate on email. Stripe Checkout collects it. An optional email field before redirect is fine but must not block.
- The CTA is Brandaro-facing, visually distinct from the prospect-facing "Request a Free Quote" CTAs so the demo still reads as the business's own site.

## Part 2 — Changes on this side (`brandaro-generate-demo`)

All env-var syncing is centralized in `supabase/functions/_shared/vercelDeploy.ts` → `tryVercelHook()`. Both callers (`brandaro-generate-demo` and `brandaro-score-demo`'s auto-fix redeploy) already pass `demo_id` in the payload, so adding the vars in that one file covers both paths automatically — no divergence.

### New env vars pushed to the industry's Vercel project

| Key | Value | Source |
|---|---|---|
| `VITE_DEMO_ID` | the demo UUID | `payload.demo_id` (already in the payload interface, currently unused) |
| `VITE_CHECKOUT_URL` | `${SUPABASE_URL}/functions/v1/demo-stripe-checkout` | built from the env |
| `VITE_CLAIM_TIERS_JSON` | `[{tier,label,amount_cents}]` | read from `brandaro_stripe_config` for the active mode |
| `VITE_CLAIM_ENABLED` | `"1"` / `"0"` | kill switch, so the CTA can be pulled without a template change |

These join the existing required block (`VITE_BUSINESS_NAME`, `VITE_DEMO_SLUG`, etc.) and use the same non-fatal upsert — a failed claim var must never block the deploy.

### One data gap to close first

`brandaro_stripe_config` has `amount_cents` populated for all four **test** rows (starter 49900, pro 99900, custom 249900, hosting 9900) but **null for all three live rows**. If the CTA displays a price, live builds would render blank. Fix: backfill `amount_cents` on the live rows before shipping, or have the template fall back to a label-only button ("Get This Site") when the amount is missing. Recommend doing both.

### Known constraint, unchanged

Vercel env vars are project-scoped, and there is one project per industry — so only the newest demo per industry is live at a time. `VITE_DEMO_ID` inherits exactly that constraint: an older demo URL that is still resolvable would carry the newer demo's id. This is the same accepted trade-off already documented for the personalization vars. Worth flagging separately if claim links need to stay valid after the next demo in that industry generates.

### Also verify

- `success_url` points at `https://brandarodigital.com/thanks?demo_id=…&session=…`. Confirm that page exists and renders; otherwise a paying customer lands on a 404 immediately after paying.
- `STRIPE_MODE` resolves to `test` unless explicitly set to `live`. Live tier price IDs exist, so flipping is a secret change, not a code change.

## Part 3 — Yes, the button ships from Brandaro Base's own instance

Confirmed. `gasmask718/brandaro-base` is a separate repo built by its own Lovable project; nothing in this repo can edit it — same as the sticky CTA bar and the earlier template fixes today. So the split is:

- **This project (Dynasty OS):** the four env vars in `vercelDeploy.ts`, the `amount_cents` backfill, and the `/thanks` page check. Ship first — harmless on its own, since unused env vars are inert.
- **Brandaro Base project:** the button, the modal, and the fetch hook, consuming the vars. Ship second.

Sequencing that way means the very next generated demo in any industry already has the data waiting when the template change lands.

## Verification

1. Generate a demo, then read back the Vercel project's env list — confirm all four keys present with the right values.
2. Load the deployed demo in a real browser, click the CTA, confirm a request to `demo-stripe-checkout` and a redirect to `checkout.stripe.com` (test mode).
3. Pay with a test card; confirm `demo-stripe-webhook` fires and sets `paid_at` on the row.
4. Click the CTA again on the same demo — confirm the "already been purchased" error surfaces instead of a second session.

## Technical notes

- Files touched here: `supabase/functions/_shared/vercelDeploy.ts` only (plus one small migration/update for `amount_cents`).
- `demo-stripe-checkout` itself needs no changes — its validation, mode resolution, price lookup, and paid/failed guards already handle this call shape.
