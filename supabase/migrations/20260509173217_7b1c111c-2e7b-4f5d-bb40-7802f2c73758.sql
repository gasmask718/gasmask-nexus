ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS start_time time without time zone,
  ADD COLUMN IF NOT EXISTS end_time time without time zone,
  ADD COLUMN IF NOT EXISTS total_stops integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS idx_routes_assigned_to_date ON public.routes(assigned_to, date DESC);
CREATE INDEX IF NOT EXISTS idx_routes_status_date ON public.routes(status, date DESC);