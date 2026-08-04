# Wire the "Get This Site" claim CTA on generated demos

Goal: a prospect on a live demo site can click a claim button, pick a tier, and land on a real Stripe checkout — end to end, verifiable in a browser.

Today `demo-stripe-checkout` works when invoked directly, but nothing renders a claim button on shipped demos and no build variable tells the template which demo it is. Two halves have to land: template changes in the external `brandaro-base` repo, and one extra env-var block in the deploy path here.

## 1. What goes into the demo template (brandaro-base)

### Claim bar + modal

A persistent claim bar, visually separate from the prospect-facing "Request a Free Quote" CTA so the two are never confused:

- Fixed bottom bar (desktop) / sticky footer strip (mobile), branded in Brandaro colors, not the demo's own `VITE_COLOR_PRIMARY`.
- Copy: "This is a demo site built for {business name}." + primary button "Get This Site".
- The bar renders only when `VITE_DEMO_ID` is present. On a real paid client site the variable is absent and the bar disappears with no code change. This is the single kill switch.

Clicking "Get This Site" opens a small modal rather than jumping straight to Stripe.

### Tier handling — recommendation

Do not default silently to one tier, and do not show a full three-column pricing table. Use a **preselected default with visible alternatives**:

- Three radio-style cards inside the modal: Starter, Pro, Custom, with Starter preselected.
- Prices are not hardcoded in the template — they arrive as one env var (below) so pricing changes never require a template redeploy.
- Custom is a real tier in `brandaro_stripe_config` and checks out like the others; no "contact us" branch.
- One email field (required) and an optional name field. Email is passed through so Stripe prefills it and the webhook can match the buyer.

### The request

On submit the modal POSTs JSON to the checkout endpoint:

```
{ demo_id, tier, customer_email, customer_name }
```

and redirects the browser to the returned `checkout_url`. No Supabase client library, no anon key, no auth header — the function is public and CORS is already open. A plain `fetch` keeps the template dependency-free.

Error handling: the function returns `{ error }` with a 4xx/5xx for already-purchased demos, unknown demo ids, and unconfigured pricing. Those strings are user-safe and should be shown inline in the modal, not swallowed. A demo that has already been bought shows "This site has already been claimed" and the bar hides itself.

## 2. What changes in the deploy path (this project)

`_shared/vercelDeploy.ts` currently syncs 11 `VITE_` vars per build. Add three required ones to the same block, so they follow the identical upsert-then-hook path:

| Variable | Value | Why |
|---|---|---|
| `VITE_DEMO_ID` | `payload.demo_id` | The uuid the checkout call needs; also the render gate for the claim bar |
| `VITE_CHECKOUT_ENDPOINT` | backend functions base URL + `/demo-stripe-checkout`, built server-side from the existing environment | Keeps the endpoint out of the template repo and out of source control |
| `VITE_TIERS_JSON` | serialized `[{tier,label,price_display,blurb}]` read from `brandaro_stripe_config` for the active mode | Pricing stays database-driven; the template renders whatever it is handed |

`VITE_TIERS_JSON` is built by a small helper that reads `brandaro_stripe_config` filtered to the resolved Stripe mode and excludes the `hosting` tier (that is the recurring subscription, not a claim purchase). If the read fails, the var is omitted and the template falls back to a single "Get This Site" button that posts `tier: "starter"` — degraded but still functional.

`brandaro-generate-demo` needs no change beyond this, since it already passes `demo_id` into `tryVercelHook`. `brandaro-score-demo`'s auto-fix loop redeploys through the same shared helper and inherits the new vars automatically.

### Mode safety

`demo-stripe-checkout` resolves test vs live from `STRIPE_MODE`, defaulting to test. The template must never send a `mode` field — leaving that decision server-side means a demo page can never force a live charge. `VITE_TIERS_JSON` must be built from the same resolved mode so displayed prices match what Stripe actually charges.

## 3. Where the work happens

Yes — the CTA bar, the modal, the tier cards, and the fetch call all live in `gasmask718/brandaro-base` and have to be built in that project's own Lovable instance, exactly like the sticky CTA bar and the other template edits done earlier today. This project cannot write into that repo.

Suggested order:

1. Ship the three env vars here first. Harmless on their own — the current template ignores unknown `VITE_` vars.
2. Regenerate one demo and confirm the three variables are present on the Vercel project.
3. Build the claim bar in the brandaro-base instance against those now-real variables.
4. Verify live.

## 4. Verification

Against a freshly generated demo, in test mode:

- The claim bar renders and is visually distinct from the quote CTA.
- Clicking through with a test email produces a network call to the checkout endpoint returning `checkout_url`, and the browser lands on a Stripe checkout page showing the correct tier price.
- Completing the test payment fires `demo-stripe-webhook` and stamps `paid_at` on the demo row.
- Reloading the demo after purchase shows the claimed state instead of the buy button.
- A page with no `VITE_DEMO_ID` renders no claim bar at all.

## Open question

Custom tier is priced at $2,499 in test config. Confirm whether prospects should be able to self-checkout at that price, or whether Custom should instead open an inquiry form and route to a rep.
