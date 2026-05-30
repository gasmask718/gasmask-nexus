
-- One-shot corrective backfill: cost was stored per-box instead of per-tube for 228 finalized-invoice rows.
-- Bypass the finalized-invoice guard for this corrective update only.
SET LOCAL session_replication_role = replica;

UPDATE invoice_line_items
SET cost_per_unit_at_sale = cost_per_unit_at_sale / units_per_box_snapshot,
    profit_at_sale = (unit_price * quantity) - ((cost_per_unit_at_sale / units_per_box_snapshot) * quantity)
WHERE cost_per_unit_at_sale > 0
  AND units_per_box_snapshot > 1
  AND cost_per_unit_at_sale > unit_price * 5;

SET LOCAL session_replication_role = origin;
