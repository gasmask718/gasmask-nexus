-- 1. Upgrade the line-intel table
ALTER TABLE public.twilio_lookup_results
  ADD COLUMN IF NOT EXISTS valid boolean,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'twilio_lookup',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.twilio_lookup_results SET status = 'stop' WHERE status = 'dead';
UPDATE public.twilio_lookup_results SET status = 'unknown' WHERE status IS NULL;

ALTER TABLE public.twilio_lookup_results
  DROP CONSTRAINT IF EXISTS twilio_lookup_results_status_check;
ALTER TABLE public.twilio_lookup_results
  ADD CONSTRAINT twilio_lookup_results_status_check
  CHECK (status IN ('live','stop','unknown'));

ALTER TABLE public.twilio_lookup_results
  DROP CONSTRAINT IF EXISTS twilio_lookup_results_phone10_check;
ALTER TABLE public.twilio_lookup_results
  ADD CONSTRAINT twilio_lookup_results_phone10_check
  CHECK (phone10 ~ '^[0-9]{10}$');

CREATE INDEX IF NOT EXISTS idx_twilio_lookup_results_status ON public.twilio_lookup_results(status);
CREATE INDEX IF NOT EXISTS idx_twilio_lookup_results_line_type ON public.twilio_lookup_results(line_type);

GRANT SELECT ON public.twilio_lookup_results TO authenticated;
GRANT ALL ON public.twilio_lookup_results TO service_role;
ALTER TABLE public.twilio_lookup_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated staff can read line intel" ON public.twilio_lookup_results;
CREATE POLICY "Authenticated staff can read line intel"
  ON public.twilio_lookup_results FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role manages line intel" ON public.twilio_lookup_results;
CREATE POLICY "Service role manages line intel"
  ON public.twilio_lookup_results FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. Contact-level view: what the dialer and VA console read
CREATE OR REPLACE VIEW public.v_contact_line_intel AS
SELECT
  sc.id                AS contact_id,
  sc.store_id,
  sc.name              AS contact_name,
  sc.phone,
  right(regexp_replace(coalesce(sc.phone,''), '\D', '', 'g'), 10) AS phone_last10,
  sc.is_primary,
  sc.responsiveness_status,
  sc.opted_out,
  t.line_type,
  t.carrier,
  t.valid              AS line_valid,
  t.status             AS line_status,
  t.checked_on         AS line_checked_on,
  CASE WHEN t.checked_on IS NULL THEN NULL
       ELSE (CURRENT_DATE - t.checked_on) END AS line_check_age_days,
  CASE WHEN t.checked_on IS NULL THEN true
       ELSE (CURRENT_DATE - t.checked_on) > 180 END AS line_check_stale,
  (t.line_type = 'mobile')                                  AS is_mobile_line,
  (t.line_type IN ('landline','fixedVoip'))                 AS is_premises_line,
  coalesce(t.status, 'unknown') <> 'stop'                   AS line_survives
FROM public.store_contacts sc
LEFT JOIN public.twilio_lookup_results t
  ON t.phone10 = right(regexp_replace(coalesce(sc.phone,''), '\D', '', 'g'), 10)
WHERE sc.deleted_at IS NULL;

GRANT SELECT ON public.v_contact_line_intel TO authenticated;

-- 3. Store-level coverage: who loses their last reachable number
CREATE OR REPLACE VIEW public.v_store_line_coverage AS
WITH nums AS (
  SELECT store_id, right(regexp_replace(coalesce(phone,''), '\D','','g'),10) AS p10
  FROM public.store_contacts WHERE deleted_at IS NULL AND phone IS NOT NULL
  UNION
  SELECT id, right(regexp_replace(coalesce(phone,''), '\D','','g'),10) FROM public.stores WHERE phone IS NOT NULL
  UNION
  SELECT id, right(regexp_replace(coalesce(alt_phone,''), '\D','','g'),10) FROM public.stores WHERE alt_phone IS NOT NULL
  UNION
  SELECT id, right(regexp_replace(coalesce(phone,''), '\D','','g'),10) FROM public.store_master WHERE deleted_at IS NULL AND phone IS NOT NULL
),
scored AS (
  SELECT n.store_id, n.p10, t.line_type, coalesce(t.status,'unknown') AS status, t.checked_on
  FROM nums n LEFT JOIN public.twilio_lookup_results t ON t.phone10 = n.p10
  WHERE length(n.p10) = 10
)
SELECT
  s.store_id,
  sm.store_name,
  count(*)                                                        AS total_numbers,
  count(*) FILTER (WHERE s.checked_on IS NOT NULL)                AS checked_numbers,
  count(*) FILTER (WHERE s.status = 'stop')                       AS stop_numbers,
  count(*) FILTER (WHERE s.status <> 'stop')                      AS surviving_numbers,
  count(*) FILTER (WHERE s.status <> 'stop' AND s.line_type = 'mobile')                    AS surviving_mobile,
  count(*) FILTER (WHERE s.status <> 'stop' AND s.line_type IN ('landline','fixedVoip'))   AS surviving_premises,
  max(s.checked_on)                                               AS last_checked_on,
  coalesce(p.open_balance, 0)                                     AS open_balance,
  coalesce(p.overdue_amount, 0)                                   AS overdue_amount,
  (count(*) FILTER (WHERE s.status <> 'stop') = 0)                AS lost_all_numbers,
  (count(*) FILTER (WHERE s.status <> 'stop') > 0
   AND count(*) FILTER (WHERE s.status <> 'stop' AND s.line_type IN ('landline','fixedVoip')) = 0
   AND count(*) FILTER (WHERE s.checked_on IS NOT NULL) > 0)      AS mobile_only
FROM scored s
LEFT JOIN public.store_master sm ON sm.id = s.store_id
LEFT JOIN public.v_money_store_profitability p ON p.store_id = s.store_id
GROUP BY s.store_id, sm.store_name, p.open_balance, p.overdue_amount;

GRANT SELECT ON public.v_store_line_coverage TO authenticated;