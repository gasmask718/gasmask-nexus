-- Create store_voice_notes table for V7: Voice Notes Pipeline
CREATE TABLE public.store_voice_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  transcript TEXT,
  created_by UUID,
  duration_seconds INTEGER,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'transcribing', 'transcribed', 'analyzed', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for efficient store-based lookups
CREATE INDEX idx_store_voice_notes_store_id ON public.store_voice_notes(store_id);
CREATE INDEX idx_store_voice_notes_status ON public.store_voice_notes(status);

-- Enable RLS
ALTER TABLE public.store_voice_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - allow authenticated users to manage voice notes
CREATE POLICY "Users can view voice notes" ON public.store_voice_notes
  FOR SELECT USING (true);

CREATE POLICY "Users can insert voice notes" ON public.store_voice_notes
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update voice notes" ON public.store_voice_notes
  FOR UPDATE USING (true);

CREATE POLICY "Users can delete voice notes" ON public.store_voice_notes
  FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_store_voice_notes_timestamp
  BEFORE UPDATE ON public.store_voice_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for voice notes (if not exists, we'll handle in code)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store-voice-notes', 'store-voice-notes', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for voice notes bucket
CREATE POLICY "Authenticated users can upload voice notes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'store-voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view voice notes" ON storage.objects
  FOR SELECT USING (bucket_id = 'store-voice-notes' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete voice notes" ON storage.objects
  FOR DELETE USING (bucket_id = 'store-voice-notes' AND auth.role() = 'authenticated');