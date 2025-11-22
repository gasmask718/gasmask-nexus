-- Mission Notifications
CREATE TABLE public.mission_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  mission_id UUID NOT NULL REFERENCES public.mission_assignments(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  xp_awarded INTEGER NOT NULL DEFAULT 0,
  badge_awarded TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.mission_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
ON public.mission_notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.mission_notifications FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
ON public.mission_notifications FOR UPDATE
USING (auth.uid() = user_id);

-- Add realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mission_notifications;

-- Influencer Posts
CREATE TABLE public.influencer_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.influencer_campaigns(id),
  platform_post_id TEXT,
  url TEXT,
  posted_at TIMESTAMP WITH TIME ZONE,
  caption TEXT,
  hashtags JSONB,
  metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view influencer posts"
ON public.influencer_posts FOR SELECT
USING (true);

CREATE POLICY "Admins can manage influencer posts"
ON public.influencer_posts FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Influencer Conversions
CREATE TABLE public.influencer_conversions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.influencer_campaigns(id),
  post_id UUID REFERENCES public.influencer_posts(id),
  store_id UUID REFERENCES public.stores(id),
  wholesale_hub_id UUID REFERENCES public.wholesale_hubs(id),
  conversion_type TEXT NOT NULL,
  value NUMERIC,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.influencer_conversions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view influencer conversions"
ON public.influencer_conversions FOR SELECT
USING (true);

CREATE POLICY "Admins can manage influencer conversions"
ON public.influencer_conversions FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Route Insights
CREATE TABLE public.route_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id),
  average_service_time_minutes INTEGER,
  average_arrival_delay_minutes INTEGER,
  visit_success_rate NUMERIC,
  best_time_window TEXT,
  notes TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.route_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view route insights"
ON public.route_insights FOR SELECT
USING (true);

CREATE POLICY "Admins can manage route insights"
ON public.route_insights FOR ALL
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

-- Executive Reports
CREATE TABLE public.executive_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_date DATE NOT NULL,
  period TEXT NOT NULL,
  data JSONB NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  delivered_channels JSONB
);

ALTER TABLE public.executive_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view executive reports"
ON public.executive_reports FOR SELECT
USING (EXISTS (
  SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "System can create executive reports"
ON public.executive_reports FOR INSERT
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_route_insights_updated_at
BEFORE UPDATE ON public.route_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();