
-- Phase 1: Read-only discovery view for legacy invoice price clusters
CREATE OR REPLACE VIEW v_legacy_invoice_price_clusters AS
SELECT 
  inv.total,
  COUNT(*) as invoice_count,
  MIN(inv.created_at::date) as first_seen,
  MAX(inv.created_at::date) as last_seen,
  COUNT(DISTINCT inv.brand) as distinct_brands,
  COUNT(DISTINCT inv.store_id) as distinct_stores,
  ROUND(AVG(inv.total::numeric), 2) as avg_total,
  ROUND(MIN(inv.total::numeric), 2) as min_total,
  ROUND(MAX(inv.total::numeric), 2) as max_total
FROM invoices inv
WHERE inv.status = 'finalized'
  AND inv.deleted_at IS NULL
  AND inv.id NOT IN (
    SELECT DISTINCT invoice_id FROM invoice_line_items WHERE deleted_at IS NULL
  )
GROUP BY inv.total
ORDER BY invoice_count DESC;

COMMENT ON VIEW v_legacy_invoice_price_clusters IS 
  'Phase 1 Discovery: Read-only clustering of legacy finalized invoices (zero line items) by price point. No mutations. Used to identify price patterns for manual tube mapping.';
