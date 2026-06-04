-- ============================================================
-- product_views
-- ============================================================
CREATE TABLE public.product_views (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products_all(id) ON DELETE CASCADE,
  user_id     uuid NULL,
  visitor_id  text NULL,
  source      text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_views_product_idx ON public.product_views (product_id, created_at DESC);
CREATE INDEX product_views_visitor_idx ON public.product_views (visitor_id, created_at DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX product_views_user_idx    ON public.product_views (user_id, created_at DESC)    WHERE user_id    IS NOT NULL;

GRANT INSERT ON public.product_views TO anon, authenticated;
GRANT SELECT ON public.product_views TO authenticated;
GRANT ALL    ON public.product_views TO service_role;

ALTER TABLE public.product_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log views"
  ON public.product_views FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND visitor_id IS NOT NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "Owners and admins read views"
  ON public.product_views FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- category_descriptions
-- ============================================================
CREATE TABLE public.category_descriptions (
  category    text PRIMARY KEY,
  body        text NOT NULL,
  ai_assisted boolean NOT NULL DEFAULT true,
  updated_by  uuid NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.category_descriptions TO anon, authenticated;
GRANT ALL    ON public.category_descriptions TO service_role;

ALTER TABLE public.category_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read category copy"
  ON public.category_descriptions FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Admins write category copy"
  ON public.category_descriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- review_summaries + review_summary_jobs
-- ============================================================
CREATE TABLE public.review_summaries (
  product_id   uuid PRIMARY KEY REFERENCES public.products_all(id) ON DELETE CASCADE,
  summary      text NOT NULL,
  review_count int  NOT NULL,
  source_hash  text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.review_summaries TO anon, authenticated;
GRANT ALL    ON public.review_summaries TO service_role;

ALTER TABLE public.review_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read review summaries"
  ON public.review_summaries FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.review_summary_jobs (
  product_id  uuid PRIMARY KEY REFERENCES public.products_all(id) ON DELETE CASCADE,
  enqueued_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.review_summary_jobs TO service_role;
ALTER TABLE public.review_summary_jobs ENABLE ROW LEVEL SECURITY;
-- service_role bypasses RLS; no other roles granted.

CREATE OR REPLACE FUNCTION public.touch_review_summary()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.review_summary_jobs (product_id) VALUES (NEW.product_id)
    ON CONFLICT (product_id) DO UPDATE SET enqueued_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER reviews_touch_summary
  AFTER INSERT OR UPDATE OF status, text, rating ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.touch_review_summary();

-- ============================================================
-- cart_events
-- ============================================================
CREATE TABLE public.cart_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NULL,
  visitor_id  text NULL,
  email       text NULL,
  phone       text NULL,
  event_type  text NOT NULL,
  items       jsonb NOT NULL,
  cart_total  numeric NOT NULL DEFAULT 0,
  user_agent  text NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cart_events_email_idx ON public.cart_events (email, created_at DESC) WHERE email IS NOT NULL;
CREATE INDEX cart_events_user_idx  ON public.cart_events (user_id, created_at DESC) WHERE user_id IS NOT NULL;

GRANT INSERT ON public.cart_events TO anon, authenticated;
GRANT SELECT ON public.cart_events TO authenticated;
GRANT ALL    ON public.cart_events TO service_role;

ALTER TABLE public.cart_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log cart events"
  ON public.cart_events FOR INSERT TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

CREATE POLICY "Admins read cart events"
  ON public.cart_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

-- ============================================================
-- notification_queue (cart-recovery sink + general outbound)
-- ============================================================
CREATE TABLE public.notification_queue (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status       text NOT NULL DEFAULT 'queued',  -- queued | sent | failed | cancelled
  channel      text NOT NULL,                   -- email | sms
  provider     text NOT NULL,                   -- resend | twilio | ...
  recipient    text NOT NULL,                   -- email or E.164
  subject      text NULL,
  payload      jsonb NOT NULL,
  related_kind text NULL,                       -- 'cart_recovery' | ...
  related_id   uuid NULL,
  queued_at    timestamptz NOT NULL DEFAULT now(),
  sent_at      timestamptz NULL,
  error        text NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notification_queue_status_idx ON public.notification_queue (status, queued_at DESC);
CREATE INDEX notification_queue_related_idx ON public.notification_queue (related_kind, related_id);

GRANT SELECT ON public.notification_queue TO authenticated;
GRANT ALL    ON public.notification_queue TO service_role;

ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read notification queue"
  ON public.notification_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER notification_queue_updated_at
  BEFORE UPDATE ON public.notification_queue
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TRIGGER category_descriptions_updated_at
  BEFORE UPDATE ON public.category_descriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============================================================
-- RPC: dd_picked_for_you
-- ============================================================
CREATE OR REPLACE FUNCTION public.dd_picked_for_you(
  p_visitor_id text DEFAULT NULL,
  p_user_id    uuid DEFAULT NULL,
  p_limit      int  DEFAULT 8
)
RETURNS SETOF public.products_all
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seen uuid[];
  v_hit_count int;
BEGIN
  -- 1. Caller's last ~50 viewed product_ids
  IF p_user_id IS NOT NULL THEN
    SELECT array_agg(product_id) INTO v_seen
      FROM (SELECT DISTINCT ON (product_id) product_id, created_at
              FROM public.product_views
             WHERE user_id = p_user_id
             ORDER BY product_id, created_at DESC) s
      ORDER BY created_at DESC LIMIT 50;
  ELSIF p_visitor_id IS NOT NULL THEN
    SELECT array_agg(product_id) INTO v_seen
      FROM (SELECT DISTINCT ON (product_id) product_id, created_at
              FROM public.product_views
             WHERE visitor_id = p_visitor_id
             ORDER BY product_id, created_at DESC) s
      ORDER BY created_at DESC LIMIT 50;
  END IF;

  v_hit_count := COALESCE(array_length(v_seen, 1), 0);

  -- 2/3. Co-viewed + co-purchased ranking when we have enough history
  IF v_hit_count >= 3 THEN
    RETURN QUERY
    WITH co_views AS (
      SELECT pv.product_id, COUNT(*)::int AS score
        FROM public.product_views pv
        JOIN public.product_views seed
          ON seed.visitor_id IS NOT DISTINCT FROM pv.visitor_id
         AND seed.user_id    IS NOT DISTINCT FROM pv.user_id
         AND seed.product_id = ANY(v_seen)
         AND seed.id <> pv.id
       WHERE pv.product_id <> ALL(v_seen)
       GROUP BY pv.product_id
    ),
    co_buys AS (
      SELECT moi.product_id, COUNT(*)::int * 2 AS score
        FROM public.marketplace_order_items moi
        JOIN public.marketplace_order_items seed
          ON seed.order_id = moi.order_id
         AND seed.product_id = ANY(v_seen)
         AND seed.product_id <> moi.product_id
       WHERE moi.product_id <> ALL(v_seen)
       GROUP BY moi.product_id
    ),
    ranked AS (
      SELECT product_id, SUM(score)::int AS total
        FROM (SELECT * FROM co_views UNION ALL SELECT * FROM co_buys) u
       GROUP BY product_id
    )
    SELECT p.*
      FROM public.products_all p
      JOIN ranked r ON r.product_id = p.id
     WHERE p.status = 'active'
     ORDER BY r.total DESC, p.created_at DESC
     LIMIT p_limit;

    IF FOUND THEN RETURN; END IF;
  END IF;

  -- 4. Cold-start: bestsellers (trailing 30d qty in marketplace_order_items)
  RETURN QUERY
  WITH bestsellers AS (
    SELECT product_id, SUM(qty)::int AS sold
      FROM public.marketplace_order_items
     WHERE created_at >= now() - interval '30 days'
     GROUP BY product_id
     ORDER BY sold DESC
     LIMIT p_limit * 3
  )
  SELECT p.*
    FROM public.products_all p
    LEFT JOIN bestsellers b ON b.product_id = p.id
   WHERE p.status = 'active'
     AND (v_seen IS NULL OR p.id <> ALL(v_seen))
   ORDER BY b.sold DESC NULLS LAST, p.created_at DESC
   LIMIT p_limit;
END $$;

GRANT EXECUTE ON FUNCTION public.dd_picked_for_you(text, uuid, int) TO anon, authenticated;