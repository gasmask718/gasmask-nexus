
-- ═══════════════════════════════════════════════════════════════════
-- v_store_last_order_snapshot
-- Derived intelligence view: most recent order per store × brand
-- Read-only. No new tables. Always current.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.v_store_last_order_snapshot AS
WITH ranked_invoices AS (
  SELECT
    i.id AS invoice_id,
    i.store_id,
    i.brand,
    i.created_at AS order_date,
    i.total_amount,
    ROW_NUMBER() OVER (
      PARTITION BY i.store_id, LOWER(TRIM(i.brand))
      ORDER BY i.created_at DESC
    ) AS rn
  FROM public.invoices i
  WHERE i.deleted_at IS NULL
    AND i.store_id IS NOT NULL
    AND i.brand IS NOT NULL
    AND TRIM(i.brand) <> ''
),
latest_invoices AS (
  SELECT * FROM ranked_invoices WHERE rn = 1
),
line_item_agg AS (
  SELECT
    li.invoice_id,
    COALESCE(SUM(
      CASE
        WHEN li.tubes_equivalent IS NOT NULL AND li.tubes_equivalent > 0 THEN li.tubes_equivalent
        WHEN LOWER(li.unit_type) = 'box' THEN li.quantity * COALESCE(li.units_per_box_snapshot, 100)
        WHEN LOWER(li.unit_type) = 'half_box' THEN li.quantity * 50
        ELSE li.quantity
      END
    ), 0) AS total_tubes,
    COUNT(*) AS line_count
  FROM public.invoice_line_items li
  GROUP BY li.invoice_id
),
-- Rolling average: avg tubes across ALL orders for this store×brand (for comparison)
all_orders_agg AS (
  SELECT
    i.store_id,
    LOWER(TRIM(i.brand)) AS brand_key,
    COUNT(DISTINCT i.id) AS total_order_count,
    AVG(COALESCE(lia_all.total_tubes, 0)) AS avg_tubes_per_order,
    -- Avg days between orders
    CASE
      WHEN COUNT(DISTINCT i.id) >= 2
      THEN EXTRACT(EPOCH FROM (MAX(i.created_at) - MIN(i.created_at))) / 86400.0 / GREATEST(COUNT(DISTINCT i.id) - 1, 1)
      ELSE NULL
    END AS avg_days_between_orders
  FROM public.invoices i
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(
      CASE
        WHEN li2.tubes_equivalent IS NOT NULL AND li2.tubes_equivalent > 0 THEN li2.tubes_equivalent
        WHEN LOWER(li2.unit_type) = 'box' THEN li2.quantity * COALESCE(li2.units_per_box_snapshot, 100)
        WHEN LOWER(li2.unit_type) = 'half_box' THEN li2.quantity * 50
        ELSE li2.quantity
      END
    ), 0) AS total_tubes
    FROM public.invoice_line_items li2
    WHERE li2.invoice_id = i.id
  ) lia_all ON TRUE
  WHERE i.deleted_at IS NULL
    AND i.store_id IS NOT NULL
    AND i.brand IS NOT NULL
    AND TRIM(i.brand) <> ''
  GROUP BY i.store_id, LOWER(TRIM(i.brand))
)
SELECT
  li_inv.store_id,
  sm.store_name,
  li_inv.brand AS brand_name,
  LOWER(TRIM(li_inv.brand)) AS brand_key,
  li_inv.order_date AS last_order_date,
  EXTRACT(DAY FROM (NOW() - li_inv.order_date))::int AS days_since_last_order,
  COALESCE(lia.total_tubes, 0)::int AS last_order_total_units,
  ROUND(COALESCE(lia.total_tubes, 0) / 100.0, 2) AS last_order_box_equivalent,
  CASE
    WHEN COALESCE(lia.total_tubes, 0) >= 100 AND MOD(COALESCE(lia.total_tubes, 0)::int, 100) = 0
      THEN (COALESCE(lia.total_tubes, 0)::int / 100)::text || ' Full Box' || CASE WHEN COALESCE(lia.total_tubes, 0)::int > 100 THEN 'es' ELSE '' END
    WHEN COALESCE(lia.total_tubes, 0) = 50
      THEN 'Half Box'
    ELSE COALESCE(lia.total_tubes, 0)::int::text || ' Tubes'
  END AS last_order_size_label,
  li_inv.total_amount AS last_order_total_amount,
  lia.line_count AS last_order_line_count,
  aoa.total_order_count,
  ROUND(COALESCE(aoa.avg_tubes_per_order, 0))::int AS avg_tubes_per_order,
  ROUND(COALESCE(aoa.avg_days_between_orders, 0))::int AS avg_days_between_orders,
  -- Operational flags
  CASE
    WHEN aoa.avg_days_between_orders IS NOT NULL
      AND EXTRACT(DAY FROM (NOW() - li_inv.order_date)) > aoa.avg_days_between_orders * 1.5
      THEN TRUE
    ELSE FALSE
  END AS is_restock_due,
  CASE
    WHEN aoa.avg_tubes_per_order IS NOT NULL
      AND aoa.avg_tubes_per_order > 0
      AND COALESCE(lia.total_tubes, 0) < aoa.avg_tubes_per_order * 0.7
      THEN TRUE
    ELSE FALSE
  END AS is_order_smaller_than_usual
FROM latest_invoices li_inv
LEFT JOIN public.store_master sm ON sm.id = li_inv.store_id
LEFT JOIN line_item_agg lia ON lia.invoice_id = li_inv.invoice_id
LEFT JOIN all_orders_agg aoa ON aoa.store_id = li_inv.store_id AND aoa.brand_key = LOWER(TRIM(li_inv.brand));
