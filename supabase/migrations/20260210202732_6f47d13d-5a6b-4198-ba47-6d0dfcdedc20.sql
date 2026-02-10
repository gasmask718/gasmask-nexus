
-- Add spatial + ingestion tracking columns to neighborhoods
ALTER TABLE public.neighborhoods
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS bbox jsonb,
  ADD COLUMN IF NOT EXISTS osm_area_id bigint,
  ADD COLUMN IF NOT EXISTS ingestion_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS last_ingested_at timestamptz,
  ADD COLUMN IF NOT EXISTS ingestion_stats jsonb;

-- Add index for ingestion queries
CREATE INDEX IF NOT EXISTS idx_neighborhoods_ingestion_status ON public.neighborhoods(ingestion_status);

-- Add comment for documentation
COMMENT ON COLUMN public.neighborhoods.bbox IS 'Bounding box as {south, west, north, east} for Overpass queries';
COMMENT ON COLUMN public.neighborhoods.ingestion_status IS 'pending | ingesting | complete | partial | failed';
COMMENT ON COLUMN public.neighborhoods.ingestion_stats IS 'Last run stats: {inserted, skipped, total, types_queried}';
