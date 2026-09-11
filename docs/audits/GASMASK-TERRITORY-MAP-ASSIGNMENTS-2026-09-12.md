# GasMask — Territory Assignment + Ambassador Map Verification

**Date:** 2026-09-12
**Scope:** Ching's nine-person roster plus Ching's own field identity. No other ambassador records touched.

## 1. Existing territory / map model (audit)

| Layer | Where it lives | Verdict |
|---|---|---|
| Territory rules | `ambassador_territory_coverage` (`region_type` = state / county / city / custom_zone, `region_value`, `is_primary`) | Existing structure reused. Neighborhoods are expressible as `custom_zone`, so later Brooklyn carve-outs need no new architecture. |
| Store ownership | `ambassador_assignments` (unique active index on `ambassador_id` + `store_id`) | Existing structure reused. |
| Canonical store data | `store_master` (live = `deleted_at IS NULL`, non-simulation); coordinates read from `stores.lat/lng` | Unchanged. |
| Ambassador Map | `AmbassadorStoreMap` → `useAmbassadorPortfolio` → the signed-in ambassador's own active assignments | Map is assignment-driven, so territory rules alone do not populate it; direct assignments remain required for map visibility. |

No second territory system was created.

## 2. Result table

| Person | Territory | Territory status | Live stores in scope | Stores assigned | Map scope verified | Login status | Blocker |
|---|---|---|---:|---:|---|---|---|
| Ching | Brooklyn, NY | Assigned (default borough owner) | 985 Brooklyn | 986 (985 Brooklyn + 1 legacy Queens store) | Yes — 977 have coordinates | Active (admin + linked field identity) | Legacy Queens store predates this task |
| Javier Smith | Staten Island, NY + New Jersey | Assigned | 39 | 39 (unchanged) | Yes — 38 mapped | Invite pending | LOGIN_VERIFICATION_PENDING_MAIL_PROVIDER |
| Rufino Vinales | Bronx, NY + Mount Vernon, NY | Assigned | 96 | 97 (unchanged) | Yes — 96 mapped | Invite pending | LOGIN_VERIFICATION_PENDING_MAIL_PROVIDER |
| Shawn Warner / Nutt | Connecticut | Assigned (rule only) | 0 | 0 | Empty scope | Invite pending | No Connecticut stores exist yet |
| Looney | Delaware | Assigned (rule only) | 0 | 0 | Empty scope | Invite pending | No Delaware stores exist yet |
| Chico | Florida | Assigned (rule only) | 0 | 0 | Empty scope | Invite pending | "Other connections" not defined |
| SL | Bed-Stuy + Manhattan (intended) | IDENTITY_CONFIRMATION_REQUIRED | Bed-Stuy / Manhattan stores untouched | 0 | n/a | No identity | Possible existing name-only SL record `0ddde0f3-…`; no confirmation recorded |
| Oliver | — | TERRITORY_OWNER_CLARIFICATION_REQUIRED | 0 | 0 | n/a | Invite pending | Older "all NYC" direction conflicts with Brooklyn → Ching |
| Billz | Georgia (intended) | CONTACT_REQUIRED | 0 | 0 | n/a | No record | No email supplied; no profile exists to hold the rule |
| Mooks | Pennsylvania (intended) | CONTACT_REQUIRED | 0 | 0 | n/a | No record | No email supplied; no profile exists to hold the rule |

## 3. Summary counts

- **CLEAR TERRITORIES ASSIGNED:** 6 people (Ching, Javier, Shawn, Rufino, Looney, Chico) across 8 territory rules.
- **TOTAL LIVE STORES COVERED:** 1,122 active assignments across the roster (Ching 986, Rufino 97, Javier 39).
- **UNASSIGNED / CONFLICT STORES HELD:** 5 Brooklyn stores already actively assigned elsewhere (4 to BARRY KALI ENY, 1 to Javier) were left untouched — no overwrite. Manhattan, Bed-Stuy, and Queens stores remain unassigned pending SL and Oliver decisions.
- **AMBASSADORS NEEDING OWNER CLARIFICATION:** SL, Oliver, Billz, Mooks.

## 4. Map verification results

Verified by query against the same source the Ambassador Map reads (own active assignments joined to canonical `stores` coordinates):

- Ching → 986 assigned, 977 with real coordinates, all Brooklyn except one legacy Queens store.
- Javier → 39 assigned (Staten Island + NJ only), 38 mapped.
- Rufino → 97 assigned (Bronx + Mount Vernon only), 96 mapped.
- No store is actively assigned to two people (duplicate check returned 0), so no map can leak another ambassador's territory.
- Markers, call/text, and store detail all read canonical store records; no coordinates, contacts, or store data were modified.
- For the five invited members, end-user sign-in could not be exercised: **LOGIN_VERIFICATION_PENDING_MAIL_PROVIDER**.

## 5. Brooklyn carve-out readiness

Brooklyn is recorded as Ching's `city` territory. A future neighborhood carve-out is expressed as a `custom_zone` territory row for the other ambassador plus reassignment of that neighborhood's stores; the narrower rule takes precedence over the borough rule. No neighborhood ownership was invented.

## QUESTIONS FOR CHING

1. Oliver — Brooklyn is now yours. What territory should Oliver own instead?
2. SL — is the existing "SL" record (phone 929-944-3067, no email) the same person as BELIEVEITORNOTT28@gmail.com? And does SL own all of Manhattan plus Bed-Stuy, or only Bed-Stuy?
3. Billz and Mooks — what email/phone should we use so Georgia and Pennsylvania can be recorded against real profiles?
4. Chico — besides Florida, what are the "other connections" territories?
5. Four Brooklyn stores are currently assigned to BARRY KALI ENY (and one to Javier). Should those stay with them or move to you?
