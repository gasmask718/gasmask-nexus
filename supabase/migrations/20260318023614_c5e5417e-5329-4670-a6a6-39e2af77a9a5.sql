CREATE TABLE IF NOT EXISTS public.brandaro_auto_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.brandaro_qualified_leads(id) ON DELETE CASCADE,
  action_type text NOT NULL, -- 'ai_call', 'sms', 'follow_up_sms'
  status text NOT NULL DEFAULT 'triggered', -- 'triggered', 'success', 'failed', 'skipped'
  attempt_number integer DEFAULT 1,
  trigger_source text DEFAULT 'webhook', -- 'webhook', 'cron', 'manual'
  error_message text,
  provider_sid text,
  created_at timestamptz DEFAULT now(),
  scheduled_for timestamptz,
  executed_at timestamptz
);

ALTER TABLE public.brandaro_auto_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_brandaro_auto_actions_lead ON public.brandaro_auto_actions(lead_id);
CREATE INDEX idx_brandaro_auto_actions_created ON public.brandaro_auto_actions(created_at DESC);