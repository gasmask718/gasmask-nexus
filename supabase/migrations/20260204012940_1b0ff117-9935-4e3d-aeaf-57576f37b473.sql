
-- ═══════════════════════════════════════════════════════════════════════════════
-- HUMAN-CONTROLLED OUTREACH CADENCE SYSTEM
-- Phase 1: Core tables for cadence policies, outreach plans, and escalations
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) Store Cadence Policy — defines how often and how to reach out to each store
CREATE TABLE IF NOT EXISTS public.store_cadence_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  
  -- Cadence settings
  enabled BOOLEAN NOT NULL DEFAULT false,
  cadence_days INTEGER NOT NULL DEFAULT 7 CHECK (cadence_days >= 1 AND cadence_days <= 30),
  
  -- Channel order preference
  text_first BOOLEAN NOT NULL DEFAULT true,
  
  -- Attempt caps per window
  max_texts_per_window INTEGER NOT NULL DEFAULT 3,
  max_calls_per_window INTEGER NOT NULL DEFAULT 2,
  
  -- Time windows (stored as 'HH:MM' strings)
  allowed_hours_start TIME NOT NULL DEFAULT '09:00',
  allowed_hours_end TIME NOT NULL DEFAULT '18:00',
  
  -- Ownership
  owner_user_id UUID REFERENCES auth.users(id),
  owner_team TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(store_id)
);

-- 2) Outreach Plans — generated plans for stores that are due
CREATE TABLE IF NOT EXISTS public.outreach_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  
  -- Window timing
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  
  -- Status workflow: draft -> approved -> running -> completed | cancelled
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'running', 'completed', 'cancelled')),
  
  -- Approval tracking
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  
  -- Execution tracking
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Summary stats
  total_items INTEGER NOT NULL DEFAULT 0,
  items_sent INTEGER NOT NULL DEFAULT 0,
  items_responded INTEGER NOT NULL DEFAULT 0,
  
  -- Result
  escalated_to_visit BOOLEAN NOT NULL DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Outreach Plan Items — individual actions within a plan
CREATE TABLE IF NOT EXISTS public.outreach_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.outreach_plans(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.store_contacts(id) ON DELETE CASCADE,
  
  -- What to do
  channel TEXT NOT NULL CHECK (channel IN ('text', 'call')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  template_id UUID, -- optional reference to communication_templates
  
  -- Status: pending -> sent | failed | skipped | responded
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped', 'responded')),
  
  -- Behavior flags
  stop_if_response BOOLEAN NOT NULL DEFAULT true,
  
  -- Execution result
  executed_at TIMESTAMPTZ,
  communication_log_id UUID, -- links to the actual communication_logs entry
  outcome TEXT, -- answered, no_answer, voicemail, delivered, failed, replied
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) Store Escalations — tracks stores needing physical visits after failed outreach
CREATE TABLE IF NOT EXISTS public.store_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  
  -- Source
  outreach_plan_id UUID REFERENCES public.outreach_plans(id) ON DELETE SET NULL,
  
  -- Reason and priority
  reason TEXT NOT NULL DEFAULT 'unresponsive' CHECK (reason IN ('unresponsive', 'at_risk', 'high_value', 'manual')),
  priority INTEGER NOT NULL DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  
  -- Context
  attempts_made INTEGER NOT NULL DEFAULT 0,
  contacts_attempted INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  
  -- Status: pending -> assigned -> visited -> resolved
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'visited', 'resolved', 'dismissed')),
  
  -- Assignment
  assigned_to UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  
  -- Created by
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_store_cadence_policy_store_id ON public.store_cadence_policy(store_id);
CREATE INDEX IF NOT EXISTS idx_store_cadence_policy_enabled ON public.store_cadence_policy(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_outreach_plans_store_id ON public.outreach_plans(store_id);
CREATE INDEX IF NOT EXISTS idx_outreach_plans_status ON public.outreach_plans(status);
CREATE INDEX IF NOT EXISTS idx_outreach_plans_window ON public.outreach_plans(window_start, window_end);

CREATE INDEX IF NOT EXISTS idx_outreach_plan_items_plan_id ON public.outreach_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_outreach_plan_items_contact_id ON public.outreach_plan_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_plan_items_status ON public.outreach_plan_items(status);
CREATE INDEX IF NOT EXISTS idx_outreach_plan_items_scheduled ON public.outreach_plan_items(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_store_escalations_store_id ON public.store_escalations(store_id);
CREATE INDEX IF NOT EXISTS idx_store_escalations_status ON public.store_escalations(status);
CREATE INDEX IF NOT EXISTS idx_store_escalations_assigned ON public.store_escalations(assigned_to) WHERE assigned_to IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.store_cadence_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_escalations ENABLE ROW LEVEL SECURITY;

-- Cadence Policy: admin/owner can manage all, owners can view/edit their assigned
CREATE POLICY "Admin/Owner can manage all cadence policies"
  ON public.store_cadence_policy FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Policy owners can view their policies"
  ON public.store_cadence_policy FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Policy owners can update their policies"
  ON public.store_cadence_policy FOR UPDATE
  USING (owner_user_id = auth.uid());

-- Outreach Plans: similar pattern
CREATE POLICY "Admin/Owner can manage all outreach plans"
  ON public.outreach_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Authenticated users can view outreach plans"
  ON public.outreach_plans FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Outreach Plan Items
CREATE POLICY "Admin/Owner can manage all plan items"
  ON public.outreach_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Authenticated users can view plan items"
  ON public.outreach_plan_items FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Store Escalations
CREATE POLICY "Admin/Owner can manage all escalations"
  ON public.store_escalations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Assigned users can view their escalations"
  ON public.store_escalations FOR SELECT
  USING (assigned_to = auth.uid());

CREATE POLICY "Assigned users can update their escalations"
  ON public.store_escalations FOR UPDATE
  USING (assigned_to = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGERS for updated_at
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_store_cadence_policy_updated_at
  BEFORE UPDATE ON public.store_cadence_policy
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_plans_updated_at
  BEFORE UPDATE ON public.outreach_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outreach_plan_items_updated_at
  BEFORE UPDATE ON public.outreach_plan_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_store_escalations_updated_at
  BEFORE UPDATE ON public.store_escalations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Generate outreach plan for a store
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.generate_store_outreach_plan(p_store_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_policy store_cadence_policy%ROWTYPE;
  v_plan_id UUID;
  v_contact RECORD;
  v_scheduled_at TIMESTAMPTZ;
  v_item_count INTEGER := 0;
BEGIN
  -- Get the cadence policy
  SELECT * INTO v_policy FROM store_cadence_policy WHERE store_id = p_store_id;
  
  IF NOT FOUND OR NOT v_policy.enabled THEN
    RAISE EXCEPTION 'No enabled cadence policy for store %', p_store_id;
  END IF;
  
  -- Create the plan
  INSERT INTO outreach_plans (store_id, window_start, window_end)
  VALUES (
    p_store_id,
    now(),
    now() + (v_policy.cadence_days || ' days')::interval
  )
  RETURNING id INTO v_plan_id;
  
  -- Generate items for each contact with SMS enabled
  v_scheduled_at := now();
  
  FOR v_contact IN 
    SELECT id, name, can_receive_sms 
    FROM store_contacts 
    WHERE store_id = p_store_id 
    ORDER BY is_primary DESC, created_at ASC
  LOOP
    -- Text first (if policy says so and contact allows)
    IF v_policy.text_first AND v_contact.can_receive_sms AND v_item_count < v_policy.max_texts_per_window THEN
      INSERT INTO outreach_plan_items (plan_id, contact_id, channel, scheduled_at)
      VALUES (v_plan_id, v_contact.id, 'text', v_scheduled_at);
      v_item_count := v_item_count + 1;
    END IF;
    
    -- Call as fallback (scheduled later in the window)
    IF v_item_count < (v_policy.max_texts_per_window + v_policy.max_calls_per_window) THEN
      INSERT INTO outreach_plan_items (plan_id, contact_id, channel, scheduled_at)
      VALUES (v_plan_id, v_contact.id, 'call', v_scheduled_at + interval '3 days');
      v_item_count := v_item_count + 1;
    END IF;
  END LOOP;
  
  -- Update total items count
  UPDATE outreach_plans SET total_items = v_item_count WHERE id = v_plan_id;
  
  RETURN v_plan_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- HELPER FUNCTION: Escalate store to needs visit
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.escalate_store_to_visit(
  p_store_id UUID,
  p_plan_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT 'unresponsive',
  p_priority INTEGER DEFAULT 5
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_escalation_id UUID;
  v_attempts INTEGER;
  v_contacts INTEGER;
  v_last_attempt TIMESTAMPTZ;
BEGIN
  -- Gather stats from the plan if provided
  IF p_plan_id IS NOT NULL THEN
    SELECT 
      COUNT(*) FILTER (WHERE status = 'sent'),
      COUNT(DISTINCT contact_id),
      MAX(executed_at)
    INTO v_attempts, v_contacts, v_last_attempt
    FROM outreach_plan_items
    WHERE plan_id = p_plan_id;
    
    -- Mark the plan as escalated
    UPDATE outreach_plans SET escalated_to_visit = true WHERE id = p_plan_id;
  ELSE
    v_attempts := 0;
    v_contacts := 0;
    v_last_attempt := NULL;
  END IF;
  
  -- Create the escalation
  INSERT INTO store_escalations (
    store_id,
    outreach_plan_id,
    reason,
    priority,
    attempts_made,
    contacts_attempted,
    last_attempt_at
  )
  VALUES (
    p_store_id,
    p_plan_id,
    p_reason,
    p_priority,
    COALESCE(v_attempts, 0),
    COALESCE(v_contacts, 0),
    v_last_attempt
  )
  RETURNING id INTO v_escalation_id;
  
  -- Also create a follow-up queue entry
  INSERT INTO follow_up_queue (
    store_id,
    reason,
    recommended_action,
    priority,
    due_at,
    context,
    status
  )
  VALUES (
    p_store_id,
    'Store unresponsive - needs physical visit',
    'Visit store to re-establish contact',
    p_priority,
    now() + interval '1 day',
    jsonb_build_object(
      'escalation_id', v_escalation_id,
      'source', 'outreach_cadence',
      'attempts_made', v_attempts,
      'contacts_attempted', v_contacts
    ),
    'pending'
  );
  
  RETURN v_escalation_id;
END;
$$;

-- Enable realtime for outreach monitoring
ALTER PUBLICATION supabase_realtime ADD TABLE public.outreach_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_escalations;
