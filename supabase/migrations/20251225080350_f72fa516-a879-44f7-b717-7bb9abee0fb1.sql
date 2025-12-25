-- Biker OS v2 Data Model

-- 1) Biker locations (last known position)
CREATE TABLE public.biker_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  biker_id UUID NOT NULL REFERENCES public.profiles(id),
  lat NUMERIC(10, 7) NOT NULL,
  lng NUMERIC(10, 7) NOT NULL,
  accuracy_meters NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2) Issues table for tracking store/location issues
CREATE TABLE public.biker_issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  location_id UUID REFERENCES public.store_master(id),
  reported_by_biker_id UUID REFERENCES public.profiles(id),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('inventory_missing', 'sticker_missing', 'store_closed', 'hostile_staff', 'competitor_activity', 'delivery_problem', 'other')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  assigned_biker_id UUID REFERENCES public.profiles(id),
  description TEXT,
  photos TEXT[],
  escalated BOOLEAN DEFAULT FALSE,
  due_at TIMESTAMP WITH TIME ZONE,
  escalates_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3) Issue SLA rules
CREATE TABLE public.issue_sla_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  issue_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  sla_minutes INTEGER NOT NULL DEFAULT 1440,
  escalation_minutes INTEGER NOT NULL DEFAULT 2880,
  escalation_target_role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, issue_type, severity)
);

-- 4) Issue events (audit log)
CREATE TABLE public.issue_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  issue_id UUID NOT NULL REFERENCES public.biker_issues(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL CHECK (action IN ('created', 'assigned', 'status_changed', 'escalated', 'resolved', 'comment_added')),
  notes TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 5) Biker performance daily
CREATE TABLE public.biker_performance_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  biker_id UUID NOT NULL REFERENCES public.profiles(id),
  date DATE NOT NULL,
  tasks_assigned INTEGER DEFAULT 0,
  tasks_submitted INTEGER DEFAULT 0,
  tasks_approved INTEGER DEFAULT 0,
  tasks_rejected INTEGER DEFAULT 0,
  tasks_late INTEGER DEFAULT 0,
  avg_time_to_submit_minutes NUMERIC,
  issues_reported INTEGER DEFAULT 0,
  issues_overdue INTEGER DEFAULT 0,
  score NUMERIC DEFAULT 100,
  coaching_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(biker_id, date)
);

-- 6) Territory stats daily
CREATE TABLE public.territory_stats_daily (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  date DATE NOT NULL,
  boro TEXT NOT NULL,
  neighborhood TEXT,
  tasks_completed INTEGER DEFAULT 0,
  issues_open INTEGER DEFAULT 0,
  issues_critical INTEGER DEFAULT 0,
  revenue_impact_estimate NUMERIC,
  heat_score NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id, date, boro, neighborhood)
);

-- 7) Route suggestions
CREATE TABLE public.route_suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  suggested_for_biker_id UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'applied', 'dismissed')),
  algorithm_version TEXT DEFAULT 'v1',
  summary TEXT,
  priority_focus TEXT,
  boro_filter TEXT,
  neighborhood_filter TEXT,
  stops_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 8) Route suggestion stops
CREATE TABLE public.route_suggestion_stops (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_suggestion_id UUID NOT NULL REFERENCES public.route_suggestions(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.store_master(id),
  stop_order INTEGER NOT NULL,
  reason TEXT CHECK (reason IN ('high_priority_issue', 'sla_risk', 'territory_gap', 'followup_needed', 'new_store', 'other')),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  estimated_minutes INTEGER,
  issue_id UUID REFERENCES public.biker_issues(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 9) Internal notifications
CREATE TABLE public.internal_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id),
  target_role TEXT,
  title TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.biker_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biker_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biker_performance_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.territory_stats_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_suggestion_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow authenticated users
CREATE POLICY "Authenticated users can view biker_locations" ON public.biker_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert biker_locations" ON public.biker_locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update biker_locations" ON public.biker_locations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view biker_issues" ON public.biker_issues FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert biker_issues" ON public.biker_issues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update biker_issues" ON public.biker_issues FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete biker_issues" ON public.biker_issues FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view issue_sla_rules" ON public.issue_sla_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage issue_sla_rules" ON public.issue_sla_rules FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view issue_events" ON public.issue_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert issue_events" ON public.issue_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view biker_performance_daily" ON public.biker_performance_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage biker_performance_daily" ON public.biker_performance_daily FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view territory_stats_daily" ON public.territory_stats_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage territory_stats_daily" ON public.territory_stats_daily FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view route_suggestions" ON public.route_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage route_suggestions" ON public.route_suggestions FOR ALL TO authenticated USING (true);

CREATE POLICY "Authenticated users can view route_suggestion_stops" ON public.route_suggestion_stops FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage route_suggestion_stops" ON public.route_suggestion_stops FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can view own notifications" ON public.internal_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR target_role IS NOT NULL);
CREATE POLICY "Authenticated users can insert notifications" ON public.internal_notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update own notifications" ON public.internal_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_biker_locations_biker_id ON public.biker_locations(biker_id);
CREATE INDEX idx_biker_locations_recorded_at ON public.biker_locations(recorded_at DESC);
CREATE INDEX idx_biker_issues_status ON public.biker_issues(status);
CREATE INDEX idx_biker_issues_severity ON public.biker_issues(severity);
CREATE INDEX idx_biker_issues_location_id ON public.biker_issues(location_id);
CREATE INDEX idx_biker_issues_due_at ON public.biker_issues(due_at);
CREATE INDEX idx_issue_events_issue_id ON public.issue_events(issue_id);
CREATE INDEX idx_biker_performance_daily_biker_date ON public.biker_performance_daily(biker_id, date DESC);
CREATE INDEX idx_territory_stats_daily_date ON public.territory_stats_daily(date DESC);
CREATE INDEX idx_route_suggestions_date ON public.route_suggestions(date DESC);
CREATE INDEX idx_route_suggestion_stops_suggestion ON public.route_suggestion_stops(route_suggestion_id);

-- Function to compute SLA timestamps on issue creation
CREATE OR REPLACE FUNCTION public.compute_issue_sla()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sla_minutes INTEGER;
  v_escalation_minutes INTEGER;
BEGIN
  SELECT sla_minutes, escalation_minutes INTO v_sla_minutes, v_escalation_minutes
  FROM public.issue_sla_rules
  WHERE (business_id = NEW.business_id OR business_id IS NULL)
    AND issue_type = NEW.issue_type
    AND severity = NEW.severity
  LIMIT 1;
  
  IF v_sla_minutes IS NULL THEN
    v_sla_minutes := CASE NEW.severity
      WHEN 'critical' THEN 120
      WHEN 'high' THEN 480
      WHEN 'medium' THEN 1440
      ELSE 2880
    END;
    v_escalation_minutes := v_sla_minutes * 2;
  END IF;
  
  NEW.due_at := NEW.created_at + (v_sla_minutes || ' minutes')::INTERVAL;
  NEW.escalates_at := NEW.created_at + (v_escalation_minutes || ' minutes')::INTERVAL;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_compute_issue_sla
  BEFORE INSERT ON public.biker_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_issue_sla();

-- Function to auto-create issue event on insert
CREATE OR REPLACE FUNCTION public.create_issue_created_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.issue_events (issue_id, actor_user_id, action, notes)
  VALUES (NEW.id, NEW.reported_by_biker_id, 'created', 'Issue created');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_issue_event
  AFTER INSERT ON public.biker_issues
  FOR EACH ROW
  EXECUTE FUNCTION public.create_issue_created_event();

-- Insert default SLA rules
INSERT INTO public.issue_sla_rules (issue_type, severity, sla_minutes, escalation_minutes, escalation_target_role)
VALUES
  ('inventory_missing', 'critical', 120, 240, 'admin'),
  ('inventory_missing', 'high', 480, 960, 'admin'),
  ('inventory_missing', 'medium', 1440, 2880, 'ops_manager'),
  ('inventory_missing', 'low', 2880, 5760, 'dispatcher'),
  ('sticker_missing', 'critical', 120, 240, 'admin'),
  ('sticker_missing', 'high', 480, 960, 'admin'),
  ('sticker_missing', 'medium', 1440, 2880, 'ops_manager'),
  ('sticker_missing', 'low', 2880, 5760, 'dispatcher'),
  ('store_closed', 'critical', 60, 120, 'admin'),
  ('store_closed', 'high', 240, 480, 'admin'),
  ('store_closed', 'medium', 1440, 2880, 'ops_manager'),
  ('store_closed', 'low', 2880, 5760, 'dispatcher'),
  ('hostile_staff', 'critical', 60, 120, 'admin'),
  ('hostile_staff', 'high', 240, 480, 'admin'),
  ('hostile_staff', 'medium', 1440, 2880, 'ops_manager'),
  ('hostile_staff', 'low', 2880, 5760, 'dispatcher'),
  ('competitor_activity', 'high', 480, 960, 'admin'),
  ('competitor_activity', 'medium', 1440, 2880, 'ops_manager'),
  ('competitor_activity', 'low', 2880, 5760, 'dispatcher'),
  ('delivery_problem', 'critical', 60, 120, 'admin'),
  ('delivery_problem', 'high', 240, 480, 'admin'),
  ('delivery_problem', 'medium', 1440, 2880, 'ops_manager'),
  ('delivery_problem', 'low', 2880, 5760, 'dispatcher'),
  ('other', 'critical', 240, 480, 'admin'),
  ('other', 'high', 480, 960, 'admin'),
  ('other', 'medium', 1440, 2880, 'ops_manager'),
  ('other', 'low', 2880, 5760, 'dispatcher')
ON CONFLICT DO NOTHING;