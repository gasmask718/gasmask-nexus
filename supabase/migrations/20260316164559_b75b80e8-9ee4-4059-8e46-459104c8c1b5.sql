-- Track human agent phone line availability
CREATE TABLE public.human_agent_line_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number text NOT NULL,
  status text NOT NULL DEFAULT 'available',
  current_call_sid text,
  current_queue_item_id uuid,
  busy_since timestamptz,
  business_id uuid,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(phone_number)
);

ALTER TABLE public.human_agent_line_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read line status"
  ON public.human_agent_line_status FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage line status"
  ON public.human_agent_line_status FOR ALL TO service_role USING (true);

-- Queue for callers waiting for the human agent
CREATE TABLE public.human_agent_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid text NOT NULL,
  queue_item_id uuid,
  campaign_id uuid,
  phone_number text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.human_agent_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read call queue"
  ON public.human_agent_call_queue FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can manage call queue"
  ON public.human_agent_call_queue FOR ALL TO service_role USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.human_agent_line_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.human_agent_call_queue;