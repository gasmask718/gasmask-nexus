
-- Phase 1A: Tube Integrity Verification View
-- Read-only diagnostic view comparing invoice_line_items vs tube_sale_ledger
CREATE OR REPLACE VIEW public.v_tube_integrity_check AS
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.status AS invoice_status,
  i.entity_type,
  i.entity_id,
  i.created_at AS invoice_date,
  COALESCE(li.line_items_tubes, 0) AS line_items_tubes,
  COALESCE(tsl.ledger_tubes_delta, 0) AS ledger_tubes_delta,
  COALESCE(li.line_items_tubes, 0) - COALESCE(tsl.ledger_tubes_delta, 0) AS mismatch,
  CASE
    WHEN i.status = 'voided' AND COALESCE(tsl.ledger_tubes_delta, 0) != 0 THEN 'VOIDED_NONZERO_LEDGER'
    WHEN i.status = 'finalized' AND COALESCE(li.line_items_tubes, 0) != COALESCE(tsl.ledger_tubes_delta, 0) THEN 'FINALIZED_MISMATCH'
    ELSE 'OK'
  END AS integrity_status
FROM invoices i
LEFT JOIN LATERAL (
  SELECT SUM(il.computed_tubes_total) AS line_items_tubes
  FROM invoice_line_items il
  WHERE il.invoice_id = i.id
) li ON true
LEFT JOIN LATERAL (
  SELECT SUM(t.tubes_delta) AS ledger_tubes_delta
  FROM tube_sale_ledger t
  WHERE t.invoice_id = i.id
) tsl ON true
WHERE i.status IN ('finalized', 'voided');
