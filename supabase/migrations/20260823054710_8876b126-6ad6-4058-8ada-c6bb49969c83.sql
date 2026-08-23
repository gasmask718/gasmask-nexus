CREATE OR REPLACE VIEW public.v_routes_overview AS
SELECT
  r.id AS route_id,
  r.date,
  r.type,
  r.status,
  r.route_state,
  COALESCE(NULLIF(btrim(r.name), ''), initcap(r.type) || ' route · ' || to_char(r.date::timestamptz, 'DD Mon YYYY')) AS route_name,
  r.assigned_to,
  COALESCE(
    (SELECT a.name FROM ambassadors a WHERE a.user_id = r.assigned_to LIMIT 1),
    (SELECT d.full_name FROM drivers d WHERE d.user_id = r.assigned_to LIMIT 1),
    (SELECT b.full_name FROM bikers b WHERE b.user_id = r.assigned_to LIMIT 1),
    (SELECT p.name FROM profiles p WHERE p.id = r.assigned_to LIMIT 1),
    (SELECT p.email FROM profiles p WHERE p.id = r.assigned_to LIMIT 1)
  ) AS worker_name,
  CASE WHEN r.assigned_to IS NULL THEN 'UNASSIGNED — nobody is running this route' ELSE 'assigned' END AS assignment_state,
  r.total_stops,
  (SELECT count(*) FROM route_stops s WHERE s.route_id = r.id) AS stops,
  (SELECT count(*) FROM route_stops s WHERE s.route_id = r.id AND s.status = 'completed') AS done,
  (SELECT count(*) FROM route_stops s WHERE s.route_id = r.id AND s.status = ANY (ARRAY['planned','pending','in_progress'])) AS remaining,
  (SELECT round(sum(COALESCE(i.total_amount, 0) - COALESCE(i.amount_paid, 0)))
     FROM route_stops s
     JOIN invoices i ON i.store_id = s.store_id AND i.deleted_at IS NULL AND i.revenue_role = 'sale' AND i.payment_status IS DISTINCT FROM 'paid'
    WHERE s.route_id = r.id) AS money_on_this_route,
  (SELECT string_agg(sm.store_name, ' · ' ORDER BY s.planned_order)
     FROM route_stops s JOIN store_master sm ON sm.id = s.store_id
    WHERE s.route_id = r.id) AS stop_list,
  r.created_at,
  r.territory,
  r.brand_ids
FROM routes r
WHERE public.is_staff(auth.uid()) OR r.assigned_to = auth.uid();

GRANT SELECT ON public.v_routes_overview TO authenticated;
GRANT SELECT ON public.v_routes_overview TO service_role;

CREATE OR REPLACE VIEW public.v_office_material_balance AS
WITH issued AS (
  SELECT s.office_id, i_1.material_type, i_1.brand, max(i_1.unit) AS unit,
         sum(i_1.quantity) AS total_issued,
         sum(COALESCE(i_1.received_quantity, 0)) AS total_received,
         sum(COALESCE(i_1.total_cost, 0)) AS total_issued_cost
    FROM production_office_shipment_items i_1
    JOIN production_office_shipments s ON s.id = i_1.shipment_id
   WHERE s.status <> 'disputed'
   GROUP BY s.office_id, i_1.material_type, i_1.brand
), consumed AS (
  SELECT b.office_id, 'empty_tubes'::text AS material_type, o_1.brand, sum(o_1.tubes_used)::numeric AS qty
    FROM production_batch_outputs o_1 JOIN production_batches b ON b.id = o_1.batch_id
   WHERE b.office_id IS NOT NULL GROUP BY b.office_id, o_1.brand
  UNION ALL
  SELECT b.office_id, 'stickers'::text, o_1.brand, sum(o_1.stickers_used)::numeric
    FROM production_batch_outputs o_1 JOIN production_batches b ON b.id = o_1.batch_id
   WHERE b.office_id IS NOT NULL GROUP BY b.office_id, o_1.brand
  UNION ALL
  SELECT b.office_id, 'empty_boxes'::text, o_1.brand, sum(o_1.empty_boxes_used)::numeric
    FROM production_batch_outputs o_1 JOIN production_batches b ON b.id = o_1.batch_id
   WHERE b.office_id IS NOT NULL GROUP BY b.office_id, o_1.brand
  UNION ALL
  SELECT m.office_id,
         CASE m.material_type::text WHEN 'tobacco_lbs' THEN 'tobacco' WHEN 'tubes' THEN 'empty_tubes' WHEN 'boxes' THEN 'empty_boxes' ELSE m.material_type::text END,
         NULL::text, sum(m.quantity_used)
    FROM production_material_usage m GROUP BY m.office_id, m.material_type
), consumed_rollup AS (
  SELECT office_id, material_type, brand, sum(qty) AS total_consumed
    FROM consumed GROUP BY office_id, material_type, brand
)
SELECT
  COALESCE(i.office_id, c.office_id) AS office_id,
  o.name AS office_name,
  COALESCE(i.material_type, c.material_type) AS material_type,
  COALESCE(i.brand, c.brand) AS brand,
  i.unit,
  COALESCE(i.total_issued, 0) AS total_issued,
  COALESCE(i.total_received, 0) AS total_received,
  COALESCE(c.total_consumed, 0) AS total_consumed,
  COALESCE(i.total_issued, 0) - COALESCE(c.total_consumed, 0) AS expected_on_hand,
  CASE WHEN public.production_core_staff(auth.uid())
       THEN COALESCE(i.total_issued_cost, 0)
       ELSE NULL::numeric END AS total_issued_cost
FROM issued i
FULL JOIN consumed_rollup c ON c.office_id = i.office_id AND c.material_type = i.material_type AND c.brand IS NOT DISTINCT FROM i.brand
LEFT JOIN production_offices o ON o.id = COALESCE(i.office_id, c.office_id)
WHERE public.production_office_member(auth.uid(), COALESCE(i.office_id, c.office_id));