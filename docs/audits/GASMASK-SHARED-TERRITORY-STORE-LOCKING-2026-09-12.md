# GasMask Shared Territory + Secured Store Locking

Date: 2026-09-12  
Scope: GasMask ambassador field visibility and explicit store securing only.

## Outcome

Territory now controls which stores an ambassador can see. Assignments and route stops remain operational responsibility and routing records; they are not ownership claims. An ambassador may explicitly secure a visible store, creating one atomic active lock with claimant and time. Other ambassadors in the same area continue seeing the store and its secured status.

## Approved territory state

| Ambassador | Approved territory | Profile/login state | Result |
|---|---|---|---|
| Ching | Brooklyn | Existing linked admin/ambassador account | Shared-area visibility active |
| Oliver | Queens | Existing profile; no linked login | Queens-only coverage recorded; browser verification blocked by missing login linkage |
| Javier | Staten Island / New Jersey | Existing profile | Coverage preserved |
| Rufino | Bronx / Mt. Vernon | Existing profile | Coverage preserved |
| Shawn | Connecticut | Existing profile | Coverage preserved |
| Looney | Delaware | Existing profile | Coverage preserved |
| Chico | Florida | Existing profile | Florida only; additional areas held |
| Bosket | Georgia | Separate profile using `Huntatrell@gmail.com`; no login | Georgia coverage recorded; no invitation sent |
| Billz | Georgia | Separate profile using `GmbhBillz@gmail.com`; no login | Georgia coverage recorded; no invitation sent |

Inter, SL, Mooks, Relleo, and Chico's additional areas remain held. No ambiguous ownership was inferred.

## Implementation

- Added a secured-store claim ledger with one active lock per store.
- Added territory matching and field-visible store functions using approved territory coverage, existing assignments, and existing route access.
- Added an atomic secure-store action. Duplicate active claims are rejected by database protection rather than client timing.
- Removed anonymous execution from the new access functions and removed direct signed-in claim-table reads; claim data is returned through scoped functions.
- Added Available/Secured status, claimant/time display, and confirmed Secure Store action to the ambassador list, profile, portfolio, dashboard, and map.
- Map results use existing coordinates only. No coordinates were invented.
- Existing assignments, routes, route stops, check-ins, visits, and store data were not rewritten.

## Verification

- Signed in with Ching's existing account and loaded the real `/ambassador/stores` screen.
- The screen returned 992 visible stores, including 987 assignment-backed stores and shared-area records.
- Store cards showed `Available` and `Secure Store` controls.
- The confirmation explicitly states that one secured-store lock is created and other ambassadors in the area retain visibility.
- A temporary claim test used an unclaimed Brooklyn store. Ching's first claim succeeded; a second active claim was rejected by the unique lock; the temporary claim was deleted in the same verification transaction.
- Cleanup query confirmed zero temporary active claims remain.
- Production build passed, including route and public-view grant checks.
- Bosket and Billz have separate active profiles and Georgia coverage, no linked login accounts, and no invitations.

## Preserved behavior and limitations

- Route auto-fill remains assignment-based and capped by its existing candidate limit. It was deliberately not broadened to every territory-visible store.
- Oliver's Queens-only data state is verified, but end-to-end portal verification cannot be performed until an approved login is linked; none was fabricated.
- The current store book contains no live Georgia stores, so Georgia shared visibility cannot produce store rows yet. Coverage is ready for future Georgia records.
- Territory-aware `field_worker_has_store` also permits field communication access for territory-visible stores. This matches shared-area field work but is a broader authorization meaning than assignment-only access and should remain an explicit product/security decision.
- The workspace-wide database linter remains noisy with more than 1,300 pre-existing findings. New functions were separately checked to ensure anonymous execution was removed; this work does not claim global linter cleanliness.
- Existing unrelated UI ref warnings remain outside this scope.

## Scope confirmation

No invitations, outreach, mass provisioning, store edits, coordinate changes, route rewrites, check-ins, visits, or completed deliveries were created. No claim was inferred from an assignment, route, check-in, or completion event.

## Owner Territory Clarifications — 2026-09-12

Applied only Ching's newly confirmed territory instructions using the existing shared-area model. No new tables, no claim/route/map rebuilds, no invitations, no outreach, no store mutations.

### ZIP territory support

`ambassador_territory_coverage` previously supported state / county / city / custom_zone only. Added the smallest safe capability to the existing model:

- New `zip` value on the existing `territory_region_type` enum.
- `territory_matches_store(...)` now takes the canonical `store_master.zip` and performs exact, digit-normalized 5-digit matching (no radius, no prefix inference).
- `ambassador_has_store_access(...)` passes `sm.zip`; every map / list / route surface reads through this same path.

### Person table

| Person | Confirmed territory | Coverage applied | Shared overlap | Identity status | Blocker |
|---|---|---|---|---|---|
| Inter (INTERSTATE) | Far Rockaway, Queens NY + ZIP 10460 Bronx | Yes — city `Far Rockaway, NY`, zip `10460` | Far Rockaway shared with Oliver (Queens); 10460 inside Rufino's Bronx | Matched existing profile by confirmed phone 929-777-1122; email `InnerstateTransportation@gmail.com` recorded; no login | Invite not sent (mail-provider 403 held) |
| Relleo | ZIP 10460 + "surrounding" | No | — | No safe Relleo profile exists | IDENTITY_CONFIRMATION_REQUIRED; "surrounding" = OWNER_BOUNDARY_CLARIFICATION_REQUIRED |
| Rufino Vinales | Bronx, Mt. Vernon, Yonkers, New Rochelle, Manhattan | Yes — existing Bronx + Mount Vernon kept; added Yonkers, New Rochelle, Manhattan | Manhattan shared with SL (intended), 10460 shared with Inter | Existing profile; no login | None |
| SL | Manhattan | No | — | Ambiguous: existing record phone 929-944-3067 vs roster email BELIEVEITORNOTT28@gmail.com, unconfirmed | IDENTITY_CONFIRMATION_REQUIRED — architecture has no identity-free pending coverage |
| Oliver | Queens | Unchanged (`Queens, NY`) | Far Rockaway also visible to Inter — intentional | Existing profile; no login | None |

Ching (Brooklyn), Javier (Staten Island + New Jersey), Shawn (Connecticut), Bosket/Billz (Georgia), Looney (Delaware) and Chico (Florida) were not modified.

### Verification (live store book, non-deleted, non-simulation)

- Inter — Far Rockaway: 10 stores; ZIP 10460: 8 stores.
- Oliver — Queens intact: 240 stores, including all 10 Far Rockaway stores (overlap confirmed, not exclusive).
- Rufino — Bronx 97, Mt. Vernon 1, Yonkers 12, New Rochelle 8, Manhattan 186.
- ZIP matcher: `10460` vs store zip `10460-1234` = true; vs `10461` = false.
- Territory access produced zero claims: active secured-store claims remain 0.
- Ching's effective visible-store count unchanged at 992 — CLAIM SYSTEM REGRESSION: PASS, ROUTE/MAP REGRESSION: PASS (no claim, route, or map code changed).

### Held

- Relleo's "surrounding" boundary and identity.
- SL identity merge (not performed) — Manhattan stays owner-confirmed but unapplied.
- Inter, Rufino, Oliver, Relleo and SL have no linked logins; end-to-end portal verification for them is blocked until approved logins exist. None were fabricated.

## Owner Clarifications Round 2 — 2026-09-12 (Ray / Rell / SL)

Applied only the newest owner-confirmed identities and areas using the existing shared-area model. No model, claim, route, or map rebuild. No invitations, no outreach, no store or coordinate changes.

**Supersedes the previous section's blockers:** the Relleo `IDENTITY_CONFIRMATION_REQUIRED` / "surrounding" boundary hold and the SL `IDENTITY_CONFIRMATION_REQUIRED` hold are both resolved by owner confirmation and no longer apply.

### Person table

| Person | Confirmed territory | Profile status | Coverage applied | Visible stores | Blocker |
|---|---|---|---|---:|---|
| Ray | New Jersey | Created — `Theonlysunray@aol.com`, +1 929-351-1404, active, no login | `state = New Jersey` | 7 | Invite not sent (mail-provider 403 held) |
| Rell / Relleo | Bronx, Manhattan, Mt. Vernon, New Rochelle, Yonkers, Harlem | Existing record `109e7f72-…` ("RELL") reused; confirmed email `Jrellmwest@gmail.com` recorded; no duplicate created | cities `Bronx, NY`, `Manhattan, NY`, `Mount Vernon, NY`, `New Rochelle, NY`, `Yonkers, NY` + custom zones for the five literal Harlem neighborhood values in the store book | 97 / 186 / 1 / 8 / 12 / 21 Harlem | Invite not sent; no login |
| SL | Bed-Stuy (Brooklyn) + Manhattan | Existing record `0ddde0f3-…` (phone 929-944-3067) reused and linked to roster email `BELIEVEITORNOTT28@gmail.com`; history preserved; no duplicate | custom zone `bed-stuy` + city `Manhattan, NY` | 38 / 186 | Invite not sent; no login |
| Mooks | Pennsylvania | No record | Not applied | — | CONTACT_REQUIRED — no email/phone supplied; nothing invented |

Harlem was applied as the exact neighborhood values present in canonical `store_master` (`harlem` 5, `harlem n` 6, `harlem s` 2, `east harlem` 3, `east harlem n` 5 = 21). No radius, boundary, or coordinate was invented.

Preserved unchanged: Ching (Brooklyn), Oliver (Queens), Inter (Far Rockaway + ZIP 10460), Rufino (Bronx, Mt. Vernon, Yonkers, New Rochelle, Manhattan), Javier (Staten Island + New Jersey), Bosket & Billz (Georgia), Shawn (Connecticut), Looney (Delaware), Chico (Florida).

### Overlap verification

- Ray and Javier both see the same 7 New Jersey stores — shared, neither owns them.
- Manhattan's 186 stores are visible to Rufino, Rell and SL simultaneously.
- Bed-Stuy's 38 stores are visible to both SL and Ching (Brooklyn).
- Territory grants created **zero** claims: `ambassador_store_claims` total rows = 0, active = 0.
- Atomic protection re-tested live: a second active claim on an already-secured store was rejected by `ambassador_store_claims_one_active_per_store`; the temporary test claim was deleted (0 remaining).

### Ching's visible store count — 992 explained

| Access source | Stores |
|---|---:|
| Brooklyn geographic coverage (live, non-simulation, city or borough = Brooklyn) | 990 |
| Direct assignments (985) — all inside Brooklyn, add nothing new | 0 |
| Legacy `assigned_ambassador_id` (2) — both inside Brooklyn | 0 |
| Route-stop access within 30 days, outside Brooklyn | 2 |
| Other | 0 |
| **Effective visible total** | **992** |

The two route-sourced stores are `21st ock (32-34 Steinway St)`, Long Island City, Queens and `. RAMMI / Abdul / Frankie (22506 Jamaica Ave)`, Jamaica, Queens — both reached through recent route stops assigned to Ching, which is legitimate under the effective-visible rules. Nothing was removed.

The earlier 985 Brooklyn baseline was the count of Brooklyn stores **assigned** to Ching. The geographic pool is now 990 live Brooklyn stores; the 5-store difference is Brooklyn stores in the live book that carry no active assignment to him and are visible by area only.

Brooklyn live stores: **990** · with usable coordinates: **981** · without usable coordinates: **9**.

### Status

- CLAIM SYSTEM REGRESSION: **PASS**
- MAP/ROUTE REGRESSION: **PASS** (no claim, route, map or UI code changed this pass)
- DUPLICATE PROFILE CHECK: **PASS** — one SL, one Rell, one Ray-with-confirmed-contact. A separate legacy record named " RAY GMA " (`0d38db36-…`) exists with no email or phone; it was **not** merged or altered, because nothing links it to the confirmed Ray identity. Owner confirmation required before any merge.
- Only remaining roster/contact blocker: **Mooks** (Pennsylvania known, contact unresolved). All other confirmed people are recorded and area-visible; logins remain pending the unresolved mail-provider 403.

## Additional Owner Roster Updates — 2026-09-12

Applied Ching's newest confirmed people/contacts/territories using the existing shared-area
model. No territory logic, claim logic, routing, map code or store data was changed. No
invitations or outreach were sent (mail-provider 403 still unresolved).

| Person | Role | Email | Phone | Territory | Profile status | Visible live stores | Login/invite | Blocker |
|---|---|---|---|---|---:|---|---|
| Jayo | Ambassador | Saintil.jonathan@yahoo.com | +1 818-675-1358 | Pennsylvania (primary), California | Created (`JAYO-PACA`) | PA 0 · CA 0 | None — invite held | No live stores exist in PA or CA yet |
| Mooez | Driver | moeeali.act.999@gmail.com | not supplied | None (deliberate) | Driver created under GasMask | n/a | None | TERRITORY_PENDING_OWNER_DIRECTION |
| Looney | Ambassador | BOOKLOONEYMAC@gmail.com | +1 718-415-2793 (new) | Delaware | Existing profile updated (`587e8817-…`) | 0 | Invite held | No live Delaware stores yet |
| Kuff | Ambassador | colwinmcgregor4@gmail.com | +1 917-214-3563 | Brooklyn, NY | Created (`KUFF-BK`) | 990 | Invite held | None |
| Mooks | Ambassador (intended) | — | — | Pennsylvania (intended) | Not created | n/a | n/a | CONTACT_REQUIRED — **not** merged with Jayo |

### Per-person results

- **JAYO** — profile created, shared state coverage for Pennsylvania and California (neither
  exclusive). Pennsylvania visible: 0 live stores. California visible: 0 live stores. Zero claims.
- **MOOEZ** — driver record created in the canonical `drivers` table under GasMask, status
  `active`, no territory, no ambassador profile, no store visibility, no invitation. A legacy
  driver named `.MOOEZ ` (`f094e5d3-…`, phone 347-544-0515, no email) exists; it was **left
  untouched** because nothing but the name links it to the confirmed email. Owner should confirm
  whether the two are the same person before any merge.
- **LOONEY** — existing profile reused; phone stored as `718-415-2793`. Delaware coverage
  unchanged (0 live Delaware stores). No second Looney created.
- **KUFF** — profile created with Brooklyn city coverage. Brooklyn visibility: 990 live stores,
  the same shared pool Ching sees. Brooklyn was not split, no stores were removed from Ching, no
  assignments were transferred, and no claims were created.

### Regression checks (live counts, shared pools)

| Overlap | Shared live stores |
|---|---:|
| Ching + Kuff → Brooklyn | 990 |
| Ray + Javier → New Jersey | 7 |
| Rufino + Rell + SL → Manhattan | 186 |
| Bosket + Billz → Georgia | 0 (no live GA stores yet) |
| Oliver (Queens 240) + Inter (Far Rockaway 10) | 10 |
| Inter (ZIP 10460) + Rufino/Rell (Bronx 97) | ZIP-scoped subset of the Bronx pool |

- Active store claims after all changes: **0** — territory access created no claims.
- Active assignments 1,127 and routes 50, both unchanged by this pass.

### Status

- DUPLICATE CHECK: **PASS** — one Jayo, one Kuff, one Looney, one email-confirmed Mooez driver.
- CLAIM REGRESSION: **PASS** — zero claims; atomic one-active-claim-per-store rule untouched.
- MAP/VISIBILITY REGRESSION: **PASS**
- ROUTING REGRESSION: **PASS** — no route or route-stop records touched.
