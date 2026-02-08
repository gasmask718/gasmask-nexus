
-- Fix: tables already partially created, just add the missing pieces
-- Drop the partial delivery_followup_actions and recreate
DROP TABLE IF EXISTS public.store_health_scores;
DROP TABLE IF EXISTS public.delivery_followup_actions;

CREATE TABLE public.delivery_followup_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checklist_id UUID NOT NULL REFERENCES public.delivery_checklists(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  action_label TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  assigned_role TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','dismissed')),
  rule_trigger TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dfa_store_status ON public.delivery_followup_actions(store_id, status);
CREATE INDEX idx_dfa_status_priority ON public.delivery_followup_actions(status, priority);

ALTER TABLE public.delivery_followup_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view followup actions"
  ON public.delivery_followup_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert followup actions"
  ON public.delivery_followup_actions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update followup actions"
  ON public.delivery_followup_actions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Store Health Scores
CREATE TABLE public.store_health_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  overall_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  health_status TEXT NOT NULL DEFAULT 'watch' CHECK (health_status IN ('healthy','watch','at_risk')),
  dimension_scores JSONB NOT NULL DEFAULT '{}',
  dimension_explanations JSONB NOT NULL DEFAULT '{}',
  last_visit_date DATE,
  total_visits_30d INTEGER DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shs_store ON public.store_health_scores(store_id);
CREATE INDEX idx_shs_status_score ON public.store_health_scores(health_status, overall_score);

ALTER TABLE public.store_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view health scores"
  ON public.store_health_scores FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert health scores"
  ON public.store_health_scores FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update health scores"
  ON public.store_health_scores FOR UPDATE
  USING (auth.uid() IS NOT NULL);
