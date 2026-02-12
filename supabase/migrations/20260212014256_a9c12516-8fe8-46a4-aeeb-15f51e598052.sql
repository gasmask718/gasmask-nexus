/* =====================================================================
PHASE 6.3 — Supplier Scorecards (READ-ONLY)
Builds on:
- v_supplier_cost_history (6.1)
- v_supplier_price_drift, v_supplier_cost_volatility, v_supplier_price_alerts (6.2)

Goals:
- A supplier-product scorecard with normalized scores (0–100)
- A supplier-level rollup scorecard
- Rankings views for dashboard / alerts

ZERO MUTATIONS. Safe to DROP without affecting Phases 4–5.
===================================================================== */

-- 6.3.1 Supplier-Product Scorecard
-- Grain: (supplier_name, product_id)
-- Inputs:
--  - avg_unit_cost / receipts_count from v_supplier_cost_history
--  - pct_change from v_supplier_price_drift
--  - volatility_pct from v_supplier_cost_volatility
--
-- Outputs:
--  - cost_score: cheaper = better (normalized within same product across suppliers)
--  - trend_score: cost creeping up = worse
--  - stability_score: volatility higher = worse
--  - reliability_score: more receipts = better
--  - overall_score: weighted blend

CREATE OR REPLACE VIEW public.v_supplier_product_scorecard AS
WITH base AS (
  SELECT
    sch.supplier_name,
    sch.product_id,
    sch.product_name,
    COUNT(*)::int AS receipts_count,
    AVG(sch.unit_cost)::numeric AS avg_unit_cost,
    MIN(sch.unit_cost)::numeric AS min_unit_cost,
    MAX(sch.unit_cost)::numeric AS max_unit_cost
  FROM public.v_supplier_cost_history sch
  GROUP BY sch.supplier_name, sch.product_id, sch.product_name
),
joined AS (
  SELECT
    b.*,
    d.pct_change,
    d.first_received_at,
    d.latest_received_at,
    v.volatility_pct
  FROM base b
  LEFT JOIN public.v_supplier_price_drift d
    ON d.supplier_name = b.supplier_name AND d.product_id = b.product_id
  LEFT JOIN public.v_supplier_cost_volatility v
    ON v.supplier_name = b.supplier_name AND v.product_id = b.product_id
),
norm AS (
  SELECT
    j.*,

    -- Normalize cost within each product across suppliers:
    -- cheapest avg_unit_cost => 100, most expensive => 0
    MIN(j.avg_unit_cost) OVER (PARTITION BY j.product_id) AS product_min_avg_cost,
    MAX(j.avg_unit_cost) OVER (PARTITION BY j.product_id) AS product_max_avg_cost,

    -- Defaults for missing drift/volatility when only 1 receipt
    COALESCE(j.pct_change, 0) AS pct_change_safe,
    COALESCE(j.volatility_pct, 0) AS volatility_pct_safe
  FROM joined j
)
SELECT
  supplier_name,
  product_id,
  product_name,
  receipts_count,
  ROUND(avg_unit_cost, 4) AS avg_unit_cost,
  ROUND(min_unit_cost, 4) AS min_unit_cost,
  ROUND(max_unit_cost, 4) AS max_unit_cost,
  ROUND(pct_change_safe::numeric, 2) AS pct_change,
  ROUND(volatility_pct_safe::numeric, 2) AS volatility_pct,
  first_received_at,
  latest_received_at,

  -- COST SCORE (0–100) within product
  CASE
    WHEN product_max_avg_cost = product_min_avg_cost THEN 100
    ELSE ROUND(
      (1 - ((avg_unit_cost - product_min_avg_cost) / NULLIF((product_max_avg_cost - product_min_avg_cost), 0))) * 100
    , 2)
  END AS cost_score,

  -- TREND SCORE (0–100)
  -- If pct_change <= 0 => 100 (cost flat/down is good)
  -- pct_change 0..10 => linearly down from 100..50
  -- pct_change 10..20 => linearly down from 50..0
  -- >= 20 => 0
  CASE
    WHEN pct_change_safe <= 0 THEN 100
    WHEN pct_change_safe > 0 AND pct_change_safe < 10 THEN ROUND(100 - (pct_change_safe * 5), 2)
    WHEN pct_change_safe >= 10 AND pct_change_safe < 20 THEN ROUND(50 - ((pct_change_safe - 10) * 5), 2)
    ELSE 0
  END AS trend_score,

  -- STABILITY SCORE (0–100)
  -- volatility 0 => 100, volatility 25 => 0 (cap)
  CASE
    WHEN volatility_pct_safe <= 0 THEN 100
    WHEN volatility_pct_safe >= 25 THEN 0
    ELSE ROUND(100 - (volatility_pct_safe * 4), 2)
  END AS stability_score,

  -- RELIABILITY SCORE (0–100)
  -- 0 receipts (won't exist) but guard anyway
  -- 1 receipt => 20, 5 receipts => 60, 10 receipts => 80, 20+ => 100
  CASE
    WHEN receipts_count <= 1 THEN 20
    WHEN receipts_count >= 20 THEN 100
    ELSE ROUND(20 + (receipts_count::numeric - 1) * (80 / 19), 2)
  END AS reliability_score,

  -- OVERALL SCORE (0–100) weighted
  ROUND(
    (
      (CASE
        WHEN product_max_avg_cost = product_min_avg_cost THEN 100
        ELSE (1 - ((avg_unit_cost - product_min_avg_cost) / NULLIF((product_max_avg_cost - product_min_avg_cost), 0))) * 100
      END) * 0.35
      +
      (CASE
        WHEN pct_change_safe <= 0 THEN 100
        WHEN pct_change_safe > 0 AND pct_change_safe < 10 THEN 100 - (pct_change_safe * 5)
        WHEN pct_change_safe >= 10 AND pct_change_safe < 20 THEN 50 - ((pct_change_safe - 10) * 5)
        ELSE 0
      END) * 0.25
      +
      (CASE
        WHEN volatility_pct_safe <= 0 THEN 100
        WHEN volatility_pct_safe >= 25 THEN 0
        ELSE 100 - (volatility_pct_safe * 4)
      END) * 0.25
      +
      (CASE
        WHEN receipts_count <= 1 THEN 20
        WHEN receipts_count >= 20 THEN 100
        ELSE 20 + (receipts_count::numeric - 1) * (80 / 19)
      END) * 0.15
    )::numeric
  , 2) AS overall_score

FROM norm
ORDER BY supplier_name, product_name;

COMMENT ON VIEW public.v_supplier_product_scorecard IS
'Supplier-product scorecard (read-only). Scores: cost (35%), trend/drift (25%), stability/volatility (25%), reliability/receipt count (15%). Normalizes cost within each product across suppliers. Safe to drop.';


-- 6.3.2 Supplier Rollup Scorecard
-- Grain: (supplier_name)
-- Weighted by canonical units received (units_in) where available, else simple averages.
-- Uses v_supplier_cost_history units_in to weight product scores.
CREATE OR REPLACE VIEW public.v_supplier_scorecard AS
WITH weights AS (
  SELECT
    supplier_name,
    product_id,
    SUM(units_in)::numeric AS units_in_total
  FROM public.v_supplier_cost_history
  GROUP BY supplier_name, product_id
),
sc AS (
  SELECT
    sps.supplier_name,
    sps.product_id,
    sps.product_name,
    sps.receipts_count,
    COALESCE(w.units_in_total, 0) AS units_in_total,
    sps.cost_score,
    sps.trend_score,
    sps.stability_score,
    sps.reliability_score,
    sps.overall_score
  FROM public.v_supplier_product_scorecard sps
  LEFT JOIN weights w
    ON w.supplier_name = sps.supplier_name AND w.product_id = sps.product_id
)
SELECT
  supplier_name,
  COUNT(*)::int AS products_count,
  SUM(receipts_count)::int AS total_receipts_count,
  ROUND(SUM(units_in_total)::numeric, 2) AS total_units_in,

  -- Weighted averages (fallback to unweighted if total_units_in is 0)
  ROUND(
    CASE WHEN SUM(units_in_total) > 0
      THEN SUM(cost_score * units_in_total) / NULLIF(SUM(units_in_total), 0)
      ELSE AVG(cost_score)
    END
  , 2) AS cost_score,

  ROUND(
    CASE WHEN SUM(units_in_total) > 0
      THEN SUM(trend_score * units_in_total) / NULLIF(SUM(units_in_total), 0)
      ELSE AVG(trend_score)
    END
  , 2) AS trend_score,

  ROUND(
    CASE WHEN SUM(units_in_total) > 0
      THEN SUM(stability_score * units_in_total) / NULLIF(SUM(units_in_total), 0)
      ELSE AVG(stability_score)
    END
  , 2) AS stability_score,

  ROUND(
    CASE WHEN SUM(units_in_total) > 0
      THEN SUM(reliability_score * units_in_total) / NULLIF(SUM(units_in_total), 0)
      ELSE AVG(reliability_score)
    END
  , 2) AS reliability_score,

  ROUND(
    CASE WHEN SUM(units_in_total) > 0
      THEN SUM(overall_score * units_in_total) / NULLIF(SUM(units_in_total), 0)
      ELSE AVG(overall_score)
    END
  , 2) AS overall_score

FROM sc
GROUP BY supplier_name
ORDER BY overall_score DESC, supplier_name;

COMMENT ON VIEW public.v_supplier_scorecard IS
'Supplier rollup scorecard (read-only). Aggregates v_supplier_product_scorecard weighted by units received (units_in). Safe to drop.';


-- 6.3.3 Supplier Rankings (for UI)
CREATE OR REPLACE VIEW public.v_supplier_rankings AS
SELECT
  supplier_name,
  overall_score,
  cost_score,
  trend_score,
  stability_score,
  reliability_score,
  total_units_in,
  total_receipts_count,
  products_count,
  RANK() OVER (ORDER BY overall_score DESC) AS rank_overall
FROM public.v_supplier_scorecard
ORDER BY rank_overall, supplier_name;

COMMENT ON VIEW public.v_supplier_rankings IS
'Supplier rankings (read-only) for dashboard. RANK over v_supplier_scorecard overall_score. Safe to drop.';