-- 1) Ambassador store access: make the older access helpers honour the canonical
--    shared-territory rule (ambassador_has_store_access) so RLS on tube counts,
--    notes, invoices and line items matches what the portal shows.
CREATE OR REPLACE FUNCTION public.user_has_store_access(_store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    public.is_elevated_user(auth.uid())
    OR EXISTS (SELECT 1 FROM public.user_store_map WHERE user_id = auth.uid() AND store_id = _store_id)
    OR EXISTS (SELECT 1 FROM public.driver_assignments da JOIN public.profiles p ON p.id = da.driver_id
               WHERE p.id = auth.uid() AND da.store_id = _store_id AND da.is_active = true)
    OR EXISTS (SELECT 1 FROM public.biker_assignments ba JOIN public.profiles p ON p.id = ba.biker_id
               WHERE p.id = auth.uid() AND ba.store_id = _store_id AND ba.is_active = true)
    OR EXISTS (SELECT 1 FROM public.ambassador_assignments aa JOIN public.ambassadors a ON a.id = aa.ambassador_id
               WHERE a.user_id = auth.uid() AND aa.store_id = _store_id AND aa.active = true)
    OR (public.has_role(auth.uid(), 'ambassador'::app_role) AND public.ambassador_has_store_access(auth.uid(), _store_id))
$function$;

CREATE OR REPLACE FUNCTION public.is_ambassador_for_store(_user_id uuid, _store_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.ambassador_assignments aa
    JOIN public.ambassadors a ON aa.ambassador_id = a.id
    WHERE a.user_id = _user_id AND aa.store_id = _store_id AND aa.active = true
  ) OR (public.has_role(_user_id, 'ambassador'::app_role) AND public.ambassador_has_store_access(_user_id, _store_id))
$function$;

-- 2) Last-seen helper: only moves store_master.last_visit_at forward.
CREATE OR REPLACE FUNCTION public.bump_store_last_visit(_store_id uuid, _ts timestamptz)
 RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  UPDATE public.store_master
     SET last_visit_at = _ts
   WHERE id = _store_id
     AND _ts IS NOT NULL AND _ts <= now() + interval '5 minutes'
     AND (last_visit_at IS NULL OR _ts > last_visit_at);
$function$;
REVOKE ALL ON FUNCTION public.bump_store_last_visit(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- field_submissions trigger: referenced a non-existent submitted_at column (crashed
-- every applied submission). Now also counts the act of submitting from the field.
CREATE OR REPLACE FUNCTION public.trg_bump_store_last_visit_at_fs()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.store_id IS NULL OR NEW.entity_type::text = 'new_store' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND NEW.submitted_by_role IN ('ambassador','driver','biker') THEN
    PERFORM public.bump_store_last_visit(NEW.store_id, COALESCE(NEW.created_at, now()));
  ELSIF TG_OP = 'UPDATE' AND NEW.is_applied IS TRUE AND OLD.is_applied IS NOT TRUE
        AND NEW.submitted_by_role IN ('ambassador','driver','biker') THEN
    PERFORM public.bump_store_last_visit(NEW.store_id, COALESCE(NEW.created_at, now()));
  END IF;
  RETURN NEW;
END;
$function$;

-- Generic: a field-role user touching a store = they were there.
CREATE OR REPLACE FUNCTION public.trg_bump_last_visit_by_field_actor()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.store_id IS NOT NULL AND auth.uid() IS NOT NULL AND public.is_field_role(auth.uid()) THEN
    PERFORM public.bump_store_last_visit(NEW.store_id, now());
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_store_notes_bump_last_visit ON public.store_notes;
CREATE TRIGGER trg_store_notes_bump_last_visit AFTER INSERT ON public.store_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_last_visit_by_field_actor();

DROP TRIGGER IF EXISTS trg_invoices_bump_last_visit_field ON public.invoices;
CREATE TRIGGER trg_invoices_bump_last_visit_field AFTER INSERT OR UPDATE OF payment_status, amount_paid ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_last_visit_by_field_actor();

DROP TRIGGER IF EXISTS trg_tube_status_bump_last_visit_field ON public.store_tube_inventory_status;
CREATE TRIGGER trg_tube_status_bump_last_visit_field AFTER INSERT OR UPDATE OF current_tubes_left ON public.store_tube_inventory_status
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_last_visit_by_field_actor();

DROP TRIGGER IF EXISTS trg_visit_logs_bump_last_visit_field ON public.visit_logs;
CREATE TRIGGER trg_visit_logs_bump_last_visit_field AFTER INSERT ON public.visit_logs
  FOR EACH ROW EXECUTE FUNCTION public.trg_bump_last_visit_by_field_actor();

-- 3) apply_field_submission: fix column mismatches in every branch; unknown
--    entity types now fail closed instead of being marked applied silently.
CREATE OR REPLACE FUNCTION public.apply_field_submission(p_submission_id uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_submission public.field_submissions%ROWTYPE;
  p jsonb;
  v_group_id uuid;
  v_new_store_id uuid;
  v_ambassador_id uuid;
  v_brand text;
  v_field text;
  v_count int;
  v_needs_order boolean;
  v_bring_samples boolean;
  v_bring_starter boolean;
  v_owner_interested boolean;
  v_introduced boolean;
  v_needs_switch boolean;
BEGIN
  SELECT * INTO v_submission FROM public.field_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'submission not found');
  END IF;
  IF v_submission.is_applied THEN
    RETURN jsonb_build_object('success', false, 'error', 'already applied');
  END IF;
  p := COALESCE(v_submission.payload_after, '{}'::jsonb);

  CASE v_submission.entity_type::text
    WHEN 'new_store' THEN
      IF v_submission.action_type = 'create' THEN
        IF v_submission.submitted_by_role = 'ambassador' THEN
          SELECT id INTO v_ambassador_id FROM public.ambassadors
          WHERE user_id = v_submission.submitted_by_user_id LIMIT 1;
        END IF;
        INSERT INTO public.store_master (
          store_name, address, city, state, zip, phone, owner_name, notes,
          sourced_by_ambassador_id, assigned_ambassador_id, sourced_at
        ) VALUES (
          p->>'store_name', p->>'address', p->>'city', p->>'state', p->>'zip',
          NULLIF(p->>'phone',''), NULLIF(p->>'owner_name',''),
          NULLIF(concat_ws(E'\n',
            NULLIF(p->>'neighborhood',''),
            CASE WHEN p ? 'brand_interest' THEN 'Brand interest: ' || (p->>'brand_interest') END,
            NULLIF(p->>'notes','')), ''),
          v_ambassador_id, v_ambassador_id, NOW()
        ) RETURNING id INTO v_new_store_id;
        UPDATE public.field_submissions SET store_id = v_new_store_id, entity_id = v_new_store_id
        WHERE id = p_submission_id;
      END IF;

    WHEN 'brand_sticker', 'sticker_change' THEN
      IF v_submission.action_type = 'update' AND v_submission.entity_id IS NOT NULL THEN
        UPDATE public.store_brand_stickers SET
          front_door_sticker = COALESCE((p->>'front_door_sticker')::boolean, front_door_sticker),
          authorized_retailer_sticker = COALESCE((p->>'authorized_retailer_sticker')::boolean, authorized_retailer_sticker),
          brand_character_sticker = COALESCE((p->>'brand_character_sticker')::boolean, brand_character_sticker),
          telephone_number_sticker = COALESCE((p->>'telephone_number_sticker')::boolean, telephone_number_sticker),
          notes = COALESCE(p->>'notes', notes),
          last_verified_by = v_submission.submitted_by_user_id,
          last_verified_at = NOW(),
          last_updated_by_role = v_submission.submitted_by_role,
          updated_at = NOW()
        WHERE id = v_submission.entity_id;
      END IF;

    WHEN 'store_contact' THEN
      IF v_submission.action_type = 'create' THEN
        INSERT INTO public.store_contacts (
          store_id, name, phone, role, shirt_size, notes, is_primary, responsive_by_call, responsive_by_text
        ) VALUES (
          v_submission.store_id, p->>'name', p->>'phone', p->>'role', p->>'shirt_size', p->>'notes',
          COALESCE((p->>'is_primary')::boolean, false),
          (p->>'responsive_by_call')::boolean, (p->>'responsive_by_text')::boolean
        );
      ELSIF v_submission.action_type = 'update' AND v_submission.entity_id IS NOT NULL THEN
        UPDATE public.store_contacts SET
          name = COALESCE(p->>'name', name),
          phone = COALESCE(p->>'phone', phone),
          role = COALESCE(p->>'role', role),
          shirt_size = COALESCE(p->>'shirt_size', shirt_size),
          notes = COALESCE(p->>'notes', notes),
          is_primary = COALESCE((p->>'is_primary')::boolean, is_primary),
          responsive_by_call = COALESCE((p->>'responsive_by_call')::boolean, responsive_by_call),
          responsive_by_text = COALESCE((p->>'responsive_by_text')::boolean, responsive_by_text)
        WHERE id = v_submission.entity_id;
      ELSIF v_submission.action_type = 'delete' AND v_submission.entity_id IS NOT NULL THEN
        -- soft delete only
        UPDATE public.store_contacts SET deleted_at = NOW(), deleted_by = v_submission.submitted_by_user_id,
               delete_reason = 'field submission'
        WHERE id = v_submission.entity_id AND deleted_at IS NULL;
      END IF;

    WHEN 'tube_inventory' THEN
      IF v_submission.action_type IN ('create', 'update') THEN
        v_brand := NULLIF(trim(p->>'brand_id'), '');
        IF v_brand IS NULL AND v_submission.entity_id IS NOT NULL THEN
          SELECT brand_id INTO v_brand FROM public.store_tube_inventory_status WHERE id = v_submission.entity_id;
        END IF;
        IF v_brand IS NULL OR v_submission.store_id IS NULL THEN
          RETURN jsonb_build_object('success', false, 'error', 'tube_inventory submission missing store_id or brand_id');
        END IF;
        v_field := p->>'field';
        -- Accept both payload shapes: direct columns, or {field, value} from the signal toggles.
        v_count := COALESCE(NULLIF(p->>'current_tubes_left','')::int,
                            CASE WHEN v_field = 'current_tubes_left' THEN NULLIF(p->>'value','')::int END);
        v_needs_order := COALESCE((p->>'needs_order')::boolean, CASE WHEN v_field = 'needs_order' THEN (p->>'value')::boolean END);
        v_bring_samples := COALESCE((p->>'bring_samples')::boolean, CASE WHEN v_field = 'bring_samples' THEN (p->>'value')::boolean END);
        v_bring_starter := COALESCE((p->>'bring_starter_kit')::boolean, CASE WHEN v_field = 'bring_starter_kit' THEN (p->>'value')::boolean END);
        v_owner_interested := COALESCE((p->>'owner_interested')::boolean, CASE WHEN v_field = 'owner_interested' THEN (p->>'value')::boolean END);
        v_introduced := COALESCE((p->>'product_introduced')::boolean, CASE WHEN v_field = 'product_introduced' THEN (p->>'value')::boolean END);
        v_needs_switch := COALESCE((p->>'needs_switch')::boolean, CASE WHEN v_field = 'needs_switch' THEN (p->>'value')::boolean END);

        UPDATE public.store_tube_inventory_status t SET
          current_tubes_left = COALESCE(v_count, t.current_tubes_left),
          needs_order = COALESCE(v_needs_order, t.needs_order),
          bring_samples = COALESCE(v_bring_samples, t.bring_samples),
          bring_starter_kit = COALESCE(v_bring_starter, t.bring_starter_kit),
          owner_interested = COALESCE(v_owner_interested, t.owner_interested),
          product_introduced = COALESCE(v_introduced, t.product_introduced),
          needs_switch = COALESCE(v_needs_switch, t.needs_switch),
          last_updated_by = v_submission.submitted_by_user_id,
          last_updated_by_role = v_submission.submitted_by_role,
          last_updated_method = 'ambassador_app',
          last_updated_at = NOW(),
          last_inventory_check_by = CASE WHEN v_count IS NOT NULL THEN v_submission.submitted_by_user_id ELSE t.last_inventory_check_by END
        WHERE t.store_id = v_submission.store_id AND t.brand_id = v_brand AND t.is_simulation = false;

        IF NOT FOUND THEN
          INSERT INTO public.store_tube_inventory_status (
            store_id, brand_id, brand_name, is_simulation, current_tubes_left, needs_order,
            bring_samples, bring_starter_kit, owner_interested, product_introduced, needs_switch,
            last_updated_by, last_updated_by_role, last_updated_method, last_updated_at, last_inventory_check_by
          ) VALUES (
            v_submission.store_id, v_brand, COALESCE(p->>'brand_name', v_brand), false, COALESCE(v_count, 0),
            COALESCE(v_needs_order, false), COALESCE(v_bring_samples, false), COALESCE(v_bring_starter, false),
            v_owner_interested, COALESCE(v_introduced, false), COALESCE(v_needs_switch, false),
            v_submission.submitted_by_user_id, v_submission.submitted_by_role, 'ambassador_app', NOW(),
            CASE WHEN v_count IS NOT NULL THEN v_submission.submitted_by_user_id END
          );
        END IF;
      END IF;

    WHEN 'connected_store' THEN
      IF v_submission.action_type = 'create' THEN
        SELECT connected_store_group_id INTO v_group_id FROM public.store_master WHERE id = v_submission.store_id;
        IF v_group_id IS NULL THEN
          v_group_id := gen_random_uuid();
          UPDATE public.store_master SET connected_store_group_id = v_group_id WHERE id = v_submission.store_id;
        END IF;
      END IF;

    WHEN 'store_questionnaire' THEN
      IF v_submission.action_type IN ('create', 'update') THEN
        INSERT INTO public.store_questionnaire (
          store_id, security_level, sells_flowers, interested_cleaning_service,
          additional_items_wanted, top_selling_items, most_needed_items, last_verified_by, last_verified_at
        ) VALUES (
          v_submission.store_id, p->>'security_level', (p->>'sells_flowers')::boolean,
          (p->>'interested_cleaning_service')::boolean, p->>'additional_items_wanted',
          p->>'top_selling_items', p->>'most_needed_items', v_submission.submitted_by_user_id, NOW()
        )
        ON CONFLICT (store_id) DO UPDATE SET
          security_level = COALESCE(EXCLUDED.security_level, store_questionnaire.security_level),
          sells_flowers = COALESCE(EXCLUDED.sells_flowers, store_questionnaire.sells_flowers),
          interested_cleaning_service = COALESCE(EXCLUDED.interested_cleaning_service, store_questionnaire.interested_cleaning_service),
          additional_items_wanted = COALESCE(EXCLUDED.additional_items_wanted, store_questionnaire.additional_items_wanted),
          top_selling_items = COALESCE(EXCLUDED.top_selling_items, store_questionnaire.top_selling_items),
          most_needed_items = COALESCE(EXCLUDED.most_needed_items, store_questionnaire.most_needed_items),
          last_verified_by = EXCLUDED.last_verified_by,
          last_verified_at = EXCLUDED.last_verified_at;
      END IF;

    WHEN 'visit_log' THEN
      -- The field portal's visit table is store_visits (visit_logs has a different shape).
      IF v_submission.action_type = 'create' THEN
        INSERT INTO public.store_visits (store_id, visited_by, role_type, visit_type, status, notes, started_at, completed_at)
        VALUES (
          v_submission.store_id, v_submission.submitted_by_user_id, v_submission.submitted_by_role,
          COALESCE(p->>'visit_type', 'check'), 'completed', p->>'notes',
          COALESCE((p->>'visited_at')::timestamptz, v_submission.created_at, NOW()),
          COALESCE((p->>'visited_at')::timestamptz, v_submission.created_at, NOW())
        );
      END IF;

    WHEN 'store_update' THEN
      IF v_submission.action_type = 'update' AND v_submission.store_id IS NOT NULL THEN
        UPDATE public.store_master SET
          phone = COALESCE(p->>'phone', phone),
          owner_name = COALESCE(p->>'owner_name', owner_name),
          notes = COALESCE(p->>'notes', notes)
        WHERE id = v_submission.store_id;
      END IF;

    WHEN 'wholesaler_association' THEN
      IF v_submission.action_type = 'create' THEN
        IF NULLIF(p->>'wholesaler_id','') IS NULL THEN
          RETURN jsonb_build_object('success', false,
            'error', 'new wholesaler must be created by the office first (no wholesaler_id on submission)');
        END IF;
        INSERT INTO public.store_wholesaler_associations (store_id, wholesaler_id, created_by)
        VALUES (v_submission.store_id, (p->>'wholesaler_id')::uuid, v_submission.submitted_by_user_id)
        ON CONFLICT (store_id, wholesaler_id) DO NOTHING;
      END IF;

    ELSE
      RETURN jsonb_build_object('success', false,
        'error', 'apply_field_submission has no handler for entity_type ' || v_submission.entity_type::text);
  END CASE;

  UPDATE public.field_submissions
  SET is_applied = true, submission_status = 'approved', applied_at = NOW()
  WHERE id = p_submission_id;

  RETURN jsonb_build_object('success', true, 'submission_id', p_submission_id, 'new_store_id', v_new_store_id);
END;
$function$;