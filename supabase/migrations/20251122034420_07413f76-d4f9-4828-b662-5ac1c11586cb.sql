-- Fraud Detection Tables
CREATE TABLE public.fraud_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  route_stop_id UUID REFERENCES public.route_stops(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fraud flags"
  ON public.fraud_flags FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage fraud flags"
  ON public.fraud_flags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Influencers Table
CREATE TABLE public.influencers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  username TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'youtube')),
  followers INTEGER NOT NULL DEFAULT 0,
  engagement_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  city TEXT,
  niche TEXT,
  email TEXT,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'target' CHECK (status IN ('target', 'contacted', 'active', 'inactive')),
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view influencers"
  ON public.influencers FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage influencers"
  ON public.influencers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Daily Missions Tables
CREATE TABLE public.daily_missions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.daily_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view daily missions"
  ON public.daily_missions FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage daily missions"
  ON public.daily_missions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE TABLE public.mission_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id UUID REFERENCES public.daily_missions(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE CASCADE,
  influencer_id UUID REFERENCES public.influencers(id) ON DELETE CASCADE,
  hub_id UUID REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 5,
  reason TEXT,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.mission_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission items"
  ON public.mission_items FOR SELECT
  USING (true);

CREATE POLICY "Field workers can update mission items"
  ON public.mission_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() 
      AND profiles.role IN ('admin', 'driver', 'biker', 'csr')
    )
  );

CREATE POLICY "Admins can manage mission items"
  ON public.mission_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Triggers for updated_at
CREATE TRIGGER update_influencers_updated_at
  BEFORE UPDATE ON public.influencers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_missions_updated_at
  BEFORE UPDATE ON public.daily_missions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();