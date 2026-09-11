# GasMask — Dedicated Ambassador Portal Login / Redirect (2026-09-12)

Scope: entry-context routing only. No mail-provider work, no invitations, no new accounts,
no role changes, no territory/claim/route/store changes.

## 1. Current flow (traced before changes)

| Concern | Finding |
| --- | --- |
| Main login | `/auth` (`src/pages/Auth.tsx`) → `getRoleRedirectPath(role)`, honors safe `?next=` / `state.returnTo` via `src/lib/authNext.ts` |
| Ambassador login | `/ambassador/login` (`src/pages/ambassador/AmbassadorLogin.tsx`) → hardcoded `/ambassador/dashboard`; **did not** handle an already-signed-in user (showed the form again) |
| Ambassador portal | `/ambassador/dashboard` — `ProtectedRoute` + `RequireRole(['admin','ambassador'])`; `/portal/ambassador` and `/portals/ambassador` already redirect here |
| Signed-out guard | `ProtectedRoute` → `/auth` with `state.returnTo` preserved |
| Ching identity | auth `6019a316-2d95-4662-997c-c47bd0b37697` (`gasmaskapprovedllc@gmail.com`) linked to ambassador `903ecd8b-990f-456c-bdaf-18ef5f0b4317` (`ching`); roles: owner, admin, wholesaler, ambassador |
| Intended-destination param | Already existed (`authNext`, same-origin relative paths only) |

Gap: no dedicated portal entry URL, and the ambassador login ignored an existing session.

## 2. Change applied

- New `src/pages/ambassador/AmbassadorPortalEntry.tsx`:
  - signed in → `/ambassador/dashboard`
  - signed out → `/ambassador/login` with `returnTo`
  - honors only `isSafeNextPath` destinations (no external/absolute URLs)
- Routes registered: `/ambassador`, `/ambassador/portal`, `/portal/gasmask-ambassador` → portal entry.
- `AmbassadorLogin.tsx`: redirects an already-authenticated user straight into the portal
  (no second login, no second account) and honors the entry `returnTo`/`next`.

No auth system duplicated; no role grants added.

## 3. Security

- Portal entry is a redirect only; access is still enforced by `ProtectedRoute` + `RequireRole(['admin','ambassador'])`.
- A plain ambassador gains no admin privileges; store/territory visibility remains the existing
  shared-territory model keyed to the signed-in user's linked ambassador identity.
- Redirect target restricted to same-origin relative paths (`isSafeNextPath`), so the entry link
  cannot be abused for arbitrary external redirects.
- Destination is decided by entry context; Ching's account roles were not modified.

## 4. Verification (live, Ching's existing account)

| Check | Result |
| --- | --- |
| `/ambassador` signed in | → `/ambassador/dashboard` — PASS |
| `/ambassador/portal` signed in | → `/ambassador/dashboard` — PASS |
| `/ambassador` signed out | → `/ambassador/login` — PASS |
| `/auth` signed in (admin regression) | → `/` main admin home — PASS |
| Portfolio | 992 stores (987 assigned) — PASS |
| Brooklyn map | Loads, clustered Brooklyn markers, 983 mapped / 9 need geocoding — PASS |
| Routes | `/ambassador/routes` Route Planner loads with available stores + history — PASS |
| Check-in | Store visit actions reachable from stores/route stops — PASS |
| Duplicate account | None created — PASS |

## 5. Output

- AMBASSADOR PORTAL URL: `https://gasmask-os-nexus.lovable.app/ambassador`
- MAIN LOGIN URL: `https://gasmask-os-nexus.lovable.app/auth`
- CHING AMBASSADOR ENTRY: PASS
- POST-LOGIN DESTINATION: `/ambassador/dashboard`
- ADMIN LOGIN REGRESSION: PASS (main admin home)
- AMBASSADOR SECURITY: PASS
- BROOKLYN MAP: PASS
- ROUTES: PASS
- CHECK-IN: PASS
- READY FOR CHING TO LOGIN NOW: YES
