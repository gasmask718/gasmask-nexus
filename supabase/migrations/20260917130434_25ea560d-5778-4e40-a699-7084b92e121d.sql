ALTER TABLE public.route_stops
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;