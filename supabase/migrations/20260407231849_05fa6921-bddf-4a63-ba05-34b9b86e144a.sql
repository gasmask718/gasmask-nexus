-- ============================================================
-- COACH BUS DISPATCH COMMAND — COMPLETE SCHEMA
-- ============================================================

-- 1. BOOKING REQUESTS
CREATE TABLE public.cb_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  pickup_city TEXT NOT NULL,
  pickup_state TEXT,
  pickup_address TEXT,
  dropoff_city TEXT NOT NULL,
  dropoff_state TEXT,
  dropoff_address TEXT,
  trip_date DATE,
  trip_time TIME,
  return_date DATE,
  return_time TIME,
  trip_type TEXT DEFAULT 'one_way',
  passenger_count INTEGER NOT NULL DEFAULT 1,
  bus_type_preference TEXT,
  requested_amenities TEXT[],
  special_requests TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  recommended_quote_id UUID,
  selected_quote_id UUID,
  selected_partner_id UUID,
  customer_offer_sent_at TIMESTAMPTZ,
  customer_offer_price NUMERIC,
  customer_approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_booking_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage booking requests"
  ON public.cb_booking_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can create requests"
  ON public.cb_booking_requests FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can view own requests"
  ON public.cb_booking_requests FOR SELECT TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. PARTNER DISPATCHES
CREATE TABLE public.cb_request_partner_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  partner_name TEXT,
  partner_phone TEXT,
  partner_email TEXT,
  channel TEXT NOT NULL DEFAULT 'sms',
  dispatch_payload JSONB,
  response_token TEXT DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_request_partner_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage dispatches"
  ON public.cb_request_partner_dispatches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. PARTNER QUOTES
CREATE TABLE public.cb_partner_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  dispatch_id UUID REFERENCES public.cb_request_partner_dispatches(id),
  quoted_price NUMERIC NOT NULL,
  currency TEXT DEFAULT 'USD',
  vehicle_type TEXT,
  capacity INTEGER,
  amenities TEXT[],
  availability_status TEXT NOT NULL DEFAULT 'quoted',
  alternate_offer_notes TEXT,
  quote_notes TEXT,
  deposit_required NUMERIC DEFAULT 0,
  expiration_at TIMESTAMPTZ,
  response_method TEXT,
  response_time_seconds INTEGER,
  raw_response_payload JSONB,
  is_selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_partner_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quotes"
  ON public.cb_partner_quotes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Partners can insert quotes"
  ON public.cb_partner_quotes FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. MARGIN ENGINE
CREATE TABLE public.cb_quote_margins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES public.cb_partner_quotes(id) ON DELETE CASCADE,
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  partner_quote_amount NUMERIC NOT NULL,
  markup_type TEXT NOT NULL DEFAULT 'percentage',
  markup_value NUMERIC NOT NULL DEFAULT 20,
  final_customer_price NUMERIC NOT NULL,
  expected_margin_amount NUMERIC NOT NULL,
  expected_margin_percentage NUMERIC NOT NULL,
  admin_override BOOLEAN DEFAULT false,
  override_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_quote_margins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access margins"
  ON public.cb_quote_margins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. QUOTE SELECTION EVENTS (audit trail)
CREATE TABLE public.cb_quote_selection_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  selected_quote_id UUID NOT NULL REFERENCES public.cb_partner_quotes(id),
  selected_partner_id UUID NOT NULL,
  selection_reason TEXT,
  selected_by UUID,
  quote_snapshot JSONB NOT NULL,
  backup_quote_ids UUID[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_quote_selection_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access selection events"
  ON public.cb_quote_selection_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. COMMUNICATION LOGS
CREATE TABLE public.cb_communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID REFERENCES public.cb_booking_requests(id) ON DELETE SET NULL,
  partner_id UUID,
  customer_identifier TEXT,
  direction TEXT NOT NULL DEFAULT 'outbound',
  channel TEXT NOT NULL DEFAULT 'sms',
  template_used TEXT,
  content_preview TEXT,
  full_content TEXT,
  delivery_status TEXT DEFAULT 'pending',
  external_message_id TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_communication_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access comm logs"
  ON public.cb_communication_logs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. ADMIN INTERNAL NOTES
CREATE TABLE public.cb_admin_internal_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  author_id UUID,
  author_name TEXT,
  note TEXT NOT NULL,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_admin_internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can access internal notes"
  ON public.cb_admin_internal_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 8. DISPATCH CONFIG
CREATE TABLE public.cb_dispatch_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL DEFAULT 'coach_bus',
  routing_mode TEXT NOT NULL DEFAULT 'multi_partner_broadcast',
  max_partners_per_request INTEGER DEFAULT 20,
  default_markup_type TEXT DEFAULT 'percentage',
  default_markup_value NUMERIC DEFAULT 20,
  target_margin_percentage NUMERIC DEFAULT 25,
  auto_recommend BOOLEAN DEFAULT true,
  quote_expiration_hours INTEGER DEFAULT 48,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category)
);

ALTER TABLE public.cb_dispatch_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage dispatch config"
  ON public.cb_dispatch_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed default config
INSERT INTO public.cb_dispatch_config (category, routing_mode, max_partners_per_request, default_markup_type, default_markup_value, target_margin_percentage)
VALUES ('coach_bus', 'multi_partner_broadcast', 20, 'percentage', 20, 25);

-- 9. AUTO-MARGIN TRIGGER
CREATE OR REPLACE FUNCTION public.cb_auto_calculate_margin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_config RECORD;
  v_markup_val NUMERIC;
  v_final_price NUMERIC;
  v_margin_amount NUMERIC;
  v_margin_pct NUMERIC;
BEGIN
  SELECT * INTO v_config FROM cb_dispatch_config WHERE category = 'coach_bus' LIMIT 1;
  
  IF v_config IS NULL THEN
    v_config.default_markup_type := 'percentage';
    v_config.default_markup_value := 20;
  END IF;

  IF v_config.default_markup_type = 'percentage' THEN
    v_markup_val := v_config.default_markup_value;
    v_final_price := NEW.quoted_price * (1 + v_markup_val / 100);
  ELSE
    v_markup_val := v_config.default_markup_value;
    v_final_price := NEW.quoted_price + v_markup_val;
  END IF;

  v_margin_amount := v_final_price - NEW.quoted_price;
  v_margin_pct := CASE WHEN v_final_price > 0 THEN (v_margin_amount / v_final_price) * 100 ELSE 0 END;

  INSERT INTO cb_quote_margins (
    quote_id, booking_request_id, partner_quote_amount,
    markup_type, markup_value, final_customer_price,
    expected_margin_amount, expected_margin_percentage
  ) VALUES (
    NEW.id, NEW.booking_request_id, NEW.quoted_price,
    v_config.default_markup_type, v_markup_val, v_final_price,
    v_margin_amount, v_margin_pct
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cb_auto_margin
  AFTER INSERT ON public.cb_partner_quotes
  FOR EACH ROW EXECUTE FUNCTION public.cb_auto_calculate_margin();

-- 10. AUTO-UPDATE REQUEST STATUS ON QUOTE
CREATE OR REPLACE FUNCTION public.cb_update_request_on_quote()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE cb_booking_requests
  SET status = 'quotes_received', updated_at = now()
  WHERE id = NEW.booking_request_id
    AND status IN ('new', 'dispatching', 'awaiting_quotes');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cb_status_on_quote
  AFTER INSERT ON public.cb_partner_quotes
  FOR EACH ROW EXECUTE FUNCTION public.cb_update_request_on_quote();

-- 11. UPDATED_AT TRIGGERS
CREATE OR REPLACE FUNCTION public.cb_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_cb_booking_requests_updated BEFORE UPDATE ON public.cb_booking_requests FOR EACH ROW EXECUTE FUNCTION public.cb_set_updated_at();
CREATE TRIGGER trg_cb_dispatches_updated BEFORE UPDATE ON public.cb_request_partner_dispatches FOR EACH ROW EXECUTE FUNCTION public.cb_set_updated_at();
CREATE TRIGGER trg_cb_quotes_updated BEFORE UPDATE ON public.cb_partner_quotes FOR EACH ROW EXECUTE FUNCTION public.cb_set_updated_at();
CREATE TRIGGER trg_cb_margins_updated BEFORE UPDATE ON public.cb_quote_margins FOR EACH ROW EXECUTE FUNCTION public.cb_set_updated_at();

-- 12. INDEXES
CREATE INDEX idx_cb_requests_status ON public.cb_booking_requests(status);
CREATE INDEX idx_cb_requests_pickup ON public.cb_booking_requests(pickup_city);
CREATE INDEX idx_cb_dispatches_request ON public.cb_request_partner_dispatches(booking_request_id);
CREATE INDEX idx_cb_dispatches_partner ON public.cb_request_partner_dispatches(partner_id);
CREATE INDEX idx_cb_dispatches_status ON public.cb_request_partner_dispatches(status);
CREATE INDEX idx_cb_quotes_request ON public.cb_partner_quotes(booking_request_id);
CREATE INDEX idx_cb_quotes_partner ON public.cb_partner_quotes(partner_id);
CREATE INDEX idx_cb_margins_quote ON public.cb_quote_margins(quote_id);
CREATE INDEX idx_cb_comm_request ON public.cb_communication_logs(booking_request_id);
CREATE INDEX idx_cb_notes_request ON public.cb_admin_internal_notes(booking_request_id);

-- 13. KPI FUNCTION
CREATE OR REPLACE FUNCTION public.cb_dispatch_kpis()
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'open_requests', (SELECT count(*) FROM cb_booking_requests WHERE status IN ('new','dispatching','awaiting_quotes')),
    'awaiting_quotes', (SELECT count(*) FROM cb_booking_requests WHERE status = 'awaiting_quotes'),
    'quotes_received_today', (SELECT count(*) FROM cb_partner_quotes WHERE created_at::date = CURRENT_DATE),
    'total_quotes', (SELECT count(*) FROM cb_partner_quotes),
    'avg_response_time_seconds', (SELECT coalesce(avg(response_time_seconds), 0) FROM cb_partner_quotes WHERE response_time_seconds > 0),
    'dispatch_success_rate', (
      SELECT CASE WHEN count(*) > 0 
        THEN round(count(*) FILTER (WHERE status = 'responded')::numeric / count(*)::numeric * 100, 1) 
        ELSE 0 END
      FROM cb_request_partner_dispatches
    ),
    'selection_rate', (
      SELECT CASE WHEN count(*) > 0 
        THEN round(count(*) FILTER (WHERE status = 'selected')::numeric / count(*)::numeric * 100, 1) 
        ELSE 0 END
      FROM cb_booking_requests WHERE status NOT IN ('new','cancelled')
    ),
    'confirmation_rate', (
      SELECT CASE WHEN count(*) > 0 
        THEN round(count(*) FILTER (WHERE status = 'confirmed')::numeric / count(*)::numeric * 100, 1)
        ELSE 0 END
      FROM cb_booking_requests WHERE status NOT IN ('new','cancelled')
    ),
    'avg_gross_margin', (SELECT coalesce(round(avg(expected_margin_percentage), 1), 0) FROM cb_quote_margins),
    'busiest_cities', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT pickup_city as city, count(*) as request_count 
        FROM cb_booking_requests 
        GROUP BY pickup_city ORDER BY count(*) DESC LIMIT 5
      ) t
    ),
    'top_responding_partners', (
      SELECT coalesce(json_agg(row_to_json(t)), '[]'::json) FROM (
        SELECT partner_id, count(*) as quote_count, round(avg(response_time_seconds)) as avg_response_sec
        FROM cb_partner_quotes 
        GROUP BY partner_id ORDER BY count(*) DESC LIMIT 5
      ) t
    )
  ) INTO result;
  RETURN result;
END;
$$;

-- 14. QUOTE RECOMMENDATION FUNCTION
CREATE OR REPLACE FUNCTION public.cb_recommend_quote(p_request_id UUID)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'lowest_price', (
      SELECT json_build_object('quote_id', q.id, 'partner_id', q.partner_id, 'price', m.final_customer_price)
      FROM cb_partner_quotes q JOIN cb_quote_margins m ON m.quote_id = q.id
      WHERE q.booking_request_id = p_request_id AND q.availability_status = 'quoted'
      ORDER BY m.final_customer_price ASC LIMIT 1
    ),
    'best_margin', (
      SELECT json_build_object('quote_id', q.id, 'partner_id', q.partner_id, 'margin_pct', m.expected_margin_percentage)
      FROM cb_partner_quotes q JOIN cb_quote_margins m ON m.quote_id = q.id
      WHERE q.booking_request_id = p_request_id AND q.availability_status = 'quoted'
      ORDER BY m.expected_margin_percentage DESC LIMIT 1
    ),
    'fastest_response', (
      SELECT json_build_object('quote_id', q.id, 'partner_id', q.partner_id, 'response_seconds', q.response_time_seconds)
      FROM cb_partner_quotes q
      WHERE q.booking_request_id = p_request_id AND q.availability_status = 'quoted' AND q.response_time_seconds > 0
      ORDER BY q.response_time_seconds ASC LIMIT 1
    ),
    'all_quotes', (
      SELECT coalesce(json_agg(json_build_object(
        'quote_id', q.id, 'partner_id', q.partner_id, 'quoted_price', q.quoted_price,
        'final_customer_price', m.final_customer_price, 'margin_pct', m.expected_margin_percentage,
        'vehicle_type', q.vehicle_type, 'capacity', q.capacity, 'amenities', q.amenities,
        'availability', q.availability_status, 'response_seconds', q.response_time_seconds
      ) ORDER BY m.final_customer_price ASC), '[]'::json)
      FROM cb_partner_quotes q JOIN cb_quote_margins m ON m.quote_id = q.id
      WHERE q.booking_request_id = p_request_id
    )
  ) INTO result;
  RETURN result;
END;
$$;