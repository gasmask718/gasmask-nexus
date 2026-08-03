-- ============================================================
-- 1. Shared role helper: everyone meant to log field activity
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_field_or_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('owner','admin','employee','staff','csr','accountant','va',
                      'production','warehouse','biker','driver','ambassador','developer')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.role IN ('owner','admin','employee','staff','csr','accountant','va',
                     'production','warehouse','biker','driver','ambassador','developer')
  );
$$;

-- ============================================================
-- 2. store_opportunities: attribution + soft delete columns
-- ============================================================
ALTER TABLE public.store_opportunities
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_store_opportunities_live
  ON public.store_opportunities (store_id) WHERE deleted_at IS NULL;

-- Stamp business_id + created_by server-side; never trust the client
CREATE OR REPLACE FUNCTION public.stamp_store_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  IF NEW.business_id IS NULL THEN
    NEW.business_id := COALESCE(
      (SELECT sm.business_id FROM public.store_master sm WHERE sm.id = NEW.store_id),
      'c3d4e5f6-a7b8-9012-cdef-123456789012'::uuid
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_store_opportunity ON public.store_opportunities;
CREATE TRIGGER trg_stamp_store_opportunity
  BEFORE INSERT ON public.store_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.stamp_store_opportunity();

-- INSERT: any field/office role may log a follow-up
DROP POLICY IF EXISTS "Field and staff can insert store opportunities" ON public.store_opportunities;
CREATE POLICY "Field and staff can insert store opportunities"
ON public.store_opportunities
FOR INSERT TO authenticated
WITH CHECK (public.is_field_or_staff(auth.uid()));

-- UPDATE: author or admin (covers soft delete + complete/urgent/route toggles)
DROP POLICY IF EXISTS "Author or admin can update store opportunities" ON public.store_opportunities;
CREATE POLICY "Author or admin can update store opportunities"
ON public.store_opportunities
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR assignee = auth.uid()
  OR public.is_elevated_user(auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR assignee = auth.uid()
  OR public.is_elevated_user(auth.uid())
  OR public.is_admin(auth.uid())
);

-- ============================================================
-- 3. store_notes: soft delete columns + policy
-- ============================================================
ALTER TABLE public.store_notes
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

CREATE INDEX IF NOT EXISTS idx_store_notes_live
  ON public.store_notes (store_id) WHERE deleted_at IS NULL;

DROP POLICY IF EXISTS "store_notes_author_or_admin_update" ON public.store_notes;
CREATE POLICY "store_notes_author_or_admin_update"
ON public.store_notes
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR public.is_elevated_user(auth.uid())
  OR public.is_admin(auth.uid())
)
WITH CHECK (
  created_by = auth.uid()
  OR public.is_elevated_user(auth.uid())
  OR public.is_admin(auth.uid())
);

-- ============================================================
-- 4. Flower demand list: real borough
-- ============================================================
CREATE OR REPLACE VIEW public.v_flower_demand_list AS
SELECT sm.id AS store_id,
    sm.store_name,
    sm.nickname,
    sm.address,
    sm.city,
    sm.state,
    sm.zip,
    sm.borough_id,
    COALESCE(
      b.name,
      nz.boro,
      CASE
        WHEN upper(btrim(sm.city)) IN ('BROOKLYN') THEN 'Brooklyn'
        WHEN upper(btrim(sm.city)) IN ('BRONX','THE BRONX') THEN 'Bronx'
        WHEN upper(btrim(sm.city)) IN ('MANHATTAN','NEW YORK','NEW YORK CITY','NYC') THEN 'Manhattan'
        WHEN upper(btrim(sm.city)) IN ('QUEENS','JAMAICA','ASTORIA','FLUSHING','RIDGEWOOD',
                                       'LONG ISLAND CITY','FAR ROCKAWAY','ROCKAWAY',
                                       'ELMHURST','CORONA','JACKSON HEIGHTS','WOODSIDE',
                                       'OZONE PARK','SOUTH OZONE PARK','RICHMOND HILL',
                                       'SPRINGFIELD GARDENS','ROSEDALE','QUEENS VILLAGE',
                                       'FOREST HILLS','REGO PARK','MASPETH','WOODHAVEN',
                                       'SAINT ALBANS','ST ALBANS','HOLLIS','BAYSIDE') THEN 'Queens'
        WHEN upper(btrim(sm.city)) IN ('STATEN ISLAND') THEN 'Staten Island'
        ELSE NULL
      END
    ) AS borough,
    sm.phone AS store_phone,
    sm.status AS store_status,
    sm.business_id,
    sm.last_visit_at,
    sm.sells_flowers_note AS flower_note,
    sm.sells_flowers_flagged_at AS flagged_at,
    sm.sells_flowers_flagged_by AS flagged_by_id,
    COALESCE(p.name, p.email) AS flagged_by_name,
    c.name AS contact_name,
    c.role AS contact_role,
    COALESCE(c.phone, sm.phone) AS contact_phone
   FROM store_master sm
     LEFT JOIN boroughs b ON b.id = sm.borough_id
     LEFT JOIN LATERAL (
        SELECT z.boro FROM public.neighborhood_zip_lookup z
        WHERE z.zip_code = left(btrim(sm.zip), 5)
        LIMIT 1
     ) nz ON true
     LEFT JOIN profiles p ON p.id = sm.sells_flowers_flagged_by
     LEFT JOIN LATERAL ( SELECT sc.name, sc.role, sc.phone
           FROM store_contacts sc
          WHERE sc.store_id = sm.id
          ORDER BY sc.is_primary DESC NULLS LAST, sc.created_at
         LIMIT 1) c ON true
  WHERE sm.sells_flowers IS TRUE;

GRANT SELECT ON public.v_flower_demand_list TO authenticated;