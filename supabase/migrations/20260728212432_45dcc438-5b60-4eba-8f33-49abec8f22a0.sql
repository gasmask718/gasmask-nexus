ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS stop_reason text;

COMMENT ON COLUMN public.route_stops.stop_reason IS 'Why this stop exists: physical_inventory_check | update_contact_details | delivery (null = standard).';

CREATE INDEX IF NOT EXISTS idx_route_stops_store_reason
  ON public.route_stops (store_id, stop_reason)
  WHERE stop_reason IS NOT NULL;