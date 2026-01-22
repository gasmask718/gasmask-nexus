-- =============================================
-- UI-BIND: Aggregate Views for Zero-Drift Display
-- =============================================

-- Ambassador commission totals (RLS applies automatically)
CREATE OR REPLACE VIEW public.ambassador_commission_totals AS
SELECT
  ambassador_id,
  SUM(commission_amount) FILTER (WHERE status = 'pending') AS pending_total,
  SUM(commission_amount) FILTER (WHERE status = 'approved') AS approved_total,
  SUM(commission_amount) FILTER (WHERE status = 'paid') AS paid_total,
  SUM(commission_amount) FILTER (WHERE status = 'reversed') AS reversed_total,
  SUM(commission_amount) FILTER (WHERE status IN ('pending', 'approved', 'paid')) AS lifetime_total,
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  COUNT(*) FILTER (WHERE status = 'paid') AS paid_count
FROM public.commission_ledger
GROUP BY ambassador_id;

-- Store-scoped commission totals
CREATE OR REPLACE VIEW public.store_commission_totals AS
SELECT
  store_id,
  ambassador_id,
  SUM(commission_amount) FILTER (WHERE status = 'pending') AS pending_total,
  SUM(commission_amount) FILTER (WHERE status = 'approved') AS approved_total,
  SUM(commission_amount) FILTER (WHERE status = 'paid') AS paid_total,
  SUM(commission_amount) AS lifetime_total,
  COUNT(*) AS entry_count,
  MAX(earned_at) AS last_commission_at
FROM public.commission_ledger
WHERE store_id IS NOT NULL
GROUP BY store_id, ambassador_id;

-- Channel breakdown for ambassador
CREATE OR REPLACE VIEW public.ambassador_commission_by_channel AS
SELECT
  ambassador_id,
  source_channel,
  SUM(commission_amount) FILTER (WHERE status IN ('pending', 'approved', 'paid')) AS channel_total,
  COUNT(*) AS entry_count
FROM public.commission_ledger
WHERE status != 'reversed'
GROUP BY ambassador_id, source_channel;