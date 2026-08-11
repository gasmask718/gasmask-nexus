# BUG-005 — TopTier admin pages calling tables/actions that have never existed

**Status:** OPEN (logged, not fixed)
**Filed:** 2026-08-11
**Class:** functional break, not security. Same class as the TTFleet finding — grouped here.

Every one of these has been broken since it was written. They fail silently: `pubFetch` swallows
errors and returns `[]`, so the pages render empty instead of erroring.

## Non-existent tables (`PGRST205` on the public project)
| Call site | Table requested | Probable real name |
|---|---|---|
| `TTCommissions.tsx` | `commission_rates` (read + `pubPatch`) | `commission_ledger` |
| `TTCommissions.tsx` | `commissions` | `commission_ledger` |
| `TTPackages.tsx` | `packages` (read + `pubPost`/`pubPatch`) | `vip_packages` |
| `TTPackages.tsx` | `add_ons` (read + `pubPost`/`pubPatch`) | `add_on_packages` |

Note the writes: `pubPatch`/`pubPost` to these names go direct from the browser (see SEC-014) and
also target tables that do not exist, so those buttons are no-ops.

## Non-existent proxy actions
| Call site | Payload sent | Reality |
|---|---|---|
| `TTFleet.tsx:74` | `{ action: 'get_vehicles_with_partners' }` | `proxy-public-data` only accepts `{table, select, filters, order, limit}` → `PGRST205 public.undefined` |
| `TTFleet.tsx:159` | `{ action: 'update_vehicle_partner' }` | same |

Confirmed live before the gate was added; no repo-vs-deploy drift.

## Fix direction
Correct the four table names at the call sites (and add the corrected names to the proxy
allow-list, removing the four dead ones), and rewrite TTFleet's two calls as table reads/writes —
or implement the two actions server-side. Blocked behind SEC-015 (real service-role key) for
verification, since reads currently return empty regardless.
