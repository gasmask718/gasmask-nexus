
-- Security Agents
CREATE TABLE public.security_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  profile_image TEXT,
  bio TEXT,
  years_experience INTEGER DEFAULT 0,
  specialties TEXT[] DEFAULT '{}',
  armed BOOLEAN DEFAULT false,
  hourly_rate NUMERIC(10,2) DEFAULT 0,
  verified BOOLEAN DEFAULT false,
  independent_contractor BOOLEAN DEFAULT true,
  city TEXT,
  state TEXT,
  availability JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view agents" ON public.security_agents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agents can update own profile" ON public.security_agents FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Agents can insert own profile" ON public.security_agents FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admin full access agents" ON public.security_agents FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_security_agents_city ON public.security_agents(city);
CREATE INDEX idx_security_agents_active ON public.security_agents(is_active);

-- Security Certifications
CREATE TABLE public.security_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.security_agents(id) ON DELETE CASCADE,
  license_type TEXT NOT NULL,
  license_number TEXT,
  expiration_date DATE,
  insurance_status TEXT DEFAULT 'pending',
  document_url TEXT,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view certs" ON public.security_certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agent can manage own certs" ON public.security_certifications FOR ALL TO authenticated USING (
  agent_id IN (SELECT id FROM public.security_agents WHERE user_id = auth.uid())
);
CREATE POLICY "Admin full access certs" ON public.security_certifications FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Security Media
CREATE TABLE public.security_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.security_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'image',
  url TEXT NOT NULL,
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view media" ON public.security_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Agent can manage own media" ON public.security_media FOR ALL TO authenticated USING (
  agent_id IN (SELECT id FROM public.security_agents WHERE user_id = auth.uid())
);
CREATE POLICY "Admin full access media" ON public.security_media FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Security Bookings
CREATE TABLE public.security_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  agent_id UUID REFERENCES public.security_agents(id),
  service_type TEXT NOT NULL,
  hours NUMERIC(6,2) DEFAULT 1,
  number_of_agents INTEGER DEFAULT 1,
  location TEXT,
  event_date DATE,
  event_time TIME,
  total_price NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.security_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings" ON public.security_bookings FOR SELECT TO authenticated USING (
  auth.uid() = user_id OR agent_id IN (SELECT id FROM public.security_agents WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create bookings" ON public.security_bookings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Agents can update assigned bookings" ON public.security_bookings FOR UPDATE TO authenticated USING (
  agent_id IN (SELECT id FROM public.security_agents WHERE user_id = auth.uid())
);
CREATE POLICY "Admin full access bookings" ON public.security_bookings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE INDEX idx_security_bookings_agent ON public.security_bookings(agent_id);
CREATE INDEX idx_security_bookings_status ON public.security_bookings(status);

-- Enable realtime for bookings
ALTER PUBLICATION supabase_realtime ADD TABLE public.security_bookings;
