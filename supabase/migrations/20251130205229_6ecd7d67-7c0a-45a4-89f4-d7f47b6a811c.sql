-- SECTION 7: AI Approval Workflow Table

CREATE TABLE IF NOT EXISTS public.ai_approval_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type TEXT NOT NULL, -- 'automation', 'payout', 'schema_change', 'permission_change'
  action_description TEXT NOT NULL,
  requested_by TEXT, -- 'ai_worker' or user_id
  ai_worker_id UUID REFERENCES public.ai_workers(id),
  payload JSONB DEFAULT '{}'::jsonb,
  severity TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'expired'
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ai_approval_status ON public.ai_approval_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_approval_type ON public.ai_approval_queue(request_type);
CREATE INDEX IF NOT EXISTS idx_ai_approval_severity ON public.ai_approval_queue(severity);
CREATE INDEX IF NOT EXISTS idx_ai_approval_created ON public.ai_approval_queue(created_at DESC);

-- RLS
ALTER TABLE public.ai_approval_queue ENABLE ROW LEVEL SECURITY;

-- Only admins can view/manage approval queue
CREATE POLICY "Admins can view ai approvals" ON public.ai_approval_queue 
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert ai approvals" ON public.ai_approval_queue 
  FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()) OR public.is_elevated_user(auth.uid()));
CREATE POLICY "Admins can update ai approvals" ON public.ai_approval_queue 
  FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));

-- Function to request AI approval
CREATE OR REPLACE FUNCTION public.request_ai_approval(
  p_request_type TEXT,
  p_action_description TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_severity TEXT DEFAULT 'medium',
  p_ai_worker_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
BEGIN
  INSERT INTO public.ai_approval_queue (
    request_type,
    action_description,
    requested_by,
    ai_worker_id,
    payload,
    severity
  ) VALUES (
    p_request_type,
    p_action_description,
    COALESCE(p_ai_worker_id::text, 'ai_system'),
    p_ai_worker_id,
    p_payload,
    p_severity
  )
  RETURNING id INTO v_request_id;
  
  RETURN v_request_id;
END;
$$;

-- Function to approve/reject AI request
CREATE OR REPLACE FUNCTION public.process_ai_approval(
  p_request_id UUID,
  p_approved BOOLEAN,
  p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only admins can approve
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can process approvals';
  END IF;

  UPDATE public.ai_approval_queue
  SET 
    status = CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_notes = p_notes
  WHERE id = p_request_id AND status = 'pending';
  
  RETURN FOUND;
END;
$$;