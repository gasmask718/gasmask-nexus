
-- Floor Agents registry + AI backfill jobs + draft_ai guard

CREATE TABLE IF NOT EXISTS public.floor_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor smallint NOT NULL,
  agent_name text NOT NULL,
  purpose text NOT NULL,
  charter text NOT NULL,
  schedule_cron text DEFAULT '0 * * * *',
  enabled boolean NOT NULL DEFAULT true,
  daily_token_budget integer NOT NULL DEFAULT 100000,
  tokens_used_today integer NOT NULL DEFAULT 0,
  budget_reset_at date NOT NULL DEFAULT current_date,
  last_run_at timestamptz,
  last_run_summary jsonb,
  last_findings_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (floor, agent_name)
);

GRANT SELECT ON public.floor_agents TO anon;
GRANT SELECT, UPDATE ON public.floor_agents TO authenticated;
GRANT ALL ON public.floor_agents TO service_role;

ALTER TABLE public.floor_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "floor_agents_read" ON public.floor_agents FOR SELECT USING (true);
CREATE POLICY "floor_agents_update_auth" ON public.floor_agents FOR UPDATE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.floor_agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.floor_agents(id) ON DELETE CASCADE,
  floor smallint NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running',
  findings_count integer DEFAULT 0,
  tokens_used integer DEFAULT 0,
  summary text,
  error text,
  raw_output jsonb
);

GRANT SELECT ON public.floor_agent_runs TO authenticated;
GRANT ALL ON public.floor_agent_runs TO service_role;
ALTER TABLE public.floor_agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "floor_agent_runs_read_auth" ON public.floor_agent_runs FOR SELECT TO authenticated USING (true);

-- Seed one agent per floor
INSERT INTO public.floor_agents (floor, agent_name, purpose, charter, schedule_cron) VALUES
(1, 'CRM Data Quality Agent', 'Detect missing phones/addresses, stale records, duplicate suspects',
 'You are a CRM data quality auditor. Scan active stores for: missing/invalid phone numbers, missing addresses, records not updated in 60+ days, and likely duplicates (same name+zip). Return JSON array of findings: [{store_id, issue_type, severity, recommendation}].',
 '0 1 * * *'),
(2, 'Comms Outreach Agent', 'Find needs-response backlog and stores not contacted in 30d',
 'You audit communications. Identify (a) inbound messages awaiting response >24h, (b) active stores with zero outbound contact in last 30 days. Return JSON findings with recommended next action.',
 '0 2 * * *'),
(3, 'Inventory Stock Agent', 'Low stock, dead SKUs, reorder suggestions',
 'You audit inventory. Surface low-stock SKUs below reorder point, dead SKUs (no sales in 60d), and recommended reorder quantities based on velocity.',
 '0 3 * * *'),
(4, 'Delivery Route Agent', 'Aging undelivered triggers and route gaps',
 'You audit delivery operations. Flag undelivered visit triggers aging >7 days and neighborhoods with low coverage.',
 '0 4 * * *'),
(5, 'Finance Collections Agent', 'Overdue invoices -> recommend collect_payment flags',
 'You audit finance. Identify invoices overdue >14 days and recommend collect_payment action. Never auto-mark; only recommend.',
 '0 5 * * *'),
(6, 'Production Efficiency Agent', 'Boxes/lb drift and batch anomalies',
 'You audit production. Compare recent batches conversion ratio (boxes per lb) to 30-day baseline; flag drift >15% or batch anomalies.',
 '0 6 * * *'),
(7, 'Wholesale Pattern Agent', 'Declining wholesalers and reorder windows',
 'You audit wholesale orders. Flag wholesalers with declining order velocity and those past typical reorder window.',
 '0 7 * * *'),
(8, 'Ambassador Performance Agent', 'Inactive ambassadors and capture quality',
 'You audit the ambassador team. Surface ambassadors inactive >14 days and capture submissions with low quality scores.',
 '0 8 * * *')
ON CONFLICT (floor, agent_name) DO NOTHING;

-- AI Backfill Jobs (notes + invoices)
CREATE TABLE IF NOT EXISTS public.ai_backfill_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (job_type IN ('notes','invoices')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','failed')),
  per_run_cap integer NOT NULL DEFAULT 50,
  scanned_count integer NOT NULL DEFAULT 0,
  generated_count integer NOT NULL DEFAULT 0,
  reviewed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  config jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.ai_backfill_jobs TO authenticated;
GRANT ALL ON public.ai_backfill_jobs TO service_role;
ALTER TABLE public.ai_backfill_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_backfill_jobs_auth" ON public.ai_backfill_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.ai_backfill_jobs (job_type, status) VALUES
('notes','pending'),('invoices','pending')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ai_backfill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.ai_backfill_jobs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'generated' CHECK (status IN ('generated','reviewed','rejected','failed')),
  output jsonb,
  error text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_backfill_items_job ON public.ai_backfill_items(job_id, status);
GRANT SELECT, UPDATE ON public.ai_backfill_items TO authenticated;
GRANT ALL ON public.ai_backfill_items TO service_role;
ALTER TABLE public.ai_backfill_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ai_backfill_items_auth" ON public.ai_backfill_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Guard: prevent auto-finalize of draft_ai invoices
CREATE OR REPLACE FUNCTION public.finalize_invoice(p_invoice_id uuid, p_user_id text DEFAULT 'manual'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_use_canonical boolean;
  v_units numeric;
  v_line record;
  v_cost_layer record;
  v_remaining int;
  v_consume int;
  v_store_id uuid;
  v_current_status text;
BEGIN
  SELECT status INTO v_current_status FROM invoices WHERE id = p_invoice_id;

  IF v_current_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  IF v_current_status = 'finalized' THEN
    RETURN json_build_object('success', true, 'already_finalized', true, 'invoice_id', p_invoice_id, 'message', 'Invoice was already finalized. No duplicate entries created.');
  END IF;

  IF v_current_status = 'voided' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot finalize a voided invoice');
  END IF;

  -- NEW: draft_ai requires human approval first (flips to 'draft' via approve_ai_draft_invoice)
  IF v_current_status = 'draft_ai' THEN
    RETURN json_build_object('success', false, 'error', 'AI-drafted invoice requires human review and approval before finalization');
  END IF;

  SELECT COALESCE(use_canonical_units, false) INTO v_use_canonical FROM system_settings LIMIT 1;
  SELECT store_id INTO v_store_id FROM invoices WHERE id = p_invoice_id;

  FOR v_line IN
    SELECT li.id, li.invoice_id, li.product_id, li.product_name,
           li.brand_id, li.brand, li.line_subtotal,
           li.computed_tubes_total, li.computed_units_total,
           p.track_by
    FROM invoice_line_items li
    LEFT JOIN products p ON p.id = li.product_id
    WHERE li.invoice_id = p_invoice_id
  LOOP
    v_units := CASE
      WHEN v_use_canonical THEN COALESCE(v_line.computed_units_total, v_line.computed_tubes_total)
      ELSE COALESCE(v_line.computed_tubes_total, v_line.computed_units_total)
    END;
    IF v_line.track_by = 'tubes' THEN
      INSERT INTO tube_sale_ledger (invoice_id, line_item_id, store_id, brand_id, brand, product_id, product_name, tubes_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.brand, v_line.product_id, v_line.product_name, -ABS(v_units), 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    ELSIF v_line.track_by = 'bags' THEN
      INSERT INTO bag_sale_ledger (invoice_id, line_item_id, store_id, brand_id, product_id, product_name, bags_delta, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_store_id, v_line.brand_id, v_line.product_id, v_line.product_name, -ABS(v_units)::int, 'finalized', p_user_id)
      ON CONFLICT DO NOTHING;
    END IF;
    v_remaining := ABS(v_units)::int;
    FOR v_cost_layer IN
      SELECT id, unit_cost, units_in, units_consumed FROM inventory_cost_ledger
      WHERE product_id = v_line.product_id AND units_consumed < units_in
      ORDER BY received_at ASC, created_at ASC
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_consume := LEAST(v_remaining, v_cost_layer.units_in - v_cost_layer.units_consumed);
      INSERT INTO cogs_ledger (invoice_id, line_item_id, product_id, product_name, cost_layer_id, units_consumed, unit_cost, total_cost, source, recorded_by)
      VALUES (v_line.invoice_id, v_line.id, v_line.product_id, v_line.product_name, v_cost_layer.id, v_consume, v_cost_layer.unit_cost, v_consume * v_cost_layer.unit_cost, 'invoice_finalized', p_user_id)
      ON CONFLICT (invoice_id, line_item_id, product_id, cost_layer_id) DO NOTHING;
      UPDATE inventory_cost_ledger SET units_consumed = units_consumed + v_consume WHERE id = v_cost_layer.id;
      v_remaining := v_remaining - v_consume;
    END LOOP;
  END LOOP;

  UPDATE invoices SET
    subtotal = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    total_amount = COALESCE((SELECT SUM(line_subtotal) FROM invoice_line_items WHERE invoice_id = p_invoice_id), 0),
    status = 'finalized', finalized_at = now(), finalized_by = p_user_id
  WHERE id = p_invoice_id;

  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id, 'flag_used', v_use_canonical, 'message', 'Invoice finalized with COGS allocation');
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Human approval RPC: flips draft_ai -> draft after reviewer signs off
CREATE OR REPLACE FUNCTION public.approve_ai_draft_invoice(p_invoice_id uuid, p_reviewer uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM invoices WHERE id = p_invoice_id;
  IF v_status <> 'draft_ai' THEN
    RETURN json_build_object('success', false, 'error', 'Invoice is not an AI draft');
  END IF;
  UPDATE invoices SET status = 'draft', updated_at = now() WHERE id = p_invoice_id;
  UPDATE ai_backfill_items SET status='reviewed', reviewed_by=p_reviewer, reviewed_at=now()
    WHERE entity_type='invoice' AND entity_id=p_invoice_id;
  RETURN json_build_object('success', true, 'invoice_id', p_invoice_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.approve_ai_draft_invoice(uuid, uuid) TO authenticated, service_role;
