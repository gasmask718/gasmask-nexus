# Project rules

- Ambassador store access in RLS resolves through public.ambassador_has_store_access (shared-territory rule); older helpers (user_has_store_access, is_ambassador_for_store) delegate to it so every table agrees on which stores an ambassador can touch.
- Store "last seen" (store_master.last_visit_at) only moves forward via public.bump_store_last_visit; field-role writes (visits, counts, notes, orders, payments, field submissions) call it from triggers, so new field write paths get it for free.
- GasMask shelf counts live in store_tube_inventory_status: brand_id 'gasmasktubes' = tubes, 'gasmask' = bags (current_tubes_left holds the bag count). Never add a second inventory table.
- Imported ambassador prospects use ambassador_area_prospect_keys for territory-only SELECT RLS and ambassador_area_prospects_page for canonical server-side filtering/pagination; keep the existing discovered-location approval flow separate because its identifiers are not store_prospects keys.

- Delivery requests have ONE queue: public.pending_route_stops (/dispatch/pending-stops). Store-portal delivery_requests rows feed it via trigger (source_ref 'delivery_request:<id>') and sync status back; never list delivery_requests separately in Route Command Center or a second admin page.
- Store customer portal lives at /portal/mystore (not /portal/store, which is the Dynasty Direct buyer portal); store users are identified by store_users rows and all their data access goes through store_portal_* SECURITY DEFINER RPCs.
- Ambassador invites in public.invites may carry target_link {ambassador_id, route_ids}; the accept trigger links ambassadors.user_id and assigns those routes, so never link ambassador accounts by hand.
- Signed-out (anon) visitors get no grants on store/invoice tables or any view built on them; public pages read store data only through narrow SECURITY DEFINER RPCs (e.g. get_public_store_locator). Revocations are recorded in public.anon_access_revocation_log so they can be reversed exactly.
- Field visit photo proof: photos upload to PRIVATE bucket field-visit-photos (<user_id>/<store_id>/<uuid>.jpg); store_visits.photo_paths holds PATHS (never URLs); render via SignedImage. GPS is best-effort into store_visits.gps_lat/gps_lng. change_list_items.entity_type must be one of the CHECK values ('questionnaire', not 'store_questionnaire').
