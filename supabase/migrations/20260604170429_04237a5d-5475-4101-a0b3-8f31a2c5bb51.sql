
CREATE TABLE IF NOT EXISTS public.owner_ai_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prompt text NOT NULL,
  response text,
  scope text NOT NULL DEFAULT 'owner',
  mode text NOT NULL DEFAULT 'text' CHECK (mode IN ('voice','text')),
  cost_cents integer,
  confidence integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_owner_ai_commands_user_created ON public.owner_ai_commands (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_owner_ai_commands_mode ON public.owner_ai_commands (mode);

GRANT SELECT, INSERT ON public.owner_ai_commands TO authenticated;
GRANT ALL ON public.owner_ai_commands TO service_role;

ALTER TABLE public.owner_ai_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_ai_commands_own_read"
  ON public.owner_ai_commands FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "owner_ai_commands_own_insert"
  ON public.owner_ai_commands FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);
