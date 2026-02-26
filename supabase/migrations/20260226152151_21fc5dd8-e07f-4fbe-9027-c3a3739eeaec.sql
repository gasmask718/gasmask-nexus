
-- Cold Call Campaigns table
CREATE TABLE public.cold_call_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  campaign_type TEXT NOT NULL DEFAULT 'tts_blast' CHECK (campaign_type IN ('tts_blast', 'normal_blast')),
  tts_script TEXT,
  voice_id TEXT,
  handoff_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
  total_numbers INTEGER NOT NULL DEFAULT 0,
  completed_count INTEGER NOT NULL DEFAULT 0,
  transferred_count INTEGER NOT NULL DEFAULT 0,
  from_number TEXT
);

-- Cold Call Items table
CREATE TABLE public.cold_call_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.cold_call_campaigns(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'dialing', 'answered', 'transferred', 'no_answer', 'failed', 'completed', 'opted_out')),
  call_sid TEXT,
  duration INTEGER,
  disposition TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable realtime for cold_call_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.cold_call_items;

-- RLS policies
ALTER TABLE public.cold_call_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cold_call_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own campaigns" ON public.cold_call_campaigns
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create campaigns" ON public.cold_call_campaigns
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own campaigns" ON public.cold_call_campaigns
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can view items of own campaigns" ON public.cold_call_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.cold_call_campaigns c WHERE c.id = campaign_id AND c.created_by = auth.uid())
  );

CREATE POLICY "Users can insert items to own campaigns" ON public.cold_call_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.cold_call_campaigns c WHERE c.id = campaign_id AND c.created_by = auth.uid())
  );

CREATE POLICY "Users can update items of own campaigns" ON public.cold_call_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.cold_call_campaigns c WHERE c.id = campaign_id AND c.created_by = auth.uid())
  );

-- Service role policy for edge functions to update items
CREATE POLICY "Service role full access campaigns" ON public.cold_call_campaigns
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access items" ON public.cold_call_items
  FOR ALL USING (true) WITH CHECK (true);

-- Storage bucket for TTS audio
INSERT INTO storage.buckets (id, name, public) VALUES ('cold-call-audio', 'cold-call-audio', true);

-- Storage policy: authenticated users can upload
CREATE POLICY "Authenticated users can upload cold call audio" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'cold-call-audio' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read cold call audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'cold-call-audio');

-- Index for fast lookups
CREATE INDEX idx_cold_call_items_campaign_id ON public.cold_call_items(campaign_id);
CREATE INDEX idx_cold_call_items_status ON public.cold_call_items(status);
