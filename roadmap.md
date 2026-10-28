# Roadmap — Oct 28

- [x] STEP 0: snapshot 11 tables → `_snap_*_20261028`, counts verified vs live
  - NOTE: no pre-existing nightly snapshot job existed; created dated snapshot tables now (additive). Real backup = daily platform backups (More → Database → Manage → Backups).

- STEP 1: Store Customer Portal — IN PROGRESS
  - [x] Audit schemas; phone OTP confirmed DISABLED (`phone:false` in auth settings) → send-sms code fallback
  - [x] Migration `0011_store_customer_portal`: store_users, store_portal_codes, delivery_requests (+RLS+grants+cancel guard trigger), is_store_user_for (connected_group_id/owner_group_id), portal_invite_info, store_portal_* RPCs (stores/home/inventory/save_inventory/request_delivery/requests/cancel), redeem_portal_invite store linking
  - [x] Migration `0012_v_route_candidates_delivery_requests`: open requests appear as candidates (verified: view runs, 2,156 rows)
  - [x] Edge functions deployed: text-store-portal-invite, store-portal-auth (code via send-sms + admin magiclink session), store-portal-notify (created→David+ambassador, scheduled/delivered→store contact); all log communication_logs
  - [x] Portal UI: /portal/mystore (home, inventory, delivery ASAP/scheduled, requests+cancel, store switcher); store-link branch in UniversalInviteAccept with texted code; RoleRouter sends store_users to /portal/mystore. (orig note:) /portal/mystore pages (PATH CHANGE: /portal/store is the existing Dynasty Direct buyer portal — new GasMask portal must NOT take that path), invite landing phone-code flow (note: /portal/invite/:token → UniversalInviteAccept, not InviteLanding), osNavigation 'store' entry + RoleRouter
  - [x] Reuse audit (Oct 28): existing request queue = pending_route_stops + /dispatch/pending-stops. delivery_requests now FEEDS it via trigger (migrations 0014/0015); duplicate RCC branch removed; approve→request scheduled + store text; reject/cancel synced. The admin list is /dispatch/pending-stops; do NOT build a separate Delivery Requests list — put launch toggle + checklist on that page.
  - [x] Staff UI: Portal panel + Text portal link (locked label) on store profile; launch switch + 8-step checklist on /dispatch/pending-stops (renamed Delivery Requests); RCC gets requests via pending_route_stops. (orig note:) Text portal link button (StoreTaskRouteButtons), Delivery Requests admin page + Layout nav, Portal panel on StoreDetail, RCC candidate add-to-route → notify
  - [x] RLS isolation + lock rejection tests (all rollback; no rows left). Fixed: delivery_requests policy/guard permission errors, portal_security_events type check (blocked every store redemption), stores readable by all signed-in users → restrictive policy for store-portal users. Full phone sign-in not run (Twilio down + no test phone).
  - [ ] Final report

- [ ] STEP 2: SL invite c26f1a3d created (invites, target_link ambassador_id + 5 route_ids; auto-link trigger tested: row linked, 5 routes, 220 stores). Fixed missing invite_redirect_for_role. TEXT NOT SENT — BLOCKED: Twilio error 70051 'authorization with Key failed' (owner must fix Twilio key in secrets).

- LAUNCH LOCK (added Oct 28)
  - [x] `store_master.is_portal_test` (default false); setting `store_portal_live` in system_settings (default OFF) + `store_portal_is_live()`, `store_portal_launch_state()`, owner/admin-only `set_store_portal_launch(live, checklist)` that refuses ON unless all 8 checklist steps are true
  - [x] text-store-portal-invite rejects non-test stores while OFF ("Portal not live yet"); store-portal-notify never texts a real store while OFF (fail closed) — deployed
  - [x] Test store created: "TEST - Owner Portal Test Store" id 8d962954-2466-4a72-b03f-7229a3ebd55b (source='portal_test', zip 00000)
  - [ ] Owner sets test phone (primary contact, can_receive_sms) — blocked on owner's number
  - [ ] Delivery Requests page: ON/OFF toggle + 8-step checklist (part of Staff UI item)
  - [ ] Text portal link button disabled "Portal not live yet" for non-test stores while OFF (part of Staff UI item)
  - [x] (partial) Hidden from RCC candidates; stores.is_test_data=true; no ambassador/invoices so not in ambassador lists or money. Raw store totals still count it +1. (orig:) Hide is_portal_test stores from v_route_candidates store branches, ambassador lists, KPIs, money reports, store counts (its delivery requests still show in RCC)

- BLOCKED on owner: test phone number; Twilio key fix (all outbound texts failing 70051).

- NEW (Oct 28): A) Photo verification audit — screens/roles/buckets (crew-drop-photos, checklist-photos, storefront-captures), GPS+timestamp, review path; fix ambassador photo visit → store profile. Real upload test, clean up own rows.
- NEW (Oct 28): B) Owner route portal — verify Ching's 10 draft routes (Oct 29–Nov 9, assigned_to owner's profile) + 170 stores appear in his ambassador/field portal and RCC; wire if needed.
