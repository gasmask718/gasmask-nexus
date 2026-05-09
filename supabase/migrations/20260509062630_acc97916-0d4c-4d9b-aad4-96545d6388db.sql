
-- Phase B1: Backfill tube_sale_ledger from invoice_line_items
-- Preserves original invoice timestamps for time-window math.
-- Suspect-signature lines tagged 'historical_backfill_suspect' (none currently match).

INSERT INTO public.tube_sale_ledger (
  invoice_id, line_item_id, store_id, brand_id, brand,
  product_name, product_id, tubes_delta, source, recorded_by, created_at
)
SELECT
  ili.invoice_id,
  ili.id,
  i.store_id,
  p.brand_id,
  b.name,
  p.name,
  ili.product_id,
  ili.computed_tubes_total,
  CASE
    WHEN i.invoice_number ~ '^INV-17[0-9]{10,}-'
      OR (COALESCE(i.subtotal,0) = 0 AND COALESCE(i.total,0) > 0)
    THEN 'historical_backfill_suspect'
    ELSE 'historical_backfill'
  END,
  'session2_migration',
  i.created_at
FROM public.invoice_line_items ili
JOIN public.invoices i ON i.id = ili.invoice_id
LEFT JOIN public.products p ON p.id = ili.product_id
LEFT JOIN public.brands b ON b.id = p.brand_id
WHERE ili.computed_tubes_total > 0
  AND i.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.tube_sale_ledger l WHERE l.line_item_id = ili.id
  );
