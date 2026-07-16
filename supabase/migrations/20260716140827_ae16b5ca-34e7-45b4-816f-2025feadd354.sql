
-- Materialized view: one row per store that has ever been invoiced
CREATE MATERIALIZED VIEW IF NOT EXISTS public.store_invoice_activity AS
SELECT
  store_id,
  MAX(created_at)  AS last_invoice_at,
  COUNT(*)::bigint AS invoice_count,
  TRUE             AS has_ever_invoiced
FROM public.invoices_unified
WHERE store_id IS NOT NULL
GROUP BY store_id;

-- Unique index enables REFRESH ... CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS store_invoice_activity_store_id_idx
  ON public.store_invoice_activity (store_id);

GRANT SELECT ON public.store_invoice_activity TO authenticated, service_role;

-- Refresh helper (SECURITY DEFINER so pg_cron in the cron schema can call it)
CREATE OR REPLACE FUNCTION public.refresh_store_invoice_activity()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.store_invoice_activity;
EXCEPTION WHEN OTHERS THEN
  -- If CONCURRENTLY fails (e.g. first run with no unique index yet, or lock contention),
  -- fall back to a plain refresh so we never leave the view stale forever.
  REFRESH MATERIALIZED VIEW public.store_invoice_activity;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_store_invoice_activity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_store_invoice_activity() TO service_role;

-- Schedule: every 5 minutes. Unschedule any prior copy of this job first (idempotent).
DO $$
DECLARE
  jid bigint;
BEGIN
  FOR jid IN
    SELECT jobid FROM cron.job WHERE jobname = 'refresh_store_invoice_activity_5min'
  LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;

  PERFORM cron.schedule(
    'refresh_store_invoice_activity_5min',
    '*/5 * * * *',
    $cron$SELECT public.refresh_store_invoice_activity();$cron$
  );
END $$;

-- Prime it once now so the grid has data on first read.
SELECT public.refresh_store_invoice_activity();
