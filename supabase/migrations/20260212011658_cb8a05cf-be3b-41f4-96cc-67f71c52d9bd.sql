
-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: COGS & MARGIN INTELLIGENCE
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── 5A: inventory_cost_ledger ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text,
  source text NOT NULL,
  source_id uuid NOT NULL,
  units_in integer NOT NULL,
  units_consumed integer NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_ledger_idempotent
  ON public.inventory_cost_ledger(source, source_id, product_id);

CREATE OR REPLACE FUNCTION public.prevent_cost_ledger_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Cost ledger rows cannot be deleted.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cost_ledger_no_delete ON public.inventory_cost_ledger;
CREATE TRIGGER trg_cost_ledger_no_delete
  BEFORE DELETE ON public.inventory_cost_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_cost_ledger_delete();

ALTER TABLE public.inventory_cost_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cost_ledger" ON public.inventory_cost_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cost_ledger" ON public.inventory_cost_ledger FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update cost_ledger" ON public.inventory_cost_ledger FOR UPDATE TO authenticated USING (true);

-- ─── 5B: cogs_ledger ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cogs_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL,
  line_item_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name text,
  cost_layer_id uuid REFERENCES public.inventory_cost_ledger(id),
  units_consumed integer NOT NULL,
  unit_cost numeric NOT NULL,
  total_cost numeric NOT NULL,
  source text NOT NULL DEFAULT 'invoice_finalized',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cogs_ledger_idempotent
  ON public.cogs_ledger(invoice_id, line_item_id, product_id, cost_layer_id);

DROP TRIGGER IF EXISTS trg_cogs_ledger_immutable_upd ON public.cogs_ledger;
CREATE TRIGGER trg_cogs_ledger_immutable_upd
  BEFORE UPDATE ON public.cogs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_cogs_ledger_immutable_del ON public.cogs_ledger;
CREATE TRIGGER trg_cogs_ledger_immutable_del
  BEFORE DELETE ON public.cogs_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

ALTER TABLE public.cogs_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read cogs_ledger" ON public.cogs_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert cogs_ledger" ON public.cogs_ledger FOR INSERT TO authenticated WITH CHECK (true);

-- ─── 5A.3: Patch receive_purchase_order with cost layer posting ─────────────

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb,
  p_notes text DEFAULT NULL,
  p_user_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt_id uuid;
  v_item jsonb;
  v_units numeric;
  v_track_by text;
  v_pack_size int;
  v_ppb int;
  v_upb int;
  v_product_id uuid;
  v_product_name text;
  v_po_item_id uuid;
  v_receive_unit text;
  v_qty numeric;
  v_unit_cost numeric;
  v_cost_per_unit numeric;
  v_items_received int := 0;
  v_total_units numeric := 0;
BEGIN
  PERFORM id FROM purchase_orders WHERE id = p_po_id FOR UPDATE;

  INSERT INTO po_receipts (purchase_order_id, received_by, notes)
  VALUES (p_po_id, p_user_id, p_notes)
  RETURNING id INTO v_receipt_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_po_item_id := (v_item->>'po_item_id')::uuid;
    v_product_id := (v_item->>'product_id')::uuid;
    v_product_name := v_item->>'product_name';
    v_track_by := COALESCE(v_item->>'track_by', 'none');
    v_receive_unit := COALESCE(v_item->>'receive_unit', 'unit');
    v_qty := (v_item->>'quantity')::numeric;
    v_pack_size := COALESCE((v_item->>'pack_size')::int, 1);
    v_ppb := (v_item->>'packs_per_box')::int;
    v_upb := (v_item->>'units_per_box')::int;
    v_unit_cost := COALESCE((v_item->>'unit_cost')::numeric, 0);

    CASE v_receive_unit
      WHEN 'unit' THEN v_units := v_qty;
      WHEN 'pack' THEN v_units := v_qty * v_pack_size;
      WHEN 'box' THEN
        IF v_ppb IS NOT NULL THEN
          v_units := v_qty * v_ppb * v_pack_size;
        ELSE
          v_units := v_qty * COALESCE(v_upb, 1);
        END IF;
    END CASE;

    INSERT INTO po_receipt_items (
      po_receipt_id, po_item_id, product_id,
      product_name_snapshot, track_by_snapshot,
      pack_size_snapshot, packs_per_box_snapshot, units_per_box_snapshot,
      receive_unit, quantity, computed_units_total
    ) VALUES (
      v_receipt_id, v_po_item_id, v_product_id,
      v_product_name, v_track_by,
      v_pack_size, v_ppb, v_upb,
      v_receive_unit, v_qty, v_units
    );

    IF v_track_by = 'tubes' THEN
      INSERT INTO tube_inventory_ledger (product_id, product_name, tubes_delta, source, source_id, recorded_by)
      VALUES (v_product_id, v_product_name, v_units::int, 'po_received', v_receipt_id, p_user_id)
      ON CONFLICT (source, source_id, product_id) DO NOTHING;
    ELSIF v_track_by = 'bags' THEN
      INSERT INTO bag_inventory_ledger (product_id, product_name, bags_delta, source, source_id, recorded_by)
      VALUES (v_product_id, v_product_name, v_units::int, 'po_received', v_receipt_id, p_user_id)
      ON CONFLICT (source, source_id, product_id) DO NOTHING;
    END IF;

    -- Phase 5: Cost layer
    IF v_units > 0 AND v_unit_cost > 0 THEN
      v_cost_per_unit := (v_qty * v_unit_cost) / v_units;
      INSERT INTO inventory_cost_ledger (
        product_id, product_name, source, source_id,
        units_in, unit_cost, recorded_by
      ) VALUES (
        v_product_id, v_product_name, 'po_received', v_receipt_id,
        v_units::int, v_cost_per_unit, p_user_id
      ) ON CONFLICT (source, source_id, product_id) DO NOTHING;
    END IF;

    IF v_po_item_id IS NOT NULL THEN
      UPDATE purchase_order_items
      SET quantity_received = COALESCE(quantity_received, 0) + v_qty
      WHERE id = v_po_item_id;
    END IF;

    v_items_received := v_items_received + 1;
    v_total_units := v_total_units + v_units;
  END LOOP;

  UPDATE purchase_orders
  SET status = CASE
    WHEN (SELECT bool_and(COALESCE(quantity_received,0) >= quantity_ordered) FROM purchase_order_items WHERE purchase_order_id = p_po_id)
    THEN 'received'
    ELSE 'partially_received'
  END,
  updated_at = now()
  WHERE id = p_po_id;

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'items_received', v_items_received,
    'total_canonical_units', v_total_units
  );
END;
$$;

-- ─── 5C: FIFO in finalize_invoice (join products for track_by, invoices for store_id) ──

CREATE OR REPLACE FUNCTION public.finalize_invoice(
  p_invoice_id uuid,
  p_user_id text DEFAULT 'manual'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_use_canonical boolean;
  v_units numeric;
  v_line record;
  v_cost_layer record;
  v_remaining int;
  v_consume int;
  v_store_id uuid;
BEGIN
  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;

  -- Get store_id from the invoice
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

    -- Post to sale ledger
    IF v_line.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (invoice_id, line_item_id, store_id, brand_id, brand, product_id, product_name, tubes_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Phase 5C: FIFO cost allocation
    v_remaining := ABS(v_units)::int;

    FOR v_cost_layer IN
      SELECT id, unit_cost, units_in, units_consumed
      FROM inventory_cost_ledger
      WHERE product_id = v_line.product_id
        AND units_consumed < units_in
      ORDER BY received_at ASC, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;

      v_consume := LEAST(v_remaining, v_cost_layer.units_in - v_cost_layer.units_consumed);

      INSERT INTO cogs_ledger (
        invoice_id, line_item_id, product_id, product_name,
        cost_layer_id, units_consumed, unit_cost, total_cost,
        source, recorded_by
      ) VALUES (
        v_line.invoice_id, v_line.id, v_line.product_id, v_line.product_name,
        v_cost_layer.id, v_consume, v_cost_layer.unit_cost, v_consume * v_cost_layer.unit_cost,
        'invoice_finalized', p_user_id
      ) ON CONFLICT (invoice_id, line_item_id, product_id, cost_layer_id) DO NOTHING;

      UPDATE inventory_cost_ledger
      SET units_consumed = units_consumed + v_consume
      WHERE id = v_cost_layer.id;

      v_remaining := v_remaining - v_consume;
    END LOOP;
  END LOOP;

  UPDATE invoices SET status = 'finalized', updated_at = now() WHERE id = p_invoice_id;

  RETURN json_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'flag_used', v_use_canonical,
    'message', 'Invoice finalized with COGS allocation'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ─── 5D: Margin Views (join invoices for store_id, products for track_by) ──

CREATE OR REPLACE VIEW public.v_invoice_line_margin AS
SELECT
  li.invoice_id,
  li.id AS line_item_id,
  li.product_id,
  li.product_name,
  inv.store_id,
  li.brand_id,
  li.brand,
  li.line_subtotal AS revenue,
  COALESCE(cogs.total_cogs, 0) AS cogs,
  li.line_subtotal - COALESCE(cogs.total_cogs, 0) AS gross_profit,
  CASE WHEN li.line_subtotal > 0
    THEN ROUND((li.line_subtotal - COALESCE(cogs.total_cogs, 0)) / li.line_subtotal, 4)
    ELSE 0
  END AS margin_pct
FROM invoice_line_items li
JOIN invoices inv ON inv.id = li.invoice_id
LEFT JOIN (
  SELECT line_item_id, SUM(total_cost) AS total_cogs
  FROM cogs_ledger GROUP BY line_item_id
) cogs ON cogs.line_item_id = li.id
WHERE inv.status = 'finalized';

CREATE OR REPLACE VIEW public.v_margin_per_product AS
SELECT product_id, product_name,
  SUM(revenue) AS total_revenue, SUM(cogs) AS total_cogs,
  SUM(gross_profit) AS total_profit,
  CASE WHEN SUM(revenue) > 0 THEN ROUND(SUM(gross_profit) / SUM(revenue), 4) ELSE 0 END AS margin_pct
FROM v_invoice_line_margin GROUP BY product_id, product_name;

CREATE OR REPLACE VIEW public.v_margin_per_brand AS
SELECT brand_id, brand AS brand_name,
  SUM(revenue) AS total_revenue, SUM(cogs) AS total_cogs,
  SUM(gross_profit) AS total_profit,
  CASE WHEN SUM(revenue) > 0 THEN ROUND(SUM(gross_profit) / SUM(revenue), 4) ELSE 0 END AS margin_pct
FROM v_invoice_line_margin GROUP BY brand_id, brand;

CREATE OR REPLACE VIEW public.v_margin_per_store AS
SELECT store_id,
  SUM(revenue) AS total_revenue, SUM(cogs) AS total_cogs,
  SUM(gross_profit) AS total_profit,
  CASE WHEN SUM(revenue) > 0 THEN ROUND(SUM(gross_profit) / SUM(revenue), 4) ELSE 0 END AS margin_pct
FROM v_invoice_line_margin GROUP BY store_id;

-- 5E: Negative margin alerts view
CREATE OR REPLACE VIEW public.v_negative_margin_alerts AS
SELECT invoice_id, line_item_id, product_id, product_name,
  store_id, brand, revenue, cogs, gross_profit, margin_pct,
  CASE
    WHEN margin_pct < 0 THEN 'negative_margin'
    WHEN margin_pct < 0.10 THEN 'thin_margin'
    WHEN cogs = 0 AND revenue > 0 THEN 'unknown_cost'
    ELSE 'healthy'
  END AS alert_type
FROM v_invoice_line_margin
WHERE margin_pct < 0.10 OR (cogs = 0 AND revenue > 0);

COMMENT ON TABLE public.inventory_cost_ledger IS 'Append-only cost layers for inbound inventory. units_consumed tracks FIFO drawdown.';
COMMENT ON TABLE public.cogs_ledger IS 'Immutable COGS entries. Each row ties a sale to a cost layer via FIFO.';
