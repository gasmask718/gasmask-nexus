
CREATE TABLE public.dd_affiliates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  code text NOT NULL UNIQUE,
  display_name text,
  email text,
  phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','paused','revoked')),
  tier text NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze','silver','gold','platinum')),
  commission_rate numeric NOT NULL DEFAULT 0.10 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  clicks integer NOT NULL DEFAULT 0,
  conversions integer NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_dd_affiliates_user ON public.dd_affiliates(user_id);
CREATE INDEX idx_dd_affiliates_status ON public.dd_affiliates(status);
GRANT SELECT, INSERT, UPDATE ON public.dd_affiliates TO authenticated;
GRANT ALL ON public.dd_affiliates TO service_role;
ALTER TABLE public.dd_affiliates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read self" ON public.dd_affiliates FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Affiliates update self limited" ON public.dd_affiliates FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage affiliates" ON public.dd_affiliates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TABLE public.dd_affiliate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid NOT NULL REFERENCES public.dd_affiliates(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('click','signup','order')),
  status text NOT NULL DEFAULT 'recorded' CHECK (status IN ('recorded','pending','earned','reversed','paid')),
  order_id uuid REFERENCES public.marketplace_orders(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  commission_rate numeric,
  commission_amount numeric NOT NULL DEFAULT 0,
  visitor_hash text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  earned_at timestamptz,
  paid_at timestamptz,
  payout_batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  click_day date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'UTC')::date) STORED
);
CREATE INDEX idx_dd_aff_events_affiliate ON public.dd_affiliate_events(affiliate_id, kind, created_at DESC);
CREATE INDEX idx_dd_aff_events_order ON public.dd_affiliate_events(order_id);
CREATE UNIQUE INDEX uniq_dd_aff_events_order_commission
  ON public.dd_affiliate_events(order_id) WHERE kind='order';
CREATE UNIQUE INDEX uniq_dd_aff_events_click_dedupe
  ON public.dd_affiliate_events(affiliate_id, visitor_hash, click_day)
  WHERE kind='click' AND visitor_hash IS NOT NULL;

GRANT SELECT ON public.dd_affiliate_events TO authenticated;
GRANT ALL ON public.dd_affiliate_events TO service_role;
ALTER TABLE public.dd_affiliate_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Affiliates read own events" ON public.dd_affiliate_events FOR SELECT TO authenticated
  USING (affiliate_id IN (SELECT id FROM public.dd_affiliates WHERE user_id = auth.uid())
         OR has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Admins manage affiliate events" ON public.dd_affiliate_events FOR ALL TO authenticated
  USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_dd_affiliates_updated_at BEFORE UPDATE ON public.dd_affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS affiliate_id uuid REFERENCES public.dd_affiliates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS affiliate_code text;
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_affiliate ON public.marketplace_orders(affiliate_id);

CREATE OR REPLACE FUNCTION public.generate_affiliate_code(p_seed text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_base text; v_code text; v_try int := 0;
BEGIN
  v_base := upper(regexp_replace(coalesce(p_seed,''), '[^A-Za-z0-9]', '', 'g'));
  IF length(v_base) < 3 THEN v_base := 'DD'; END IF;
  v_base := substring(v_base,1,8);
  LOOP
    IF v_try = 0 THEN v_code := v_base || (floor(random()*90+10))::int::text;
    ELSE v_code := v_base || (floor(random()*9000+1000))::int::text;
    END IF;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.dd_affiliates WHERE code=v_code);
    v_try := v_try+1;
    IF v_try > 20 THEN v_code := 'DD'||substr(gen_random_uuid()::text,1,6); EXIT; END IF;
  END LOOP;
  RETURN v_code;
END $$;

DROP FUNCTION IF EXISTS public.dd_create_marketplace_order(jsonb, jsonb, text, text, uuid, numeric, numeric, numeric, text, text);

CREATE OR REPLACE FUNCTION public.dd_create_marketplace_order(
  p_items jsonb, p_shipping_address jsonb,
  p_guest_email text DEFAULT NULL, p_guest_phone text DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_subtotal numeric DEFAULT 0, p_shipping_cost numeric DEFAULT 0, p_tax_amount numeric DEFAULT 0,
  p_notes text DEFAULT NULL, p_discount_code text DEFAULT NULL, p_affiliate_code text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_order_id uuid; v_user uuid;
  v_guest_bucket constant uuid := '00000000-0000-0000-0000-000000000001';
  v_item jsonb; v_discount_amount numeric := 0; v_discount record;
  v_total numeric; v_routing jsonb := '[]'::jsonb; v_route jsonb;
  v_affiliate record; v_commission numeric := 0; v_aff_id uuid; v_aff_rate numeric;
BEGIN
  v_user := COALESCE(p_customer_id, auth.uid(), v_guest_bucket);

  IF p_discount_code IS NOT NULL AND length(trim(p_discount_code))>0 THEN
    SELECT * INTO v_discount FROM public.validate_discount(p_discount_code, NULLIF(p_customer_id, v_guest_bucket), p_guest_email);
    IF v_discount.valid THEN
      IF v_discount.type='percent' THEN
        v_discount_amount := round((p_subtotal * v_discount.value / 100)::numeric, 2);
      ELSE v_discount_amount := least(v_discount.value, p_subtotal); END IF;
    END IF;
  END IF;

  IF p_affiliate_code IS NOT NULL AND length(trim(p_affiliate_code))>0 THEN
    SELECT id, user_id, code, commission_rate INTO v_affiliate
      FROM public.dd_affiliates
      WHERE upper(code)=upper(trim(p_affiliate_code)) AND status='active' LIMIT 1;
    IF v_affiliate.id IS NOT NULL AND v_affiliate.user_id IS NOT NULL AND v_affiliate.user_id = v_user THEN
      v_aff_id := NULL;
    ELSE
      v_aff_id := v_affiliate.id; v_aff_rate := v_affiliate.commission_rate;
    END IF;
  END IF;

  v_total := GREATEST(0, p_subtotal - v_discount_amount) + COALESCE(p_shipping_cost,0) + COALESCE(p_tax_amount,0);

  INSERT INTO public.marketplace_orders(
    user_id, customer_email, customer_phone, shipping_address,
    subtotal, shipping_cost, tax_amount, discount_code, discount_amount, total,
    status, payment_status, fulfillment_status, notes, affiliate_id, affiliate_code
  ) VALUES (
    v_user, p_guest_email, p_guest_phone, p_shipping_address,
    p_subtotal, p_shipping_cost, p_tax_amount, p_discount_code, v_discount_amount, v_total,
    'pending','pending','pending', p_notes,
    v_aff_id, CASE WHEN v_aff_id IS NOT NULL THEN v_affiliate.code ELSE NULL END
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.marketplace_order_items(order_id, product_id, quantity, unit_price, subtotal)
    VALUES (v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int,
            (v_item->>'unit_price')::numeric,
            ((v_item->>'quantity')::int * (v_item->>'unit_price')::numeric));
    BEGIN
      v_route := public.route_order_to_supplier(v_order_id, (v_item->>'product_id')::uuid, (v_item->>'quantity')::int);
      v_routing := v_routing || jsonb_build_array(v_route);
    EXCEPTION WHEN OTHERS THEN
      v_routing := v_routing || jsonb_build_array(jsonb_build_object('error', SQLERRM,'product_id',v_item->>'product_id'));
    END;
  END LOOP;

  IF v_discount_amount > 0 AND p_discount_code IS NOT NULL THEN
    PERFORM public.increment_discount_usage(p_discount_code);
  END IF;

  BEGIN PERFORM public.dd_consume_order_reservations(v_order_id);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  IF v_aff_id IS NOT NULL THEN
    v_commission := round(((GREATEST(0, p_subtotal - v_discount_amount)) * v_aff_rate)::numeric, 2);
    INSERT INTO public.dd_affiliate_events(affiliate_id, kind, status, order_id, amount, commission_rate, commission_amount)
      VALUES (v_aff_id, 'order', 'pending', v_order_id,
              GREATEST(0, p_subtotal - v_discount_amount), v_aff_rate, v_commission);
    UPDATE public.dd_affiliates SET conversions = conversions + 1 WHERE id = v_aff_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'order_id', v_order_id, 'total', v_total,
    'discount_amount', v_discount_amount,
    'affiliate', CASE WHEN v_aff_id IS NOT NULL THEN jsonb_build_object(
      'affiliate_id', v_aff_id, 'code', v_affiliate.code,
      'commission_rate', v_aff_rate, 'commission_amount', v_commission) ELSE NULL END,
    'routing', v_routing);
END $$;
GRANT EXECUTE ON FUNCTION public.dd_create_marketplace_order(jsonb,jsonb,text,text,uuid,numeric,numeric,numeric,text,text,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dd_affiliate_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    IF NEW.payment_status = 'paid' THEN
      UPDATE public.dd_affiliate_events SET status='earned', earned_at=now()
        WHERE order_id = NEW.id AND kind='order' AND status='pending'
        RETURNING affiliate_id, commission_amount INTO r;
      IF FOUND THEN
        UPDATE public.dd_affiliates SET total_earned = total_earned + r.commission_amount WHERE id = r.affiliate_id;
      END IF;
    ELSIF NEW.payment_status IN ('refunded','failed') THEN
      UPDATE public.dd_affiliate_events SET status='reversed'
        WHERE order_id = NEW.id AND kind='order' AND status IN ('pending','earned')
        RETURNING affiliate_id, commission_amount INTO r;
      IF FOUND AND OLD.payment_status='paid' THEN
        UPDATE public.dd_affiliates SET total_earned = GREATEST(0, total_earned - r.commission_amount) WHERE id = r.affiliate_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_dd_affiliate_lifecycle ON public.marketplace_orders;
CREATE TRIGGER trg_dd_affiliate_lifecycle AFTER UPDATE OF payment_status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.dd_affiliate_lifecycle();

CREATE OR REPLACE FUNCTION public.dd_affiliate_track_click(
  p_code text, p_visitor_hash text DEFAULT NULL, p_meta jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_aff record; v_inserted boolean := false;
BEGIN
  SELECT id INTO v_aff FROM public.dd_affiliates WHERE upper(code)=upper(trim(p_code)) AND status='active';
  IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'error','affiliate_not_found'); END IF;
  BEGIN
    INSERT INTO public.dd_affiliate_events(affiliate_id, kind, status, visitor_hash, meta)
      VALUES (v_aff.id,'click','recorded',p_visitor_hash,COALESCE(p_meta,'{}'::jsonb));
    v_inserted := true;
    UPDATE public.dd_affiliates SET clicks = clicks+1 WHERE id = v_aff.id;
  EXCEPTION WHEN unique_violation THEN v_inserted := false;
  END;
  RETURN jsonb_build_object('success',true,'affiliate_id',v_aff.id,'recorded',v_inserted);
END $$;
GRANT EXECUTE ON FUNCTION public.dd_affiliate_track_click(text,text,jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dd_affiliate_mark_paid(p_event_ids uuid[], p_payout_batch_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total numeric := 0; r record;
BEGIN
  IF NOT (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role)) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  FOR r IN
    UPDATE public.dd_affiliate_events SET status='paid', paid_at=now(), payout_batch_id=p_payout_batch_id
      WHERE id = ANY(p_event_ids) AND kind='order' AND status='earned'
      RETURNING affiliate_id, commission_amount
  LOOP
    v_total := v_total + r.commission_amount;
    UPDATE public.dd_affiliates SET total_paid = total_paid + r.commission_amount WHERE id = r.affiliate_id;
  END LOOP;
  RETURN jsonb_build_object('success',true,'total_paid',v_total);
END $$;
GRANT EXECUTE ON FUNCTION public.dd_affiliate_mark_paid(uuid[],uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.dd_affiliate_self_signup(p_display_name text, p_email text DEFAULT NULL, p_phone text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT id INTO v_id FROM public.dd_affiliates WHERE user_id = auth.uid() LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'affiliate_id',v_id,'existed',true); END IF;
  v_code := public.generate_affiliate_code(coalesce(p_display_name, p_email));
  INSERT INTO public.dd_affiliates(user_id, code, display_name, email, phone, status, tier, commission_rate)
    VALUES (auth.uid(), v_code, p_display_name, p_email, p_phone, 'pending','bronze',0.10)
    RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'affiliate_id',v_id,'code',v_code,'existed',false);
END $$;
GRANT EXECUTE ON FUNCTION public.dd_affiliate_self_signup(text,text,text) TO authenticated, service_role;
