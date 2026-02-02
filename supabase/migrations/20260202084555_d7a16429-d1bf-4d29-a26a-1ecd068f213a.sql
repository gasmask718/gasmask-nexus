-- Phase 5 RLS Policies (using existing roles only: owner, admin)
ALTER TABLE public.dispatch_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_action_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomy_policy ENABLE ROW LEVEL SECURITY;

-- Proposals RLS
CREATE POLICY "Read proposals" ON public.dispatch_action_proposals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Insert proposals" ON public.dispatch_action_proposals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Update proposals" ON public.dispatch_action_proposals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Executions RLS
CREATE POLICY "Read executions" ON public.dispatch_action_executions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Insert executions" ON public.dispatch_action_executions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Update executions" ON public.dispatch_action_executions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Policy RLS
CREATE POLICY "Read policy" ON public.autonomy_policy FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Update policy" ON public.autonomy_policy FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Helper functions
CREATE OR REPLACE FUNCTION public.count_route_actions_last_hour(p_route_id UUID)
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(COUNT(*)::INT, 0)
  FROM dispatch_action_executions e JOIN dispatch_action_proposals p ON e.proposal_id = p.id
  WHERE p.route_id = p_route_id AND e.executed_at > now() - INTERVAL '1 hour' AND e.execution_status = 'success'
$$;

CREATE OR REPLACE FUNCTION public.get_active_autonomy_policy()
RETURNS SETOF autonomy_policy LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM autonomy_policy WHERE is_active = true LIMIT 1
$$;