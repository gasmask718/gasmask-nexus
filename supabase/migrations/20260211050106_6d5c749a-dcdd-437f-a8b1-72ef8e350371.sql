
-- STORE × BRAND RELATIONSHIP INTELLIGENCE

CREATE TYPE public.payment_type_enum AS ENUM ('pay_upfront','bill_to_bill','net7','net14','cod');
CREATE TYPE public.sampling_status_enum AS ENUM ('none','samples_given','trialing','converted');
CREATE TYPE public.relationship_health_enum AS ENUM ('healthy','at_risk','paused','terminated');

CREATE TABLE public.store_brand_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  brand_id text NOT NULL CHECK (brand_id IN ('gasmask','grabba_r_us','hotmama','hotscolatti')),
  is_active boolean NOT NULL DEFAULT false,
  payment_type public.payment_type_enum NOT NULL DEFAULT 'pay_upfront',
  needs_starter_kit boolean NOT NULL DEFAULT false,
  starter_kit_sent boolean NOT NULL DEFAULT false,
  starter_kit_date timestamptz NULL,
  sampling_status public.sampling_status_enum NOT NULL DEFAULT 'none',
  relationship_health public.relationship_health_enum NOT NULL DEFAULT 'healthy',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, brand_id)
);

CREATE OR REPLACE FUNCTION public.update_store_brand_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_store_brand_relationships_updated_at
BEFORE UPDATE ON public.store_brand_relationships
FOR EACH ROW EXECUTE FUNCTION public.update_store_brand_relationships_updated_at();

CREATE OR REPLACE FUNCTION public.ensure_store_brand_relationships(p_store_id uuid)
RETURNS void AS $$
DECLARE brand text;
BEGIN
  FOREACH brand IN ARRAY ARRAY['gasmask','grabba_r_us','hotmama','hotscolatti']
  LOOP
    INSERT INTO public.store_brand_relationships (store_id, brand_id)
    VALUES (p_store_id, brand)
    ON CONFLICT (store_id, brand_id) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.auto_seed_brand_relationships()
RETURNS TRIGGER AS $$
BEGIN PERFORM public.ensure_store_brand_relationships(NEW.id); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_store_master_seed_brands
AFTER INSERT ON public.store_master
FOR EACH ROW EXECUTE FUNCTION public.auto_seed_brand_relationships();

ALTER TABLE public.store_brand_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access on store_brand_relationships"
ON public.store_brand_relationships FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read store_brand_relationships"
ON public.store_brand_relationships FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Field roles update store_brand_relationships"
ON public.store_brand_relationships FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_store_map usm WHERE usm.user_id = auth.uid() AND usm.store_id = store_brand_relationships.store_id)
  OR EXISTS (SELECT 1 FROM public.driver_assignments da WHERE da.driver_id = auth.uid() AND da.store_id = store_brand_relationships.store_id)
  OR EXISTS (SELECT 1 FROM public.biker_assignments ba WHERE ba.biker_id = auth.uid() AND ba.store_id = store_brand_relationships.store_id)
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_store_map usm WHERE usm.user_id = auth.uid() AND usm.store_id = store_brand_relationships.store_id)
  OR EXISTS (SELECT 1 FROM public.driver_assignments da WHERE da.driver_id = auth.uid() AND da.store_id = store_brand_relationships.store_id)
  OR EXISTS (SELECT 1 FROM public.biker_assignments ba WHERE ba.biker_id = auth.uid() AND ba.store_id = store_brand_relationships.store_id)
);
