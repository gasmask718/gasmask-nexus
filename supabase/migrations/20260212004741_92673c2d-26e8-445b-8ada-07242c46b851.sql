-- Phase 2C Guardrail: NOT NULL constraint on canonical column
ALTER TABLE public.invoice_line_items
  ADD CONSTRAINT invoice_line_units_not_null
  CHECK (computed_units_total IS NOT NULL);

-- Documentation comments
COMMENT ON COLUMN public.invoice_line_items.computed_units_total IS
'Canonical unit count (tubes/bags depending on product.track_by). Primary field for all ledger operations.';

COMMENT ON COLUMN public.invoice_line_items.computed_tubes_total IS
'DEPRECATED: Legacy alias kept for backward compatibility. Do not write new business logic against this column. Use computed_units_total instead. Removal planned post Phase 4.';