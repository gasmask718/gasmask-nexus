-- ═══════════════════════════════════════════════════════════════════════════════
-- COLLECTIONS ENGINE SCHEMA — Floor 5 Finance & Orders
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1) ENUMS
CREATE TYPE public.collection_entity_type AS ENUM ('store', 'customer', 'wholesaler', 'company');
CREATE TYPE public.collection_risk_tier AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.collection_account_status AS ENUM ('active', 'paused', 'disputed', 'escalated', 'closed');
CREATE TYPE public.collection_stage AS ENUM (
  'soft_reminder', 'second_notice', 'final_notice', 'payment_plan', 
  'collections_internal', 'pre_legal', 'legal', 'closed'
);
CREATE TYPE public.promise_status AS ENUM ('active', 'kept', 'broken', 'cancelled');
CREATE TYPE public.collection_action_type AS ENUM (
  'email_sent', 'sms_sent', 'call_logged', 'statement_sent', 'note_added',
  'promise_created', 'promise_broken', 'promise_kept', 'escalated', 'paused',
  'dispute_opened', 'dispute_resolved', 'assigned', 'risk_updated'
);
CREATE TYPE public.collection_channel AS ENUM ('email', 'sms', 'phone', 'internal', 'system');

-- 2) COLLECTION ACCOUNTS (One per collectible entity)
CREATE TABLE public.collection_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.collection_entity_type NOT NULL,
  entity_id UUID NOT NULL,
  entity_name TEXT,
  primary_brand TEXT,
  risk_tier public.collection_risk_tier NOT NULL DEFAULT 'low',
  risk_tier_override BOOLEAN DEFAULT FALSE,
  status public.collection_account_status NOT NULL DEFAULT 'active',
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_ambassador_id UUID,
  total_outstanding NUMERIC(12,2) DEFAULT 0,
  total_overdue NUMERIC(12,2) DEFAULT 0,
  oldest_invoice_date DATE,
  max_days_overdue INTEGER DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  next_action_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, entity_id)
);

-- 3) COLLECTION CASES (Escalation tracking per account)
CREATE TABLE public.collection_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES public.collection_accounts(id) ON DELETE CASCADE,
  stage public.collection_stage NOT NULL DEFAULT 'soft_reminder',
  previous_stage public.collection_stage,
  reason TEXT,
  escalation_notes TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  closed_reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4) PAYMENT PROMISES (Promise-to-pay workflow)
CREATE TABLE public.payment_promises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES public.collection_accounts(id) ON DELETE CASCADE,
  promise_amount NUMERIC(12,2) NOT NULL,
  promise_date DATE NOT NULL,
  status public.promise_status NOT NULL DEFAULT 'active',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  kept_at TIMESTAMPTZ,
  broken_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_reason TEXT
);

-- 5) COLLECTION ACTIONS (Audit trail of all collection activity)
CREATE TABLE public.collection_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES public.collection_accounts(id) ON DELETE CASCADE,
  case_id UUID REFERENCES public.collection_cases(id) ON DELETE SET NULL,
  invoice_id UUID,
  action_type public.collection_action_type NOT NULL,
  channel public.collection_channel NOT NULL DEFAULT 'internal',
  template_used TEXT,
  subject TEXT,
  message_preview TEXT,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'completed',
  external_message_id TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6) COLLECTION RULES (Automation configuration)
CREATE TABLE public.collection_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  entity_type public.collection_entity_type,
  min_balance NUMERIC(12,2) DEFAULT 0,
  days_overdue_trigger INTEGER NOT NULL DEFAULT 1,
  risk_tier_trigger public.collection_risk_tier,
  action_sequence JSONB NOT NULL DEFAULT '[]',
  is_enabled BOOLEAN DEFAULT TRUE,
  is_auto_send BOOLEAN DEFAULT FALSE,
  priority INTEGER DEFAULT 100,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7) COLLECTION QUEUE (Pending automated actions)
CREATE TABLE public.collection_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_account_id UUID NOT NULL REFERENCES public.collection_accounts(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES public.collection_rules(id) ON DELETE SET NULL,
  action_type public.collection_action_type NOT NULL,
  channel public.collection_channel NOT NULL,
  template_key TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8) INDEXES
CREATE INDEX idx_collection_accounts_entity ON public.collection_accounts(entity_type, entity_id);
CREATE INDEX idx_collection_accounts_status ON public.collection_accounts(status);
CREATE INDEX idx_collection_accounts_risk ON public.collection_accounts(risk_tier);
CREATE INDEX idx_collection_accounts_ambassador ON public.collection_accounts(assigned_ambassador_id);
CREATE INDEX idx_collection_cases_account ON public.collection_cases(collection_account_id);
CREATE INDEX idx_collection_cases_stage ON public.collection_cases(stage);
CREATE INDEX idx_payment_promises_account ON public.payment_promises(collection_account_id);
CREATE INDEX idx_payment_promises_status ON public.payment_promises(status);
CREATE INDEX idx_payment_promises_date ON public.payment_promises(promise_date);
CREATE INDEX idx_collection_actions_account ON public.collection_actions(collection_account_id);
CREATE INDEX idx_collection_actions_type ON public.collection_actions(action_type);
CREATE INDEX idx_collection_queue_status ON public.collection_queue(status, scheduled_for);

-- 9) ENABLE RLS
ALTER TABLE public.collection_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_queue ENABLE ROW LEVEL SECURITY;

-- 10) RLS POLICIES - Using has_role function pattern (admin, owner, accountant)
-- Collection Accounts
CREATE POLICY "Authenticated users can view collection accounts"
  ON public.collection_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Accountant can manage collection accounts"
  ON public.collection_accounts FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Collection Cases
CREATE POLICY "Authenticated users can view collection cases"
  ON public.collection_cases FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Accountant can manage collection cases"
  ON public.collection_cases FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Payment Promises
CREATE POLICY "Authenticated users can view payment promises"
  ON public.payment_promises FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Accountant can manage payment promises"
  ON public.payment_promises FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Collection Actions
CREATE POLICY "Authenticated users can view collection actions"
  ON public.collection_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/Accountant can create collection actions"
  ON public.collection_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- Collection Rules
CREATE POLICY "Authenticated users can view collection rules"
  ON public.collection_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin can manage collection rules"
  ON public.collection_rules FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner')
  );

-- Collection Queue
CREATE POLICY "Admin/Accountant can view collection queue"
  ON public.collection_queue FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

CREATE POLICY "Admin/Accountant can manage collection queue"
  ON public.collection_queue FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'owner') OR
    public.has_role(auth.uid(), 'accountant')
  );

-- 11) TRIGGERS for updated_at
CREATE OR REPLACE FUNCTION public.update_collection_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_collection_accounts_updated_at
  BEFORE UPDATE ON public.collection_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();

CREATE TRIGGER update_collection_cases_updated_at
  BEFORE UPDATE ON public.collection_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();

CREATE TRIGGER update_payment_promises_updated_at
  BEFORE UPDATE ON public.payment_promises
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();

CREATE TRIGGER update_collection_rules_updated_at
  BEFORE UPDATE ON public.collection_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_collection_updated_at();