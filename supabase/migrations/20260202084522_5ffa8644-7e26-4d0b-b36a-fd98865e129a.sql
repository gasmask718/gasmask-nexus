-- ═══════════════════════════════════════════════════════════════════════════════
-- PHASE 5: Tables Only (No RLS yet)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Create enums
DO $$ BEGIN
  CREATE TYPE public.dispatch_proposal_type AS ENUM (
    'split_route', 'reassign_stop', 'add_support_worker', 
    'resequence_stops', 'pause_route', 'ping_worker'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_proposal_status AS ENUM (
    'open', 'approved', 'rejected', 'executed', 'expired', 'rolled_back'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_execution_status AS ENUM ('success', 'partial', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.dispatch_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Proposals table
CREATE TABLE public.dispatch_action_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  territory TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  proposal_type public.dispatch_proposal_type NOT NULL,
  priority public.dispatch_priority NOT NULL DEFAULT 'medium',
  confidence NUMERIC(3,2) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  predicted_impact JSONB DEFAULT '{}',
  reason TEXT NOT NULL,
  proposed_payload JSONB NOT NULL,
  status public.dispatch_proposal_status NOT NULL DEFAULT 'open',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '4 hours')
);

-- Executions table
CREATE TABLE public.dispatch_action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.dispatch_action_proposals(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  executed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  executed_at TIMESTAMPTZ DEFAULT now(),
  execution_status public.dispatch_execution_status NOT NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  verification_result JSONB DEFAULT '{}',
  rollback_payload JSONB,
  rollback_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '30 minutes'),
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_message TEXT
);

-- Autonomy policy table
CREATE TABLE public.autonomy_policy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  min_confidence_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  max_actions_per_route_per_hour INT NOT NULL DEFAULT 3,
  max_reassigned_stops_per_route INT NOT NULL DEFAULT 5,
  allowed_territories TEXT[] DEFAULT ARRAY[]::TEXT[],
  blocked_territories TEXT[] DEFAULT ARRAY[]::TEXT[],
  allowed_roles_to_approve TEXT[] NOT NULL DEFAULT ARRAY['owner', 'admin'],
  blackout_windows JSONB DEFAULT '[]',
  simulation_only BOOLEAN NOT NULL DEFAULT true,
  enabled_actions public.dispatch_proposal_type[] DEFAULT ARRAY['ping_worker', 'resequence_stops']::public.dispatch_proposal_type[],
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Indexes
CREATE INDEX idx_dap_status ON public.dispatch_action_proposals(status);
CREATE INDEX idx_dap_route ON public.dispatch_action_proposals(route_id);
CREATE INDEX idx_dap_territory_date ON public.dispatch_action_proposals(territory, date);
CREATE INDEX idx_dap_priority ON public.dispatch_action_proposals(priority DESC, created_at ASC);
CREATE INDEX idx_dae_proposal ON public.dispatch_action_executions(proposal_id);
CREATE INDEX idx_dae_status ON public.dispatch_action_executions(execution_status);
CREATE INDEX idx_dae_rollback ON public.dispatch_action_executions(rollback_expires_at) WHERE rolled_back_at IS NULL;

-- Default policy
INSERT INTO public.autonomy_policy (min_confidence_threshold, max_actions_per_route_per_hour, max_reassigned_stops_per_route, allowed_roles_to_approve, simulation_only, enabled_actions, is_active)
VALUES (0.70, 3, 5, ARRAY['owner', 'admin'], true, ARRAY['ping_worker', 'resequence_stops']::public.dispatch_proposal_type[], true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dispatch_action_proposals;