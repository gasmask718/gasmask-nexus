
-- Phase 2: Legacy Invoice Price Mapping (Manual, Read-Only Safe)
-- This table allows operators to manually define what historical PRICE_ONLY invoice totals represented.
-- NO mutations to invoices, line items, inventory, or ledgers.
-- Fully auditable and reversible.

CREATE TABLE IF NOT EXISTS public.legacy_invoice_price_map (
  total_amount numeric NOT NULL,
  inferred_units integer,
  unit_type text CHECK (unit_type IN ('tubes', 'bags')),
  price_per_unit numeric,
  effective_from date,
  effective_to date,
  confidence_level text NOT NULL CHECK (confidence_level IN ('high', 'medium', 'low')),
  notes text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (total_amount, effective_from)
);

COMMENT ON TABLE public.legacy_invoice_price_map IS
  'Phase 2: Manual mapping layer defining what historical PRICE_ONLY invoice totals represented (tubes/bags). 
   This mapping does NOT alter financials or inventory. It is preparatory metadata for optional historical reconstruction.
   Fully auditable and reversible. Operators approve mappings; no automation applies them.';

COMMENT ON COLUMN public.legacy_invoice_price_map.total_amount IS
  'Invoice total amount in cents (or dollars—must match v_legacy_invoice_price_clusters). Used as lookup key.';

COMMENT ON COLUMN public.legacy_invoice_price_map.inferred_units IS
  'Human-approved unit count this price represents (e.g., 12 tubes for $150). NULL if confidence is "low" or unmapped.';

COMMENT ON COLUMN public.legacy_invoice_price_map.unit_type IS
  'Type of unit: tubes or bags. Pairs with inferred_units to define the recovery.';

COMMENT ON COLUMN public.legacy_invoice_price_map.price_per_unit IS
  'Derived: total_amount / inferred_units. Optional, for transparency.';

COMMENT ON COLUMN public.legacy_invoice_price_map.effective_from IS
  'Date this mapping became valid. Allows price evolution over time.';

COMMENT ON COLUMN public.legacy_invoice_price_map.effective_to IS
  'Date this mapping expired. NULL = still active.';

COMMENT ON COLUMN public.legacy_invoice_price_map.confidence_level IS
  'high = pricing was standard at the time. medium = inferred from context. low = best guess, manual override.';

COMMENT ON COLUMN public.legacy_invoice_price_map.notes IS
  'Justification: why this price represented this unit count (e.g., "box price in store XYZ Sep 2024" or "promo bundle").';

COMMENT ON COLUMN public.legacy_invoice_price_map.created_by IS
  'User ID of the operator who approved this mapping.';

-- Phase 2 Read-Only View: Join price clusters with mappings
-- Shows mapping status for each price cluster without mutating anything.
CREATE OR REPLACE VIEW public.v_legacy_invoice_price_mapping_status AS
SELECT 
  clusters.total,
  clusters.invoice_count,
  clusters.first_seen,
  clusters.last_seen,
  clusters.distinct_brands,
  clusters.distinct_stores,
  mapping.inferred_units as mapped_units,
  mapping.unit_type,
  mapping.confidence_level,
  mapping.notes as mapping_notes,
  CASE WHEN mapping.total_amount IS NOT NULL THEN true ELSE false END as mapping_present,
  mapping.effective_from,
  mapping.effective_to,
  mapping.created_at as mapping_created_at,
  mapping.created_by
FROM public.v_legacy_invoice_price_clusters clusters
LEFT JOIN public.legacy_invoice_price_map mapping
  ON clusters.total = mapping.total_amount
  AND (mapping.effective_to IS NULL OR mapping.effective_to >= clusters.last_seen)
ORDER BY clusters.invoice_count DESC;

COMMENT ON VIEW public.v_legacy_invoice_price_mapping_status IS
  'Phase 2 Status View: Join price clusters (Phase 1 discovery) with manual price mappings.
   Shows which prices have been mapped, confidence level, and coverage.
   This view does NOT alter financials or inventory. It is read-only for operator review.
   Fully reversible: delete rows from legacy_invoice_price_map to unmake a mapping.';
