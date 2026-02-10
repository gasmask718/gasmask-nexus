
-- Floor 9: AI Permission & Obedience Matrix (Schema Only)

-- 1. AI Action Registry — finite action vocabulary
CREATE TABLE public.ai_action_registry (
  action_key TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- scout, call, follow_up, analyze, ingest, observe
  is_destructive BOOLEAN NOT NULL DEFAULT FALSE,
  requires_human_review BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_action_registry ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read, only owner/admin can write
CREATE POLICY "Authenticated users can read action registry"
  ON public.ai_action_registry FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only owner/admin can manage action registry"
  ON public.ai_action_registry FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Seed the initial action vocabulary
INSERT INTO public.ai_action_registry (action_key, description, category, is_destructive, requires_human_review) VALUES
  ('scout_address', 'Scout and verify a territory address', 'scout', false, false),
  ('call_store', 'Initiate an AI call to a store', 'call', false, true),
  ('send_follow_up', 'Send a follow-up message to a contact', 'follow_up', false, true),
  ('suggest_promotion', 'Suggest promoting an address to candidate', 'analyze', false, true),
  ('analyze_gaps', 'Analyze territory coverage gaps', 'analyze', false, false),
  ('observe_only', 'Observe and log without any action', 'observe', false, false),
  ('ingest_external', 'Ingest data from external sources', 'ingest', false, true),
  ('update_address_status', 'Update discovery status of an address', 'scout', false, true);

-- 2. Territory AI Permissions — the obedience layer
CREATE TABLE public.territory_ai_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood_id UUID NOT NULL REFERENCES public.territory_neighborhoods(id) ON DELETE CASCADE,
  commitment_id UUID NOT NULL REFERENCES public.territory_commitments(id) ON DELETE CASCADE,
  action_key TEXT NOT NULL REFERENCES public.ai_action_registry(action_key),
  allowed BOOLEAN NOT NULL DEFAULT FALSE,
  reason TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('commitment', 'override', 'system_default')),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.territory_ai_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read AI permissions"
  ON public.territory_ai_permissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only owner/admin can manage AI permissions"
  ON public.territory_ai_permissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE INDEX idx_ai_permissions_neighborhood ON public.territory_ai_permissions(neighborhood_id);
CREATE INDEX idx_ai_permissions_action ON public.territory_ai_permissions(action_key);
CREATE INDEX idx_ai_permissions_effective ON public.territory_ai_permissions(effective_from, effective_until);

-- 3. AI Decision Log — forensic accountability
CREATE TABLE public.ai_decision_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_agent TEXT NOT NULL,
  action_key TEXT NOT NULL REFERENCES public.ai_action_registry(action_key),
  neighborhood_id UUID REFERENCES public.territory_neighborhoods(id),
  territory_address_id UUID REFERENCES public.territory_addresses(id),
  permission_allowed BOOLEAN NOT NULL,
  permission_source TEXT NOT NULL,
  decision_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  blocked_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_decision_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read decision log"
  ON public.ai_decision_log FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- AI agents insert via service role; no user-level insert needed
CREATE POLICY "Service role inserts decision log"
  ON public.ai_decision_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_decision_log_agent ON public.ai_decision_log(ai_agent);
CREATE INDEX idx_decision_log_action ON public.ai_decision_log(action_key);
CREATE INDEX idx_decision_log_neighborhood ON public.ai_decision_log(neighborhood_id);
CREATE INDEX idx_decision_log_created ON public.ai_decision_log(created_at DESC);

-- 4. Effective Permissions View — the only thing AI reads
CREATE OR REPLACE VIEW public.v_ai_effective_permissions AS
SELECT
  p.id AS permission_id,
  p.neighborhood_id,
  n.name AS neighborhood_name,
  p.action_key,
  r.description AS action_description,
  r.category AS action_category,
  r.is_destructive,
  r.requires_human_review,
  p.allowed,
  p.reason,
  p.source,
  p.effective_from,
  p.effective_until,
  p.commitment_id
FROM public.territory_ai_permissions p
JOIN public.ai_action_registry r ON r.action_key = p.action_key
JOIN public.territory_neighborhoods n ON n.id = p.neighborhood_id
WHERE p.allowed = TRUE
  AND (p.effective_until IS NULL OR p.effective_until > now());
