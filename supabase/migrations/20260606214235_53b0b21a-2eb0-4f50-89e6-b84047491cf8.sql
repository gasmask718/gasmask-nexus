
-- ============================================================
-- 1. email_captures
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text NOT NULL,
  discount_code text,
  user_id uuid,
  ip inet,
  user_agent text,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS email_captures_email_source_uq
  ON public.email_captures (lower(email), source);
CREATE INDEX IF NOT EXISTS email_captures_email_lower_idx
  ON public.email_captures (lower(email));

GRANT INSERT ON public.email_captures TO anon, authenticated;
GRANT ALL ON public.email_captures TO service_role;
ALTER TABLE public.email_captures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can submit capture" ON public.email_captures;
CREATE POLICY "anyone can submit capture"
  ON public.email_captures FOR INSERT TO anon, authenticated
  WITH CHECK (email IS NOT NULL AND length(email) BETWEEN 5 AND 255);

DROP POLICY IF EXISTS "admins read captures" ON public.email_captures;
CREATE POLICY "admins read captures"
  ON public.email_captures FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. dd_email_suppressions (DD-scoped to avoid future infra collision)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.dd_email_suppressions (
  email_lower text PRIMARY KEY,
  reason text NOT NULL,                  -- 'unsubscribe' | 'bounce' | 'complaint' | 'manual'
  source text,                            -- e.g. 'dd-email-unsubscribe'
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.dd_email_suppressions TO service_role;
ALTER TABLE public.dd_email_suppressions ENABLE ROW LEVEL SECURITY;
-- Service-role only; no anon/authenticated policies.

-- ============================================================
-- 3. email_jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.email_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template text NOT NULL,
  recipient_email text NOT NULL,
  order_id uuid,
  user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  skipped_at timestamptz,
  skipped_reason text,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  idempotency_key text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_jobs_pending_idx
  ON public.email_jobs (scheduled_for)
  WHERE sent_at IS NULL AND skipped_at IS NULL;

GRANT ALL ON public.email_jobs TO service_role;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
-- Service-role only.

-- ============================================================
-- 4. products_all_public — add updated_at for sitemap lastmod
-- ============================================================
DROP VIEW IF EXISTS public.products_all_public;
CREATE VIEW public.products_all_public
WITH (security_invoker = true)
AS
SELECT
  id,
  wholesaler_id,
  brand_id,
  product_name,
  description,
  category,
  images,
  unit_type,
  inventory_qty,
  weight_oz,
  dimensions,
  retail_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'store'::app_role) OR
      has_role(auth.uid(), 'wholesaler'::app_role) OR
      has_role(auth.uid(), 'wholesale'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'owner'::app_role)
    ) THEN store_price
    ELSE NULL::numeric
  END AS store_price,
  CASE
    WHEN auth.uid() IS NOT NULL AND (
      has_role(auth.uid(), 'wholesaler'::app_role) OR
      has_role(auth.uid(), 'wholesale'::app_role) OR
      has_role(auth.uid(), 'admin'::app_role) OR
      has_role(auth.uid(), 'owner'::app_role)
    ) THEN wholesale_price
    ELSE NULL::numeric
  END AS wholesale_price,
  street_price,
  shipping_from_city,
  shipping_from_state,
  processing_time,
  status,
  created_at,
  updated_at
FROM public.products_all
WHERE status = 'active'::text;

GRANT SELECT ON public.products_all_public TO anon, authenticated;

-- ============================================================
-- 5. Recipient resolver — single source of truth
--    customer_email first; fall back to profiles.email via user_id;
--    SKIP the guest service-account id (guest orders must use customer_email)
-- ============================================================
CREATE OR REPLACE FUNCTION public.dd_resolve_order_recipient(
  p_customer_email text,
  p_user_id uuid
) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  guest_id constant uuid := '59642b93-9e95-48fe-8984-a70078987e2a';
  prof_email text;
BEGIN
  IF p_customer_email IS NOT NULL AND length(trim(p_customer_email)) > 0 THEN
    RETURN lower(trim(p_customer_email));
  END IF;
  IF p_user_id IS NULL OR p_user_id = guest_id THEN
    RETURN NULL;
  END IF;
  SELECT email INTO prof_email FROM public.profiles WHERE id = p_user_id;
  IF prof_email IS NULL THEN RETURN NULL; END IF;
  RETURN lower(trim(prof_email));
END $$;

-- Helper: is recipient currently suppressed or unsubscribed?
CREATE OR REPLACE FUNCTION public.dd_recipient_blocked(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dd_email_suppressions WHERE email_lower = lower(p_email)
  ) OR EXISTS (
    SELECT 1 FROM public.email_captures
    WHERE lower(email) = lower(p_email) AND unsubscribed_at IS NOT NULL
  );
$$;

-- ============================================================
-- 6. Trigger: confirmation email on marketplace_orders.payment_status → paid family
-- ============================================================
CREATE OR REPLACE FUNCTION public.dd_enqueue_order_confirmation_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  paid_family constant text[] := ARRAY['paid','captured','succeeded','completed'];
  recipient text;
  paid_now boolean;
BEGIN
  paid_now := NEW.payment_status = ANY(paid_family)
    AND (TG_OP = 'INSERT' OR OLD.payment_status IS DISTINCT FROM NEW.payment_status);
  IF NOT paid_now THEN RETURN NEW; END IF;

  recipient := public.dd_resolve_order_recipient(NEW.customer_email, NEW.user_id);
  IF recipient IS NULL THEN RETURN NEW; END IF;
  IF public.dd_recipient_blocked(recipient) THEN RETURN NEW; END IF;

  INSERT INTO public.email_jobs (template, recipient_email, order_id, user_id, idempotency_key, payload)
  VALUES (
    'order_confirmation',
    recipient,
    NEW.id,
    NEW.user_id,
    'order_confirmation:' || NEW.id::text,
    jsonb_build_object('order_id', NEW.id)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dd_enqueue_order_confirmation ON public.marketplace_orders;
CREATE TRIGGER trg_dd_enqueue_order_confirmation
  AFTER INSERT OR UPDATE OF payment_status ON public.marketplace_orders
  FOR EACH ROW EXECUTE FUNCTION public.dd_enqueue_order_confirmation_email();

-- ============================================================
-- 7. Trigger: shipped + review + win-back on marketplace_fulfillments.tracking_number first set
-- ============================================================
CREATE OR REPLACE FUNCTION public.dd_enqueue_fulfillment_emails()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ord public.marketplace_orders%ROWTYPE;
  recipient text;
  first_set boolean;
BEGIN
  first_set := NEW.tracking_number IS NOT NULL AND length(trim(NEW.tracking_number)) > 0
    AND (TG_OP = 'INSERT' OR OLD.tracking_number IS NULL OR length(trim(OLD.tracking_number)) = 0);
  IF NOT first_set THEN RETURN NEW; END IF;

  SELECT * INTO ord FROM public.marketplace_orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  recipient := public.dd_resolve_order_recipient(ord.customer_email, ord.user_id);
  IF recipient IS NULL THEN RETURN NEW; END IF;
  IF public.dd_recipient_blocked(recipient) THEN RETURN NEW; END IF;

  -- shipped (immediate)
  INSERT INTO public.email_jobs (template, recipient_email, order_id, user_id, idempotency_key, payload, scheduled_for)
  VALUES (
    'order_shipped', recipient, ord.id, ord.user_id,
    'order_shipped:' || NEW.id::text,
    jsonb_build_object(
      'order_id', ord.id,
      'fulfillment_id', NEW.id,
      'tracking_number', NEW.tracking_number,
      'carrier', NEW.carrier
    ),
    now()
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- review request (T+10d)
  INSERT INTO public.email_jobs (template, recipient_email, order_id, user_id, idempotency_key, payload, scheduled_for)
  VALUES (
    'review_request', recipient, ord.id, ord.user_id,
    'review_request:' || NEW.id::text,
    jsonb_build_object('order_id', ord.id, 'fulfillment_id', NEW.id),
    now() + interval '10 days'
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  -- win-back (T+45d) — final dedupe (newer order placed) happens at SEND time
  INSERT INTO public.email_jobs (template, recipient_email, order_id, user_id, idempotency_key, payload, scheduled_for)
  VALUES (
    'win_back', recipient, ord.id, ord.user_id,
    'win_back:' || NEW.id::text,
    jsonb_build_object('order_id', ord.id, 'fulfillment_id', NEW.id, 'placed_at', ord.created_at),
    now() + interval '45 days'
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dd_enqueue_fulfillment_emails ON public.marketplace_fulfillments;
CREATE TRIGGER trg_dd_enqueue_fulfillment_emails
  AFTER INSERT OR UPDATE OF tracking_number ON public.marketplace_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.dd_enqueue_fulfillment_emails();
