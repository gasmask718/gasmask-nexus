# Project rules

- Ambassador store access in RLS resolves through public.ambassador_has_store_access (shared-territory rule); older helpers (user_has_store_access, is_ambassador_for_store) delegate to it so every table agrees on which stores an ambassador can touch.
- Store "last seen" (store_master.last_visit_at) only moves forward via public.bump_store_last_visit; field-role writes (visits, counts, notes, orders, payments, field submissions) call it from triggers, so new field write paths get it for free.
- GasMask shelf counts live in store_tube_inventory_status: brand_id 'gasmasktubes' = tubes, 'gasmask' = bags (current_tubes_left holds the bag count). Never add a second inventory table.
- Imported ambassador prospects use ambassador_area_prospect_keys for territory-only SELECT RLS and ambassador_area_prospects_page for canonical server-side filtering/pagination; keep the existing discovered-location approval flow separate because its identifiers are not store_prospects keys.

- Delivery requests have ONE queue: public.pending_route_stops (/dispatch/pending-stops). Store-portal delivery_requests rows feed it via trigger (source_ref 'delivery_request:<id>') and sync status back; never list delivery_requests separately in Route Command Center or a second admin page.
