-- Fix dashboard views to distinguish SOLD from NET inventory
-- SOLD = invoices_finalized only (for analytics)
-- NET = finalized + void reversals (for current on-hand inventory)

-- Helper views for sold quantities (analytics only)
CREATE OR REPLACE VIEW v_tubes_sold_finalized AS
SELECT
  store_id,
  product_id,
  SUM(ABS(tubes_delta)) AS tubes_sold
FROM tube_sale_ledger
WHERE source = 'invoice_finalized'
GROUP BY store_id, product_id;

CREATE OR REPLACE VIEW v_bags_sold_finalized AS
SELECT
  store_id,
  product_id,
  SUM(ABS(bags_delta)) AS bags_sold
FROM bag_sale_ledger
WHERE source = 'invoice_finalized'
GROUP BY store_id, product_id;

-- Update ratio view to use SOLD quantities (not net deltas)
-- This prevents voids from distorting shrinkage detection
DROP VIEW IF EXISTS v_tube_bag_ratio_per_store CASCADE;

CREATE VIEW v_tube_bag_ratio_per_store AS
SELECT
  COALESCE(t.store_id, b.store_id) AS store_id,
  COALESCE(t.tubes_sold, 0) AS tubes_sold,
  COALESCE(b.bags_sold, 0) AS bags_sold,
  CASE
    WHEN COALESCE(b.bags_sold, 0) = 0 THEN NULL
    ELSE ROUND(
      COALESCE(t.tubes_sold, 0)::numeric / COALESCE(b.bags_sold, 1),
      2
    )
  END AS tubes_per_bag_ratio
FROM v_tubes_sold_finalized t
FULL OUTER JOIN v_bags_sold_finalized b
  ON t.store_id = b.store_id;