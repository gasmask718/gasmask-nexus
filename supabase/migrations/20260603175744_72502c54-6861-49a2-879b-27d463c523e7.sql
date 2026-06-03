
CREATE TABLE public.dc_businesses (
  business_key text PRIMARY KEY,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Building2',
  color text NOT NULL DEFAULT 'bg-slate-500',
  is_live boolean NOT NULL DEFAULT false,
  is_internal boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 100,
  agents_label text,
  phone_default text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.dc_businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dc_businesses TO authenticated;
GRANT ALL ON public.dc_businesses TO service_role;

ALTER TABLE public.dc_businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read dc_businesses"
  ON public.dc_businesses FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage dc_businesses"
  ON public.dc_businesses FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.dc_businesses_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER dc_businesses_updated_at
  BEFORE UPDATE ON public.dc_businesses
  FOR EACH ROW EXECUTE FUNCTION public.dc_businesses_touch_updated_at();

INSERT INTO public.dc_businesses (business_key, name, icon, color, is_live, is_internal, sort_order, agents_label, phone_default) VALUES
  ('gasmask',             'GasMask / Hot Mama',    'Building2', 'bg-green-500',  true,  false, 10, 'Sales, Follow-up, Reactivation', '+18484004179'),
  ('unforgettable_times', 'Unforgettable Times',   'Sparkles',  'bg-purple-500', false, false, 20, 'Partner Outreach, Event Concierge, Ambassador Help Line', null),
  ('real_estate',         'Real Estate',           'Building2', 'bg-blue-500',   false, false, 30, 'Lead Qualifier, Wholesale Specialist, Closer', null),
  ('surplus_funds',       'Surplus Funds',         'Shield',    'bg-amber-500',  false, false, 40, 'Client Outreach, Attorney Acquisition', null),
  ('top_tier',            'Top Tier Experience',   'Sparkles',  'bg-rose-500',   false, false, 50, 'Luxury Concierge, Ambassador Help Line', null),
  ('brandaro',            'Brandaro Digital',      'Zap',       'bg-indigo-500', false, false, 60, 'Sales Expert, Closer, Relationship, Spanish Closer, Spanish Rel.', null),
  ('iclean',              'iClean WeClean',        'Wrench',    'bg-cyan-500',   false, false, 70, 'Booking Agent', null),
  ('playboxxx',           'PlayBoxxx',             'Music',     'bg-pink-500',   false, true,  80, 'Manager, Affiliate, Production', null);
