CREATE OR REPLACE VIEW public.v_invoice_effective_tubes AS
SELECT ili.invoice_id,
       inv.invoice_number,
       inv.total,
       inv.created_at AS invoice_date,
       SUM(ili.quantity) AS tube_count,
       'live_line_item'::text AS source,
       NULL::text AS confidence_level
FROM invoice_line_items ili
JOIN invoices inv ON inv.id = ili.invoice_id
WHERE inv.status = 'finalized' AND inv.deleted_at IS NULL
GROUP BY ili.invoice_id, inv.invoice_number, inv.total, inv.created_at
UNION ALL
SELECT hlr.invoice_id,
       inv.invoice_number,
       inv.total,
       inv.created_at AS invoice_date,
       hlr.unit_count AS tube_count,
       CASE WHEN hlr.attribution_method = 'price_map_auto' THEN 'price_map_auto'
            ELSE 'historical_exact_repair' END AS source,
       hlr.confidence_level
FROM historical_invoice_line_repairs hlr
JOIN invoices inv ON inv.id = hlr.invoice_id
WHERE hlr.attribution_method IN ('manual_exact','price_map_auto')
  AND hlr.unit_count IS NOT NULL
  AND inv.status = 'finalized'
  AND inv.deleted_at IS NULL
  AND hlr.invoice_id NOT IN (SELECT DISTINCT invoice_id FROM invoice_line_items);