
CREATE TABLE public.pending_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bland_call_log_id UUID REFERENCES public.bland_call_logs(id) ON DELETE SET NULL,
  store_id UUID NOT NULL,
  store_name TEXT,
  requested_day TEXT,
  requested_window TEXT,
  urgency TEXT,
  intent_summary TEXT,
  recommended_boxes INTEGER,
  recommended_brand TEXT,
  estimated_revenue NUMERIC,
  confidence_level TEXT,
  ai_payload JSONB,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  route_stop_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT prs_status_chk CHECK (status IN ('pending_approval','approved','rejected','edited')),
  CONSTRAINT prs_window_chk CHECK (requested_window IS NULL OR requested_window IN ('morning','afternoon','evening')),
  CONSTRAINT prs_urgency_chk CHECK (urgency IS NULL OR urgency IN ('today','this_week','next_week','no_rush')),
  CONSTRAINT prs_confidence_chk CHECK (confidence_level IS NULL OR confidence_level IN ('high','medium','low'))
);

CREATE INDEX idx_prs_status ON public.pending_route_stops(status);
CREATE INDEX idx_prs_store ON public.pending_route_stops(store_id);
CREATE INDEX idx_prs_created ON public.pending_route_stops(created_at DESC);

ALTER TABLE public.pending_route_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view pending route stops"
ON public.pending_route_stops FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','employee','csr','warehouse','driver'))
);

CREATE POLICY "Staff can update pending route stops"
ON public.pending_route_stops FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','employee','csr'))
);

CREATE POLICY "Staff can insert pending route stops"
ON public.pending_route_stops FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','employee','csr'))
);

CREATE TRIGGER trg_prs_updated_at
BEFORE UPDATE ON public.pending_route_stops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
