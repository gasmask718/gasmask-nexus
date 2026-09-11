
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
