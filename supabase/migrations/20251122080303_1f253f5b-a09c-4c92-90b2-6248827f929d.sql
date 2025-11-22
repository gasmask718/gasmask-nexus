-- Create driver_xp table
CREATE TABLE public.driver_xp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_amount INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('visit', 'delivery', 'bonus', 'route_completed', 'mission', 'audit', 'on_time')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver_rewards table
CREATE TABLE public.driver_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
  calculated_tier TEXT NOT NULL DEFAULT 'bronze' CHECK (calculated_tier IN ('bronze', 'silver', 'gold', 'diamond')),
  total_xp INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create driver_payouts table
CREATE TABLE public.driver_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  date DATE NOT NULL,
  calculated_breakdown JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.driver_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_payouts ENABLE ROW LEVEL SECURITY;

-- RLS policies for driver_xp
CREATE POLICY "Drivers can view their own XP"
  ON public.driver_xp FOR SELECT
  USING (auth.uid() = driver_id OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "System can insert XP"
  ON public.driver_xp FOR INSERT
  WITH CHECK (true);

-- RLS policies for driver_rewards
CREATE POLICY "Drivers can view their own rewards"
  ON public.driver_rewards FOR SELECT
  USING (auth.uid() = driver_id OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Anyone can view all rewards for leaderboard"
  ON public.driver_rewards FOR SELECT
  USING (true);

CREATE POLICY "System can manage rewards"
  ON public.driver_rewards FOR ALL
  USING (true);

-- RLS policies for driver_payouts
CREATE POLICY "Drivers can view their own payouts"
  ON public.driver_payouts FOR SELECT
  USING (auth.uid() = driver_id OR EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

CREATE POLICY "Admins can manage payouts"
  ON public.driver_payouts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  ));

-- Create indexes
CREATE INDEX idx_driver_xp_driver_id ON public.driver_xp(driver_id);
CREATE INDEX idx_driver_xp_created_at ON public.driver_xp(created_at DESC);
CREATE INDEX idx_driver_rewards_driver_id ON public.driver_rewards(driver_id);
CREATE INDEX idx_driver_payouts_driver_id ON public.driver_payouts(driver_id);
CREATE INDEX idx_driver_payouts_date ON public.driver_payouts(date DESC);