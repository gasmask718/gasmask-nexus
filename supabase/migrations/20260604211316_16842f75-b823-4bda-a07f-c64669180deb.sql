DROP INDEX IF EXISTS public.uq_territory_addresses_place_id;
ALTER TABLE public.territory_addresses
  ADD CONSTRAINT territory_addresses_place_id_key UNIQUE (place_id);