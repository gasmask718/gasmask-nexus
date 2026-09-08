CREATE OR REPLACE FUNCTION public.dd_creator_update_draft(p_draft_id uuid, p_patch jsonb)
RETURNS TABLE(id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := false;
  v_unknown_keys text[];
  v_status text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
  END IF;

  v_is_admin := public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'owner'::public.app_role);

  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'patch must be a JSON object';
  END IF;

  SELECT array_agg(k ORDER BY k)
  INTO v_unknown_keys
  FROM jsonb_object_keys(p_patch) AS k
  WHERE k <> ALL (ARRAY[
    'product_name','cost','recognition','copy','category','selected','image_variants',
    'no_printed_label','weight_oz','dimensions','status'
  ]::text[]);

  IF v_unknown_keys IS NOT NULL THEN
    RAISE EXCEPTION 'unsupported draft fields: %', array_to_string(v_unknown_keys, ', ');
  END IF;

  IF p_patch ? 'status' THEN
    v_status := p_patch->>'status';
    IF v_status IS DISTINCT FROM 'pending_admin_review' THEN
      RAISE EXCEPTION 'camera intake may only submit a draft for admin review';
    END IF;
  END IF;

  RETURN QUERY
  UPDATE public.dd_catalog_drafts d SET
    product_name = CASE WHEN p_patch ? 'product_name' THEN NULLIF(btrim(p_patch->>'product_name'), '') ELSE d.product_name END,
    cost = CASE WHEN p_patch ? 'cost' THEN NULLIF(p_patch->>'cost', '')::numeric ELSE d.cost END,
    recognition = CASE WHEN p_patch ? 'recognition' THEN p_patch->'recognition' ELSE d.recognition END,
    copy = CASE WHEN p_patch ? 'copy' THEN p_patch->'copy' ELSE d.copy END,
    category = CASE WHEN p_patch ? 'category' THEN NULLIF(p_patch->>'category', '') ELSE d.category END,
    selected = CASE WHEN p_patch ? 'selected' THEN p_patch->'selected' ELSE d.selected END,
    image_variants = CASE WHEN p_patch ? 'image_variants' THEN p_patch->'image_variants' ELSE d.image_variants END,
    no_printed_label = CASE WHEN p_patch ? 'no_printed_label' THEN (p_patch->>'no_printed_label')::boolean ELSE d.no_printed_label END,
    weight_oz = CASE WHEN p_patch ? 'weight_oz' THEN NULLIF(p_patch->>'weight_oz', '')::numeric ELSE d.weight_oz END,
    dimensions = CASE WHEN p_patch ? 'dimensions' THEN p_patch->'dimensions' ELSE d.dimensions END,
    status = CASE WHEN p_patch ? 'status' THEN v_status ELSE d.status END,
    submitted_by = CASE WHEN (p_patch->>'status') = 'pending_admin_review' THEN v_uid ELSE d.submitted_by END,
    submitted_at = CASE WHEN (p_patch->>'status') = 'pending_admin_review' THEN now() ELSE d.submitted_at END,
    updated_at = now()
  WHERE d.id = p_draft_id
    AND (d.created_by = v_uid OR v_is_admin)
  RETURNING d.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft not found or you do not have permission to edit it' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.dd_creator_update_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dd_creator_update_draft(uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.dd_creator_update_draft(uuid, jsonb) IS 'Verified allowlisted camera/onboarding draft update for the owning creator or an admin/owner; prevents exposure of protected pricing fields.';