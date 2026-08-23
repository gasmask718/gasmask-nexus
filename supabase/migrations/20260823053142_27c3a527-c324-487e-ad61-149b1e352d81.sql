
-- ============================================================
-- 1. HELPER: core staff (see ALL offices) vs office-assigned users
-- ============================================================
CREATE OR REPLACE FUNCTION public.production_core_staff(p_user uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(p_user,'owner') OR public.has_role(p_user,'admin')
      OR public.has_role(p_user,'employee') OR public.has_role(p_user,'staff')
$$;

CREATE OR REPLACE FUNCTION public.production_office_member(p_user uuid, p_office uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.production_core_staff(p_user)
      OR EXISTS (SELECT 1 FROM public.production_office_users u
                 WHERE u.user_id = p_user AND u.office_id = p_office AND u.active IS NOT FALSE)
$$;

-- ============================================================
-- 2. ISSUANCE LEDGER — shipments header
-- ============================================================
CREATE TABLE public.production_office_shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.production_offices(id),
  sent_date date NOT NULL DEFAULT current_date,
  sent_by uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','received','disputed')),
  notes text,
  received_at timestamptz,
  received_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_office_shipments TO authenticated;
GRANT ALL ON public.production_office_shipments TO service_role;

ALTER TABLE public.production_office_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office members can view their office shipments"
  ON public.production_office_shipments FOR SELECT TO authenticated
  USING (public.production_office_member(auth.uid(), office_id));

CREATE POLICY "core staff can create shipments"
  ON public.production_office_shipments FOR INSERT TO authenticated
  WITH CHECK (public.production_core_staff(auth.uid()));

CREATE POLICY "office members can update their office shipments"
  ON public.production_office_shipments FOR UPDATE TO authenticated
  USING (public.production_office_member(auth.uid(), office_id))
  WITH CHECK (public.production_office_member(auth.uid(), office_id));

CREATE POLICY "core staff can delete shipments"
  ON public.production_office_shipments FOR DELETE TO authenticated
  USING (public.production_core_staff(auth.uid()));

-- ============================================================
-- 3. ISSUANCE LEDGER — shipment lines
-- ============================================================
CREATE TABLE public.production_office_shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.production_office_shipments(id) ON DELETE CASCADE,
  material_type text NOT NULL CHECK (material_type IN ('tobacco','empty_tubes','stickers','sleeves','empty_boxes','tools','other')),
  brand text,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'each' CHECK (unit IN ('lb','kg','each','roll')),
  unit_cost numeric,
  total_cost numeric,
  expected_yield_boxes integer,
  received_quantity numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_office_shipment_items TO authenticated;
GRANT ALL ON public.production_office_shipment_items TO service_role;

ALTER TABLE public.production_office_shipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "office members can view their shipment items"
  ON public.production_office_shipment_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_office_shipments s
                 WHERE s.id = shipment_id
                   AND public.production_office_member(auth.uid(), s.office_id)));

CREATE POLICY "core staff can create shipment items"
  ON public.production_office_shipment_items FOR INSERT TO authenticated
  WITH CHECK (public.production_core_staff(auth.uid()));

CREATE POLICY "office members can update their shipment items"
  ON public.production_office_shipment_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.production_office_shipments s
                 WHERE s.id = shipment_id
                   AND public.production_office_member(auth.uid(), s.office_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.production_office_shipments s
                 WHERE s.id = shipment_id
                   AND public.production_office_member(auth.uid(), s.office_id)));

CREATE POLICY "core staff can delete shipment items"
  ON public.production_office_shipment_items FOR DELETE TO authenticated
  USING (public.production_core_staff(auth.uid()));

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.production_office_shipments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipment_items_updated_at BEFORE UPDATE ON public.production_office_shipment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 4. BALANCE VIEW — issued minus consumed, per office per material
--    Consumption: tubes/stickers/boxes from production_batch_outputs,
--    tobacco (and anything else) from production_material_usage.
--    The WHERE clause scopes office leaders to their own office.
-- ============================================================
CREATE OR REPLACE VIEW public.v_office_material_balance
WITH (security_invoker = false) AS
WITH issued AS (
  SELECT s.office_id,
         i.material_type,
         i.brand,
         max(i.unit) AS unit,
         sum(i.quantity) AS total_issued,
         sum(COALESCE(i.received_quantity, 0)) AS total_received,
         sum(COALESCE(i.total_cost, 0)) AS total_issued_cost
  FROM public.production_office_shipment_items i
  JOIN public.production_office_shipments s ON s.id = i.shipment_id
  WHERE s.status <> 'disputed'
  GROUP BY s.office_id, i.material_type, i.brand
),
consumed AS (
  SELECT b.office_id, 'empty_tubes'::text AS material_type, o.brand, sum(o.tubes_used)::numeric AS qty
  FROM public.production_batch_outputs o
  JOIN public.production_batches b ON b.id = o.batch_id
  WHERE b.office_id IS NOT NULL
  GROUP BY b.office_id, o.brand
  UNION ALL
  SELECT b.office_id, 'stickers', o.brand, sum(o.stickers_used)::numeric
  FROM public.production_batch_outputs o
  JOIN public.production_batches b ON b.id = o.batch_id
  WHERE b.office_id IS NOT NULL
  GROUP BY b.office_id, o.brand
  UNION ALL
  SELECT b.office_id, 'empty_boxes', o.brand, sum(o.empty_boxes_used)::numeric
  FROM public.production_batch_outputs o
  JOIN public.production_batches b ON b.id = o.batch_id
  WHERE b.office_id IS NOT NULL
  GROUP BY b.office_id, o.brand
  UNION ALL
  SELECT m.office_id,
         CASE m.material_type::text
           WHEN 'tobacco_lbs' THEN 'tobacco'
           WHEN 'tubes' THEN 'empty_tubes'
           WHEN 'boxes' THEN 'empty_boxes'
           ELSE m.material_type::text
         END,
         NULL,
         sum(m.quantity_used)
  FROM public.production_material_usage m
  GROUP BY m.office_id, m.material_type
),
consumed_rollup AS (
  SELECT office_id, material_type, brand, sum(qty) AS total_consumed
  FROM consumed
  GROUP BY office_id, material_type, brand
)
SELECT COALESCE(i.office_id, c.office_id) AS office_id,
       o.name AS office_name,
       COALESCE(i.material_type, c.material_type) AS material_type,
       COALESCE(i.brand, c.brand) AS brand,
       i.unit,
       COALESCE(i.total_issued, 0) AS total_issued,
       COALESCE(i.total_received, 0) AS total_received,
       COALESCE(c.total_consumed, 0) AS total_consumed,
       COALESCE(i.total_issued, 0) - COALESCE(c.total_consumed, 0) AS expected_on_hand,
       COALESCE(i.total_issued_cost, 0) AS total_issued_cost
FROM issued i
FULL OUTER JOIN consumed_rollup c
  ON c.office_id = i.office_id
 AND c.material_type = i.material_type
 AND c.brand IS NOT DISTINCT FROM i.brand
LEFT JOIN public.production_offices o ON o.id = COALESCE(i.office_id, c.office_id)
WHERE public.production_office_member(auth.uid(), COALESCE(i.office_id, c.office_id));

GRANT SELECT ON public.v_office_material_balance TO authenticated;
GRANT SELECT ON public.v_office_material_balance TO service_role;

-- ============================================================
-- 5. INVITE CHAIN — accept_invite handles the production role:
--    creates the production_office_users row (manager, primary)
--    from the invite's target_link.office_id.
-- ============================================================
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_invite public.invites;
  v_uid UUID := auth.uid();
  v_target JSONB;
  v_redirect TEXT;
  v_role TEXT;
  v_name TEXT;
  v_business UUID;
  v_code TEXT;
  v_office UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'auth_required');
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_token');
  END IF;
  IF v_invite.status = 'accepted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_accepted');
  END IF;
  IF v_invite.status = 'revoked' THEN
    RETURN jsonb_build_object('success', false, 'error', 'revoked');
  END IF;
  IF v_invite.expires_at < now() THEN
    UPDATE public.invites SET status='expired' WHERE id = v_invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  v_role := v_invite.role::text;
  v_name := COALESCE(v_invite.sent_name, 'New ' || v_role);
  v_target := COALESCE(v_invite.target_link, '{}'::jsonb);

  v_business := NULLIF(v_target->>'business_id','')::uuid;
  IF v_business IS NULL THEN
    SELECT id INTO v_business FROM public.businesses WHERE name = 'GasMask' LIMIT 1;
  END IF;

  INSERT INTO public.user_roles (user_id, role, role_name, created_by)
  VALUES (v_uid, v_invite.role, v_role, v_invite.invited_by)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.user_profiles (user_id, primary_role, full_name, phone)
  VALUES (v_uid, v_role, v_invite.sent_name, v_invite.sent_to_phone)
  ON CONFLICT (user_id) DO UPDATE
    SET primary_role = COALESCE(NULLIF(public.user_profiles.primary_role, ''), EXCLUDED.primary_role),
        full_name = COALESCE(public.user_profiles.full_name, EXCLUDED.full_name),
        phone = COALESCE(public.user_profiles.phone, EXCLUDED.phone);

  IF v_invite.role = 'wholesaler' AND (v_target ? 'wholesaler_profile_id') THEN
    UPDATE public.wholesaler_profiles
       SET user_id = v_uid, status = 'active'
     WHERE id = (v_target->>'wholesaler_profile_id')::uuid;
    v_redirect := '/portals/wholesaler';
  ELSIF v_invite.role = 'wholesaler' THEN
    INSERT INTO public.wholesaler_profiles (user_id, company_name, contact_name, phone, email, status)
    VALUES (v_uid, COALESCE(v_target->>'company_name', v_invite.sent_name, 'New Wholesaler'),
            v_invite.sent_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active')
    ON CONFLICT DO NOTHING;
    v_redirect := '/portals/wholesaler';

  ELSIF v_invite.role = 'ambassador' THEN
    INSERT INTO public.ambassador_profiles (user_id) VALUES (v_uid) ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.user_id = v_uid) THEN
      LOOP
        v_code := upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ambassadors a WHERE a.tracking_code = v_code);
      END LOOP;
      INSERT INTO public.ambassadors (user_id, name, email, phone_primary, personal_phone, tracking_code, is_active, created_by)
      VALUES (v_uid, v_name, v_invite.sent_to_email, v_invite.sent_to_phone, v_invite.sent_to_phone, v_code, true, v_invite.invited_by);
    END IF;
    v_redirect := '/ambassador/dashboard';

  ELSIF v_invite.role = 'driver' THEN
    IF NOT EXISTS (SELECT 1 FROM public.drivers d WHERE d.user_id = v_uid) THEN
      INSERT INTO public.drivers (user_id, business_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_business, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/driver';

  ELSIF v_invite.role = 'biker' THEN
    IF NOT EXISTS (SELECT 1 FROM public.bikers b WHERE b.user_id = v_uid) THEN
      INSERT INTO public.bikers (user_id, business_id, full_name, phone, email, status, created_by)
      VALUES (v_uid, v_business, v_name, v_invite.sent_to_phone, v_invite.sent_to_email, 'active', v_uid);
    END IF;
    v_redirect := '/portal/biker';

  ELSIF v_invite.role = 'va' THEN
    INSERT INTO public.va_profiles (user_id, label) VALUES (v_uid, 'VA')
    ON CONFLICT (user_id) DO NOTHING;
    v_redirect := '/va/dashboard';

  ELSIF v_invite.role = 'production' THEN
    -- Office leader: the invite carries which office they run.
    v_office := NULLIF(v_target->>'office_id','')::uuid;
    IF v_office IS NOT NULL THEN
      INSERT INTO public.production_office_users (office_id, user_id, role, is_primary, assigned_by)
      VALUES (v_office, v_uid, 'manager', true, v_invite.invited_by)
      ON CONFLICT DO NOTHING;
    END IF;
    v_redirect := '/portals/production';

  ELSIF v_invite.role = 'store' THEN
    v_redirect := '/portals/store';
  ELSIF v_invite.role = 'customer' THEN
    v_redirect := '/account';
  ELSE
    v_redirect := '/';
  END IF;

  UPDATE public.invites
     SET status='accepted', accepted_user_id = v_uid, accepted_at = now()
   WHERE id = v_invite.id;

  RETURN jsonb_build_object(
    'success', true,
    'role', v_role,
    'redirect', v_redirect,
    'target_link', v_target
  );
END
$function$;

-- ============================================================
-- 6. SCHEDULE the production alert engine (never had a caller)
-- ============================================================
SELECT cron.schedule(
  'production-alert-engine-daily',
  '30 6 * * *',
  $$SELECT private.cron_post('production-alert-engine', '{}'::jsonb) AS request_id;$$
);
