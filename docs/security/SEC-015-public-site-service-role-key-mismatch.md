# SEC-015 — PUBLIC_SITE_SERVICE_ROLE_KEY is not a service-role key

**Status:** OPEN (needs the correct key from the public project owner)
**Filed:** 2026-08-11

## Finding
`proxy-public-data` boots fine (URL + key present, no 503), but reads behave exactly like an
anonymous PostgREST client on the public project: 12 of 14 allow-listed tables return
`42501 permission denied for function has_role` / `permission denied for table bookings`.

Probing the public project directly with the hardcoded anon key from `src/lib/publicSiteApi.ts`
returns byte-identical responses, which means the secret stored as
`PUBLIC_SITE_SERVICE_ROLE_KEY` is (or behaves as) the **anon** key, not the service role key.

## Impact
TopTier admin pages that read partners, promo_codes, affiliates, affiliate_commissions,
partner_earnings, payments, bookings, service_packages, add_on_packages, commission_rates will
render empty — the proxy returns errors, `pubFetch` swallows them and yields `[]`.
Not a security exposure; a functional break plus a misleading secret name.

## Also found while testing
- Three allow-listed names do not exist on the public project:
  `commission_rates`, `packages`, `add_ons`, `commissions` → `PGRST205`
  (suggested real names: `commission_ledger`, `vip_packages`, `add_on_packages`).
  These come from client call sites that were already querying non-existent tables.
- `PUBLIC_SITE_ORIGIN` points at the marketing site (returns HTML), not the data API. The proxy
  now uses the public project's REST base explicitly and no longer falls back to that origin.

## Fix direction
Store the public project's real `service_role` key under `PUBLIC_SITE_SERVICE_ROLE_KEY`
(project is at the 100-secret cap — update the existing secret, don't add a new one), then re-run
the 14-table probe. Separately, correct the three wrong table names at the call sites.
