
-- Patch writer to convert per-box purchase cost → per-tube using line item's units_per_box_snapshot.
CREATE OR REPLACE FUNCTION public.backfill_invoice_line_item_costs(
  p_from_date timestamp with time zone DEFAULT '2000-01-01 00:00:00+00'::timestamp with time zone,
  p_to_date timestamp with time zone DEFAULT now()
)
RETURNS TABLE(updated_count integer, skipped_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_updated int := 0;
  v_skipped int := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT ili.id AS line_item_id,
           aa.ambassador_id,
           ili.product_name,
           i.created_at AS invoice_date,
           ili.unit_price,
           ili.quantity,
           COALESCE(NULLIF(ili.units_per_box_snapshot, 0), 1) AS upb
    FROM invoice_line_items ili
    JOIN invoices i ON i.id = ili.invoice_id
    JOIN ambassador_assignments aa ON aa.store_id = i.store_id
      AND aa.active = true
      AND i.created_at >= COALESCE(aa.start_date::timestamptz, aa.created_at)
      AND i.created_at <= COALESCE(aa.unassigned_at, aa.end_date::timestamptz + interval '1 day', now())
    WHERE i.created_at BETWEEN p_from_date AND p_to_date
      AND (ili.cost_per_unit_at_sale IS NULL OR ili.cost_per_unit_at_sale = 0)
      AND ili.product_name IS NOT NULL
  LOOP
    DECLARE
      v_wac_per_purchase_unit numeric;
      v_wac_per_sale_unit numeric;
    BEGIN
      v_wac_per_purchase_unit := compute_ambassador_wac(rec.ambassador_id, rec.product_name, rec.invoice_date);
      -- Convert per-box purchase cost → per-tube sale cost using the line item's box size snapshot.
      -- If upb=1 the product is sold by the purchase unit (no conversion needed).
      v_wac_per_sale_unit := v_wac_per_purchase_unit / rec.upb;

      IF v_wac_per_sale_unit > 0 THEN
        UPDATE invoice_line_items
        SET cost_per_unit_at_sale = v_wac_per_sale_unit,
            profit_at_sale = (rec.unit_price * rec.quantity) - (v_wac_per_sale_unit * rec.quantity)
        WHERE id = rec.line_item_id;
        v_updated := v_updated + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    END;
  END LOOP;

  RETURN QUERY SELECT v_updated, v_skipped;
END;
$function$;
