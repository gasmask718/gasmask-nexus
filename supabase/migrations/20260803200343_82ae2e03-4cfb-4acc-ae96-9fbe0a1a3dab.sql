-- 1) Trigger: key off business_date (fallback created_at) and recompute so corrections can move dates EARLIER
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_order_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_store uuid := COALESCE(NEW.store_id, OLD.store_id);
  v_max timestamptz;
BEGIN
  IF v_store IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT MAX(COALESCE(i.business_date::timestamptz, i.created_at))
    INTO v_max
  FROM public.invoices i
  WHERE i.store_id = v_store
    AND i.deleted_at IS NULL;

  UPDATE public.store_master
     SET last_order_at = v_max
   WHERE id = v_store
     AND last_order_at IS DISTINCT FROM v_max;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

DROP TRIGGER IF EXISTS trg_invoices_bump_last_order_at ON public.invoices;
CREATE TRIGGER trg_invoices_bump_last_order_at
AFTER INSERT OR UPDATE OF business_date, created_at, deleted_at, store_id OR DELETE
ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.trg_bump_store_last_order_at();

-- 2) Backfill every store from corrected dates
WITH newmax AS (
  SELECT store_id, MAX(COALESCE(business_date::timestamptz, created_at)) AS nd
  FROM public.invoices
  WHERE deleted_at IS NULL AND store_id IS NOT NULL
  GROUP BY store_id
)
UPDATE public.store_master sm
   SET last_order_at = n.nd
  FROM newmax n
 WHERE sm.id = n.store_id
   AND sm.last_order_at IS DISTINCT FROM n.nd;

-- 3) Snapshot view: order_date now business_date-based
CREATE OR REPLACE VIEW public.v_store_last_order_snapshot AS
 WITH ranked_invoices AS (
         SELECT i.id AS invoice_id,
            i.store_id,
            i.brand,
            COALESCE(i.business_date::timestamptz, i.created_at) AS order_date,
            i.total_amount,
            row_number() OVER (PARTITION BY i.store_id, (lower(TRIM(BOTH FROM i.brand))) ORDER BY COALESCE(i.business_date::timestamptz, i.created_at) DESC) AS rn
           FROM invoices i
          WHERE i.deleted_at IS NULL AND i.store_id IS NOT NULL AND i.brand IS NOT NULL AND TRIM(BOTH FROM i.brand) <> ''::text
        ), latest_invoices AS (
         SELECT ranked_invoices.invoice_id,
            ranked_invoices.store_id,
            ranked_invoices.brand,
            ranked_invoices.order_date,
            ranked_invoices.total_amount,
            ranked_invoices.rn
           FROM ranked_invoices
          WHERE ranked_invoices.rn = 1
        ), line_item_agg AS (
         SELECT li.invoice_id,
            COALESCE(sum(
                CASE
                    WHEN li.tubes_equivalent IS NOT NULL AND li.tubes_equivalent > 0::numeric THEN li.tubes_equivalent
                    WHEN lower(li.unit_type) = 'box'::text THEN li.quantity * COALESCE(li.units_per_box_snapshot, 100)::numeric
                    WHEN lower(li.unit_type) = 'half_box'::text THEN li.quantity * 50::numeric
                    ELSE li.quantity
                END), 0::numeric) AS total_tubes,
            count(*) AS line_count
           FROM invoice_line_items li
          GROUP BY li.invoice_id
        ), all_orders_agg AS (
         SELECT i.store_id,
            lower(TRIM(BOTH FROM i.brand)) AS brand_key,
            count(DISTINCT i.id) AS total_order_count,
            avg(COALESCE(lia_all.total_tubes, 0::numeric)) AS avg_tubes_per_order,
                CASE
                    WHEN count(DISTINCT i.id) >= 2 THEN EXTRACT(epoch FROM max(COALESCE(i.business_date::timestamptz, i.created_at)) - min(COALESCE(i.business_date::timestamptz, i.created_at))) / 86400.0 / GREATEST(count(DISTINCT i.id) - 1, 1::bigint)::numeric
                    ELSE NULL::numeric
                END AS avg_days_between_orders
           FROM invoices i
             LEFT JOIN LATERAL ( SELECT COALESCE(sum(
                        CASE
                            WHEN li2.tubes_equivalent IS NOT NULL AND li2.tubes_equivalent > 0::numeric THEN li2.tubes_equivalent
                            WHEN lower(li2.unit_type) = 'box'::text THEN li2.quantity * COALESCE(li2.units_per_box_snapshot, 100)::numeric
                            WHEN lower(li2.unit_type) = 'half_box'::text THEN li2.quantity * 50::numeric
                            ELSE li2.quantity
                        END), 0::numeric) AS total_tubes
                   FROM invoice_line_items li2
                  WHERE li2.invoice_id = i.id) lia_all ON true
          WHERE i.deleted_at IS NULL AND i.store_id IS NOT NULL AND i.brand IS NOT NULL AND TRIM(BOTH FROM i.brand) <> ''::text
          GROUP BY i.store_id, (lower(TRIM(BOTH FROM i.brand)))
        )
 SELECT li_inv.store_id,
    sm.store_name,
    li_inv.brand AS brand_name,
    lower(TRIM(BOTH FROM li_inv.brand)) AS brand_key,
    li_inv.order_date AS last_order_date,
    EXTRACT(day FROM now() - li_inv.order_date)::integer AS days_since_last_order,
    COALESCE(lia.total_tubes, 0::numeric)::integer AS last_order_total_units,
    round(COALESCE(lia.total_tubes, 0::numeric) / 100.0, 2) AS last_order_box_equivalent,
        CASE
            WHEN COALESCE(lia.total_tubes, 0::numeric) >= 100::numeric AND mod(COALESCE(lia.total_tubes, 0::numeric)::integer, 100) = 0 THEN (((COALESCE(lia.total_tubes, 0::numeric)::integer / 100)::text) || ' Full Box'::text) ||
            CASE
                WHEN COALESCE(lia.total_tubes, 0::numeric)::integer > 100 THEN 'es'::text
                ELSE ''::text
            END
            WHEN COALESCE(lia.total_tubes, 0::numeric) = 50::numeric THEN 'Half Box'::text
            ELSE COALESCE(lia.total_tubes, 0::numeric)::integer::text || ' Tubes'::text
        END AS last_order_size_label,
    li_inv.total_amount AS last_order_total_amount,
    lia.line_count AS last_order_line_count,
    aoa.total_order_count,
    round(COALESCE(aoa.avg_tubes_per_order, 0::numeric))::integer AS avg_tubes_per_order,
    round(COALESCE(aoa.avg_days_between_orders, 0::numeric))::integer AS avg_days_between_orders,
        CASE
            WHEN aoa.avg_days_between_orders IS NOT NULL AND EXTRACT(day FROM now() - li_inv.order_date) > (aoa.avg_days_between_orders * 1.5) THEN true
            ELSE false
        END AS is_restock_due,
        CASE
            WHEN aoa.avg_tubes_per_order IS NOT NULL AND aoa.avg_tubes_per_order > 0::numeric AND COALESCE(lia.total_tubes, 0::numeric) < (aoa.avg_tubes_per_order * 0.7) THEN true
            ELSE false
        END AS is_order_smaller_than_usual
   FROM latest_invoices li_inv
     LEFT JOIN store_master sm ON sm.id = li_inv.store_id
     LEFT JOIN line_item_agg lia ON lia.invoice_id = li_inv.invoice_id
     LEFT JOIN all_orders_agg aoa ON aoa.store_id = li_inv.store_id AND aoa.brand_key = lower(TRIM(BOTH FROM li_inv.brand));