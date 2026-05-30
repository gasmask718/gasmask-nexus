-- Phase 1: Add source discriminator to canonical routes table
DO $$ BEGIN
  CREATE TYPE public.route_source AS ENUM ('manual','optimizer','gasmask_agent','grabba_biker');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS source public.route_source NOT NULL DEFAULT 'manual';

UPDATE public.routes SET source = 'manual' WHERE source IS NULL;

CREATE INDEX IF NOT EXISTS idx_routes_source ON public.routes(source);