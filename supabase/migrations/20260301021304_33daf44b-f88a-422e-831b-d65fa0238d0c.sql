
-- Auto-refresh audience segments when invoices change status
CREATE OR REPLACE FUNCTION public.refresh_customer_segments()
RETURNS trigger AS $$
BEGIN
  -- Update cached_count for all dynamic segments by re-running the count query
  UPDATE public.audience_segments
  SET cached_count = sub.cnt,
      cached_at = now()
  FROM (
    SELECT COUNT(DISTINCT sm.id) AS cnt
    FROM public.store_master sm
    JOIN public.invoices i ON i.store_id = sm.id
    WHERE i.payment_status IN ('paid','completed','sent','finalized')
      AND sm.phone IS NOT NULL
  ) sub
  WHERE audience_segments.is_dynamic = true
    AND audience_segments.filter_config->>'source' = 'invoices';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire after invoice inserts or status updates (statement-level to batch)
CREATE TRIGGER trg_refresh_segments_after_invoice
AFTER INSERT OR UPDATE OF payment_status
ON public.invoices
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_customer_segments();
