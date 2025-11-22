-- Add health score columns to various tables
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS health_score INTEGER DEFAULT 50 CHECK (health_score >= 0 AND health_score <= 100);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS driver_health_score INTEGER DEFAULT 50 CHECK (driver_health_score >= 0 AND driver_health_score <= 100);
ALTER TABLE public.wholesale_hubs ADD COLUMN IF NOT EXISTS wholesaler_health_score INTEGER DEFAULT 50 CHECK (wholesaler_health_score >= 0 AND wholesaler_health_score <= 100);
ALTER TABLE public.influencers ADD COLUMN IF NOT EXISTS influencer_health_score INTEGER DEFAULT 50 CHECK (influencer_health_score >= 0 AND influencer_health_score <= 100);

-- Create ai_recommendations table to store supervisor output
CREATE TABLE public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  category TEXT NOT NULL CHECK (category IN ('alert', 'opportunity', 'warning', 'action', 'mission')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reasoning TEXT,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  entity_type TEXT,
  entity_id UUID,
  recommended_action JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged', 'actioned', 'dismissed')),
  actioned_at TIMESTAMP WITH TIME ZONE,
  actioned_by UUID REFERENCES public.profiles(id)
);

-- Create ai_system_health table to track overall system health
CREATE TABLE public.ai_system_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  overall_health_score INTEGER NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  stores_health_avg INTEGER,
  drivers_health_avg INTEGER,
  wholesalers_health_avg INTEGER,
  influencers_health_avg INTEGER,
  routes_efficiency_score INTEGER,
  communication_health_score INTEGER,
  inventory_health_score INTEGER,
  insights JSONB
);

-- Enable RLS
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_system_health ENABLE ROW LEVEL SECURITY;

-- RLS policies for ai_recommendations
CREATE POLICY "Admins can view all recommendations"
  ON public.ai_recommendations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can insert recommendations"
  ON public.ai_recommendations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update recommendations"
  ON public.ai_recommendations FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- RLS policies for ai_system_health
CREATE POLICY "Admins can view system health"
  ON public.ai_system_health FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can insert health snapshots"
  ON public.ai_system_health FOR INSERT
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_ai_recommendations_status ON public.ai_recommendations(status);
CREATE INDEX idx_ai_recommendations_category ON public.ai_recommendations(category);
CREATE INDEX idx_ai_recommendations_created_at ON public.ai_recommendations(created_at DESC);
CREATE INDEX idx_ai_system_health_snapshot_time ON public.ai_system_health(snapshot_time DESC);