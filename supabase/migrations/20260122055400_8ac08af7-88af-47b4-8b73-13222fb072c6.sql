-- =============================================
-- EXPORTS & STATEMENTS PHASE
-- =============================================

-- 1. Payout Export Rows View (Flat CSV-ready format)
CREATE OR REPLACE VIEW public.payout_export_rows AS
SELECT
  pb.id AS payout_batch_id,
  pb.ambassador_id,
  a.name AS ambassador_name,
  p.email AS ambassador_email,
  pm.method_type AS payout_method,
  pm.method_label AS payout_method_label,
  pm.external_ref AS payout_destination,
  pb.period_start,
  pb.period_end,
  cl.id AS commission_id,
  cl.source_channel,
  cl.source_id,
  cl.store_id,
  sm.store_name,
  cl.gross_amount,
  cl.commission_rate,
  cl.commission_amount,
  cl.earned_at,
  pb.total_amount AS batch_total,
  pb.currency,
  pb.status AS payout_status,
  pb.paid_at
FROM public.payout_batches pb
JOIN public.payout_items pi ON pi.payout_batch_id = pb.id
JOIN public.commission_ledger cl ON cl.id = pi.commission_ledger_id
JOIN public.ambassadors a ON a.id = pb.ambassador_id
LEFT JOIN public.profiles p ON p.id = a.user_id
LEFT JOIN public.store_master sm ON sm.id = cl.store_id
LEFT JOIN public.ambassador_payout_methods pm
  ON pm.ambassador_id = pb.ambassador_id
  AND pm.is_default = true
  AND pm.active = true;

-- 2. Payout Statement Data View (JSON aggregation for PDF generation)
CREATE OR REPLACE VIEW public.payout_statement_data AS
SELECT
  pb.id AS payout_batch_id,
  pb.ambassador_id,
  a.name AS full_name,
  p.email,
  pb.period_start,
  pb.period_end,
  pb.paid_at,
  pb.currency,
  pb.subtotal_amount,
  pb.adjustments_amount,
  pb.total_amount,
  pb.statement_url,
  pb.status,
  (SELECT json_agg(json_build_object(
    'earned_at', cl.earned_at,
    'source_channel', cl.source_channel,
    'store_name', COALESCE(sm.store_name, 'N/A'),
    'gross_amount', cl.gross_amount,
    'rate', cl.commission_rate,
    'commission', cl.commission_amount
  ) ORDER BY cl.earned_at ASC)
  FROM public.payout_items pi2
  JOIN public.commission_ledger cl ON cl.id = pi2.commission_ledger_id
  LEFT JOIN public.store_master sm ON sm.id = cl.store_id
  WHERE pi2.payout_batch_id = pb.id) AS line_items,
  (SELECT COUNT(*) FROM public.payout_items pi3 WHERE pi3.payout_batch_id = pb.id) AS items_count
FROM public.payout_batches pb
JOIN public.ambassadors a ON a.id = pb.ambassador_id
LEFT JOIN public.profiles p ON p.id = a.user_id;

-- 3. Export Payout Batch CSV Function
CREATE OR REPLACE FUNCTION public.export_payout_batch_csv(p_batch_id uuid)
RETURNS TABLE (
  payout_batch_id uuid,
  ambassador_name text,
  ambassador_email text,
  payout_method text,
  payout_destination text,
  period_start date,
  period_end date,
  source_channel text,
  source_id uuid,
  store_name text,
  gross_amount numeric,
  commission_rate numeric,
  commission_amount numeric,
  earned_at timestamptz,
  batch_total numeric,
  currency text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    payout_batch_id,
    ambassador_name,
    ambassador_email,
    payout_method,
    payout_destination,
    period_start,
    period_end,
    source_channel,
    source_id,
    store_name,
    gross_amount,
    commission_rate,
    commission_amount,
    earned_at,
    batch_total,
    currency
  FROM payout_export_rows
  WHERE payout_batch_id = p_batch_id;
$$;

-- 4. Get Statement Data Function (for PDF generation)
CREATE OR REPLACE FUNCTION public.get_payout_statement(p_batch_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'batch_id', payout_batch_id,
    'ambassador_id', ambassador_id,
    'ambassador_name', full_name,
    'ambassador_email', email,
    'period_start', period_start,
    'period_end', period_end,
    'paid_at', paid_at,
    'currency', currency,
    'subtotal', subtotal_amount,
    'adjustments', adjustments_amount,
    'total', total_amount,
    'status', status,
    'statement_url', statement_url,
    'line_items', line_items,
    'items_count', items_count
  )
  FROM payout_statement_data
  WHERE payout_batch_id = p_batch_id;
$$;

-- 5. Update statement URL function
CREATE OR REPLACE FUNCTION public.set_statement_url(p_batch_id uuid, p_url text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE payout_batches
  SET statement_url = p_url, updated_at = now()
  WHERE id = p_batch_id;
  
  INSERT INTO entity_audit_log (entity_type, entity_id, action, actor_id, new_values)
  VALUES ('payout_batch', p_batch_id, 'statement_generated', auth.uid(), 
    jsonb_build_object('statement_url', p_url));
END;
$$;

-- 6. Bulk export function for all ready/paid batches in date range
CREATE OR REPLACE FUNCTION public.export_payouts_by_period(p_start date, p_end date)
RETURNS TABLE (
  payout_batch_id uuid,
  ambassador_name text,
  ambassador_email text,
  payout_method text,
  payout_destination text,
  period_start date,
  period_end date,
  source_channel text,
  source_id uuid,
  store_name text,
  gross_amount numeric,
  commission_rate numeric,
  commission_amount numeric,
  earned_at timestamptz,
  batch_total numeric,
  currency text,
  payout_status text,
  paid_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    payout_batch_id,
    ambassador_name,
    ambassador_email,
    payout_method,
    payout_destination,
    period_start,
    period_end,
    source_channel,
    source_id,
    store_name,
    gross_amount,
    commission_rate,
    commission_amount,
    earned_at,
    batch_total,
    currency,
    payout_status,
    paid_at
  FROM payout_export_rows
  WHERE period_start >= p_start 
    AND period_end <= p_end
    AND payout_status IN ('ready', 'paid')
  ORDER BY ambassador_name, period_start, earned_at;
$$;

-- 7. Grants
GRANT SELECT ON public.payout_export_rows TO authenticated;
GRANT SELECT ON public.payout_statement_data TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_payout_batch_csv TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_payout_statement TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_statement_url TO authenticated;
GRANT EXECUTE ON FUNCTION public.export_payouts_by_period TO authenticated;