-- Phase 2A Win 2 pre-req: pg_trgm GIN indexes for scalable ILIKE search on store_master
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_store_master_store_name_trgm
  ON public.store_master USING gin (store_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_master_address_trgm
  ON public.store_master USING gin (address gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_master_owner_name_trgm
  ON public.store_master USING gin (owner_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_master_city_trgm
  ON public.store_master USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_master_zip_trgm
  ON public.store_master USING gin (zip gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_store_master_phone_trgm
  ON public.store_master USING gin (phone gin_trgm_ops);

-- B-tree indexes to accelerate common server-side filters
CREATE INDEX IF NOT EXISTS idx_store_master_created_at
  ON public.store_master (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_master_relationship_status
  ON public.store_master (relationship_status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_store_master_active_partial
  ON public.store_master (is_simulation, deleted_at, store_name)
  WHERE deleted_at IS NULL;