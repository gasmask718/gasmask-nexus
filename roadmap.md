
## Secrets capacity (2026-09-07)
- [x] Deleted DEMO_STRIPE_WEBHOOK_SECRET_TEST; PLAYBOXXX_INGEST_SECRET pending owner value entry

## Highway map geocoding (2026-09-08)
- [ ] Backfill hw_leads lat/long via US Census batch geocoder; report before/after coordinate counts

## Ambassador Route Planning (2026-09-08)
- [x] Central /ambassadors/route-planning page on existing ambassadors/assignments/routes/route_stops
- [ ] BLOCKER: 52 active ambassadors share one login user_id (12 share another) — routes are keyed to login, so they see each other's routes
- [ ] 10 active ambassadors have no login; 291 active stores lack coordinates (geocoding backlog)

## Ching's GasMask Ambassador Roster (2026-09-11)
- [x] Create six dedicated invite-ready ambassador identities without touching SL, Billz, Mooks, or unrelated ambassadors
- [x] Assign 39 live Staten Island/New Jersey stores to Javier and 97 current canonical Bronx/Mt. Vernon stores to Rufino without duplicates
- [ ] BLOCKER: Six linked email invites were attempted and recorded, but the mail provider rejected the configured sender with HTTP 403; authorize sender/domain and resend before expiry
- [x] Validate assignment isolation and document member portal checks as blocked until invite delivery and acceptance

## Account Activity Report (2026-09-08)
- [x] Numbered, expandable, paginated audit log at /reports/account-activity
- [ ] 1,032 account_review notes have no author recorded; no live code writes that source today, so authorship can only be captured once a review-saving screen is (re)built

## GasMask Territory Assignment + Map (2026-09-12)
- [x] Territory rules recorded in ambassador_territory_coverage for Ching (Brooklyn), Javier (SI+NJ), Shawn (CT), Rufino (Bronx+Mt Vernon), Looney (DE), Chico (FL)
- [x] Brooklyn default ownership: 984 unassigned live Brooklyn stores assigned to Ching's field identity; 5 already-owned Brooklyn stores held, no overwrite
- [x] Map scope verified by assignment query (Ching 977 mapped, Javier 38, Rufino 96); no duplicate active store assignments
- [ ] OWNER: Oliver's territory after Brooklyn → Ching; SL identity + Manhattan scope; Billz/Mooks contacts; Chico "other connections"; 4 BARRY KALI ENY Brooklyn stores
- [ ] BLOCKER: invite emails still rejected by mail provider (HTTP 403) — end-user login verification pending

## GasMask Shared Territory + Store Locking (2026-09-12)
- [x] Make territory coverage the ambassador store/map visibility source without treating assignments or routes as ownership
- [x] Add one atomic secured-store claim per store with claimant and secured timestamp; preserve shared visibility
- [x] Apply only approved territories and create/link Bosket and Billz with exact owner-provided emails; send no invitations
- [x] Show Available/Secured status on ambassador store cards, map details, and store profile; add confirmed Secure store action
- [x] Verify Georgia coverage readiness and atomic double-claim rejection with temporary data, then clean it up
- [x] Recheck Ching Brooklyn visibility/route flow and Oliver Queens-only visibility; document held owner decisions
