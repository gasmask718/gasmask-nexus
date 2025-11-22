-- Phase 3 Module 1: Executive Report Scheduler Tables
CREATE TABLE IF NOT EXISTS public.report_schedule_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_enabled BOOLEAN DEFAULT false,
  weekly_enabled BOOLEAN DEFAULT false,
  monthly_enabled BOOLEAN DEFAULT false,
  daily_time TIME DEFAULT '07:00:00',
  weekly_day TEXT DEFAULT 'monday',
  weekly_time TIME DEFAULT '07:00:00',
  monthly_day INTEGER DEFAULT 1,
  monthly_time TIME DEFAULT '07:00:00',
  recipient_emails TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.executive_report_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES public.executive_reports(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  delivery_method TEXT NOT NULL,
  delivered_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'sent',
  recipient TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.report_schedule_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.executive_report_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for report_schedule_settings
CREATE POLICY "Admins can manage report schedules"
  ON public.report_schedule_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can view report schedules"
  ON public.report_schedule_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for executive_report_logs
CREATE POLICY "Admins can view report logs"
  ON public.executive_report_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "System can insert report logs"
  ON public.executive_report_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add missing fields to communication_templates for Phase 3 Module 4
ALTER TABLE public.communication_templates 
  ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_executive_report_logs_report_id ON public.executive_report_logs(report_id);
CREATE INDEX IF NOT EXISTS idx_executive_report_logs_delivered_at ON public.executive_report_logs(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_communication_templates_usage ON public.communication_templates(usage_count DESC);

-- Update timestamp trigger for report_schedule_settings
CREATE TRIGGER update_report_schedule_settings_updated_at
  BEFORE UPDATE ON public.report_schedule_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();