
-- 1. batch_cost_history snapshot trigger
CREATE OR REPLACE FUNCTION public.snapshot_batch_cost_on_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only fire when completed_at transitions from NULL -> NOT NULL
  IF OLD.completed_at IS NULL AND NEW.completed_at IS NOT NULL THEN
    -- One-snapshot-per-batch uniqueness guard
    IF NOT EXISTS (SELECT 1 FROM public.batch_cost_history WHERE batch_id = NEW.id) THEN
      INSERT INTO public.batch_cost_history (
        batch_id, office_id, product_type, boxes_produced,
        tobacco_cost, packaging_cost, labor_cost, overhead_cost,
        total_batch_cost, cost_per_box, is_immutable, version
      ) VALUES (
        NEW.id,
        NEW.office_id,
        COALESCE(NEW.product_type, 'tubes'),
        COALESCE(NEW.boxes_produced, 0),
        COALESCE(NEW.tobacco_cost, 0),
        COALESCE(NEW.packaging_cost, 0),
        COALESCE(NEW.labor_cost, 0),
        COALESCE(NEW.overhead_cost, 0),
        COALESCE(NEW.total_cost, 0),
        CASE WHEN COALESCE(NEW.boxes_produced,0) > 0
             THEN COALESCE(NEW.total_cost,0) / NEW.boxes_produced
             ELSE 0 END,
        true,
        1
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_snapshot_batch_cost ON public.production_batches;
CREATE TRIGGER trg_snapshot_batch_cost
AFTER UPDATE OF completed_at ON public.production_batches
FOR EACH ROW
EXECUTE FUNCTION public.snapshot_batch_cost_on_close();

-- 2. Deprecation comments
COMMENT ON TABLE public.communication_escalations IS 'DEPRECATED 2026-06-04 (T4c) — Use public.store_escalations (driven by escalation_rules). Readers being migrated; do not write new code against this table.';
COMMENT ON TABLE public.ambassador_commissions IS 'DEPRECATED 2026-06-04 (T4c) — Migrate readers to public.commission_ledger. Drop scheduled after reader sweep (T4c item 7 — scope blocker, 20+ files).';
COMMENT ON TABLE public.commission_events IS 'DEPRECATED 2026-06-04 (T4c) — Migrate readers to public.commission_ledger. Drop scheduled after reader sweep (T4c item 7 — scope blocker, 20+ files).';

-- 3. floor_directory updates
UPDATE public.floor_directory SET status='ready', last_audited=now(), gaps_count=0
 WHERE page_route IN ('/communication/missed-calls','/communication/escalations','/portal/national-wholesale','/crm/global');

UPDATE public.floor_directory SET status='ready', last_audited=now(),
  purpose=COALESCE(purpose,'') || ' [trigger live on production_batches.completed_at]'
 WHERE page_route ILIKE '%batch-cost%' OR page_name ILIKE '%batch cost%';

UPDATE public.floor_directory SET status='kill_pending', last_audited=now(),
  purpose='MOOT — page killed at K10; no writer required'
 WHERE page_route ILIKE '%worker-scores%' OR page_name ILIKE '%worker score%';

UPDATE public.floor_directory SET status='dormant', last_audited=now(),
  purpose=COALESCE(purpose,'') || ' [dormant-pending-producer: fills when dialer places real calls]'
 WHERE page_route ILIKE '%deals%' AND status <> 'kill_pending';

-- Insert directory rows if missing for the touched pages
INSERT INTO public.floor_directory (floor, section, page_route, page_name, purpose, status, gaps_count, last_audited)
VALUES
  ('Floor 2','Communication','/communication/missed-calls','Missed Calls Dashboard','Reads bland_call_logs + dialer_call_attempts for no-answer/voicemail/missed','ready',0,now()),
  ('Floor 2','Communication','/communication/escalations','Escalations','Reads store_escalations (driven by escalation_rules)','ready',0,now()),
  ('Floor 4','Portal','/portal/national-wholesale','National Wholesale Portal','Live wholesalers + wholesale_hubs grouped by state','ready',0,now()),
  ('Floor 6','CRM','/crm/global?tab=customers','Global CRM — Customers','Lists crm_customers + businesses (M4 follow-up)','ready',0,now()),
  ('Floor 8','Commissions','(readers)','Commission Reader Sweep','BLOCKER: 20+ readers across hooks/pages reference ambassador_commissions/commission_events. Tables marked DEPRECATED; drop deferred pending reader rewrite ruling.','needs_work',20,now())
ON CONFLICT DO NOTHING;
