-- Phase 3: Revenue Brain & Game Layer Tables

-- 1. Automation Settings
CREATE TABLE public.automation_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'routes', 'missions', 'influencers', 'outreach', 'alerts')),
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual', 'hybrid_va', 'full_auto')),
  va_owner_id UUID REFERENCES public.profiles(id),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(scope)
);

ALTER TABLE public.automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage automation settings"
  ON public.automation_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view automation settings"
  ON public.automation_settings FOR SELECT
  USING (true);

-- 2. Forecast Snapshots
CREATE TABLE public.forecast_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  predicted_revenue_total NUMERIC NOT NULL DEFAULT 0,
  predicted_revenue_stores NUMERIC NOT NULL DEFAULT 0,
  predicted_revenue_wholesale NUMERIC NOT NULL DEFAULT 0,
  predicted_revenue_influencer NUMERIC NOT NULL DEFAULT 0,
  actual_revenue_total NUMERIC,
  assumptions JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.forecast_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage forecast snapshots"
  ON public.forecast_snapshots FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view forecast snapshots"
  ON public.forecast_snapshots FOR SELECT
  USING (true);

-- 3. Worker Scores (Gamification)
CREATE TABLE public.worker_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  role app_role NOT NULL,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  missions_completed INTEGER NOT NULL DEFAULT 0,
  stores_activated INTEGER NOT NULL DEFAULT 0,
  wholesale_intros INTEGER NOT NULL DEFAULT 0,
  streak_days INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMP WITH TIME ZONE,
  badges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.worker_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scores"
  ON public.worker_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all scores"
  ON public.worker_scores FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- 4. Mission Templates
CREATE TABLE public.mission_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  role app_role NOT NULL,
  mission_type TEXT NOT NULL CHECK (mission_type IN ('visits', 'new_stores', 'restock', 'wholesale_outreach', 'influencer_outreach')),
  target_count INTEGER NOT NULL DEFAULT 1,
  xp_reward INTEGER NOT NULL DEFAULT 100,
  cash_bonus NUMERIC,
  validity_days INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage mission templates"
  ON public.mission_templates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view active templates"
  ON public.mission_templates FOR SELECT
  USING (is_active = true);

-- 5. Mission Assignments
CREATE TABLE public.mission_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  mission_template_id UUID NOT NULL REFERENCES public.mission_templates(id),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'in_progress', 'completed', 'expired')),
  progress_current INTEGER NOT NULL DEFAULT 0,
  progress_target INTEGER NOT NULL DEFAULT 1,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.mission_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignments"
  ON public.mission_assignments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all assignments"
  ON public.mission_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Users can update their assignment progress"
  ON public.mission_assignments FOR UPDATE
  USING (auth.uid() = user_id);

-- 6. Influencer Campaigns
CREATE TABLE public.influencer_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  objective TEXT,
  start_date DATE,
  end_date DATE,
  budget NUMERIC,
  expected_reach INTEGER,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'paused')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage campaigns"
  ON public.influencer_campaigns FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view campaigns"
  ON public.influencer_campaigns FOR SELECT
  USING (true);

-- 7. Campaign Participants
CREATE TABLE public.influencer_campaign_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.influencer_campaigns(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES public.influencers(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary', 'support', 'micro')),
  agreed_rate NUMERIC,
  deliverables JSONB,
  tracking_link TEXT,
  performance_stats JSONB,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'accepted', 'in_progress', 'completed', 'no_show')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_campaign_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage participants"
  ON public.influencer_campaign_participants FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view participants"
  ON public.influencer_campaign_participants FOR SELECT
  USING (true);

-- 8. Communication Events (Unified Timeline)
CREATE TABLE public.communication_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('call', 'sms', 'visit', 'email', 'dm', 'note', 'mission', 'alert', 'influencer_contact')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'system')),
  store_id UUID REFERENCES public.stores(id),
  user_id UUID REFERENCES public.profiles(id),
  external_contact TEXT,
  channel TEXT CHECK (channel IN ('phone', 'sms', 'whatsapp', 'instagram', 'tiktok', 'email', 'internal')),
  summary TEXT NOT NULL,
  payload JSONB,
  linked_entity_type TEXT CHECK (linked_entity_type IN ('store', 'route', 'mission', 'influencer', 'wholesale_hub', 'none')),
  linked_entity_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.communication_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view communication events"
  ON public.communication_events FOR SELECT
  USING (true);

CREATE POLICY "Field workers can create events"
  ON public.communication_events FOR INSERT
  WITH CHECK (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = ANY(ARRAY['admin'::app_role, 'csr'::app_role])
  ));

-- Triggers for updated_at
CREATE TRIGGER update_automation_settings_updated_at
  BEFORE UPDATE ON public.automation_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_worker_scores_updated_at
  BEFORE UPDATE ON public.worker_scores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mission_templates_updated_at
  BEFORE UPDATE ON public.mission_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_influencer_campaigns_updated_at
  BEFORE UPDATE ON public.influencer_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();