-- Drop permissive policies that override scoped siblings on brandaro_* tables
-- See companion analysis: 21 policies identified via pg_policies inspection

-- brandaro_call_logs: keep authenticated insert/select; remove anon insert
DROP POLICY IF EXISTS "Anon can insert call logs" ON public.brandaro_call_logs;

-- brandaro_call_queue: scoped sibling exists (auth.uid based)
DROP POLICY IF EXISTS "auth_manage_call_queue" ON public.brandaro_call_queue;
DROP POLICY IF EXISTS "Authenticated users can view queue" ON public.brandaro_call_queue;

-- brandaro_campaigns
DROP POLICY IF EXISTS "Authenticated users can view campaigns" ON public.brandaro_campaigns;

-- brandaro_client_views: token check was not actually enforced in SQL
DROP POLICY IF EXISTS "Public read via token" ON public.brandaro_client_views;

-- brandaro_conversations
DROP POLICY IF EXISTS "anon_insert_conversations" ON public.brandaro_conversations;
DROP POLICY IF EXISTS "anon_read_conversations" ON public.brandaro_conversations;

-- brandaro_execution_queue
DROP POLICY IF EXISTS "Allow anon read" ON public.brandaro_execution_queue;

-- brandaro_intent_log
DROP POLICY IF EXISTS "anon_read_intent_log" ON public.brandaro_intent_log;

-- brandaro_lead_events
DROP POLICY IF EXISTS "Anon can insert lead events" ON public.brandaro_lead_events;

-- brandaro_lead_jobs: was granting anon UPDATE under guise of "service" — service_role bypasses RLS
DROP POLICY IF EXISTS "Service can update lead jobs" ON public.brandaro_lead_jobs;

-- brandaro_qualified_leads: P0 PII exposure
DROP POLICY IF EXISTS "Anon can read leads" ON public.brandaro_qualified_leads;
DROP POLICY IF EXISTS "Authenticated users can insert brandaro_qualified_leads" ON public.brandaro_qualified_leads;
DROP POLICY IF EXISTS "Authenticated users can view brandaro_qualified_leads" ON public.brandaro_qualified_leads;
DROP POLICY IF EXISTS "Authenticated users can update brandaro_qualified_leads" ON public.brandaro_qualified_leads;

-- brandaro_testimonials / brandaro_urgency: re-add with scoping later if public site needs them
DROP POLICY IF EXISTS "Public read testimonials" ON public.brandaro_testimonials;
DROP POLICY IF EXISTS "Public read urgency" ON public.brandaro_urgency;

-- brandaro_va_daily_performance
DROP POLICY IF EXISTS "ins_va_perf" ON public.brandaro_va_daily_performance;
DROP POLICY IF EXISTS "sel_va_perf" ON public.brandaro_va_daily_performance;

-- brandaro_va_lead_heat
DROP POLICY IF EXISTS "va_lead_heat_read" ON public.brandaro_va_lead_heat;

-- brandaro_va_skill_profiles
DROP POLICY IF EXISTS "Managers can read all skill profiles" ON public.brandaro_va_skill_profiles;