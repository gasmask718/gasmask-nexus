
-- ═══════════════════════════════════════════════════════════════════════════
-- FLOOR 9.4 — AI Violation & Denial Monitor (read-only aggregation view)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_ai_denial_summary AS
SELECT
  action_key,
  neighborhood_id,
  blocked_reason AS denial_reason,
  permission_source AS constraint_source,
  COUNT(*) AS denial_count,
  MIN(created_at) AS first_denied_at,
  MAX(created_at) AS last_denied_at,
  -- Time window classification
  CASE
    WHEN MAX(created_at) > NOW() - INTERVAL '1 hour' THEN 'last_hour'
    WHEN MAX(created_at) > NOW() - INTERVAL '24 hours' THEN 'last_24h'
    WHEN MAX(created_at) > NOW() - INTERVAL '7 days' THEN 'last_7d'
    ELSE 'older'
  END AS time_window
FROM public.ai_decision_log
WHERE permission_allowed = false
GROUP BY action_key, neighborhood_id, blocked_reason, permission_source
ORDER BY denial_count DESC;

-- ═══════════════════════════════════════════════════════════════════════════
-- FLOOR 11 — Territory Playbooks (human-owned autopilot)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE public.territory_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  neighborhood_id UUID REFERENCES public.neighborhoods(id),
  playbook_name TEXT NOT NULL,
  ordered_action_keys TEXT[] NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  created_by UUID NOT NULL,
  approved_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.territory_playbooks ENABLE ROW LEVEL SECURITY;

-- Policies: only admin/owner can manage playbooks
CREATE POLICY "Admins can view all playbooks"
  ON public.territory_playbooks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can create playbooks"
  ON public.territory_playbooks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "Admins can update playbooks"
  ON public.territory_playbooks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can delete playbooks"
  ON public.territory_playbooks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

-- Playbook execution log (audit trail)
CREATE TABLE public.territory_playbook_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  playbook_id UUID NOT NULL REFERENCES public.territory_playbooks(id),
  triggered_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 0,
  step_results JSONB DEFAULT '[]',
  halted_at_step INTEGER,
  halt_reason TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.territory_playbook_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view playbook runs"
  ON public.territory_playbook_runs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can insert playbook runs"
  ON public.territory_playbook_runs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

CREATE POLICY "Admins can update playbook runs"
  ON public.territory_playbook_runs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'owner')
    )
  );

-- Timestamp trigger for playbooks
CREATE TRIGGER update_territory_playbooks_updated_at
  BEFORE UPDATE ON public.territory_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Validate that action keys exist in registry
CREATE OR REPLACE FUNCTION public.validate_playbook_action_keys()
RETURNS TRIGGER AS $$
DECLARE
  key TEXT;
BEGIN
  FOREACH key IN ARRAY NEW.ordered_action_keys LOOP
    IF NOT EXISTS (SELECT 1 FROM public.ai_action_registry WHERE action_key = key) THEN
      RAISE EXCEPTION 'Action key "%" not found in ai_action_registry', key;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER validate_playbook_keys
  BEFORE INSERT OR UPDATE ON public.territory_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_playbook_action_keys();
