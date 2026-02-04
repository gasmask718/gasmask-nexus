
-- =====================================================
-- MASTER FIX: Driver & Biker Store-Scoped Permissions
-- =====================================================

-- 1. Create unified store access helper function
CREATE OR REPLACE FUNCTION public.user_has_store_access(_store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_elevated_user(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.user_store_map
      WHERE user_id = auth.uid() AND store_id = _store_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.driver_assignments da
      JOIN public.profiles p ON p.id = da.driver_id
      WHERE p.id = auth.uid() AND da.store_id = _store_id AND da.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.biker_assignments ba
      JOIN public.profiles p ON p.id = ba.biker_id
      WHERE p.id = auth.uid() AND ba.store_id = _store_id AND ba.is_active = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.ambassador_assignments aa
      JOIN public.ambassadors a ON a.id = aa.ambassador_id
      WHERE a.user_id = auth.uid() AND aa.store_id = _store_id AND aa.active = true
    )
$$;

-- 2. Create role check helper for field roles
CREATE OR REPLACE FUNCTION public.is_field_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id 
    AND role IN ('driver'::app_role, 'biker'::app_role, 'ambassador'::app_role)
  )
$$;

-- =====================================================
-- 3. FIX: store_brand_stickers
-- =====================================================

DROP POLICY IF EXISTS "Elevated users can manage stickers" ON public.store_brand_stickers;

CREATE POLICY "Field roles can update assigned store stickers"
ON public.store_brand_stickers
FOR UPDATE
TO authenticated
USING (public.user_has_store_access(store_id))
WITH CHECK (public.user_has_store_access(store_id));

CREATE POLICY "Elevated users full sticker access"
ON public.store_brand_stickers
FOR ALL
TO authenticated
USING (public.is_elevated_user(auth.uid()))
WITH CHECK (public.is_elevated_user(auth.uid()));

-- =====================================================
-- 4. FIX: store_tube_inventory_status
-- =====================================================

DROP POLICY IF EXISTS "Bikers can view and update tube intel" ON public.store_tube_inventory_status;
DROP POLICY IF EXISTS "Ambassadors can view and update tube intel" ON public.store_tube_inventory_status;
DROP POLICY IF EXISTS "Drivers can view tube intel" ON public.store_tube_inventory_status;

CREATE POLICY "Bikers can manage tube intel for assigned stores"
ON public.store_tube_inventory_status
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'biker'::app_role)
  AND public.user_has_store_access(store_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'biker'::app_role)
  AND public.user_has_store_access(store_id)
);

CREATE POLICY "Ambassadors can manage tube intel for assigned stores"
ON public.store_tube_inventory_status
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'ambassador'::app_role)
  AND public.user_has_store_access(store_id)
)
WITH CHECK (
  public.has_role(auth.uid(), 'ambassador'::app_role)
  AND public.user_has_store_access(store_id)
);

CREATE POLICY "Drivers can view tube intel for assigned stores"
ON public.store_tube_inventory_status
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'driver'::app_role)
  AND public.user_has_store_access(store_id)
);

-- =====================================================
-- 5. FIX: invoices
-- =====================================================

CREATE POLICY "Field roles can create invoices for assigned stores"
ON public.invoices
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_field_role(auth.uid())
  AND public.user_has_store_access(store_id)
);

CREATE POLICY "Field roles can view assigned store invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  public.is_field_role(auth.uid())
  AND public.user_has_store_access(store_id)
);

-- =====================================================
-- 6. FIX: invoice_line_items
-- =====================================================

DROP POLICY IF EXISTS "Authenticated users can manage invoice line items" ON public.invoice_line_items;

CREATE POLICY "Users can manage line items for accessible invoices"
ON public.invoice_line_items
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id
    AND (
      public.is_elevated_user(auth.uid())
      OR public.user_has_store_access(i.store_id)
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id
    AND (
      public.is_elevated_user(auth.uid())
      OR public.user_has_store_access(i.store_id)
    )
  )
);
