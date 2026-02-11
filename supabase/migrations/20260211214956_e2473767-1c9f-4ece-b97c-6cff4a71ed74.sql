
-- Phase 2B Addendum: Developer Documentation for Canonical Unit Semantics
-- Goal: Lock in forward-compatible naming and meaning for future developers

-- ============================================================================
-- DOCUMENTATION: CANONICAL UNIT ABSTRACTION
-- ============================================================================

-- ADD inline comment to finalize_invoice explaining canonical unit semantics
COMMENT ON FUNCTION public.finalize_invoice IS
'Finalizes a draft invoice and posts unit deltas to ledgers.

CANONICAL SEMANTICS (DO NOT CHANGE):
- computed_tubes_total = final sellable units (meaning determined by product.track_by)
- If product.track_by = ''tubes'': computed_tubes_total represents tubes sold
- If product.track_by = ''bags'': computed_tubes_total represents bags sold
- Ledger selection (tube_sale_ledger vs bag_sale_ledger) is determined by product.track_by
- Both ledgers use the same computed_tubes_total value as units_delta

This design supports future product types (cones, filters) without code changes.
';

-- ADD inline comment to repair_invoice_units explaining canonical unit semantics
COMMENT ON FUNCTION public.repair_invoice_units IS
'Appends corrective unit deltas to repair ledgers for historical invoices.

CANONICAL SEMANTICS:
- Repairs are idempotent: same invoice + product + reason cannot be posted twice
- Delta is calculated as: expected_units - currently_posted_units
- Expected units come from invoice_line_items.computed_tubes_total grouped by product
- Repairs are always written with source = ''invoice_repair'' for audit trail
- Repairs modify NET inventory but NOT SOLD analytics (clean reporting)

This function supports the append-only, immutable ledger architecture.
';

-- ADD inline comment to void_invoice
COMMENT ON FUNCTION public.void_invoice IS
'Voids a finalized invoice and posts reversal deltas to ledgers.

CANONICAL SEMANTICS:
- Reversals are posted with source = ''invoice_reversal''
- Reversal delta = +original_delta (net effect is to cancel out the original posting)
- NET inventory includes reversals, SOLD analytics excludes them
- Voided invoices enter ''voided'' status; repair_status is reset
';

-- ============================================================================
-- VIEWS: CANONICAL UNIT LABELS AND ABSTRACTIONS
-- ============================================================================

COMMENT ON VIEW v_invoice_line_units IS
'Canonical line item view with explicit unit labels.
Removes ambiguity: every row shows what kind of "unit" it represents (tubes/bags/units).
';

COMMENT ON VIEW v_inventory_movements IS
'Unified ledger abstraction across tubes and bags.
All rows use units_delta (semantic meaning determined by track_by).
Supports future product types without view changes.
';

COMMENT ON VIEW v_inventory_movements_with_repairs IS
'Complete inventory movement history: finalized + voided + repairs.
Used for NET inventory calculations (includes all deltas).
';

COMMENT ON VIEW v_tubes_sold_finalized IS
'SOLD analytics: finalized tubes only.
Excludes repairs and reversals for clean sales reporting.
';

COMMENT ON VIEW v_bags_sold_finalized IS
'SOLD analytics: finalized bags only.
Excludes repairs and reversals for clean sales reporting.
';

-- ============================================================================
-- LEDGER TABLE SEMANTICS
-- ============================================================================

COMMENT ON TABLE tube_sale_ledger IS
'Immutable ledger of tube movements.
- tubes_delta: units sold (negative) or reversed (positive)
- source: ''invoice_finalized'', ''invoice_reversal'', or ''invoice_repair''
- NEVER UPDATE or DELETE rows; use inventory_repair_ledger for corrections
';

COMMENT ON TABLE bag_sale_ledger IS
'Immutable ledger of bag movements.
- bags_delta: units sold (negative) or reversed (positive)
- source: ''invoice_finalized'', ''invoice_reversal'', or ''invoice_repair''
- NEVER UPDATE or DELETE rows; use inventory_repair_ledger for corrections
';

COMMENT ON TABLE inventory_repair_ledger IS
'Append-only repair ledger for historical corrections.
- units_delta: net correction (positive or negative)
- source: always ''invoice_repair''
- idempotent: (invoice_id, product_id, source) prevents double-posting
';

-- ============================================================================
-- COLUMN SEMANTICS (FOR FUTURE DEVELOPERS)
-- ============================================================================

COMMENT ON COLUMN invoice_line_items.computed_tubes_total IS
'CANONICAL UNIT COUNT for this line item.
Name: preserved for legacy compatibility (do not rename yet).
Meaning: final sellable units, type determined by product.track_by.
Example: If product.track_by=''bags'' and quantity=100, this value = 100 (not ''100 tubes'').
In new code: refer to computed_units_total alias or treat computed_tubes_total as ''units''.
';

COMMENT ON COLUMN invoice_line_items.computed_units_total IS
'Forward-compatible alias for computed_tubes_total.
Use this name in all new code.
Represents final sellable units for any tracked product type.
';

-- ============================================================================
-- FUTURE-PROOFING GUIDE FOR DEVELOPERS
-- ============================================================================

-- NOTE: To add a new product type (e.g., cones):
--   1. Add track_by = 'cones' to products table
--   2. Create cone_sale_ledger table (schema = tube_sale_ledger with "cones_delta" column)
--   3. Add UNION ALL to v_inventory_movements and v_inventory_movements_with_repairs
--   4. Create v_cones_sold_finalized view (same pattern as tubes/bags)
--   5. Create v_store_cones_on_hand view (same pattern as tubes/bags)
--   6. Update finalize_invoice to branch on track_by = 'cones'
--   7. Update void_invoice to handle track_by = 'cones'
--   8. No business logic changes needed—everything is data-driven by product.track_by
