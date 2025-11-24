-- Create campaigns table
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'call')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'failed', 'paused')),
  message_template TEXT,
  subject TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  settings JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create campaign_recipients table
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  contact_id UUID,
  contact_name TEXT,
  contact_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'opened', 'clicked', 'replied')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create campaign_messages table
CREATE TABLE public.campaign_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.campaign_recipients(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create campaign_stats table
CREATE TABLE public.campaign_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT now(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for campaigns
CREATE POLICY "Users can view campaigns for their business"
  ON public.campaigns FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins and managers can create campaigns"
  ON public.campaigns FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT bm.business_id FROM public.business_members bm
      WHERE bm.user_id = auth.uid() AND bm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins and managers can update campaigns"
  ON public.campaigns FOR UPDATE
  USING (
    business_id IN (
      SELECT bm.business_id FROM public.business_members bm
      WHERE bm.user_id = auth.uid() AND bm.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Admins can delete campaigns"
  ON public.campaigns FOR DELETE
  USING (
    business_id IN (
      SELECT bm.business_id FROM public.business_members bm
      WHERE bm.user_id = auth.uid() AND bm.role = 'admin'
    )
  );

-- RLS Policies for campaign_recipients
CREATE POLICY "Users can view recipients for their business campaigns"
  ON public.campaign_recipients FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE business_id IN (
        SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert recipients"
  ON public.campaign_recipients FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update recipients"
  ON public.campaign_recipients FOR UPDATE
  USING (true);

-- RLS Policies for campaign_messages
CREATE POLICY "Users can view messages for their business campaigns"
  ON public.campaign_messages FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE business_id IN (
        SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert messages"
  ON public.campaign_messages FOR INSERT
  WITH CHECK (true);

-- RLS Policies for campaign_stats
CREATE POLICY "Users can view stats for their business campaigns"
  ON public.campaign_stats FOR SELECT
  USING (
    campaign_id IN (
      SELECT id FROM public.campaigns WHERE business_id IN (
        SELECT business_id FROM public.business_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert stats"
  ON public.campaign_stats FOR INSERT
  WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX idx_campaigns_business_id ON public.campaigns(business_id);
CREATE INDEX idx_campaigns_status ON public.campaigns(status);
CREATE INDEX idx_campaigns_channel ON public.campaigns(channel);
CREATE INDEX idx_campaign_recipients_campaign_id ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(status);
CREATE INDEX idx_campaign_messages_campaign_id ON public.campaign_messages(campaign_id);
CREATE INDEX idx_campaign_stats_campaign_id ON public.campaign_stats(campaign_id);

-- Trigger to update updated_at
CREATE TRIGGER update_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();