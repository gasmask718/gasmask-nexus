DROP POLICY IF EXISTS "dd return photos admin read" ON storage.objects;
CREATE POLICY "dd return photos admin read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'dd-return-photos'
     AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)));

CREATE UNIQUE INDEX IF NOT EXISTS dd_supplier_metrics_period_key
  ON public.dd_supplier_metrics(wholesaler_id, period_start, period_end);

CREATE OR REPLACE FUNCTION public.dd_apply_return_to_metrics(p_return_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_start date;
  v_end date;
  v_orders integer;
BEGIN
  SELECT * INTO r FROM public.dd_returns WHERE id = p_return_id;
  IF r IS NULL OR r.wholesaler_id IS NULL THEN RETURN; END IF;

  v_start := date_trunc('month', now())::date;
  v_end := (date_trunc('month', now()) + interval '1 month - 1 day')::date;

  INSERT INTO public.dd_supplier_metrics (wholesaler_id, period_start, period_end, returns_total, returns_fault)
  VALUES (r.wholesaler_id, v_start, v_end, 1, CASE WHEN r.is_fault_return THEN 1 ELSE 0 END)
  ON CONFLICT (wholesaler_id, period_start, period_end) DO UPDATE
    SET returns_total = public.dd_supplier_metrics.returns_total + 1,
        returns_fault = public.dd_supplier_metrics.returns_fault + CASE WHEN r.is_fault_return THEN 1 ELSE 0 END,
        calculated_at = now();

  SELECT count(*) INTO v_orders
    FROM public.marketplace_orders o
   WHERE o.wholesaler_id = r.wholesaler_id
     AND o.created_at >= v_start;

  UPDATE public.dd_supplier_metrics m
     SET return_rate = CASE WHEN COALESCE(v_orders,0) > 0
                            THEN round((m.returns_total::numeric / v_orders) * 100, 2)
                            ELSE NULL END
   WHERE m.wholesaler_id = r.wholesaler_id
     AND m.period_start = v_start
     AND m.period_end = v_end;
END;
$$;
REVOKE ALL ON FUNCTION public.dd_apply_return_to_metrics(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.dd_apply_return_to_metrics(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.dd_pending_clawback_cents(p_wholesaler_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount_cents), 0)::bigint
    FROM public.dd_wholesaler_clawbacks
   WHERE wholesaler_id = p_wholesaler_id AND status = 'pending';
$$;
REVOKE ALL ON FUNCTION public.dd_pending_clawback_cents(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dd_pending_clawback_cents(uuid) TO authenticated, service_role;