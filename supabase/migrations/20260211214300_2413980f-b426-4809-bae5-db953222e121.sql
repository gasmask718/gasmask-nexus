
-- PHASE 2A: Historical Invoice Repair + Ledger Rebuild

-- 1) Create inventory_repair_ledger table
CREATE TABLE IF NOT EXISTS public.inventory_repair_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id),
  store_id uuid NOT NULL,
  product_id uuid NOT NULL,
  track_by text NOT NULL CHECK (track_by IN ('tubes', 'bags')),
  units_delta integer NOT NULL,
  reason text NOT NULL,
  source text NOT NULL DEFAULT 'invoice_repair',
  repaired_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_repair_ledger_idempotent
  ON public.inventory_repair_ledger (invoice_id, product_id, source);

ALTER TABLE public.inventory_repair_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read repair ledger"
  ON public.inventory_repair_ledger FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert repair entries"
  ON public.inventory_repair_ledger FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin')
  );

-- 2) RPC: preview_invoice_repair
CREATE OR REPLACE FUNCTION public.preview_invoice_repair(p_invoice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_lines jsonb := '[]'::jsonb;
  v_line record;
  v_product record;
  v_expected_units numeric;
  v_posted_units numeric;
  v_delta numeric;
  v_total_tubes_delta numeric := 0;
  v_total_bags_delta numeric := 0;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id;
  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  IF v_invoice.status NOT IN ('finalized', 'voided') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only finalized or voided invoices can be repaired');
  END IF;

  FOR v_line IN
    SELECT li.*, li.computed_tubes_total AS computed_units
    FROM invoice_line_items li
    WHERE li.invoice_id = p_invoice_id
  LOOP
    SELECT * INTO v_product FROM products WHERE id = v_line.product_id;
    IF v_product IS NULL OR v_product.track_by = 'none' THEN
      CONTINUE;
    END IF;

    v_expected_units := -COALESCE(v_line.computed_units, 0);
    IF v_invoice.status = 'voided' THEN
      v_expected_units := 0;
    END IF;

    IF v_product.track_by = 'tubes' THEN
      SELECT COALESCE(SUM(tubes_delta), 0) INTO v_posted_units
      FROM tube_sale_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id;
      SELECT v_posted_units + COALESCE(SUM(units_delta), 0) INTO v_posted_units
      FROM inventory_repair_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id AND track_by = 'tubes';
    ELSE
      SELECT COALESCE(SUM(bags_delta), 0) INTO v_posted_units
      FROM bag_sale_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id;
      SELECT v_posted_units + COALESCE(SUM(units_delta), 0) INTO v_posted_units
      FROM inventory_repair_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id AND track_by = 'bags';
    END IF;

    v_delta := v_expected_units - v_posted_units;

    IF v_product.track_by = 'tubes' THEN
      v_total_tubes_delta := v_total_tubes_delta + v_delta;
    ELSE
      v_total_bags_delta := v_total_bags_delta + v_delta;
    END IF;

    v_lines := v_lines || jsonb_build_object(
      'line_item_id', v_line.id,
      'product_id', v_line.product_id,
      'product_name', COALESCE(v_line.product_name_snapshot, v_line.product_name),
      'track_by', v_product.track_by,
      'computed_units', COALESCE(v_line.computed_units, 0),
      'posted_units', v_posted_units,
      'delta_needed', v_delta,
      'needs_repair', (v_delta != 0)
    );
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'invoice_number', v_invoice.invoice_number,
    'store_id', v_invoice.store_id,
    'status', v_invoice.status,
    'repair_status', v_invoice.repair_status,
    'line_items', v_lines,
    'tubes_delta_needed', v_total_tubes_delta,
    'bags_delta_needed', v_total_bags_delta,
    'needs_repair', (v_total_tubes_delta != 0 OR v_total_bags_delta != 0)
  );
END;
$$;

-- 3) RPC: repair_invoice_units (admin-only, idempotent)
CREATE OR REPLACE FUNCTION public.repair_invoice_units(
  p_invoice_id uuid,
  p_reason text,
  p_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_line record;
  v_product record;
  v_expected_units numeric;
  v_posted_units numeric;
  v_delta numeric;
  v_postings_made integer := 0;
  v_total_tubes_delta numeric := 0;
  v_total_bags_delta numeric := 0;
  v_already_repaired boolean;
BEGIN
  SELECT * INTO v_invoice FROM invoices WHERE id = p_invoice_id FOR UPDATE;
  IF v_invoice IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;
  IF v_invoice.status NOT IN ('finalized', 'voided') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only finalized/voided invoices can be repaired');
  END IF;

  FOR v_line IN
    SELECT li.*, li.computed_tubes_total AS computed_units
    FROM invoice_line_items li WHERE li.invoice_id = p_invoice_id
  LOOP
    SELECT * INTO v_product FROM products WHERE id = v_line.product_id;
    IF v_product IS NULL OR v_product.track_by = 'none' THEN
      CONTINUE;
    END IF;

    v_expected_units := -COALESCE(v_line.computed_units, 0);
    IF v_invoice.status = 'voided' THEN
      v_expected_units := 0;
    END IF;

    IF v_product.track_by = 'tubes' THEN
      SELECT COALESCE(SUM(tubes_delta), 0) INTO v_posted_units
      FROM tube_sale_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id;
      SELECT v_posted_units + COALESCE(SUM(units_delta), 0) INTO v_posted_units
      FROM inventory_repair_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id AND track_by = 'tubes';
    ELSE
      SELECT COALESCE(SUM(bags_delta), 0) INTO v_posted_units
      FROM bag_sale_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id;
      SELECT v_posted_units + COALESCE(SUM(units_delta), 0) INTO v_posted_units
      FROM inventory_repair_ledger WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id AND track_by = 'bags';
    END IF;

    v_delta := v_expected_units - v_posted_units;

    IF v_delta != 0 THEN
      -- Check idempotency
      SELECT EXISTS(
        SELECT 1 FROM inventory_repair_ledger
        WHERE invoice_id = p_invoice_id AND product_id = v_line.product_id AND source = 'invoice_repair'
      ) INTO v_already_repaired;

      IF v_already_repaired THEN
        CONTINUE; -- skip if already repaired for this product
      END IF;

      INSERT INTO inventory_repair_ledger (
        invoice_id, store_id, product_id, track_by, units_delta, reason, source, repaired_by
      ) VALUES (
        p_invoice_id, v_invoice.store_id, v_line.product_id,
        v_product.track_by, v_delta, p_reason, 'invoice_repair', p_user_id
      );

      IF v_product.track_by = 'tubes' THEN
        INSERT INTO tube_sale_ledger (
          invoice_id, line_item_id, store_id, brand_id, product_id,
          product_name, tubes_delta, source, recorded_by
        ) VALUES (
          p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
          COALESCE(v_line.product_name_snapshot, v_line.product_name),
          v_delta, 'invoice_repair', p_user_id
        );
        v_total_tubes_delta := v_total_tubes_delta + v_delta;
      ELSE
        INSERT INTO bag_sale_ledger (
          invoice_id, line_item_id, store_id, brand_id, product_id,
          product_name, bags_delta, source, recorded_by
        ) VALUES (
          p_invoice_id, v_line.id, v_invoice.store_id, v_line.brand_id, v_line.product_id,
          COALESCE(v_line.product_name_snapshot, v_line.product_name),
          v_delta, 'invoice_repair', p_user_id
        );
        v_total_bags_delta := v_total_bags_delta + v_delta;
      END IF;

      v_postings_made := v_postings_made + 1;
    END IF;
  END LOOP;

  UPDATE invoices SET
    repair_status = CASE WHEN v_postings_made > 0 THEN 'repaired' ELSE 'verified' END,
    repair_notes = p_reason,
    repaired_at = now(),
    repaired_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN jsonb_build_object(
    'success', true,
    'invoice_id', p_invoice_id,
    'postings_made', v_postings_made,
    'tubes_delta', v_total_tubes_delta,
    'bags_delta', v_total_bags_delta,
    'status', CASE WHEN v_postings_made > 0 THEN 'repaired' ELSE 'verified' END
  );
END;
$$;

-- 4) Views: preserve existing column signatures
-- On-hand views already include all sources (SUM of all deltas), which is correct
-- They include invoice_repair source automatically since they sum ALL rows
-- No changes needed for v_store_tubes_on_hand / v_store_bags_on_hand

-- SOLD views stay finalized-only (already correct from fast patch)
-- No changes needed for v_tubes_sold_finalized / v_bags_sold_finalized
-- No changes needed for v_tube_bag_ratio_per_store
