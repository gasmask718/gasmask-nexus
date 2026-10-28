# Store Customer Portal — build plan

## What the audit found (reuse, no new parallel systems)

- **Role:** `store` already exists in the `app_role` enum — reuse it, no new role.
- **Invites:** `portal_invites` already has `store_id`, `phone`, `token_hash`, expiry, consumed status, plus the `redeem_portal_invite` RPC (assigns role after sign-in) and `redeem-portal-invite` edge function. Reuse all of it.
- **Phone sign-in:** `PortalLogin.tsx` already does Supabase `signInWithOtp` + `verifyOtp` by phone — reuse that pattern.
- **Inventory:** `store_tube_inventory_status` is the one live table (`store_tube_inventory` is retired). Brand keys: `gasmasktubes`, `gasmask` (bags), `hotmama`, `grabba_r_us`, `hotscalatimixpack`, `hotscolatti-light`, `hotscolatti-dark`, `hotscalatibros`.
- **Multi-location:** only `connected_group_id` exists (on `stores` and `store_master`); `owner_group_id` does not exist anywhere. Store switcher will group by `connected_group_id`.
- **Balance owed:** no balance column; computed from unpaid finalized invoices (`total` − `amount_paid`), same as existing code.
- **SMS:** `send-sms` edge function with mandatory `send_class` + `idempotency_key`; it writes `communication_logs` (store history view) already.
- **Routing:** `v_route_candidates` UNION view + `add_store_to_route` RPC + `RouteCommandCenter.tsx`; store profile is `StoreDetail.tsx` with `StoreTaskRouteButtons` for actions.
- **Prices:** `products.store_price` catalog exists; the prices you listed ($200/$100/$100/$250) will be read from the catalog, not hardcoded.

## Build steps

### 1. Database (one additive migration)
- New table `store_users` (user_id, store_id, created_at) linking a store login to one or more stores; RLS: store users read only their own rows; staff/admin manage.
- New SECURITY DEFINER helpers: `is_store_user_for(store_id)` (own row, or store shares `connected_group_id` with one of their stores) and `is_staff_for_store(store_id)` (elevated user or assigned ambassador via `ambassador_assignments`).
- New table `delivery_requests` exactly as you specified (store_id, requested_by, request_type asap/scheduled, requested_date, time_window, items jsonb, notes, status new/confirmed/scheduled/delivered/cancelled, assigned_to, route_id, timestamps) + GRANTs + RLS: store users insert/read/cancel their own stores' requests; staff and the store's ambassador read/update.
- RLS additions on existing tables (SELECT/limited UPDATE only, nothing existing changed): store users can read their own `store_master`/`stores` rows, `store_tube_inventory_status`, unpaid invoice totals, and `ambassador_assignments` (name/phone of their ambassador); can update `store_tube_inventory_status` counts for their stores; can insert `store_notes`.
- Extend `v_route_candidates` (CREATE OR REPLACE, adds one UNION branch) so open delivery_requests appear as candidates with the requested date.
- Store users get role `store` only; no policy grants them anything outside their own stores.

### 2. Edge functions
- `text-store-portal-invite`: admin/staff/assigned-ambassador only; creates the portal_invites row (role `store`, store_id, phone) and texts the primary contact (from `store_contacts`, `can_receive_sms` + not on suppression list) via `send-sms`, class `transactional`: "GasMask: update your inventory or schedule your next delivery here: <link> - Ching".
- `store-portal-notify`: on new delivery request, texts you (admin) and the assigned ambassador with store name, address, items, date; on route/delivered status change, texts the store a confirmation. All through `send-sms`, logged in `communication_logs`.
- Store OTP: verify whether Supabase phone OTP is enabled on Lovable Cloud with Twilio. If it is not configurable, the fallback is a code sent via our existing `send-sms` and verified inside a small `verify-store-code` function — I'll confirm which one works before wiring the UI.

### 3. Portal UI (mobile-first, big buttons)
- `/portal/store` home: store name/address, balance owed, last order date, assigned ambassador name + tap-to-call phone, store switcher when `connected_group_id` siblings exist, PWA install prompt (existing components).
- Inventory screen: per brand they carry, number pad + quick buttons (Sold out / Under 25 / About half box / Full box). Saves to `store_tube_inventory_status` with `last_updated_method = 'store_portal'`, user id + timestamp, and writes a dated `store_notes` entry. Any brand ≤ 25 → "Running low — want us to bring a delivery?" prompt into the delivery request.
- Delivery screen: ASAP or schedule (date picker, next 30 days, morning/afternoon/evening), products + quantities (box / half box / bags) from the active catalog at store prices, optional note. Open/past requests list; cancel while status is `new`.
- Invite landing: existing `/portal/invite/<token>` flow extended so a store invite triggers phone-OTP sign-in, then redemption links the user to the store(s).

### 4. Staff UI (reusing existing components)
- "Text portal link" button in `StoreTaskRouteButtons` on the store profile (visible to admin/staff/assigned ambassador).
- "Delivery Requests" admin list page (filters: status, date, ambassador, neighborhood), linked from the Logistics/Routes area and store profile.
- "Portal" panel on `StoreDetail`: invite status, last portal sign-in, last inventory update.
- Route Command Center: open requests show as candidates with requested date; adding to a route / marking delivered triggers the confirmation text.

### 5. Test
- End-to-end with a test store: create invite → send link → verify code → update inventory → schedule delivery → appears in Route Command Center → add to route → confirmation path. Then remove only the test rows created.
- Rollback tests: store user cannot read another store, cannot reach admin data; ambassador scoped correctly.

## Assumptions
- "Text me (admin)" = your existing admin notification phone on file; I'll use the number already used by other admin alerts.
- Portal sign-in is by phone only (no email/password for store users), as specified.
- Scheduled-request date limits: 30 days out, per your spec.

## Likely needs from you
- Supabase phone-OTP may require Twilio messaging credentials in the auth provider settings — I'll report exactly what's needed if it's not already configured; the send-sms fallback needs nothing new.
