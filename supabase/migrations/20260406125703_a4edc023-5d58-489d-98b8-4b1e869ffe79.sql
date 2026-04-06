
-- Upsell rules
CREATE TABLE IF NOT EXISTS public.upsell_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  trigger_service_id UUID NOT NULL REFERENCES public.provider_service_menu(id) ON DELETE CASCADE,
  upsell_service_id UUID NOT NULL REFERENCES public.provider_service_menu(id) ON DELETE CASCADE,
  upsell_type TEXT NOT NULL CHECK (upsell_type IN ('upgrade','bundle','add_on')),
  display_priority INTEGER NOT NULL DEFAULT 0,
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_accepted INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active upsell rules" ON public.upsell_rules FOR SELECT USING (true);
CREATE POLICY "Providers manage own upsell rules" ON public.upsell_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()));

CREATE INDEX idx_upsell_rules_trigger ON public.upsell_rules(trigger_service_id, is_active);
CREATE INDEX idx_upsell_rules_provider ON public.upsell_rules(provider_id);

-- Upsell bundles
CREATE TABLE IF NOT EXISTS public.upsell_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id) ON DELETE CASCADE,
  bundle_name TEXT NOT NULL,
  included_services UUID[] DEFAULT '{}',
  bundle_price NUMERIC(10,2) NOT NULL,
  original_price NUMERIC(10,2) NOT NULL,
  savings_display TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundles" ON public.upsell_bundles FOR SELECT USING (true);
CREATE POLICY "Providers manage own bundles" ON public.upsell_bundles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()));

CREATE INDEX idx_upsell_bundles_provider ON public.upsell_bundles(provider_id);

-- Cart tracking
CREATE TABLE IF NOT EXISTS public.cart_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider_id UUID REFERENCES public.beauty_providers(id),
  selected_services JSONB NOT NULL DEFAULT '[]',
  total_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  upsell_interactions JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','converted','abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own carts" ON public.cart_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own carts" ON public.cart_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own carts" ON public.cart_tracking FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_cart_tracking_user ON public.cart_tracking(user_id, status);

-- Upsell conversion log
CREATE TABLE IF NOT EXISTS public.upsell_conversion_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  upsell_rule_id UUID REFERENCES public.upsell_rules(id) ON DELETE SET NULL,
  bundle_id UUID REFERENCES public.upsell_bundles(id) ON DELETE SET NULL,
  cart_id UUID REFERENCES public.cart_tracking(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  provider_id UUID NOT NULL REFERENCES public.beauty_providers(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('shown','accepted','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.upsell_conversion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Providers view own conversion logs" ON public.upsell_conversion_log FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.beauty_providers bp WHERE bp.id = provider_id AND bp.user_id = auth.uid()));
CREATE POLICY "Authenticated users log events" ON public.upsell_conversion_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_upsell_log_rule ON public.upsell_conversion_log(upsell_rule_id, event_type);
CREATE INDEX idx_upsell_log_provider ON public.upsell_conversion_log(provider_id, created_at);

-- Function to auto-update conversion rates
CREATE OR REPLACE FUNCTION public.update_upsell_conversion_rate()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.upsell_rule_id IS NOT NULL THEN
    UPDATE public.upsell_rules
    SET
      times_shown = times_shown + CASE WHEN NEW.event_type = 'shown' THEN 1 ELSE 0 END,
      times_accepted = times_accepted + CASE WHEN NEW.event_type = 'accepted' THEN 1 ELSE 0 END,
      conversion_rate = CASE
        WHEN (times_shown + CASE WHEN NEW.event_type = 'shown' THEN 1 ELSE 0 END) > 0
        THEN (times_accepted + CASE WHEN NEW.event_type = 'accepted' THEN 1 ELSE 0 END)::NUMERIC
             / (times_shown + CASE WHEN NEW.event_type = 'shown' THEN 1 ELSE 0 END)
        ELSE 0
      END,
      updated_at = now()
    WHERE id = NEW.upsell_rule_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_upsell_conversion_update
AFTER INSERT ON public.upsell_conversion_log
FOR EACH ROW
EXECUTE FUNCTION public.update_upsell_conversion_rate();
