
-- Admin RLS policies for Clipper Nation admin pages
CREATE POLICY "ca_admin_select" ON public.clipper_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ca_admin_update" ON public.clipper_accounts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "casgn_admin_select" ON public.clipper_assignments FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "casgn_admin_insert" ON public.clipper_assignments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "csa_admin_select" ON public.clipper_social_accounts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "ce_admin_select" ON public.clipper_earnings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Also grant admin visibility into submissions for the Submissions admin page
CREATE POLICY "cs_admin_select" ON public.clipper_submissions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "cs_admin_update" ON public.clipper_submissions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
