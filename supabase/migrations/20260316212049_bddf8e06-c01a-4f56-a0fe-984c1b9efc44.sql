
-- Add call tracking fields to qualified leads
ALTER TABLE public.brandaro_qualified_leads 
ADD COLUMN IF NOT EXISTS call_attempts integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_called_at timestamptz,
ADD COLUMN IF NOT EXISTS assigned_va uuid,
ADD COLUMN IF NOT EXISTS campaign_id uuid;

-- Brandaro campaigns
CREATE TABLE public.brandaro_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  target_segment text,
  industry_filter text,
  city_filter text,
  state_filter text,
  status text NOT NULL DEFAULT 'draft',
  total_leads integer DEFAULT 0,
  contacted_leads integer DEFAULT 0,
  interested_leads integer DEFAULT 0,
  conversion_rate numeric DEFAULT 0,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view campaigns" ON public.brandaro_campaigns
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and owners can manage campaigns" ON public.brandaro_campaigns
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "VAs can update campaign stats" ON public.brandaro_campaigns
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(), 'va')
  ) WITH CHECK (
    public.has_role(auth.uid(), 'va')
  );

-- Brandaro call queue
CREATE TABLE public.brandaro_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.brandaro_campaigns(id),
  priority_score integer DEFAULT 50,
  priority_tier integer DEFAULT 2,
  assigned_va uuid,
  queue_position integer,
  next_call_time timestamptz DEFAULT now(),
  retry_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  locked_by uuid,
  locked_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(lead_id)
);

ALTER TABLE public.brandaro_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view queue" ON public.brandaro_call_queue
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "VAs can update their queue items" ON public.brandaro_call_queue
  FOR UPDATE TO authenticated USING (
    assigned_va = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "Admins can manage queue" ON public.brandaro_call_queue
  FOR ALL TO authenticated USING (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

-- Brandaro call logs (immutable)
CREATE TABLE public.brandaro_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.brandaro_campaigns(id),
  call_attempt_number integer NOT NULL DEFAULT 1,
  called_by_user_id uuid NOT NULL,
  call_timestamp timestamptz NOT NULL DEFAULT now(),
  call_outcome text NOT NULL,
  call_notes text,
  call_duration integer DEFAULT 0,
  next_action text,
  next_call_time timestamptz,
  phone_used text,
  industry_context text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view call logs" ON public.brandaro_call_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "VAs can insert call logs" ON public.brandaro_call_logs
  FOR INSERT TO authenticated WITH CHECK (called_by_user_id = auth.uid());

-- Brandaro callbacks
CREATE TABLE public.brandaro_callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  scheduled_time timestamptz NOT NULL,
  assigned_va uuid NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their callbacks" ON public.brandaro_callbacks
  FOR SELECT TO authenticated USING (
    assigned_va = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

CREATE POLICY "VAs can manage callbacks" ON public.brandaro_callbacks
  FOR ALL TO authenticated USING (
    assigned_va = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner')
  );

-- Add campaign FK to qualified leads
ALTER TABLE public.brandaro_qualified_leads 
ADD CONSTRAINT brandaro_qualified_leads_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.brandaro_campaigns(id);
