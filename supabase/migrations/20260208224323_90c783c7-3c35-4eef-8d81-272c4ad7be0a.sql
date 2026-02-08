
-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSION CONTROL (TASK OS) — Owner Penthouse
-- Founder Execution OS: cross-business, cross-floor task intelligence
-- ═══════════════════════════════════════════════════════════════════════════════

-- Mission status enum
CREATE TYPE public.mission_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'blocked',
  'deferred',
  'cancelled'
);

-- Mission priority enum
CREATE TYPE public.mission_priority AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Mission source type
CREATE TYPE public.mission_source AS ENUM (
  'owner_manual',
  'floor_generated',
  'ai_suggested',
  'delegated',
  'recurring_auto',
  'external'
);

-- Mission category
CREATE TYPE public.mission_category AS ENUM (
  'strategic',
  'operational',
  'financial',
  'personal',
  'compliance',
  'growth'
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- CORE TABLE: owner_missions
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.owner_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  
  -- Core fields
  title TEXT NOT NULL,
  description TEXT,
  category public.mission_category NOT NULL DEFAULT 'operational',
  priority public.mission_priority NOT NULL DEFAULT 'medium',
  status public.mission_status NOT NULL DEFAULT 'pending',
  source public.mission_source NOT NULL DEFAULT 'owner_manual',
  
  -- Business & Floor association
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  floor_origin TEXT, -- e.g. 'floor1_crm', 'floor5_finance'
  source_entity_type TEXT, -- e.g. 'store', 'invoice', 'lead'
  source_entity_id UUID,
  
  -- Timing
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Recurring logic
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'custom'
  recurrence_config JSONB, -- { days: [1,3,5], time: '09:00' }
  next_recurrence_at TIMESTAMPTZ,
  
  -- AI metadata
  ai_confidence_score NUMERIC(5,2),
  ai_reasoning TEXT,
  ai_source_session_id UUID,
  
  -- Delegation
  delegated_to TEXT, -- role or name
  delegated_at TIMESTAMPTZ,
  
  -- Completion
  completion_notes TEXT,
  
  -- Momentum tracking
  streak_count INTEGER DEFAULT 0,
  times_deferred INTEGER DEFAULT 0,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- MISSION ACTIVITY LOG
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE public.owner_mission_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id UUID NOT NULL REFERENCES public.owner_missions(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'started', 'completed', 'deferred', 'note_added'
  details TEXT,
  performed_by TEXT DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE INDEX idx_owner_missions_owner ON public.owner_missions(owner_id);
CREATE INDEX idx_owner_missions_status ON public.owner_missions(status);
CREATE INDEX idx_owner_missions_priority ON public.owner_missions(priority);
CREATE INDEX idx_owner_missions_due_date ON public.owner_missions(due_date);
CREATE INDEX idx_owner_missions_business ON public.owner_missions(business_id);
CREATE INDEX idx_owner_missions_source ON public.owner_missions(source);
CREATE INDEX idx_owner_mission_activity_mission ON public.owner_mission_activity(mission_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES — Owner-only access
-- ═══════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.owner_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_mission_activity ENABLE ROW LEVEL SECURITY;

-- Missions: owner can CRUD their own
CREATE POLICY "Owner can view own missions"
  ON public.owner_missions FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can create missions"
  ON public.owner_missions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can update own missions"
  ON public.owner_missions FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Owner can delete own missions"
  ON public.owner_missions FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Activity: readable by mission owner
CREATE POLICY "Owner can view mission activity"
  ON public.owner_mission_activity FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.owner_missions
      WHERE id = mission_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Owner can create mission activity"
  ON public.owner_mission_activity FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.owner_missions
      WHERE id = mission_id AND owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.update_owner_mission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_owner_missions_updated_at
  BEFORE UPDATE ON public.owner_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_owner_mission_updated_at();
