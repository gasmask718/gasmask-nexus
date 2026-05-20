
-- 1. Store master additions
ALTER TABLE public.store_master
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS owner_name_arabic text;

-- 2. Store notes ambassador scope
ALTER TABLE public.store_notes
  ADD COLUMN IF NOT EXISTS ambassador_id uuid REFERENCES public.ambassadors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_store_notes_ambassador ON public.store_notes(ambassador_id);

-- 3. RPC: get_store_context
CREATE OR REPLACE FUNCTION public.get_store_context(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ambassador_id uuid;
  v_is_admin boolean := false;
  v_has_access boolean := false;
  v_store jsonb;
  v_stats jsonb;
  v_recent_orders jsonb;
  v_preferred_products jsonb;
  v_visits jsonb;
  v_comm jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Admin check
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_user_id AND role IN ('admin','super_admin','owner')
    ) INTO v_is_admin;
  EXCEPTION WHEN OTHERS THEN
    v_is_admin := false;
  END;

  SELECT id INTO v_ambassador_id FROM public.ambassadors WHERE user_id = v_user_id LIMIT 1;

  IF v_is_admin THEN
    v_has_access := true;
  ELSIF v_ambassador_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.ambassador_assignments
      WHERE ambassador_id = v_ambassador_id AND store_id = p_store_id AND active = true
    ) INTO v_has_access;
  END IF;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Access denied for store %', p_store_id;
  END IF;

  -- Store header
  SELECT to_jsonb(s) - 'deleted_at' - 'deleted_by'
    INTO v_store
  FROM (
    SELECT
      id, store_name, owner_name, owner_name_arabic, phone, email, address, city, state, zip,
      borough_id, status, language_preference, preferred_channel, photo_url, notes,
      last_visit_at, last_order_at, owed_amount, assigned_ambassador_id
    FROM public.store_master
    WHERE id = p_store_id
  ) s;

  -- Order stats
  SELECT jsonb_build_object(
    'total_orders', COALESCE(COUNT(*), 0),
    'avg_order_value', COALESCE(AVG(total_amount), 0),
    'last_order_date', MAX(placed_at),
    'last_order_amount', (
      SELECT total_amount FROM public.orders
      WHERE store_id = p_store_id AND deleted_at IS NULL
      ORDER BY placed_at DESC NULLS LAST LIMIT 1
    ),
    'outstanding_balance', (
      SELECT COALESCE(SUM(balance_due), 0) FROM public.orders
      WHERE store_id = p_store_id AND deleted_at IS NULL AND payment_status <> 'paid'
    ),
    'days_since_last_order', EXTRACT(DAY FROM (now() - MAX(placed_at)))
  ) INTO v_stats
  FROM public.orders
  WHERE store_id = p_store_id AND deleted_at IS NULL;

  -- Recent orders (5)
  SELECT COALESCE(jsonb_agg(r ORDER BY r.placed_at DESC), '[]'::jsonb) INTO v_recent_orders
  FROM (
    SELECT o.id, o.placed_at, o.total_amount, o.order_status, o.payment_status,
      (SELECT COUNT(*) FROM public.store_order_items soi WHERE soi.order_id = o.id) AS item_count
    FROM public.orders o
    WHERE o.store_id = p_store_id AND o.deleted_at IS NULL
    ORDER BY o.placed_at DESC NULLS LAST
    LIMIT 5
  ) r;

  -- Preferred products (top 5 by frequency)
  SELECT COALESCE(jsonb_agg(p ORDER BY p.times_ordered DESC), '[]'::jsonb) INTO v_preferred_products
  FROM (
    SELECT
      pr.id AS product_id,
      pr.name AS product_name,
      pr.brand_id,
      COUNT(*) AS times_ordered,
      MAX(o.placed_at) AS last_ordered_at,
      SUM(soi.quantity) AS total_quantity
    FROM public.store_order_items soi
    JOIN public.orders o ON o.id = soi.order_id
    JOIN public.products pr ON pr.id = soi.product_id
    WHERE o.store_id = p_store_id AND o.deleted_at IS NULL
    GROUP BY pr.id, pr.name, pr.brand_id
    ORDER BY COUNT(*) DESC
    LIMIT 5
  ) p;

  -- Visit history (last 10)
  SELECT COALESCE(jsonb_agg(v ORDER BY v.started_at DESC), '[]'::jsonb) INTO v_visits
  FROM (
    SELECT sv.id, sv.started_at, sv.completed_at, sv.status AS outcome, sv.notes,
      sv.visited_by, sv.amount_collected, sv.visit_type
    FROM public.store_visits sv
    WHERE sv.store_id = p_store_id
    ORDER BY sv.started_at DESC
    LIMIT 10
  ) v;

  -- Communication summary
  SELECT jsonb_build_object(
    'messages_count', (SELECT COUNT(*) FROM public.communication_messages WHERE store_id = p_store_id),
    'calls_count', (SELECT COUNT(*) FROM public.communication_logs WHERE store_id = p_store_id AND channel = 'call'),
    'inbound_30d', (SELECT COUNT(*) FROM public.communication_messages WHERE store_id = p_store_id AND direction = 'inbound' AND created_at >= now() - interval '30 days'),
    'outbound_30d', (SELECT COUNT(*) FROM public.communication_messages WHERE store_id = p_store_id AND direction = 'outbound' AND created_at >= now() - interval '30 days')
  ) INTO v_comm;

  RETURN jsonb_build_object(
    'store', v_store,
    'stats', v_stats,
    'recent_orders', v_recent_orders,
    'preferred_products', v_preferred_products,
    'visits', v_visits,
    'comm_summary', v_comm,
    'viewer', jsonb_build_object('is_admin', v_is_admin, 'ambassador_id', v_ambassador_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_store_context(uuid) TO authenticated;

-- 4. RPC: schedule_ambassador_visit
CREATE OR REPLACE FUNCTION public.schedule_ambassador_visit(
  p_store_id uuid,
  p_scheduled_for timestamptz,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_ambassador_id uuid;
  v_visit_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_ambassador_id FROM public.ambassadors WHERE user_id = v_user_id LIMIT 1;

  INSERT INTO public.store_visits (store_id, visited_by, visit_type, started_at, status, notes)
  VALUES (p_store_id, v_user_id, 'scheduled', p_scheduled_for, 'scheduled', p_notes)
  RETURNING id INTO v_visit_id;

  IF v_ambassador_id IS NOT NULL THEN
    INSERT INTO public.ambassador_activity_log (ambassador_id, store_id, action_type, metadata)
    VALUES (v_ambassador_id, p_store_id, 'visit_scheduled', jsonb_build_object('scheduled_for', p_scheduled_for, 'notes', p_notes));
  END IF;

  RETURN v_visit_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.schedule_ambassador_visit(uuid, timestamptz, text) TO authenticated;
