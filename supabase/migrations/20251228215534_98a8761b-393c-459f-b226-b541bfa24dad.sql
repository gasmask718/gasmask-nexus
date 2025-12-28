-- Create user_state_profile table
CREATE TABLE public.user_state_profile (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_state TEXT NOT NULL CHECK (user_state IN ('NY', 'GA', 'CA')),
  last_state_update TIMESTAMPTZ NOT NULL DEFAULT now(),
  state_source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create state_rules table
CREATE TABLE public.state_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code TEXT NOT NULL UNIQUE,
  enabled_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  disabled_formats JSONB NOT NULL DEFAULT '[]'::jsonb,
  tooltip_text TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create platforms table
CREATE TABLE public.platforms (
  platform_key TEXT PRIMARY KEY,
  platform_name TEXT NOT NULL,
  platform_type TEXT NOT NULL CHECK (platform_type IN ('sportsbook', 'fantasy_pickem')),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create bankrolls table
CREATE TABLE public.bankrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  global_bankroll NUMERIC NOT NULL DEFAULT 0,
  state_bankrolls JSONB NOT NULL DEFAULT '{"NY": 0, "GA": 0, "CA": 0}'::jsonb,
  max_pct_per_entry NUMERIC NOT NULL DEFAULT 0.02,
  max_pct_per_state_per_day NUMERIC NOT NULL DEFAULT 0.05,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Create pick_entries table
CREATE TABLE public.pick_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('NY', 'GA', 'CA')),
  platform TEXT NOT NULL REFERENCES public.platforms(platform_key),
  sport TEXT NOT NULL,
  format_tag TEXT NOT NULL CHECK (format_tag IN ('sportsbook_prop', 'same_game_parlay', 'fantasy_pickem', 'live_bet')),
  player TEXT,
  team TEXT,
  opponent TEXT,
  market TEXT NOT NULL,
  line_value NUMERIC,
  side TEXT CHECK (side IN ('over', 'under', 'home', 'away', NULL)),
  stake NUMERIC NOT NULL,
  odds NUMERIC,
  multiplier NUMERIC,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
  result TEXT CHECK (result IN ('W', 'L', 'Push', NULL)),
  profit_loss NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin_audit_log table
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  before JSONB,
  after JSONB,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_state_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bankrolls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pick_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS for user_state_profile: users can read/write own
CREATE POLICY "Users can view own state profile"
  ON public.user_state_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own state profile"
  ON public.user_state_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own state profile"
  ON public.user_state_profile FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS for state_rules: readable by all authenticated
CREATE POLICY "Authenticated users can view state rules"
  ON public.state_rules FOR SELECT
  TO authenticated
  USING (true);

-- RLS for platforms: readable by all authenticated
CREATE POLICY "Authenticated users can view platforms"
  ON public.platforms FOR SELECT
  TO authenticated
  USING (true);

-- RLS for bankrolls: users can read/write own
CREATE POLICY "Users can view own bankroll"
  ON public.bankrolls FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bankroll"
  ON public.bankrolls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bankroll"
  ON public.bankrolls FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS for pick_entries: users can read/write own
CREATE POLICY "Users can view own pick entries"
  ON public.pick_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pick entries"
  ON public.pick_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pick entries"
  ON public.pick_entries FOR UPDATE
  USING (auth.uid() = user_id AND (status != 'settled' OR locked_at IS NULL));

-- RLS for admin_audit_log: admin only read, insert allowed for logging
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role IN ('admin', 'owner')
  ));

CREATE POLICY "Authenticated users can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_user_id);

-- Seed platforms
INSERT INTO public.platforms (platform_key, platform_name, platform_type) VALUES
  ('draftkings', 'DraftKings', 'sportsbook'),
  ('fanduel', 'FanDuel', 'sportsbook'),
  ('betmgm', 'BetMGM', 'sportsbook'),
  ('caesars', 'Caesars', 'sportsbook'),
  ('underdog', 'Underdog Fantasy', 'fantasy_pickem'),
  ('prizepicks', 'PrizePicks', 'fantasy_pickem'),
  ('betr', 'Betr', 'fantasy_pickem');

-- Seed state_rules
INSERT INTO public.state_rules (state_code, enabled_platforms, enabled_formats, disabled_platforms, disabled_formats, tooltip_text) VALUES
  ('NY', 
   '["draftkings","fanduel","betmgm","caesars","underdog"]'::jsonb,
   '["sportsbook_prop","same_game_parlay","fantasy_pickem","live_bet"]'::jsonb,
   '["prizepicks","betr"]'::jsonb,
   '[]'::jsonb,
   'Availability varies by state. Your current state permits sportsbooks + select fantasy pick''em.'),
  ('GA',
   '["prizepicks","underdog","betr"]'::jsonb,
   '["fantasy_pickem"]'::jsonb,
   '["draftkings","fanduel","betmgm","caesars"]'::jsonb,
   '["sportsbook_prop","same_game_parlay","live_bet"]'::jsonb,
   'In your state, fantasy pick''em platforms are available; sportsbooks are not enabled.'),
  ('CA',
   '["prizepicks","underdog","betr"]'::jsonb,
   '["fantasy_pickem"]'::jsonb,
   '["draftkings","fanduel","betmgm","caesars"]'::jsonb,
   '["sportsbook_prop","same_game_parlay","live_bet"]'::jsonb,
   'In your state, fantasy pick''em platforms are available; sportsbooks are not enabled.');

-- Create trigger to lock pick_entries after settlement
CREATE OR REPLACE FUNCTION public.lock_settled_pick_entries()
RETURNS TRIGGER AS $$
BEGIN
  -- If row is already settled, prevent most changes
  IF OLD.status = 'settled' AND OLD.locked_at IS NOT NULL THEN
    -- Only allow notes to be updated
    IF NEW.platform != OLD.platform OR
       NEW.state != OLD.state OR
       NEW.format_tag != OLD.format_tag OR
       NEW.market != OLD.market OR
       NEW.line_value IS DISTINCT FROM OLD.line_value OR
       NEW.stake != OLD.stake OR
       NEW.odds IS DISTINCT FROM OLD.odds OR
       NEW.result IS DISTINCT FROM OLD.result OR
       NEW.profit_loss != OLD.profit_loss THEN
      RAISE EXCEPTION 'Cannot modify locked settled entries. Use admin override.';
    END IF;
  END IF;
  
  -- Lock when status changes to settled
  IF NEW.status = 'settled' AND OLD.status != 'settled' THEN
    NEW.locked_at := now();
  END IF;
  
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER pick_entries_lock_trigger
  BEFORE UPDATE ON public.pick_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.lock_settled_pick_entries();

-- Update timestamp triggers
CREATE TRIGGER update_user_state_profile_updated_at
  BEFORE UPDATE ON public.user_state_profile
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_state_rules_updated_at
  BEFORE UPDATE ON public.state_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bankrolls_updated_at
  BEFORE UPDATE ON public.bankrolls
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_pick_entries_user_date ON public.pick_entries(user_id, date);
CREATE INDEX idx_pick_entries_state ON public.pick_entries(state);
CREATE INDEX idx_pick_entries_status ON public.pick_entries(status);
CREATE INDEX idx_admin_audit_log_actor ON public.admin_audit_log(actor_user_id);
CREATE INDEX idx_admin_audit_log_target ON public.admin_audit_log(target_type, target_id);