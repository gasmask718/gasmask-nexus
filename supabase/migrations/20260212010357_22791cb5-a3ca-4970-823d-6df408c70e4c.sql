
-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 4: Purchase Orders → Inbound Inventory → True On-Hand
-- ═══════════════════════════════════════════════════════════════════════════════

-- A1) Enhance purchase_orders with po_number + supplier_name
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_number text,
  ADD COLUMN IF NOT EXISTS supplier_name text;

-- Generate po_number for existing rows
UPDATE public.purchase_orders
SET po_number = 'PO-' || UPPER(LEFT(id::text, 8))
WHERE po_number IS NULL;

-- Make po_number unique going forward
CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number ON public.purchase_orders(po_number);

-- A1b) Enhance purchase_order_items with snapshots + canonical units
ALTER TABLE public.purchase_order_items
  ADD COLUMN IF NOT EXISTS product_name_snapshot text,
  ADD COLUMN IF NOT EXISTS track_by_snapshot text,
  ADD COLUMN IF NOT EXISTS pack_size_snapshot integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS packs_per_box_snapshot integer,
  ADD COLUMN IF NOT EXISTS units_per_box_snapshot integer,
  ADD COLUMN IF NOT EXISTS order_unit text DEFAULT 'unit',
  ADD COLUMN IF NOT EXISTS computed_units_total numeric;

-- Constraint on order_unit
ALTER TABLE public.purchase_order_items
  DROP CONSTRAINT IF EXISTS chk_poi_order_unit;
ALTER TABLE public.purchase_order_items
  ADD CONSTRAINT chk_poi_order_unit CHECK (order_unit IN ('unit','pack','box'));

-- A2) Receipts
CREATE TABLE IF NOT EXISTS public.po_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id),
  received_at timestamptz NOT NULL DEFAULT now(),
  received_by text,
  notes text
);

CREATE TABLE IF NOT EXISTS public.po_receipt_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_receipt_id uuid NOT NULL REFERENCES public.po_receipts(id),
  po_item_id uuid REFERENCES public.purchase_order_items(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name_snapshot text,
  track_by_snapshot text,
  pack_size_snapshot integer DEFAULT 1,
  packs_per_box_snapshot integer,
  units_per_box_snapshot integer,
  receive_unit text NOT NULL DEFAULT 'unit',
  quantity numeric NOT NULL,
  computed_units_total numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT chk_ri_receive_unit CHECK (receive_unit IN ('unit','pack','box'))
);

-- A3) Inbound Ledgers (Append-only, immutable)
CREATE TABLE IF NOT EXISTS public.tube_inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text,
  tubes_delta integer NOT NULL,
  source text NOT NULL,
  source_id uuid,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unique index to prevent double-posting
CREATE UNIQUE INDEX IF NOT EXISTS idx_tube_inv_ledger_idempotent
  ON public.tube_inventory_ledger(source, source_id, product_id);

CREATE TABLE IF NOT EXISTS public.bag_inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text,
  bags_delta integer NOT NULL,
  source text NOT NULL,
  source_id uuid,
  recorded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bag_inv_ledger_idempotent
  ON public.bag_inventory_ledger(source, source_id, product_id);

-- Immutability triggers: no UPDATE or DELETE on inbound ledgers
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Ledger rows are immutable. No UPDATE or DELETE allowed on %.', TG_TABLE_NAME;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tube_inv_ledger_immutable_upd ON public.tube_inventory_ledger;
CREATE TRIGGER trg_tube_inv_ledger_immutable_upd
  BEFORE UPDATE ON public.tube_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_tube_inv_ledger_immutable_del ON public.tube_inventory_ledger;
CREATE TRIGGER trg_tube_inv_ledger_immutable_del
  BEFORE DELETE ON public.tube_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_bag_inv_ledger_immutable_upd ON public.bag_inventory_ledger;
CREATE TRIGGER trg_bag_inv_ledger_immutable_upd
  BEFORE UPDATE ON public.bag_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

DROP TRIGGER IF EXISTS trg_bag_inv_ledger_immutable_del ON public.bag_inventory_ledger;
CREATE TRIGGER trg_bag_inv_ledger_immutable_del
  BEFORE DELETE ON public.bag_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

-- RLS on new tables
ALTER TABLE public.po_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tube_inventory_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bag_inventory_ledger ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all
CREATE POLICY "Authenticated read po_receipts" ON public.po_receipts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read po_receipt_items" ON public.po_receipt_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read tube_inv_ledger" ON public.tube_inventory_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read bag_inv_ledger" ON public.bag_inventory_ledger FOR SELECT TO authenticated USING (true);

-- Authenticated insert (controlled via RPC)
CREATE POLICY "Authenticated insert po_receipts" ON public.po_receipts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert po_receipt_items" ON public.po_receipt_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert tube_inv_ledger" ON public.tube_inventory_ledger FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated insert bag_inv_ledger" ON public.bag_inventory_ledger FOR INSERT TO authenticated WITH CHECK (true);

-- Sync trigger for PO item canonical units (same Phase 3 logic)
CREATE OR REPLACE FUNCTION public.sync_po_item_units()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.computed_units_total IS NULL THEN
    CASE NEW.order_unit
      WHEN 'unit' THEN
        NEW.computed_units_total := NEW.quantity_ordered;
      WHEN 'pack' THEN
        NEW.computed_units_total := NEW.quantity_ordered * COALESCE(NEW.pack_size_snapshot, 1);
      WHEN 'box' THEN
        IF NEW.packs_per_box_snapshot IS NOT NULL AND NEW.pack_size_snapshot IS NOT NULL THEN
          NEW.computed_units_total := NEW.quantity_ordered * NEW.packs_per_box_snapshot * NEW.pack_size_snapshot;
        ELSE
          NEW.computed_units_total := NEW.quantity_ordered * COALESCE(NEW.units_per_box_snapshot, 1);
        END IF;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_po_item_units ON public.purchase_order_items;
CREATE TRIGGER trg_sync_po_item_units
  BEFORE INSERT OR UPDATE ON public.purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_po_item_units();

-- B1) receive_purchase_order RPC
CREATE OR REPLACE FUNCTION public.receive_purchase_order(
  p_po_id uuid,
  p_items jsonb, -- array of {po_item_id, product_id, receive_unit, quantity, product_name, track_by, pack_size, packs_per_box, units_per_box}
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
  v_items_received int := 0;
  v_total_units numeric := 0;
BEGIN
  -- Lock PO row
  PERFORM id FROM purchase_orders WHERE id = p_po_id FOR UPDATE;

  -- Create receipt
  INSERT INTO po_receipts (purchase_order_id, received_by, notes)
  VALUES (p_po_id, p_user_id, p_notes)
  RETURNING id INTO v_receipt_id;

  -- Process each item
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

    -- Compute canonical units
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

    -- Insert receipt item
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

    -- Post to inbound ledger (idempotent via unique index)
    IF v_track_by = 'tubes' THEN
      INSERT INTO tube_inventory_ledger (product_id, product_name, tubes_delta, source, source_id, recorded_by)
      VALUES (v_product_id, v_product_name, v_units::int, 'po_received', v_receipt_id, p_user_id)
      ON CONFLICT (source, source_id, product_id) DO NOTHING;
    ELSIF v_track_by = 'bags' THEN
      INSERT INTO bag_inventory_ledger (product_id, product_name, bags_delta, source, source_id, recorded_by)
      VALUES (v_product_id, v_product_name, v_units::int, 'po_received', v_receipt_id, p_user_id)
      ON CONFLICT (source, source_id, product_id) DO NOTHING;
    END IF;

    -- Update PO item received qty
    IF v_po_item_id IS NOT NULL THEN
      UPDATE purchase_order_items
      SET quantity_received = COALESCE(quantity_received, 0) + v_qty
      WHERE id = v_po_item_id;
    END IF;

    v_items_received := v_items_received + 1;
    v_total_units := v_total_units + v_units;
  END LOOP;

  -- Update PO status
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

-- C) True On-Hand Views (Inbound - Outbound)
-- Tubes: inbound from tube_inventory_ledger + outbound from tube_sale_ledger
CREATE OR REPLACE VIEW public.v_store_tubes_on_hand AS
SELECT
  COALESCE(inb.product_id, outb.product_id) AS product_id,
  COALESCE(inb.product_name, outb.product_name) AS product_name,
  COALESCE(inb.store_id, outb.store_id) AS store_id,
  NULL::uuid AS brand_id,
  (COALESCE(inb.inbound, 0) + COALESCE(outb.outbound, 0))::integer AS tubes_on_hand
FROM
  (SELECT product_id, product_name, store_id, SUM(tubes_delta) AS inbound
   FROM tube_inventory_ledger GROUP BY product_id, product_name, store_id) inb
FULL OUTER JOIN
  (SELECT product_id, product_name, store_id, SUM(tubes_delta) AS outbound
   FROM tube_sale_ledger GROUP BY product_id, product_name, store_id) outb
ON inb.product_id = outb.product_id AND COALESCE(inb.store_id,'00000000-0000-0000-0000-000000000000') = COALESCE(outb.store_id,'00000000-0000-0000-0000-000000000000');

-- Bags: inbound from bag_inventory_ledger + outbound from bag_sale_ledger
CREATE OR REPLACE VIEW public.v_store_bags_on_hand AS
SELECT
  COALESCE(inb.product_id, outb.product_id) AS product_id,
  COALESCE(inb.product_name, outb.product_name) AS product_name,
  COALESCE(inb.store_id, outb.store_id) AS store_id,
  outb.brand_id AS brand_id,
  (COALESCE(inb.inbound, 0) + COALESCE(outb.outbound, 0))::integer AS bags_on_hand
FROM
  (SELECT product_id, product_name, store_id, SUM(bags_delta) AS inbound
   FROM bag_inventory_ledger GROUP BY product_id, product_name, store_id) inb
FULL OUTER JOIN
  (SELECT product_id, product_name, store_id, brand_id, SUM(bags_delta) AS outbound
   FROM bag_sale_ledger GROUP BY product_id, product_name, store_id, brand_id) outb
ON inb.product_id = outb.product_id AND COALESCE(inb.store_id,'00000000-0000-0000-0000-000000000000') = COALESCE(outb.store_id,'00000000-0000-0000-0000-000000000000');

-- Comments
COMMENT ON TABLE public.tube_inventory_ledger IS 'Immutable append-only inbound ledger for tubes. +delta = received stock.';
COMMENT ON TABLE public.bag_inventory_ledger IS 'Immutable append-only inbound ledger for bags. +delta = received stock.';
COMMENT ON VIEW public.v_store_tubes_on_hand IS 'True tubes on hand = inbound (tube_inventory_ledger) + outbound (tube_sale_ledger, negative).';
COMMENT ON VIEW public.v_store_bags_on_hand IS 'True bags on hand = inbound (bag_inventory_ledger) + outbound (bag_sale_ledger, negative).';
