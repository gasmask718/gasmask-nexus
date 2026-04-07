
-- TopTier Event Carts
CREATE TABLE public.toptier_event_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'active',
  city TEXT,
  event_date DATE,
  guest_count INT,
  event_type TEXT,
  subtotal NUMERIC DEFAULT 0,
  estimated_total NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TopTier Event Cart Items
CREATE TABLE public.toptier_event_cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.toptier_event_carts(id) ON DELETE CASCADE NOT NULL,
  source_system TEXT NOT NULL DEFAULT 'unforgettable_times',
  item_type TEXT NOT NULL,
  external_item_id UUID NOT NULL,
  item_name_snapshot TEXT,
  qty INT DEFAULT 1,
  hours INT,
  price_snapshot NUMERIC DEFAULT 0,
  metadata_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- TopTier Quote Requests
CREATE TABLE public.toptier_quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.toptier_event_carts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  customer_name TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- TopTier Booking Intents
CREATE TABLE public.toptier_booking_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES public.toptier_event_carts(id) ON DELETE SET NULL,
  quote_request_id UUID REFERENCES public.toptier_quote_requests(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  payment_status TEXT DEFAULT 'unpaid',
  booking_status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.toptier_event_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toptier_event_cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toptier_quote_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.toptier_booking_intents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own carts" ON public.toptier_event_carts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own cart items" ON public.toptier_event_cart_items FOR ALL TO authenticated
  USING (cart_id IN (SELECT id FROM public.toptier_event_carts WHERE user_id = auth.uid()))
  WITH CHECK (cart_id IN (SELECT id FROM public.toptier_event_carts WHERE user_id = auth.uid()));

CREATE POLICY "Users own quotes" ON public.toptier_quote_requests FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users own bookings" ON public.toptier_booking_intents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_tt_carts_user ON public.toptier_event_carts(user_id);
CREATE INDEX idx_tt_cart_items_cart ON public.toptier_event_cart_items(cart_id);
CREATE INDEX idx_tt_quotes_user ON public.toptier_quote_requests(user_id);
CREATE INDEX idx_tt_bookings_user ON public.toptier_booking_intents(user_id);
