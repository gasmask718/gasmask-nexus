-- Helper: internal staff check
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role IN ('owner','admin','employee','staff','csr','accountant','va','production','warehouse')
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.role IN ('owner','admin','employee','staff','csr','accountant','va','production','warehouse')
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_internal_staff(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_internal_staff(uuid) TO authenticated, service_role;

-- 1. communication_drafts: drop blanket public ALL policy (scoped policies already exist)
DROP POLICY IF EXISTS "all_access_drafts" ON public.communication_drafts;

-- 2. contact_profiles: replace blanket public ALL with staff-scoped policies
DROP POLICY IF EXISTS "all_access_contacts" ON public.contact_profiles;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_profiles TO authenticated;
GRANT ALL ON public.contact_profiles TO service_role;
CREATE POLICY "contact_profiles_staff_select" ON public.contact_profiles
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "contact_profiles_staff_insert" ON public.contact_profiles
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "contact_profiles_staff_update" ON public.contact_profiles
  FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "contact_profiles_admin_delete" ON public.contact_profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- 3. dc_call_logs: remove public SELECT (authenticated ALL policy remains)
DROP POLICY IF EXISTS "Anyone can view DC call logs" ON public.dc_call_logs;

-- 4. outbound_call_queue: remove blanket authenticated UPDATE
DROP POLICY IF EXISTS "Enable update access for authenticated users" ON public.outbound_call_queue;

-- 5. sbo_sms_recipients: restrict reads to operators
DROP POLICY IF EXISTS "auth_read_sbo_sms_recipients" ON public.sbo_sms_recipients;
CREATE POLICY "operator_read_sbo_sms_recipients" ON public.sbo_sms_recipients
  FOR SELECT TO authenticated USING (public.is_sbo_operator(auth.uid()));

-- 6. store_contacts: remove anon-reachable simulation policies + blanket true policies
DROP POLICY IF EXISTS "store_contacts_simulation_select" ON public.store_contacts;
DROP POLICY IF EXISTS "store_contacts_simulation_insert" ON public.store_contacts;
DROP POLICY IF EXISTS "store_contacts_simulation_update" ON public.store_contacts;
DROP POLICY IF EXISTS "Authenticated users can view store contacts" ON public.store_contacts;
DROP POLICY IF EXISTS "Authenticated users can manage store contacts" ON public.store_contacts;
CREATE POLICY "store_contacts_staff_select" ON public.store_contacts
  FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()) AND is_simulation = public.is_simulation_mode());
CREATE POLICY "store_contacts_staff_insert" ON public.store_contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()) AND is_simulation = public.is_simulation_mode());
CREATE POLICY "store_contacts_staff_update" ON public.store_contacts
  FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()) AND is_simulation = public.is_simulation_mode())
  WITH CHECK (public.is_internal_staff(auth.uid()) AND is_simulation = public.is_simulation_mode());
CREATE POLICY "store_contacts_admin_delete" ON public.store_contacts
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role));

-- 7. store_notes: remove public read/write
DROP POLICY IF EXISTS "Anyone can view store notes" ON public.store_notes;
DROP POLICY IF EXISTS "Authenticated users can create store notes" ON public.store_notes;
DROP POLICY IF EXISTS "Users can update their own notes" ON public.store_notes;
DROP POLICY IF EXISTS "Users can delete their own notes" ON public.store_notes;
CREATE POLICY "store_notes_staff_select" ON public.store_notes
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "store_notes_staff_insert" ON public.store_notes
  FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "store_notes_own_update" ON public.store_notes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_elevated_user(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR is_elevated_user(auth.uid()));
CREATE POLICY "store_notes_own_delete" ON public.store_notes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_elevated_user(auth.uid()));

-- 8. user_invitations: remove anon full-table read, replace with token RPC
DROP POLICY IF EXISTS "Anyone can validate invite token" ON public.user_invitations;

CREATE OR REPLACE FUNCTION public.validate_invite_token_public(_token text)
RETURNS TABLE (
  id uuid,
  email text,
  role app_role,
  invite_status text,
  expires_at timestamptz,
  metadata jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ui.id, ui.email, ui.role, ui.invite_status::text, ui.expires_at, ui.metadata
  FROM public.user_invitations ui
  WHERE ui.invite_token = _token
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.validate_invite_token_public(text) TO anon, authenticated, service_role;

-- 9. va_invoices: remove anon full-table read, replace with id-scoped RPC
DROP POLICY IF EXISTS "Public can view invoices" ON public.va_invoices;

CREATE OR REPLACE FUNCTION public.get_public_invoice(_invoice_id uuid)
RETURNS TABLE (
  id uuid,
  invoice_number text,
  customer_name text,
  service_type text,
  line_items jsonb,
  total numeric,
  status text,
  payment_type text,
  deposit_percent numeric,
  deposit_amount numeric,
  final_amount numeric,
  deposit_status text,
  final_status text,
  amount_paid numeric,
  due_date date,
  notes text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.invoice_number, v.customer_name, v.service_type, v.line_items::jsonb,
         v.total, v.status::text, v.payment_type::text, v.deposit_percent, v.deposit_amount,
         v.final_amount, v.deposit_status::text, v.final_status::text, v.amount_paid,
         v.due_date::date, v.notes
  FROM public.va_invoices v
  WHERE v.id = _invoice_id
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_invoice(uuid) TO anon, authenticated, service_role;