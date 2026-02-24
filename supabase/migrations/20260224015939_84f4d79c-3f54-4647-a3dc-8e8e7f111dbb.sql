
-- Phase B Schema: dialer_campaigns table, agent wrap-up fields, campaign_id on queue

-- 1. Create dialer_campaigns table
CREATE TABLE public.dialer_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
  total_targets integer DEFAULT 0,
  completed_calls integer DEFAULT 0,
  answered_calls integer DEFAULT 0,
  voicemail_count integer DEFAULT 0,
  failed_calls integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dialer_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dialer_campaigns_admin_select" ON public.dialer_campaigns
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va'));

CREATE POLICY "dialer_campaigns_admin_insert" ON public.dialer_campaigns
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va'));

CREATE POLICY "dialer_campaigns_admin_update" ON public.dialer_campaigns
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'va'));

-- 2. Add campaign_id and assigned_agent_id to outbound_call_queue
ALTER TABLE public.outbound_call_queue
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.dialer_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_agent_id uuid;

-- 3. Add wrap_up fields to dialer_agent_availability
ALTER TABLE public.dialer_agent_availability
  ADD COLUMN IF NOT EXISTS wrap_up_seconds integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS last_call_ended_at timestamptz;

-- 4. Enable realtime for live panel auto-sync
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_call_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.outbound_call_queue;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dialer_agent_availability;
