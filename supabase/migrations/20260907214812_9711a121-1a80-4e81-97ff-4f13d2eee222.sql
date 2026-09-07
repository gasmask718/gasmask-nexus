
CREATE TABLE public.crew_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text,
  state text,
  target_drops integer NOT NULL DEFAULT 0,
  boundary jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_zones TO authenticated;
GRANT ALL ON public.crew_zones TO service_role;
ALTER TABLE public.crew_zones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_zones_select_authenticated" ON public.crew_zones FOR SELECT TO authenticated USING (true);
CREATE POLICY "crew_zones_admin_insert" ON public.crew_zones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_zones_admin_update" ON public.crew_zones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_zones_admin_delete" ON public.crew_zones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.crew_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  phone text,
  zone_id uuid REFERENCES public.crew_zones(id) ON DELETE SET NULL,
  rate_per_drop numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','inactive')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crew_profiles_user ON public.crew_profiles(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_profiles TO authenticated;
GRANT ALL ON public.crew_profiles TO service_role;
ALTER TABLE public.crew_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_profiles_select_own_or_admin" ON public.crew_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_profiles_admin_insert" ON public.crew_profiles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_profiles_admin_update" ON public.crew_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_profiles_admin_delete" ON public.crew_profiles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.crew_drops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL,
  drop_type text NOT NULL CHECK (drop_type IN ('sticker','tube_drop','store_visit')),
  store_id uuid,
  store_name text,
  photo_path text,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy_m numeric,
  notes text,
  zone_id uuid REFERENCES public.crew_zones(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','rejected')),
  verified_by uuid,
  verified_at timestamptz,
  earnings numeric NOT NULL DEFAULT 0,
  server_timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_crew_drops_crew_time ON public.crew_drops(crew_id, server_timestamp DESC);
CREATE INDEX idx_crew_drops_zone ON public.crew_drops(zone_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crew_drops TO authenticated;
GRANT ALL ON public.crew_drops TO service_role;
ALTER TABLE public.crew_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crew_drops_insert_own" ON public.crew_drops FOR INSERT TO authenticated
  WITH CHECK (crew_id = auth.uid() AND public.has_role(auth.uid(),'verification_crew'));
CREATE POLICY "crew_drops_select_own_or_admin" ON public.crew_drops FOR SELECT TO authenticated
  USING (crew_id = auth.uid() OR public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_drops_admin_update" ON public.crew_drops FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'))
  WITH CHECK (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'staff'));
CREATE POLICY "crew_drops_admin_delete" ON public.crew_drops FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin'));

-- server_timestamp is always server-set, never client-supplied
CREATE OR REPLACE FUNCTION public.crew_drops_force_server_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.server_timestamp := now();
    NEW.created_at := now();
  ELSE
    NEW.server_timestamp := OLD.server_timestamp;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crew_drops_server_timestamp
  BEFORE INSERT OR UPDATE ON public.crew_drops
  FOR EACH ROW EXECUTE FUNCTION public.crew_drops_force_server_timestamp();

CREATE TRIGGER trg_crew_profiles_updated_at BEFORE UPDATE ON public.crew_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crew_zones_updated_at BEFORE UPDATE ON public.crew_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
