# Store Customer Portal — roadmap

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
