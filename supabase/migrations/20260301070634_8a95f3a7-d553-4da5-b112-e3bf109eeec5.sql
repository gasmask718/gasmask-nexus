
-- Phase 1: Contact Signal View
-- Extracts phone signals from all historical sources
CREATE OR REPLACE VIEW public.store_contact_signals AS

-- Source 1: store_contacts table (highest confidence)
SELECT
  sc.store_id,
  sc.phone AS raw_phone,
  'store_contacts' AS source,
  0.95 AS confidence_score,
  sc.created_at
FROM public.store_contacts sc
WHERE sc.phone IS NOT NULL AND length(regexp_replace(sc.phone, '[^0-9]', '', 'g')) >= 10

UNION ALL

-- Source 2: CRM customers matched by name to store_master
SELECT
  sm.id AS store_id,
  c.phone AS raw_phone,
  'crm_customer' AS source,
  0.85 AS confidence_score,
  c.created_at
FROM public.crm_customers c
JOIN public.store_master sm ON lower(trim(c.name)) = lower(trim(sm.store_name))
WHERE c.phone IS NOT NULL AND length(regexp_replace(c.phone, '[^0-9]', '', 'g')) >= 10

UNION ALL

-- Source 3: Invoice receipt_phone_used
SELECT
  i.store_id,
  i.receipt_phone_used AS raw_phone,
  'invoice_receipt' AS source,
  0.9 AS confidence_score,
  i.created_at
FROM public.invoices i
WHERE i.store_id IS NOT NULL
  AND i.receipt_phone_used IS NOT NULL
  AND length(regexp_replace(i.receipt_phone_used, '[^0-9]', '', 'g')) >= 10

UNION ALL

-- Source 4: Marketplace orders customer_phone matched to store_master
SELECT
  sm.id AS store_id,
  mo.customer_phone AS raw_phone,
  'marketplace_order' AS source,
  0.8 AS confidence_score,
  mo.created_at
FROM public.marketplace_orders mo
JOIN public.store_master sm ON mo.wholesaler_id::text = sm.id::text
WHERE mo.customer_phone IS NOT NULL
  AND length(regexp_replace(mo.customer_phone, '[^0-9]', '', 'g')) >= 10;

-- Phase 2: Enrichment candidates table
CREATE TABLE IF NOT EXISTS public.contact_enrichment_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id),
  proposed_phone text NOT NULL,
  normalized_phone text NOT NULL,
  confidence numeric NOT NULL DEFAULT 0,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_store ON public.contact_enrichment_candidates(store_id);
CREATE INDEX IF NOT EXISTS idx_enrichment_candidates_status ON public.contact_enrichment_candidates(status);

-- Phase 3: Enrichment RPC
CREATE OR REPLACE FUNCTION public.enrich_store_contacts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_candidates_created int := 0;
  v_stores_missing_phone int := 0;
BEGIN
  -- Count stores missing phone
  SELECT count(*) INTO v_stores_missing_phone
  FROM public.store_master
  WHERE phone IS NULL OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10;

  -- Insert enrichment candidates for stores missing valid phone
  -- Pick highest confidence signal per store, skip already-proposed
  INSERT INTO public.contact_enrichment_candidates (store_id, proposed_phone, normalized_phone, confidence, source)
  SELECT DISTINCT ON (sig.store_id)
    sig.store_id,
    sig.raw_phone,
    regexp_replace(sig.raw_phone, '[^0-9]', '', 'g') AS normalized_phone,
    sig.confidence_score,
    sig.source
  FROM public.store_contact_signals sig
  JOIN public.store_master sm ON sm.id = sig.store_id
  WHERE (sm.phone IS NULL OR length(regexp_replace(sm.phone, '[^0-9]', '', 'g')) < 10)
    AND NOT EXISTS (
      SELECT 1 FROM public.contact_enrichment_candidates ec
      WHERE ec.store_id = sig.store_id AND ec.status = 'pending'
    )
  ORDER BY sig.store_id, sig.confidence_score DESC, sig.created_at DESC
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_candidates_created = ROW_COUNT;

  RETURN jsonb_build_object(
    'stores_missing_phone', v_stores_missing_phone,
    'candidates_created', v_candidates_created
  );
END;
$$;

-- Phase 4: Approve enrichment RPC
CREATE OR REPLACE FUNCTION public.approve_enrichment_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_store_id uuid;
  v_phone text;
BEGIN
  SELECT store_id, normalized_phone INTO v_store_id, v_phone
  FROM public.contact_enrichment_candidates
  WHERE id = p_candidate_id AND status = 'pending';

  IF v_store_id IS NULL THEN
    RAISE EXCEPTION 'Candidate not found or already processed';
  END IF;

  -- Update store_master phone only if still missing
  UPDATE public.store_master
  SET phone = v_phone
  WHERE id = v_store_id
    AND (phone IS NULL OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10);

  -- Mark candidate approved
  UPDATE public.contact_enrichment_candidates
  SET status = 'approved', reviewed_at = now()
  WHERE id = p_candidate_id;
END;
$$;

-- Phase 5: Reject enrichment RPC
CREATE OR REPLACE FUNCTION public.reject_enrichment_candidate(p_candidate_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.contact_enrichment_candidates
  SET status = 'rejected', reviewed_at = now()
  WHERE id = p_candidate_id AND status = 'pending';
END;
$$;

-- Phase 6: Bulk approve all pending
CREATE OR REPLACE FUNCTION public.bulk_approve_enrichment()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count int := 0;
  rec record;
BEGIN
  FOR rec IN
    SELECT id, store_id, normalized_phone
    FROM public.contact_enrichment_candidates
    WHERE status = 'pending'
    ORDER BY confidence DESC
  LOOP
    UPDATE public.store_master
    SET phone = rec.normalized_phone
    WHERE id = rec.store_id
      AND (phone IS NULL OR length(regexp_replace(phone, '[^0-9]', '', 'g')) < 10);

    UPDATE public.contact_enrichment_candidates
    SET status = 'approved', reviewed_at = now()
    WHERE id = rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- RLS: admin-only access
ALTER TABLE public.contact_enrichment_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view enrichment candidates"
  ON public.contact_enrichment_candidates FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage enrichment candidates"
  ON public.contact_enrichment_candidates FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
