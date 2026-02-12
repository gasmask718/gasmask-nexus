-- Phase 6.1: Supplier Cost History Foundation
-- Read-only view: raw cost history per inbound layer
-- One row per inventory_cost_ledger entry with supplier/PO context
-- Foundation for Phase 6.2 price drift analysis

CREATE OR REPLACE VIEW public.v_supplier_cost_history AS
SELECT
  icl.id AS cost_layer_id,
  icl.product_id,
  icl.product_name,
  po.supplier_name,
  po.id AS purchase_order_id,
  po.po_number,
  pr.id AS receipt_id,
  icl.units_in,
  icl.unit_cost,
  (icl.units_in * icl.unit_cost) AS total_cost,
  icl.received_at,
  pr.received_at AS receipt_received_at,
  po.created_at AS purchase_order_created_at,
  icl.created_at AS cost_ledger_created_at
FROM inventory_cost_ledger icl
JOIN po_receipts pr ON icl.source_id = pr.id AND icl.source = 'po_received'
JOIN purchase_orders po ON pr.purchase_order_id = po.id
ORDER BY icl.received_at ASC, icl.created_at ASC;

COMMENT ON VIEW public.v_supplier_cost_history IS
'Raw supplier cost history foundation. One row per inbound cost layer. 
No aggregation. No window functions. Purely denormalized join of cost layers with supplier and PO context.
Read-only view for Phase 6.2+ price drift, reliability, and margin analysis.
Safe to DROP without affecting Phases 4–5.';