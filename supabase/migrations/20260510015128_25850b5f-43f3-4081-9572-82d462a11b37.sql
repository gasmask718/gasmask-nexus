ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS scheduled_route_stop_id uuid REFERENCES public.route_stops(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_communication_logs_scheduled_route_stop
  ON public.communication_logs(scheduled_route_stop_id);