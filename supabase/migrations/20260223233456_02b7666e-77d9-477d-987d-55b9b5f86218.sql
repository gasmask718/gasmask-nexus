
-- sms_test_logs table for validation suite
CREATE TABLE IF NOT EXISTS public.sms_test_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL,
  result text NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  executed_by uuid NULL
);

ALTER TABLE public.sms_test_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage test logs" ON public.sms_test_logs
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
  );

-- Add enable_test_mode to messaging_settings
ALTER TABLE public.messaging_settings
  ADD COLUMN IF NOT EXISTS enable_test_mode boolean DEFAULT false;
