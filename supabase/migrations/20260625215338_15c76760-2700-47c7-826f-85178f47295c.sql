
CREATE TABLE public.ut_shipping_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier text NOT NULL,
  service_level text NOT NULL DEFAULT 'standard',
  per_kg_rate numeric(10,4) NOT NULL DEFAULT 0,
  base_fee numeric(10,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (carrier, service_level)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_shipping_rates TO authenticated;
GRANT ALL ON public.ut_shipping_rates TO service_role;
ALTER TABLE public.ut_shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read shipping rates" ON public.ut_shipping_rates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage shipping rates" ON public.ut_shipping_rates FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.ut_kit_weights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kit_sku text NOT NULL UNIQUE,
  kit_name text NOT NULL,
  weight_kg numeric(10,3) NOT NULL DEFAULT 0,
  dimensions text,
  notes text,
  confirmed_by_supplier boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ut_kit_weights TO authenticated;
GRANT ALL ON public.ut_kit_weights TO service_role;
ALTER TABLE public.ut_kit_weights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read kit weights" ON public.ut_kit_weights FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage kit weights" ON public.ut_kit_weights FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.ut_touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ut_shipping_rates_updated BEFORE UPDATE ON public.ut_shipping_rates
  FOR EACH ROW EXECUTE FUNCTION public.ut_touch_updated_at();
CREATE TRIGGER trg_ut_kit_weights_updated BEFORE UPDATE ON public.ut_kit_weights
  FOR EACH ROW EXECUTE FUNCTION public.ut_touch_updated_at();

INSERT INTO public.ut_shipping_rates (carrier, service_level, per_kg_rate, base_fee) VALUES
  ('USPS','ground',2.50,4.00),
  ('UPS','ground',3.10,5.50),
  ('FedEx','ground',3.40,6.00)
ON CONFLICT DO NOTHING;

INSERT INTO public.ut_kit_weights (kit_sku, kit_name, weight_kg) VALUES
  ('KIT-STARTER','Start a Business — Starter Kit',1.200),
  ('KIT-PRO','Start a Business — Pro Kit',2.400),
  ('KIT-ELITE','Start a Business — Elite Kit',3.600)
ON CONFLICT DO NOTHING;
