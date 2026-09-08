ALTER TABLE public.dd_catalog_drafts
  ADD COLUMN IF NOT EXISTS pack_count integer,
  ADD COLUMN IF NOT EXISTS pack_count_source text,
  ADD COLUMN IF NOT EXISTS pack_count_set_by uuid,
  ADD COLUMN IF NOT EXISTS pack_count_set_at timestamptz;

COMMENT ON COLUMN public.dd_catalog_drafts.pack_count IS 'Units per sold pack. Only from deterministic text parse (recognition/label) or a human entry — never guessed.';
COMMENT ON COLUMN public.dd_catalog_drafts.pack_count_source IS 'human | label_units_per_case | recognition.size_or_count | recognition.package_text | label_extraction.*';

CREATE OR REPLACE VIEW public.dd_admin_catalog_drafts AS
 SELECT id, created_by, product_name, supplier_id, cost, input_photos, candidates, enhanced, staged, selected, copy, pricing, status, published_product_id, notes, created_at, updated_at, inventory_qty, weight_oz, dimensions, category, confirmed_at, confirmed_by, measurements_verified_at, measurements_verified_by, market_check, measurements_estimate, price_research, image_variants, recognition, submitted_by, submitted_at, submitted_by_wholesaler_id, rejection_reason, reviewed_by, reviewed_at, selected_candidate_urls, label_photo_url, label_extraction, sku, no_printed_label, source,
        sourced_specs, pack_count, pack_count_source, pack_count_set_by, pack_count_set_at
   FROM public.dd_catalog_drafts d
  WHERE has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'owner'::app_role);

CREATE OR REPLACE FUNCTION public.dd_admin_update_draft(p_draft_id uuid, p_patch jsonb)
RETURNS SETOF public.dd_catalog_drafts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
BEGIN
  IF v_uid IS NULL OR NOT (has_role(v_uid, 'admin'::app_role) OR has_role(v_uid, 'owner'::app_role)) THEN
    RAISE EXCEPTION 'forbidden: catalog review is admin/owner only' USING ERRCODE = '42501';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch must be a JSON object';
  END IF;
  IF (p_patch ? 'status') AND (p_patch->>'status') <> 'rejected' THEN
    RAISE EXCEPTION 'status may only be set to rejected via review; publishing goes through the pipeline';
  END IF;

  RETURN QUERY
  UPDATE public.dd_catalog_drafts d SET
    pricing          = CASE WHEN p_patch ? 'pricing' THEN p_patch->'pricing' ELSE d.pricing END,
    cost             = CASE WHEN p_patch ? 'cost' THEN NULLIF(p_patch->>'cost','')::numeric ELSE d.cost END,
    pack_count       = CASE WHEN p_patch ? 'pack_count' THEN NULLIF(p_patch->>'pack_count','')::integer ELSE d.pack_count END,
    pack_count_source= CASE WHEN p_patch ? 'pack_count' THEN CASE WHEN NULLIF(p_patch->>'pack_count','') IS NULL THEN NULL ELSE 'human' END ELSE d.pack_count_source END,
    pack_count_set_by= CASE WHEN p_patch ? 'pack_count' THEN v_uid ELSE d.pack_count_set_by END,
    pack_count_set_at= CASE WHEN p_patch ? 'pack_count' THEN v_now ELSE d.pack_count_set_at END,
    weight_oz        = CASE WHEN p_patch ? 'weight_oz' THEN NULLIF(p_patch->>'weight_oz','')::numeric ELSE d.weight_oz END,
    dimensions       = CASE WHEN p_patch ? 'dimensions' THEN p_patch->'dimensions' ELSE d.dimensions END,
    -- "measurements confirmed" is a human-only stamp: always the calling admin + server time.
    measurements_verified_at = CASE WHEN COALESCE((p_patch->>'confirm_measurements')::boolean, false) THEN v_now ELSE d.measurements_verified_at END,
    measurements_verified_by = CASE WHEN COALESCE((p_patch->>'confirm_measurements')::boolean, false) THEN v_uid ELSE d.measurements_verified_by END,
    rejection_reason = CASE WHEN p_patch ? 'rejection_reason' THEN p_patch->>'rejection_reason' ELSE d.rejection_reason END,
    notes            = CASE WHEN p_patch ? 'notes' THEN p_patch->>'notes' ELSE d.notes END,
    status           = CASE WHEN p_patch ? 'status' THEN p_patch->>'status' ELSE d.status END,
    reviewed_by      = CASE WHEN (p_patch ? 'status') OR COALESCE((p_patch->>'confirm_measurements')::boolean,false) THEN v_uid ELSE d.reviewed_by END,
    reviewed_at      = CASE WHEN (p_patch ? 'status') OR COALESCE((p_patch->>'confirm_measurements')::boolean,false) THEN v_now ELSE d.reviewed_at END,
    updated_at       = v_now
  WHERE d.id = p_draft_id
  RETURNING d.*;
END;
$$;

REVOKE ALL ON FUNCTION public.dd_admin_update_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dd_admin_update_draft(uuid, jsonb) TO authenticated, service_role;