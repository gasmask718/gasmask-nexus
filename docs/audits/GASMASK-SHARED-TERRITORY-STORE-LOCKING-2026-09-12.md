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
