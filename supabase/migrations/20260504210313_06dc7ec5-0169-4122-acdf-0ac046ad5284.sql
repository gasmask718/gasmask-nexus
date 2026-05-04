
CREATE TABLE IF NOT EXISTS public.va_live_call_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_log_id uuid REFERENCES public.va_call_logs(id) ON DELETE CASCADE,
  va_id uuid NOT NULL,
  lead_id uuid,
  transcript_chunk text NOT NULL,
  cumulative_transcript text,
  sentiment text,
  buyer_intent text,
  coaching_tip text,
  next_best_action text,
  objection_detected text,
  raw_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_va_live_analysis_call ON public.va_live_call_analysis(call_log_id, created_at);
CREATE INDEX IF NOT EXISTS idx_va_live_analysis_va ON public.va_live_call_analysis(va_id, created_at DESC);

ALTER TABLE public.va_live_call_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "VAs read own live analysis" ON public.va_live_call_analysis
  FOR SELECT TO authenticated USING (va_id = auth.uid());

CREATE POLICY "Admins read all live analysis" ON public.va_live_call_analysis
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ANY (ARRAY['admin'::app_role, 'owner'::app_role]))
  );

CREATE POLICY "VAs insert own live analysis" ON public.va_live_call_analysis
  FOR INSERT TO authenticated WITH CHECK (va_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE public.va_live_call_analysis;
