# brandaro-base — "Get This Site" claim CTA

These files are staged here in Dynasty OS for review. They belong in the
**`gasmask718/brandaro-base`** GitHub repo (the Vercel template), not in this app.
Copy them across at the same paths, wire the three call sites below, commit.

No separate Lovable instance is needed — brandaro-base is a plain Vite/React/Tailwind
repo edited directly on GitHub. Any push triggers all 16 industry projects to rebuild
on their next deploy hook.

## Files

| Path | Purpose |
|---|---|
| `src/lib/claimConfig.ts` | Reads/validates the env vars. Single source of truth for "should the CTA exist at all". |
| `src/hooks/useClaimCheckout.ts` | POSTs to `demo-stripe-checkout`, redirects to Stripe. |
| `src/components/claim/ClaimSiteButton.tsx` | The CTA. `variant="bar"` (sticky) and `variant="section"` (end of page). |
| `src/components/claim/ClaimTiersModal.tsx` | Starter / Pro / Custom modal, each with its own buy action. Exports `Spinner`. |
| `src/pages/PurchaseConfirmed.tsx` | Post-payment page for real buyers. Replaces `/thanks`. |

## Wiring (3 edits in brandaro-base)

**1. Sticky bar** — inside the existing sticky bar component, alongside the
"Request a Free Quote" button:

```tsx
import { ClaimSiteButton } from "@/components/claim/ClaimSiteButton";
// ...
<ClaimSiteButton variant="bar" />
```

**2. End of page** — in the page layout, after the last content section and
before the footer:

```tsx
<ClaimSiteButton variant="section" />
```

**3. Route** — register the confirmation page:

```tsx
import PurchaseConfirmed from "@/pages/PurchaseConfirmed";
// ...
<Route path="/purchase-confirmed" element={<PurchaseConfirmed />} />
```

## Env vars (already injected by Dynasty OS)

Set automatically per-project by `supabase/functions/_shared/vercelDeploy.ts`
on every demo generation:

- `VITE_DEMO_ID`
- `VITE_CHECKOUT_URL` → `demo-stripe-checkout`
- `VITE_PURCHASE_STATUS_URL` → `demo-purchase-status`
- `VITE_CLAIM_TIERS_JSON` → `[{tier,label,amount_cents}]` from `brandaro_stripe_config`
- `VITE_CLAIM_ENABLED` → `"1"` / `"0"` kill switch

Nothing renders unless `VITE_CLAIM_ENABLED === "1"` **and** `VITE_DEMO_ID`,
`VITE_CHECKOUT_URL` and at least one tier are all present. There is no path
that produces a dead button.

Kill switch: set the `BRANDARO_CLAIM_ENABLED` secret to `0` in Dynasty OS and
regenerate — the CTA disappears from every demo.

## Styling note

The CTA never reads `VITE_COLOR_PRIMARY`. It is deliberately Brandaro slate/white
so it reads as the agency speaking, never as the demo business's own "Request a
Free Quote" CTA.

## Remaining OS-side flip

`demo-stripe-checkout` still sends buyers to `https://www.brandarodigital.com/thanks`.
Once the route above is live in brandaro-base, change `successUrl` to the demo's own
domain:

```ts
const successUrl = `${demo.demo_url}/purchase-confirmed?demo_id=${demo_id}&session={CHECKOUT_SESSION_ID}`;
```

Held back deliberately — flipping it before the route exists would 404 paying customers.
