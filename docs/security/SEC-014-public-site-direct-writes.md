# SEC-014 — Browser-side direct writes to the public site DB (hardcoded anon key)

**Status:** OPEN (logged, not fixed)
**Filed:** 2026-08-11
**Related (closed same day):** SEC-012 external-db-proxy deleted, SEC-013 proxy-public-data gated (JWT + table allow-list)

## Exposure
`src/lib/publicSiteApi.ts` — `pubPatch()`, `pubPost()`, `pubDelete()` bypass the proxy entirely and
issue PATCH/POST/DELETE straight from the browser to
`https://hruhkyvwtfpfviwnvhne.supabase.co/rest/v1/<table>` using a **hardcoded anon key** shipped in
the client bundle (`PUBLIC_KEY`, `directHeaders`).

Anyone who loads the app can extract the key and write to any table on the public project that the
`anon` role can reach. Gating `proxy-public-data` does not affect this path.

## Write call sites (13)
- `TTPromoCodes.tsx` — pubPost/pubPatch/pubDelete `promo_codes`
- `TTCommissions.tsx` — pubPatch `commission_rates`
- `TTPayouts.tsx` — pubPatch `partner_earnings`, `affiliate_commissions` (mark paid / retry)
- `TTAffiliates.tsx` — pubPatch `affiliate_applications`, `affiliates`
- `TTPartnersMgmt.tsx` — pubPatch/pubPost `partners`
- `TTPackages.tsx` — pubPost/pubPatch `service_packages`, `packages`, `add_on_packages`, `add_ons`

## Fix direction (not applied)
Route writes through an authenticated, staff-gated edge function with its own write allow-list
(mirror of the read gate), remove `PUBLIC_KEY`/`directHeaders` from client code, and rotate the
public project's anon key afterwards.

## Also open
`TTFleet.tsx:74` and `:159` send `action: get_vehicles_with_partners` / `update_vehicle_partner`,
which the function has never implemented — confirmed live as `PGRST205 public.undefined`.
Both features are broken today (functional bug, not security).
