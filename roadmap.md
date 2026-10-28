# Roadmap — Oct 28

- [x] STEP 0: snapshot 11 tables → `_snap_*_20261028`, counts verified vs live
  - NOTE: no pre-existing nightly snapshot job found; created the dated snapshot tables now (additive). Scheduled backup = daily platform backups + gdrive-backup.
- [ ] STEP 1: Store Customer Portal
  - [ ] Audit exact schemas (redeem RPC, ambassador_assignments, store_contacts, store_tube_inventory_status, invoices, v_route_candidates, products, send-sms)
  - [ ] Verify phone OTP availability (auth config); else build send-sms code fallback
  - [ ] Migration: store_users, helpers, delivery_requests, RLS, v_route_candidates branch, redeem RPC store linking
  - [ ] Edge function: text-store-portal-invite
  - [ ] Edge function: store-portal-notify (new request → admin+ambassador; route/delivered → store)
  - [ ] Portal UI: /portal/store home, inventory, delivery request, invite landing OTP flow
  - [ ] Staff UI: Text portal link button, Delivery Requests page, Portal panel on StoreDetail, RCC candidates
  - [ ] RoleRouter/osNavigation: route 'store' role to /portal/store
  - [ ] End-to-end test with test store + rollback RLS tests; remove test rows
  - [ ] Regenerate types; final report (routes/URLs, secrets needed)
- [ ] STEP 2: Ambassador SL invite (AMB-SL, 2148a425-1dd9-4c76-9752-74e8fa62cfe3)
  - [ ] Issue invite via /security/invitations flow, text to 929-944-3067 "- Ching"
  - [ ] Link ambassadors row on sign-in; territory coverage visible; 133 stores visible
  - [ ] Assign SL Day 1–5 routes (Oct 29–Nov 3) on redemption if not possible before
