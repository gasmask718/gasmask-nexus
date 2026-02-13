
-- Add opportunity_ids column to route_stops for traceability
ALTER TABLE public.route_stops
ADD COLUMN opportunity_ids uuid[] DEFAULT NULL;

-- Create index for querying by opportunity
CREATE INDEX idx_route_stops_opportunity_ids ON public.route_stops USING GIN(opportunity_ids);
