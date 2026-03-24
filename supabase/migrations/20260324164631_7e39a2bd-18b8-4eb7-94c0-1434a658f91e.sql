CREATE TABLE public.playbook_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL,
  agent_name text,
  update_content text NOT NULL,
  top_insight text,
  calls_analyzed integer DEFAULT 0,
  wins_analyzed integer DEFAULT 0,
  losses_analyzed integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.playbook_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read playbook_history"
  ON public.playbook_history FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert playbook_history"
  ON public.playbook_history FOR INSERT TO service_role WITH CHECK (true);