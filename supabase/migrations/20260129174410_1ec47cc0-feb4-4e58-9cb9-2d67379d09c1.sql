-- Create commission_events table as single source of truth for all ambassador earnings
CREATE TABLE public.commission_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('store', 'wholesaler', 'influencer', 'ambassador')),
  source_entity_type TEXT NOT NULL,
  source_entity_id UUID NOT NULL,
  source_entity_name TEXT,
  trigger_type TEXT NOT NULL,
  gross_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  reference_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.commission_events ENABLE ROW LEVEL SECURITY;

-- Index for fast lookups
CREATE INDEX idx_commission_events_ambassador ON public.commission_events(ambassador_id);
CREATE INDEX idx_commission_events_category ON public.commission_events(category);
CREATE INDEX idx_commission_events_status ON public.commission_events(status);
CREATE INDEX idx_commission_events_created ON public.commission_events(created_at DESC);

-- RLS Policies
-- Ambassadors can view their own commissions
CREATE POLICY "Ambassadors can view own commissions"
ON public.commission_events
FOR SELECT
USING (
  ambassador_id IN (
    SELECT id FROM public.ambassadors WHERE user_id = auth.uid()
  )
);

-- Recruiters can view commissions of ambassadors they recruited
CREATE POLICY "Recruiters can view recruited ambassador commissions"
ON public.commission_events
FOR SELECT
USING (
  ambassador_id IN (
    SELECT a.id FROM public.ambassadors a
    JOIN public.ambassadors recruiter ON a.recruited_by_ambassador_id = recruiter.id
    WHERE recruiter.user_id = auth.uid()
  )
);

-- Admins can view all commissions
CREATE POLICY "Admins can view all commissions"
ON public.commission_events
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Admins can insert/update commissions
CREATE POLICY "Admins can manage commissions"
ON public.commission_events
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
  )
);

-- Enable realtime for commission updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.commission_events;