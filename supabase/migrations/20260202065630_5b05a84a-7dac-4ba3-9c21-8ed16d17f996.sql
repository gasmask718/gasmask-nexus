-- ═══════════════════════════════════════════════════════════════════════════════
-- FLOOR 4 PHASE 3: Intelligence, Dispatch Control & Performance Learning
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1️⃣ WORKER PERFORMANCE PROFILES (Rolling Stats & Trust Scores)
CREATE TABLE IF NOT EXISTS public.worker_performance (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Rolling Stats (Updated after each route completion)
  routes_completed_7d INTEGER DEFAULT 0,
  routes_completed_30d INTEGER DEFAULT 0,
  routes_completed_90d INTEGER DEFAULT 0,
  
  stops_completed_7d INTEGER DEFAULT 0,
  stops_completed_30d INTEGER DEFAULT 0,
  stops_completed_90d INTEGER DEFAULT 0,
  
  -- Performance Metrics
  avg_stop_time_minutes NUMERIC(6,2) DEFAULT 0,
  avg_route_duration_minutes NUMERIC(8,2) DEFAULT 0,
  on_time_rate NUMERIC(5,4) DEFAULT 0, -- 0.0000 to 1.0000
  completion_rate NUMERIC(5,4) DEFAULT 1, -- 0.0000 to 1.0000
  exception_rate NUMERIC(5,4) DEFAULT 0, -- 0.0000 to 1.0000
  
  -- Reliability & Trust
  reliability_score INTEGER DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  trust_score INTEGER DEFAULT 50 CHECK (trust_score >= 0 AND trust_score <= 100),
  consistency_score INTEGER DEFAULT 50 CHECK (consistency_score >= 0 AND consistency_score <= 100),
  
  -- Autonomy Level
  autonomy_level TEXT DEFAULT 'manual_only' CHECK (autonomy_level IN ('manual_only', 'assisted', 'auto_eligible')),
  autonomy_promoted_at TIMESTAMP WITH TIME ZONE,
  
  -- Trend Indicators
  trend_direction TEXT DEFAULT 'stable' CHECK (trend_direction IN ('improving', 'stable', 'declining')),
  trend_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  -- Training Flags
  requires_training BOOLEAN DEFAULT false,
  training_notes TEXT,
  last_coaching_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(worker_id)
);

-- 2️⃣ ROUTE ANALYTICS (Post-Route Performance Data)
CREATE TABLE IF NOT EXISTS public.route_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES public.profiles(id),
  
  -- Planned vs Actual
  planned_duration_minutes INTEGER,
  actual_duration_minutes INTEGER,
  duration_variance_minutes INTEGER,
  
  planned_distance_km NUMERIC(8,2),
  actual_distance_km NUMERIC(8,2),
  distance_variance_km NUMERIC(8,2),
  
  planned_stops INTEGER,
  completed_stops INTEGER,
  skipped_stops INTEGER,
  failed_stops INTEGER,
  
  -- Stop-Level Metrics
  avg_stop_time_minutes NUMERIC(6,2),
  max_stop_time_minutes NUMERIC(6,2),
  min_stop_time_minutes NUMERIC(6,2),
  
  -- Performance Indicators
  on_time_stops INTEGER DEFAULT 0,
  late_stops INTEGER DEFAULT 0,
  early_stops INTEGER DEFAULT 0,
  
  -- Exceptions & Issues
  total_exceptions INTEGER DEFAULT 0,
  critical_exceptions INTEGER DEFAULT 0,
  exception_density NUMERIC(5,4) DEFAULT 0, -- exceptions per stop
  
  -- Delivery Success
  delivery_success_rate NUMERIC(5,4) DEFAULT 1,
  pod_capture_rate NUMERIC(5,4) DEFAULT 0,
  
  -- Route Grade
  performance_score INTEGER CHECK (performance_score >= 0 AND performance_score <= 100),
  route_grade TEXT CHECK (route_grade IN ('A', 'B', 'C', 'D', 'F')),
  
  -- Timestamps
  route_started_at TIMESTAMP WITH TIME ZONE,
  route_completed_at TIMESTAMP WITH TIME ZONE,
  computed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(route_id)
);

-- 3️⃣ DISPATCH INTERVENTIONS (Audit Trail for Ops Actions)
CREATE TABLE IF NOT EXISTS public.dispatch_interventions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Target
  route_id UUID REFERENCES public.routes(id),
  stop_id UUID REFERENCES public.route_stops(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  
  -- Intervention Type
  intervention_type TEXT NOT NULL CHECK (intervention_type IN (
    'reassign_route', 'reassign_stop', 'split_route', 'merge_route',
    'pause_route', 'resume_route', 'cancel_route',
    'force_complete', 'force_cancel', 'add_emergency_stop',
    'override_capacity', 'escalate'
  )),
  
  -- Context
  reason TEXT NOT NULL,
  justification TEXT,
  before_state JSONB,
  after_state JSONB,
  
  -- Actors
  performed_by UUID NOT NULL REFERENCES public.profiles(id),
  original_assignee UUID REFERENCES public.profiles(id),
  new_assignee UUID REFERENCES public.profiles(id),
  
  -- Escalation
  escalation_level INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 4️⃣ DELIVERY ALERTS (SLA Timers & Escalation System)
CREATE TABLE IF NOT EXISTS public.delivery_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Source
  route_id UUID REFERENCES public.routes(id),
  stop_id UUID REFERENCES public.route_stops(id),
  delivery_id UUID REFERENCES public.deliveries(id),
  exception_id UUID REFERENCES public.delivery_exceptions(id),
  
  -- Alert Type
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'critical_exception', 'stalled_route', 'repeated_failure',
    'sla_warning', 'sla_breach', 'capacity_overload',
    'worker_unavailable', 'vehicle_issue', 'customer_escalation'
  )),
  
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  
  -- Details
  title TEXT NOT NULL,
  description TEXT,
  context JSONB,
  
  -- SLA
  sla_deadline TIMESTAMP WITH TIME ZONE,
  sla_breached BOOLEAN DEFAULT false,
  sla_breached_at TIMESTAMP WITH TIME ZONE,
  
  -- Escalation Ladder
  escalation_level INTEGER DEFAULT 1, -- 1=Ops, 2=Manager, 3=Admin
  escalated_at TIMESTAMP WITH TIME ZONE,
  escalated_to UUID REFERENCES public.profiles(id),
  
  -- Status
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'in_progress', 'resolved', 'expired')),
  
  -- Resolution
  acknowledged_by UUID REFERENCES public.profiles(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5️⃣ ADD MISSING COLUMNS TO ROUTE_STOPS FOR ANALYTICS
ALTER TABLE public.route_stops 
  ADD COLUMN IF NOT EXISTS actual_arrival TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS actual_departure TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS was_on_time BOOLEAN,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 6️⃣ ADD MISSING COLUMNS TO ROUTES FOR ANALYTICS
ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS actual_distance_km NUMERIC(8,2);

-- Enable RLS
ALTER TABLE public.worker_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can read worker performance"
  ON public.worker_performance FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Workers can see own performance"
  ON public.worker_performance FOR SELECT
  TO authenticated USING (auth.uid() = worker_id);

CREATE POLICY "Authenticated users can insert worker performance"
  ON public.worker_performance FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update worker performance"
  ON public.worker_performance FOR UPDATE
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can read route analytics"
  ON public.route_analytics FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert route analytics"
  ON public.route_analytics FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read interventions"
  ON public.dispatch_interventions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can create interventions"
  ON public.dispatch_interventions FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can read alerts"
  ON public.delivery_alerts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage alerts"
  ON public.delivery_alerts FOR ALL
  TO authenticated USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_worker_performance_worker_id ON public.worker_performance(worker_id);
CREATE INDEX IF NOT EXISTS idx_route_analytics_route_id ON public.route_analytics(route_id);
CREATE INDEX IF NOT EXISTS idx_route_analytics_worker_id ON public.route_analytics(worker_id);
CREATE INDEX IF NOT EXISTS idx_dispatch_interventions_route_id ON public.dispatch_interventions(route_id);
CREATE INDEX IF NOT EXISTS idx_delivery_alerts_status ON public.delivery_alerts(status);
CREATE INDEX IF NOT EXISTS idx_delivery_alerts_severity ON public.delivery_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_delivery_alerts_route_id ON public.delivery_alerts(route_id);