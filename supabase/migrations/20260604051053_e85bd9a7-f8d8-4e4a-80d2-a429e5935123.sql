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
  IF p_user_id IS NOT NULL THEN
    SELECT array_agg(product_id) INTO v_seen FROM (
      SELECT product_id FROM (
        SELECT DISTINCT ON (product_id) product_id, created_at
          FROM public.product_views
         WHERE user_id = p_user_id
         ORDER BY product_id, created_at DESC
      ) s ORDER BY s.created_at DESC LIMIT 50
    ) t;
  ELSIF p_visitor_id IS NOT NULL THEN
    SELECT array_agg(product_id) INTO v_seen FROM (
      SELECT product_id FROM (
        SELECT DISTINCT ON (product_id) product_id, created_at
          FROM public.product_views
         WHERE visitor_id = p_visitor_id
         ORDER BY product_id, created_at DESC
      ) s ORDER BY s.created_at DESC LIMIT 50
    ) t;
  END IF;

  v_hit_count := COALESCE(array_length(v_seen, 1), 0);

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
      SELECT moi.product_id, (COUNT(*)::int * 2) AS score
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