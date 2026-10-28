# Roadmap — Oct 28

- [x] STEP 0: snapshot 11 tables → `_snap_*_20261028`, counts verified vs live
  - NOTE: no pre-existing nightly snapshot job existed; created dated snapshot tables now (additive). Real backup = daily platform backups (More → Database → Manage → Backups).

- STEP 1: Store Customer Portal — IN PROGRESS
  - [x] Audit schemas; phone OTP confirmed DISABLED (`phone:false` in auth settings) → send-sms code fallback
  - [x] Migration `0011_store_customer_portal`: store_users, store_portal_codes, delivery_requests (+RLS+grants+cancel guard trigger), is_store_user_for (connected_group_id/owner_group_id), portal_invite_info, store_portal_* RPCs (stores/home/inventory/save_inventory/request_delivery/requests/cancel), redeem_portal_invite store linking
  - [x] Migration `0012_v_route_candidates_delivery_requests`: open requests appear as candidates (verified: view runs, 2,156 rows)
  - [x] Edge functions deployed: text-store-portal-invite, store-portal-auth (code via send-sms + admin magiclink session), store-portal-notify (created→David+ambassador, scheduled/delivered→store contact); all log communication_logs
  - [ ] Portal UI: /portal/mystore pages (PATH CHANGE: /portal/store is the existing Dynasty Direct buyer portal — new GasMask portal must NOT take that path), invite landing phone-code flow (note: /portal/invite/:token → UniversalInviteAccept, not InviteLanding), osNavigation 'store' entry + RoleRouter
  - [ ] Staff UI: Text portal link button (StoreTaskRouteButtons), Delivery Requests admin page + Layout nav, Portal panel on StoreDetail, RCC candidate add-to-route → notify
  - [ ] End-to-end test + RLS isolation tests; remove test rows
  - [ ] Final report

- [ ] STEP 2: Ambassador SL invite (AMB-SL, id 2148a425-1dd9-4c76-9752-74e8fa62cfe3, 929-944-3067) — NOT STARTED
