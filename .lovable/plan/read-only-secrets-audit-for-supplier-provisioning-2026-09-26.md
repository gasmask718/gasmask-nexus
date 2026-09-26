# Read-only secrets audit for supplier provisioning

Nothing was deleted, modified or created. No secret values were viewed or revealed — names only.

## What exists
- The project is at the **100-secret limit** (the maximum), which is why the one-time ops secret for supplier provisioning could not be added.
- Full name list was retrieved via the secrets tool (values are encrypted and never displayed). Names were reported in the previous turn's tool output.

## Usage check (static, names only)
- Every one of the 100 secrets is referenced at least once in the codebase (edge functions, src, scripts). **No secret is provably unused from static analysis.**
- Caveat: "referenced in code" does not prove a secret is still operationally needed (the feature using it may be retired). Safely determining that requires your knowledge of which integrations are still live. Candidates worth your review (referenced but tied to features that may be inactive): `DEMO_STRIPE_WEBHOOK_SECRET`, `RECEPTIONIST_STRIPE_WEBHOOK_SECRET_TEST`, `STRIPE_SECRET_KEY_TEST`, `VIATOR_API_KEY`, `IDEOGRAM_API_KEY`, `VERCEL_API_TOKEN`, `YELP_API_KEY`, `OUTSCRAPER_API_KEY`. This is a review list, not a deletion recommendation.

## Can an existing secret be reused for supplier provisioning?
**Not as deployed.** The provisioning function (`dd-provision-wholesaler`) accepts exactly two forms of authorization:
1. An admin/owner login token (Bearer JWT), or
2. The header `x-provision-secret` matching the env var **`DD_PROVISION_SECRET`** — and that name is not currently set.

No existing secret is read by this function, so none can be reused without a small code change.

## Safest options (pick one — nothing happens until you confirm)

**Option A (recommended, no code change):** You identify one secret you know is obsolete (from the review list above or your own knowledge) and confirm its name. I delete exactly that one secret, generate `DD_PROVISION_SECRET`, then create Anna's internal supplier account (placeholder email, generated password, no invitation sent). The ops secret stays in place for future internal provisioning.

**Option B (no secret deletion):** I make a small edit to `dd-provision-wholesaler` so it also accepts an existing ops-style secret (e.g. `DYNASTY_OS_API_KEY`) as the provisioning header, redeploy the function, then provision Anna's account. This touches deployed code for a one-time task.

**Option C:** You sign in to the preview as the owner account and I guide you through triggering the provisioning from your session. Most manual; no secret or code changes.

## After provisioning (same for all options)
- Supplier record "Anna" with placeholder email on our own domain (changeable later), generated password reported to you.
- No products imported or published; catalog untouched; supplier self-serve import is available by logging in as that supplier; all imports land in the admin review queue.
