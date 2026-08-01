-- ============ helper: resolve business via store_master ============
CREATE OR REPLACE FUNCTION public.has_business_role_for_store(_user_id uuid, _role text, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _store_id IS NULL THEN public.has_any_business_role(_user_id, _role)
    ELSE EXISTS (
      SELECT 1 FROM public.store_master s
      WHERE s.id = _store_id
        AND (
          (s.business_id IS NULL AND public.has_any_business_role(_user_id, _role))
          OR public.has_business_role(_user_id, _role, s.business_id)
        )
    )
  END
$$;

GRANT EXECUTE ON FUNCTION public.has_business_role_for_store(uuid, text, uuid) TO authenticated, service_role;

-- ============ BUCKET B: remove 'va' entirely ============

-- call_revenue_attribution
DROP POLICY IF EXISTS "Admin access call_revenue_attribution" ON public.call_revenue_attribution;
CREATE POLICY "Admin access call_revenue_attribution" ON public.call_revenue_attribution
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- call_revenue_events
DROP POLICY IF EXISTS "Admin access call_revenue_events" ON public.call_revenue_events;
CREATE POLICY "Admin access call_revenue_events" ON public.call_revenue_events
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- comm_provider_audit_log
DROP POLICY IF EXISTS "Admins can read audit log" ON public.comm_provider_audit_log;
CREATE POLICY "Admins can read audit log" ON public.comm_provider_audit_log
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

DROP POLICY IF EXISTS "Admins can insert audit log" ON public.comm_provider_audit_log;
CREATE POLICY "Admins can insert audit log" ON public.comm_provider_audit_log
FOR INSERT TO authenticated
WITH CHECK (actor_user_id = auth.uid() AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)));

-- store_tube_intel_audit
DROP POLICY IF EXISTS "Admins and owners can view tube intel audit" ON public.store_tube_intel_audit;
CREATE POLICY "Admins and owners can view tube intel audit" ON public.store_tube_intel_audit
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

-- market_lines (sports betting reference data; VA has no role here)
DROP POLICY IF EXISTS "market_lines_insert" ON public.market_lines;
CREATE POLICY "market_lines_insert" ON public.market_lines
FOR INSERT TO authenticated
WITH CHECK (is_owner(auth.uid()) OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "market_lines_update" ON public.market_lines;
CREATE POLICY "market_lines_update" ON public.market_lines
FOR UPDATE TO authenticated
USING (is_owner(auth.uid()) OR is_admin(auth.uid()));

-- ============ BUCKET A: scope by business ============

-- brandaro_campaigns (Brandaro-owned)
ALTER TABLE public.brandaro_campaigns
  ADD COLUMN IF NOT EXISTS business_id uuid NOT NULL DEFAULT '27c67680-dbf0-4002-beda-d85a098866ac';

DROP POLICY IF EXISTS "VAs can update campaign stats" ON public.brandaro_campaigns;
CREATE POLICY "VAs can read campaign stats scoped" ON public.brandaro_campaigns
FOR SELECT TO authenticated
USING (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id));

CREATE POLICY "VAs can update campaign stats scoped" ON public.brandaro_campaigns
FOR UPDATE TO authenticated
USING (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id))
WITH CHECK (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id));

-- comm_threads
ALTER TABLE public.comm_threads ADD COLUMN IF NOT EXISTS business_id uuid;
UPDATE public.comm_threads t SET business_id = s.business_id
  FROM public.store_master s
 WHERE t.business_id IS NULL AND t.entity_type = 'store' AND s.id = t.entity_id;

DROP POLICY IF EXISTS "Authenticated users can read threads" ON public.comm_threads;
CREATE POLICY "Operators can read threads" ON public.comm_threads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR created_by = auth.uid()
  OR (has_role(auth.uid(),'va'::app_role) AND (
        (business_id IS NULL AND has_any_business_role(auth.uid(),'va'::text))
        OR has_business_role(auth.uid(),'va'::text, business_id)))
);

DROP POLICY IF EXISTS "Thread creator/admin can update" ON public.comm_threads;
CREATE POLICY "Thread creator/admin can update" ON public.comm_threads
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND (
        (business_id IS NULL AND has_any_business_role(auth.uid(),'va'::text))
        OR has_business_role(auth.uid(),'va'::text, business_id)))
)
WITH CHECK (
  created_by = auth.uid()
  OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND (
        (business_id IS NULL AND has_any_business_role(auth.uid(),'va'::text))
        OR has_business_role(auth.uid(),'va'::text, business_id)))
);

-- communication_threads (store-scoped)
DROP POLICY IF EXISTS "comm_threads_select_operators" ON public.communication_threads;
CREATE POLICY "comm_threads_select_operators" ON public.communication_threads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'owner'::app_role) OR has_role(auth.uid(),'admin'::app_role)
  OR has_role(auth.uid(),'csr'::app_role) OR has_role(auth.uid(),'ambassador'::app_role)
  OR has_role(auth.uid(),'driver'::app_role) OR has_role(auth.uid(),'biker'::app_role)
  OR has_role(auth.uid(),'employee'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
);

-- live_call_sessions
DROP POLICY IF EXISTS "Admin full access on live_call_sessions" ON public.live_call_sessions;
CREATE POLICY "Admin full access on live_call_sessions" ON public.live_call_sessions
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

CREATE POLICY "VA scoped access on live_call_sessions" ON public.live_call_sessions
FOR ALL TO authenticated
USING (has_role(auth.uid(),'va'::app_role) AND (
    (business_id IS NOT NULL AND has_business_role(auth.uid(),'va'::text, business_id))
 OR (business_id IS NULL AND has_business_role_for_store(auth.uid(),'va'::text, store_id))))
WITH CHECK (has_role(auth.uid(),'va'::app_role) AND (
    (business_id IS NOT NULL AND has_business_role(auth.uid(),'va'::text, business_id))
 OR (business_id IS NULL AND has_business_role_for_store(auth.uid(),'va'::text, store_id))));

-- ops_inbox_threads
ALTER TABLE public.ops_inbox_threads ADD COLUMN IF NOT EXISTS business_id uuid;

DROP POLICY IF EXISTS "Elevated can insert threads" ON public.ops_inbox_threads;
CREATE POLICY "Elevated can insert threads" ON public.ops_inbox_threads
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND (
        (business_id IS NULL AND has_any_business_role(auth.uid(),'va'::text))
        OR has_business_role(auth.uid(),'va'::text, business_id)))
);

DROP POLICY IF EXISTS "Elevated can update threads" ON public.ops_inbox_threads;
CREATE POLICY "Elevated can update threads" ON public.ops_inbox_threads
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR created_by = auth.uid()
  OR (has_role(auth.uid(),'va'::app_role) AND (
        (business_id IS NULL AND has_any_business_role(auth.uid(),'va'::text))
        OR has_business_role(auth.uid(),'va'::text, business_id)))
);

-- outbound_messages (store-scoped; also close the USING(true) service policies)
DROP POLICY IF EXISTS "Admins can view all outbound" ON public.outbound_messages;
CREATE POLICY "Admins can view all outbound" ON public.outbound_messages
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
);

DROP POLICY IF EXISTS "Service can insert outbound" ON public.outbound_messages;
CREATE POLICY "Operators can insert outbound" ON public.outbound_messages
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
);

DROP POLICY IF EXISTS "Service can update outbound" ON public.outbound_messages;
CREATE POLICY "Operators can update outbound" ON public.outbound_messages
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
);

-- store_call_intelligence
DROP POLICY IF EXISTS "Admin access store_call_intelligence" ON public.store_call_intelligence;
CREATE POLICY "Admin access store_call_intelligence" ON public.store_call_intelligence
FOR ALL TO authenticated
USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role))
WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role));

CREATE POLICY "VA scoped access store_call_intelligence" ON public.store_call_intelligence
FOR ALL TO authenticated
USING (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
WITH CHECK (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id));

-- store_inventory_leads (GasMask store-calling work)
ALTER TABLE public.store_inventory_leads
  ADD COLUMN IF NOT EXISTS business_id uuid NOT NULL DEFAULT 'c3d4e5f6-a7b8-9012-cdef-123456789012';

DROP POLICY IF EXISTS "Ops staff can read inventory leads" ON public.store_inventory_leads;
CREATE POLICY "Ops staff can read inventory leads" ON public.store_inventory_leads
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id))
);

DROP POLICY IF EXISTS "Ops staff can insert inventory leads" ON public.store_inventory_leads;
CREATE POLICY "Ops staff can insert inventory leads" ON public.store_inventory_leads
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id))
);

DROP POLICY IF EXISTS "Ops staff can update inventory leads" ON public.store_inventory_leads;
CREATE POLICY "Ops staff can update inventory leads" ON public.store_inventory_leads
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id))
)
WITH CHECK (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role(auth.uid(),'va'::text, business_id))
);

-- store_tube_switches (store-scoped)
DROP POLICY IF EXISTS "Authorized roles can view tube switches" ON public.store_tube_switches;
CREATE POLICY "Authorized roles can view tube switches" ON public.store_tube_switches
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
  OR has_role(auth.uid(),'ambassador'::app_role) OR has_role(auth.uid(),'driver'::app_role)
  OR has_role(auth.uid(),'biker'::app_role)
  OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
);

DROP POLICY IF EXISTS "Authorized roles can insert tube switches" ON public.store_tube_switches;
CREATE POLICY "Authorized roles can insert tube switches" ON public.store_tube_switches
FOR INSERT TO authenticated
WITH CHECK (
  switched_by_user_id = auth.uid() AND (
    has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'owner'::app_role)
    OR has_role(auth.uid(),'ambassador'::app_role) OR has_role(auth.uid(),'biker'::app_role)
    OR (has_role(auth.uid(),'va'::app_role) AND has_business_role_for_store(auth.uid(),'va'::text, store_id))
  )
);