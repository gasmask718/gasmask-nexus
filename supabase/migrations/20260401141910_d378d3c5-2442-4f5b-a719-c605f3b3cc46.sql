
CREATE TABLE IF NOT EXISTS public.ut_supplier_negotiations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID,
  supplier_name TEXT,
  rfq_id UUID REFERENCES public.ut_rfq_requests(id),
  current_offer_price DECIMAL,
  current_moq INTEGER,
  current_shipping_cost DECIMAL,
  current_branding_cost DECIMAL,
  best_offer_price DECIMAL,
  best_offer_moq INTEGER,
  best_offer_shipping DECIMAL,
  best_offer_branding DECIMAL,
  original_price DECIMAL,
  original_moq INTEGER,
  target_price DECIMAL,
  target_moq INTEGER,
  negotiation_round INTEGER DEFAULT 0,
  max_rounds INTEGER DEFAULT 5,
  status TEXT DEFAULT 'initiated',
  ai_strategy_mode TEXT DEFAULT 'balanced',
  last_message TEXT,
  last_supplier_response TEXT,
  price_reduction_pct DECIMAL DEFAULT 0,
  moq_reduction_pct DECIMAL DEFAULT 0,
  shipping_savings DECIMAL DEFAULT 0,
  total_savings DECIMAL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ut_supplier_negotiations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to ut_supplier_negotiations"
  ON public.ut_supplier_negotiations FOR ALL
  USING (true) WITH CHECK (true);
