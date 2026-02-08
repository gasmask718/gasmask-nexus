
-- Phase VI-B: Sell-Through Feedback table (minimal, append-only)
CREATE TABLE public.sell_through_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 280),
  page_context TEXT NOT NULL DEFAULT 'ambassador_sell_through',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Phase VI-A: Sell-Through Analytics Events table (passive instrumentation)
CREATE TABLE public.sell_through_analytics_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  attributes JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.sell_through_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sell_through_analytics_events ENABLE ROW LEVEL SECURITY;

-- Feedback: ambassadors can insert their own, admins can read all
CREATE POLICY "Ambassadors insert own feedback"
  ON public.sell_through_feedback FOR INSERT
  WITH CHECK (
    ambassador_id IN (
      SELECT id FROM public.ambassadors
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Ambassadors read own feedback"
  ON public.sell_through_feedback FOR SELECT
  USING (
    ambassador_id IN (
      SELECT id FROM public.ambassadors
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins read all feedback"
  ON public.sell_through_feedback FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Analytics events: ambassadors can insert their own, admins can read all
CREATE POLICY "Ambassadors insert own analytics events"
  ON public.sell_through_analytics_events FOR INSERT
  WITH CHECK (
    ambassador_id IN (
      SELECT id FROM public.ambassadors
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Admins read all analytics events"
  ON public.sell_through_analytics_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'owner')
    )
  );

-- Indexes for efficient querying
CREATE INDEX idx_st_feedback_ambassador ON public.sell_through_feedback(ambassador_id);
CREATE INDEX idx_st_feedback_created ON public.sell_through_feedback(created_at DESC);
CREATE INDEX idx_st_events_ambassador ON public.sell_through_analytics_events(ambassador_id);
CREATE INDEX idx_st_events_type ON public.sell_through_analytics_events(event_type);
CREATE INDEX idx_st_events_created ON public.sell_through_analytics_events(created_at DESC);

-- Phase VI-C: Admin audit view for decision sufficiency analysis
CREATE OR REPLACE VIEW public.v_sell_through_usage_audit AS
SELECT
  -- Filter usage stats
  COUNT(*) FILTER (WHERE event_type = 'sell_through_filter_used') AS total_filter_events,
  COUNT(DISTINCT ambassador_id) FILTER (WHERE event_type = 'sell_through_filter_used') AS ambassadors_using_filters,
  
  -- Overdue focus stats
  COUNT(*) FILTER (WHERE event_type = 'sell_through_overdue_viewed') AS total_overdue_views,
  COUNT(DISTINCT ambassador_id) FILTER (WHERE event_type = 'sell_through_overdue_viewed') AS ambassadors_viewing_overdue,
  
  -- Row click stats (store profile navigation)
  COUNT(*) FILTER (WHERE event_type = 'sell_through_row_clicked') AS total_row_clicks,
  COUNT(DISTINCT ambassador_id) FILTER (WHERE event_type = 'sell_through_row_clicked') AS ambassadors_clicking_rows,
  
  -- Session stats
  COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') AS total_page_loads,
  COUNT(DISTINCT ambassador_id) FILTER (WHERE event_type = 'sell_through_view_loaded') AS unique_ambassador_sessions,
  
  -- Engagement rates (if any sessions exist)
  CASE WHEN COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE event_type = 'sell_through_filter_used')::numeric /
      COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') * 100, 1
    )
    ELSE 0
  END AS filter_usage_pct,
  
  CASE WHEN COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE event_type = 'sell_through_overdue_viewed')::numeric /
      COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') * 100, 1
    )
    ELSE 0
  END AS overdue_view_pct,
  
  CASE WHEN COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') > 0
    THEN ROUND(
      COUNT(*) FILTER (WHERE event_type = 'sell_through_row_clicked')::numeric /
      COUNT(*) FILTER (WHERE event_type = 'sell_through_view_loaded') * 100, 1
    )
    ELSE 0
  END AS row_click_pct,

  -- Feedback stats
  (SELECT COUNT(*) FROM public.sell_through_feedback) AS total_feedback_entries,
  (SELECT COUNT(*) FROM public.sell_through_feedback WHERE text ILIKE '%trend%' OR text ILIKE '%over time%' OR text ILIKE '%velocity%' OR text ILIKE '%history%') AS trend_related_feedback

FROM public.sell_through_analytics_events;
