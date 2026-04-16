-- Dynasty Phone Numbers for Caller ID matching
CREATE TABLE public.dynasty_phone_numbers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number text UNIQUE NOT NULL,
  friendly_name text,
  state text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_dynasty_phone_numbers_state ON public.dynasty_phone_numbers(state) WHERE is_active = true;

ALTER TABLE public.dynasty_phone_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_dynasty_phone_numbers" ON public.dynasty_phone_numbers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_dynasty_phone_numbers" ON public.dynasty_phone_numbers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_dynasty_phone_numbers" ON public.dynasty_phone_numbers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_dynasty_phone_numbers" ON public.dynasty_phone_numbers FOR DELETE TO authenticated USING (true);

-- Dynasty Call Queue for outbound campaigns
CREATE TABLE public.dynasty_call_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_type text NOT NULL,
  contact_name text,
  business_name text,
  phone_number text NOT NULL,
  state text,
  status text DEFAULT 'pending',
  bland_call_id text,
  created_at timestamptz DEFAULT now(),
  called_at timestamptz,
  completed_at timestamptz
);

CREATE INDEX idx_dynasty_call_queue_status ON public.dynasty_call_queue(status);
CREATE INDEX idx_dynasty_call_queue_business ON public.dynasty_call_queue(business_type);

ALTER TABLE public.dynasty_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_dynasty_call_queue" ON public.dynasty_call_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_dynasty_call_queue" ON public.dynasty_call_queue FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth_update_dynasty_call_queue" ON public.dynasty_call_queue FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth_delete_dynasty_call_queue" ON public.dynasty_call_queue FOR DELETE TO authenticated USING (true);

-- Enable realtime for new tables only
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_phone_numbers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dynasty_call_queue;