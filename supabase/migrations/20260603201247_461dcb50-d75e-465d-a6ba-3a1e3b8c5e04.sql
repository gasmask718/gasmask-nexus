
ALTER TABLE public.pending_route_stops
  ADD COLUMN IF NOT EXISTS signal_source text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS priority integer,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS business text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'prs_signal_source_chk') THEN
    ALTER TABLE public.pending_route_stops
      ADD CONSTRAINT prs_signal_source_chk
      CHECK (signal_source IS NULL OR signal_source = ANY (ARRAY[
        'ai_score','sell_through','brand_crm','opportunities',
        'ai_call_outcome','sms_outcome','manual_disposition','owner_order',
        'coverage_gap','manual'
      ]));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_prs_signal_source ON public.pending_route_stops(signal_source);
CREATE INDEX IF NOT EXISTS idx_prs_open_store_reason
  ON public.pending_route_stops(store_id, reason)
  WHERE status = 'pending_approval';

DROP VIEW IF EXISTS public.v_route_candidates;

CREATE VIEW public.v_route_candidates AS
  SELECT s.id AS store_id, s.name AS store_name, s.address_street AS address, s.address_city AS city,
         s.neighborhood, s.boro,
         'reorder'::text AS candidate_type,
         'inventory'::text AS signal_source,
         'Low stock — needs reorder'::text AS reason,
         'Low stock — needs reorder'::text AS why,
         3 AS priority, 0::numeric AS value,
         s.last_visit_date, max(t.last_updated_at) AS signal_at
    FROM stores s
    JOIN store_tube_inventory_status t ON t.store_id = s.id AND t.needs_order = true
   WHERE s.deleted_at IS NULL AND s.approval_status = 'approved'
   GROUP BY s.id
  UNION ALL
  SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
         COALESCE(prs.signal_source, 'owner_order')::text,
         COALESCE(prs.signal_source, 'owner_order')::text,
         COALESCE(prs.reason, prs.intent_summary, 'Owner requested order')::text,
         COALESCE(prs.reason, prs.intent_summary, 'Owner requested order')::text,
         COALESCE(prs.priority, CASE prs.urgency WHEN 'today' THEN 5 WHEN 'this_week' THEN 4 ELSE 3 END),
         COALESCE(prs.estimated_revenue, 0::numeric),
         s.last_visit_date, prs.created_at
    FROM pending_route_stops prs
    JOIN stores s ON s.id = prs.store_id
   WHERE prs.status = 'pending_approval' AND s.deleted_at IS NULL
  UNION ALL
  SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
         'collect_payment'::text, 'invoices'::text,
         ('Unpaid balance: $' || round(sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), 2)::text),
         ('Unpaid balance: $' || round(sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)), 2)::text),
         4, sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)),
         s.last_visit_date, max(i.created_at)
    FROM invoices i JOIN stores s ON s.id = i.store_id
   WHERE i.payment_status IN ('unpaid','partial') AND s.deleted_at IS NULL
   GROUP BY s.id
  HAVING sum(COALESCE(i.total_amount, i.total, 0) - COALESCE(i.amount_paid, 0)) > 0
  UNION ALL
  SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
         'follow_up'::text, 'follow_up_queue'::text,
         COALESCE(fq.reason, 'Follow-up scheduled')::text,
         COALESCE(fq.reason, 'Follow-up scheduled')::text,
         COALESCE(fq.priority, 3), 0::numeric,
         s.last_visit_date, fq.created_at
    FROM follow_up_queue fq JOIN stores s ON s.id = fq.store_id
   WHERE COALESCE(fq.status, 'pending') = 'pending' AND s.deleted_at IS NULL
  UNION ALL
  SELECT s.id, s.name, s.address_street, s.address_city, s.neighborhood, s.boro,
         'prospect'::text, 'prospect'::text,
         'Prospect — no visit in 30+ days'::text,
         'Prospect — no visit in 30+ days'::text,
         2, 0::numeric,
         s.last_visit_date, s.updated_at
    FROM stores s
   WHERE s.deleted_at IS NULL AND s.status = 'prospect'
     AND (s.last_visit_date IS NULL OR s.last_visit_date < now() - interval '30 days');

GRANT SELECT ON public.v_route_candidates TO authenticated;
GRANT SELECT ON public.v_route_candidates TO service_role;

CREATE OR REPLACE FUNCTION public.promote_store_to_route_board(
  _store_id uuid,
  _signal_source text,
  _reason text,
  _source_ref text DEFAULT NULL,
  _business text DEFAULT NULL,
  _priority integer DEFAULT 3,
  _estimated_revenue numeric DEFAULT NULL,
  _urgency text DEFAULT 'this_week',
  _intent_summary text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing uuid;
  _new_id uuid;
  _store_name text;
BEGIN
  IF _store_id IS NULL OR _signal_source IS NULL OR _reason IS NULL THEN
    RAISE EXCEPTION 'store_id, signal_source, and reason are required';
  END IF;

  SELECT id INTO _existing
    FROM public.pending_route_stops
   WHERE store_id = _store_id
     AND status = 'pending_approval'
     AND signal_source IS NOT DISTINCT FROM _signal_source
     AND reason IS NOT DISTINCT FROM _reason
   LIMIT 1;

  IF _existing IS NOT NULL THEN
    RETURN _existing;
  END IF;

  SELECT name INTO _store_name FROM public.stores WHERE id = _store_id;

  INSERT INTO public.pending_route_stops (
    store_id, store_name, signal_source, reason, source_ref, business,
    priority, estimated_revenue, urgency, intent_summary, status, ai_payload
  ) VALUES (
    _store_id, _store_name, _signal_source, _reason, _source_ref, _business,
    COALESCE(_priority, 3), _estimated_revenue, _urgency,
    COALESCE(_intent_summary, _reason), 'pending_approval',
    jsonb_build_object('source', _signal_source, 'source_ref', _source_ref)
  )
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_store_to_route_board(uuid, text, text, text, text, integer, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_store_to_route_board(uuid, text, text, text, text, integer, numeric, text, text) TO service_role;
