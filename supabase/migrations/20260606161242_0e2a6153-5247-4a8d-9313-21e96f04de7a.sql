
-- 1) Clean up stale dormant backfill rows so pipeline panel starts clean
ALTER TABLE public.bag_sale_ledger DISABLE TRIGGER trg_bag_ledger_no_delete;
DELETE FROM public.bag_sale_ledger WHERE source = 'backfill_finalized';
ALTER TABLE public.bag_sale_ledger ENABLE TRIGGER trg_bag_ledger_no_delete;

-- 2) finalize_invoice: normalize ledger sources to 'invoice_finalized' for both tubes and bags.
--    Preserves draft_ai rejection guard.
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT 'manual'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_use_canonical boolean;
  v_units numeric;
  v_line record;
  v_cost_layer record;
  v_remaining int;
  v_consume int;
  v_store_id uuid;
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status FROM invoices WHERE id = p_invoice_id;

  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_current_status = 'finalized' THEN
    RETURN json_build_object('success', true, 'already_finalized', true, 'invoice_id', p_invoice_id, 'message', 'Invoice was already finalized. No duplicate entries created.');
  END IF;

  IF v_current_status = 'voided' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot finalize a voided invoice');
  END IF;

  -- draft_ai requires human approval first (flips to 'draft' via approve_ai_draft_invoice)
  IF v_current_status = 'draft_ai' THEN
    RETURN json_build_object('success', false, 'error', 'AI-drafted invoice requires human review and approval before finalization');
  END IF;

  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;
  SELECT store_id INTO v_store_id FROM invoices WHERE id = p_invoice_id;

  FOR v_line IN
    SELECT li.id, li.invoice_id, li.product_id, li.product_name,
           li.brand_id, li.brand, li.line_subtotal,
           li.computed_tubes_total, li.computed_units_total,
           p.track_by
    FROM invoice_line_items li
    LEFT JOIN products p ON p.id = li.product_id
    WHERE li.invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line.computed_units_total, v_line.computed_tubes_total)
      ELSE COALESCE(v_line.computed_tubes_total, v_line.computed_units_total)
    END;
    IF v_line.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (invoice_id, line_item_id, store_id, brand_id, brand, product_id, product_name, tubes_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'invoice_finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'invoice_finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
    v_remaining := ABS(v_units)::int;
    FOR v_cost_layer IN
      SELECT id, unit_cost, units_in, units_consumed FROM inventory_cost_ledger
      WHERE product_id = v_line.product_id AND units_consumed < units_in
      ORDER BY received_at ASC, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consume := LEAST(v_remaining, v_cost_layer.units_in - v_cost_layer.units_consumed);
      INSERT INTO cogs_ledger (invoice_id, line_item_id, product_id, product_name, cost_layer_id, units_consumed, unit_cost, total_cost, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_line.product_id, v_line.product_name, v_cost_layer.id, v_consume, v_cost_layer.unit_cost, v_consume * v_cost_layer.unit_cost, 'invoice_finalized', p_user_id)
      ON CONFLICT (invoice_id, line_item_id, product_id, cost_layer_id) DO NOTHING;
      UPDATE inventory_cost_ledger SET units_consumed = units_consumed + v_consume WHERE id = v_cost_layer.id;
      v_remaining := v_remaining - v_consume;
    END LOOP;
  END LOOP;

  UPDATE invoices SET
    subtotal = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total_amount = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    status = 'finalized', finalized_at = now(), finalized_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id, 'flag_used', v_use_canonical, 'message', 'Invoice finalized with COGS allocation');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- 3) Tube views: exclude bag SKUs so bag sales no longer double-count as tubes.

-- 3a) v_invoice_effective_tubes — only sum tube-tracked line items
CREATE OR REPLACE VIEW public.v_invoice_effective_tubes AS
 SELECT ili.invoice_id,
    inv.invoice_number,
    inv.total,
    inv.business_date AS invoice_date,
    sum(ili.quantity) AS tube_count,
    'live_line_item'::text AS source,
    NULL::text AS confidence_level
   FROM invoice_line_items ili
     JOIN invoices inv ON inv.id = ili.invoice_id
     LEFT JOIN products p ON p.id = ili.product_id
  WHERE inv.status = 'finalized'::text
    AND inv.deleted_at IS NULL
    AND COALESCE(p.track_by, 'tubes') <> 'bags'
  GROUP BY ili.invoice_id, inv.invoice_number, inv.total, inv.business_date
UNION ALL
 SELECT hlr.invoice_id,
    inv.invoice_number,
    inv.total,
    inv.business_date AS invoice_date,
    hlr.unit_count AS tube_count,
        CASE
            WHEN hlr.attribution_method = 'price_map_auto'::text THEN 'price_map_auto'::text
            ELSE 'historical_exact_repair'::text
        END AS source,
    hlr.confidence_level
   FROM historical_invoice_line_repairs hlr
     JOIN invoices inv ON inv.id = hlr.invoice_id
  WHERE hlr.attribution_method = ANY (ARRAY['manual_exact'::text, 'price_map_auto'::text])
    AND hlr.unit_count IS NOT NULL
    AND inv.status = 'finalized'::text
    AND inv.deleted_at IS NULL
    AND NOT (hlr.invoice_id IN ( SELECT DISTINCT invoice_line_items.invoice_id FROM invoice_line_items ));

-- 3b) v_store_tube_kpi — exclude bag SKUs from the last_orders join so bag sales
--     don't surface as a tube-brand "last ordered" signal.
CREATE OR REPLACE VIEW public.v_store_tube_kpi AS
 WITH tube_counts AS (
         SELECT sti.store_id,
            lower(sti.brand) AS brand_id,
            sti.brand AS brand_name,
            COALESCE(sti.current_tubes_left, 0) AS tube_count,
            sti.last_updated
           FROM store_tube_inventory sti
          WHERE sti.brand IS NOT NULL
        ), intel_status AS (
         SELECT stis.store_id,
            stis.brand_id,
            stis.brand_name,
            stis.needs_order,
            stis.bring_samples,
            stis.bring_starter_kit,
            stis.owner_interested,
            stis.has_ever_ordered,
            stis.is_simulation
           FROM store_tube_inventory_status stis
          WHERE stis.is_simulation = false
        ), last_orders AS (
         SELECT i.store_id,
            lower(ili.brand) AS brand_id,
            max(i.created_at) AS last_order_date
           FROM invoices i
             JOIN invoice_line_items ili ON ili.invoice_id = i.id
             LEFT JOIN products p ON p.id = ili.product_id
          WHERE i.payment_status = ANY (ARRAY['paid'::text, 'partial'::text])
            AND ili.brand IS NOT NULL
            AND i.store_id IS NOT NULL
            AND COALESCE(p.track_by, 'tubes') <> 'bags'
          GROUP BY i.store_id, lower(ili.brand)
        ), all_store_brands AS (
         SELECT tube_counts.store_id, tube_counts.brand_id FROM tube_counts
        UNION
         SELECT intel_status.store_id, intel_status.brand_id FROM intel_status
        UNION
         SELECT last_orders.store_id, last_orders.brand_id FROM last_orders
        )
 SELECT asb.store_id,
    asb.brand_id,
    COALESCE(tc.brand_name, ist.brand_name, initcap(asb.brand_id)) AS brand_name,
    COALESCE(tc.tube_count, 0) AS tube_count,
    lo.last_order_date,
        CASE
            WHEN lo.last_order_date IS NULL THEN 'Never ordered'::text
            ELSE to_char(lo.last_order_date::timestamp without time zone, 'Mon DD, YYYY'::text)
        END AS last_order_label,
        CASE
            WHEN COALESCE(tc.tube_count, 0) = 0 THEN 'red'::text
            WHEN lo.last_order_date IS NOT NULL THEN 'green'::text
            WHEN lo.last_order_date IS NULL AND COALESCE(tc.tube_count, 0) > 0 THEN 'yellow'::text
            ELSE 'muted'::text
        END AS color_status,
    COALESCE(ist.needs_order, false) AS needs_order,
    COALESCE(ist.bring_samples, false) AS bring_samples,
    COALESCE(ist.bring_starter_kit, false) AS bring_starter_kit,
    ist.owner_interested,
    tc.last_updated AS inventory_updated_at
   FROM all_store_brands asb
     LEFT JOIN tube_counts tc ON tc.store_id = asb.store_id AND tc.brand_id = asb.brand_id
     LEFT JOIN intel_status ist ON ist.store_id = asb.store_id AND ist.brand_id = asb.brand_id
     LEFT JOIN last_orders lo ON lo.store_id = asb.store_id AND lo.brand_id = asb.brand_id;
