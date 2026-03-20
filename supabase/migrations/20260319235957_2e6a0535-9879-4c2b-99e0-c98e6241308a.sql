INSERT INTO storage.buckets (id, name, public) VALUES ('call-audio', 'call-audio', true) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Public read call audio" ON storage.objects FOR SELECT USING (bucket_id = 'call-audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role write call audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'call-audio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.brandaro_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES brandaro_qualified_leads(id) ON DELETE CASCADE,
  call_type text NOT NULL DEFAULT 'manual',
  call_outcome text,
  call_notes text,
  twilio_call_sid text,
  audio_url text,
  duration_seconds integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.brandaro_call_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can read call logs" ON public.brandaro_call_logs FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert call logs" ON public.brandaro_call_logs FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'brandaro_qualified_leads' AND column_name = 'ai_paused') THEN
    ALTER TABLE brandaro_qualified_leads ADD COLUMN ai_paused boolean DEFAULT false;
  END IF;
END $$