-- 1) v_va_caller_ids: security_invoker + membership scoping + no anon
CREATE OR REPLACE VIEW public.v_va_caller_ids
WITH (security_invoker = on) AS
SELECT c.id AS company_id,
       c.name AS company,
       c.slug,
       c.brand_color,
       c.calls_for,
       p.id AS dc_number_id,
       p.phone_number,
       p.friendly_name,
       p.number_type,
       p.is_ai_number,
       p.is_default_caller_id,
       p.status,
       CASE WHEN p.is_ai_number
            THEN 'AI agent line — a human calling from this may confuse the callee'::text
            ELSE 'human voice line'::text END AS use_note
FROM public.va_companies c
LEFT JOIN public.dc_phone_numbers p
  ON p.va_company_id = c.id AND p.status = 'active'
WHERE c.is_active
  AND (
    public.is_elevated_user(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.va_company_memberships m
      WHERE m.company_id = c.id
        AND m.user_id = auth.uid()
        AND COALESCE(m.is_active, true)
    )
  );

REVOKE ALL ON public.v_va_caller_ids FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.v_va_caller_ids FROM authenticated;
GRANT SELECT ON public.v_va_caller_ids TO authenticated;
GRANT ALL ON public.v_va_caller_ids TO service_role;

-- 2) store_tube_inventory: drop legacy permissive policies
DROP POLICY IF EXISTS store_tube_inventory_simulation_select ON public.store_tube_inventory;
DROP POLICY IF EXISTS store_tube_inventory_simulation_update ON public.store_tube_inventory;
DROP POLICY IF EXISTS store_tube_inventory_simulation_write ON public.store_tube_inventory;
DROP POLICY IF EXISTS "Admins can manage tube inventory" ON public.store_tube_inventory;