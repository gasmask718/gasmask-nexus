# Project rules

- Ambassador store access in RLS resolves through public.ambassador_has_store_access (shared-territory rule); older helpers (user_has_store_access, is_ambassador_for_store) delegate to it so every table agrees on which stores an ambassador can touch.
- Store "last seen" (store_master.last_visit_at) only moves forward via public.bump_store_last_visit; field-role writes (visits, counts, notes, orders, payments, field submissions) call it from triggers, so new field write paths get it for free.
- GasMask shelf counts live in store_tube_inventory_status: brand_id 'gasmasktubes' = tubes, 'gasmask' = bags (current_tubes_left holds the bag count). Never add a second inventory table.
