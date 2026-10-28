# Roadmap — Oct 28

- [x] STEP 0: snapshot 11 tables → `_snap_*_20261028`, counts verified vs live
  - NOTE: no pre-existing nightly snapshot job existed; created dated snapshot tables now (additive). Real backup = daily platform backups (More → Database → Manage → Backups).

- STEP 1: Store Customer Portal — IN PROGRESS
  - [x] Audit schemas; phone OTP confirmed DISABLED (`phone:false` in auth settings) → send-sms code fallback
  - [x] Migration `0011_store_customer_portal`: store_users, store_portal_codes, delivery_requests (+RLS+grants+cancel guard trigger), is_store_user_for (connected_group_id/owner_group_id), portal_invite_info, store_portal_* RPCs (stores/home/inventory/save_inventory/request_delivery/requests/cancel), redeem_portal_invite store linking
  - [x] Migration `0012_v_route_candidates_delivery_requests`: open requests appear as candidates (verified: view runs, 2,156 rows)
  - [x] Edge functions deployed: text-store-portal-invite, store-portal-auth (code via send-sms + admin magiclink session), store-portal-notify (created→David+ambassador, scheduled/delivered→store contact); all log communication_logs
  - [ ] Portal UI: /portal/mystore pages (PATH CHANGE: /portal/store is the existing Dynasty Direct buyer portal — new GasMask portal must NOT take that path), invite landing phone-code flow (note: /portal/invite/:token → UniversalInviteAccept, not InviteLanding), osNavigation 'store' entry + RoleRouter
  - [x] Reuse audit (Oct 28): existing request queue = pending_route_stops + /dispatch/pending-stops. delivery_requests now FEEDS it via trigger (migrations 0014/0015); duplicate RCC branch removed; approve→request scheduled + store text; reject/cancel synced. The admin list is /dispatch/pending-stops; do NOT build a separate Delivery Requests list — put launch toggle + checklist on that page.
  - [ ] Staff UI: Text portal link button (StoreTaskRouteButtons), Delivery Requests admin page + Layout nav, Portal panel on StoreDetail, RCC candidate add-to-route → notify
  - [ ] End-to-end test + RLS isolation tests; remove test rows
  - [ ] Final report

- [ ] STEP 2: Ambassador SL invite (AMB-SL, id 2148a425-1dd9-4c76-9752-74e8fa62cfe3, 929-944-3067) — NOT STARTED

- LAUNCH LOCK (added Oct 28)
  - [x] `store_master.is_portal_test` (default false); setting `store_portal_live` in system_settings (default OFF) + `store_portal_is_live()`, `store_portal_launch_state()`, owner/admin-only `set_store_portal_launch(live, checklist)` that refuses ON unless all 8 checklist steps are true
  - [x] text-store-portal-invite rejects non-test stores while OFF ("Portal not live yet"); store-portal-notify never texts a real store while OFF (fail closed) — deployed
  - [x] Test store created: "TEST - Owner Portal Test Store" id 8d962954-2466-4a72-b03f-7229a3ebd55b (source='portal_test', zip 00000)
  - [ ] Owner sets test phone (primary contact, can_receive_sms) — blocked on owner's number
  - [ ] Delivery Requests page: ON/OFF toggle + 8-step checklist (part of Staff UI item)
  - [ ] Text portal link button disabled "Portal not live yet" for non-test stores while OFF (part of Staff UI item)
  - [ ] Hide is_portal_test stores from v_route_candidates store branches, ambassador lists, KPIs, money reports, store counts (its delivery requests still show in RCC)
