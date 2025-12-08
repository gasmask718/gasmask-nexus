-- V5: AI Outbound Engine - Autonomous Sales Force

-- Deals / Opportunities table
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ai_call_campaigns(id) ON DELETE SET NULL,
  channel TEXT NOT NULL DEFAULT 'call', -- "call" | "sms" | "mixed"
  status TEXT NOT NULL DEFAULT 'open', -- "open" | "negotiating" | "won" | "lost" | "pending_approval"
  stage TEXT NOT NULL DEFAULT 'contacted', -- "contacted" | "interested" | "pricing" | "confirming" | "scheduled" | "issue_resolution"
  intent_type TEXT NOT NULL DEFAULT 'new_order', -- "new_order" | "reorder" | "upsell" | "reactivation" | "credit" | "refund"
  currency TEXT DEFAULT 'USD',
  expected_value NUMERIC(12,2),
  final_value NUMERIC(12,2),
  discount_amount NUMERIC(12,2),
  discount_percent NUMERIC(5,2),
  items JSONB DEFAULT '[]',
  delivery_date DATE,
  delivery_window TEXT, -- "morning" | "afternoon" | "evening"
  probability NUMERIC(5,2) DEFAULT 50,
  sentiment NUMERIC(5,2) DEFAULT 0,
  risk_level TEXT DEFAULT 'medium', -- "low" | "medium" | "high"
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE
);

-- Negotiation Sessions table
CREATE TABLE public.negotiation_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  channel TEXT NOT NULL, -- "call" | "sms"
  session_type TEXT NOT NULL, -- "pricing" | "issue" | "upsell" | "retention"
  ai_agent_id UUID REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  human_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ended_at TIMESTAMP WITH TIME ZONE,
  result TEXT, -- "agreed" | "rejected" | "followup_required"
  transcript_path TEXT,
  summary JSONB DEFAULT '{}'
);

-- Refund Tickets table
CREATE TABLE public.refund_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'open', -- "open" | "pending_approval" | "approved" | "denied" | "resolved"
  reason TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT 'human', -- "ai" | "human"
  approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ai_suggestion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Dispatch Triggers table
CREATE TABLE public.dispatch_triggers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- "pending" | "sent" | "in_progress" | "completed"
  type TEXT NOT NULL DEFAULT 'delivery', -- "delivery" | "pickup" | "special_drop"
  payload JSONB DEFAULT '{}',
  assigned_driver_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pending Orders table
CREATE TABLE public.pending_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready_for_dispatch', -- "ready_for_dispatch" | "dispatched" | "cancelled"
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sales Rules per business
CREATE TABLE public.sales_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  max_discount_percent NUMERIC(5,2) DEFAULT 15,
  max_discount_without_approval NUMERIC(5,2) DEFAULT 10,
  max_order_value_without_approval NUMERIC(12,2) DEFAULT 1000,
  allow_ai_refunds BOOLEAN DEFAULT false,
  allow_ai_refunds_up_to NUMERIC(12,2) DEFAULT 50,
  escalate_high_risk_stores BOOLEAN DEFAULT true,
  auto_dispatch_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dispatch_triggers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for deals
CREATE POLICY "Users can view deals" ON public.deals FOR SELECT USING (true);
CREATE POLICY "Users can create deals" ON public.deals FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update deals" ON public.deals FOR UPDATE USING (true);
CREATE POLICY "Users can delete deals" ON public.deals FOR DELETE USING (true);

-- RLS Policies for negotiation_sessions
CREATE POLICY "Users can view negotiation sessions" ON public.negotiation_sessions FOR SELECT USING (true);
CREATE POLICY "Users can create negotiation sessions" ON public.negotiation_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update negotiation sessions" ON public.negotiation_sessions FOR UPDATE USING (true);

-- RLS Policies for refund_tickets
CREATE POLICY "Users can view refund tickets" ON public.refund_tickets FOR SELECT USING (true);
CREATE POLICY "Users can create refund tickets" ON public.refund_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update refund tickets" ON public.refund_tickets FOR UPDATE USING (true);

-- RLS Policies for dispatch_triggers
CREATE POLICY "Users can view dispatch triggers" ON public.dispatch_triggers FOR SELECT USING (true);
CREATE POLICY "Users can create dispatch triggers" ON public.dispatch_triggers FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update dispatch triggers" ON public.dispatch_triggers FOR UPDATE USING (true);

-- RLS Policies for pending_orders
CREATE POLICY "Users can view pending orders" ON public.pending_orders FOR SELECT USING (true);
CREATE POLICY "Users can create pending orders" ON public.pending_orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update pending orders" ON public.pending_orders FOR UPDATE USING (true);

-- RLS Policies for sales_rules
CREATE POLICY "Users can view sales rules" ON public.sales_rules FOR SELECT USING (true);
CREATE POLICY "Users can create sales rules" ON public.sales_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update sales rules" ON public.sales_rules FOR UPDATE USING (true);

-- Indexes for performance
CREATE INDEX idx_deals_business ON public.deals(business_id);
CREATE INDEX idx_deals_store ON public.deals(store_id);
CREATE INDEX idx_deals_status ON public.deals(status);
CREATE INDEX idx_deals_stage ON public.deals(stage);
CREATE INDEX idx_negotiation_sessions_deal ON public.negotiation_sessions(deal_id);
CREATE INDEX idx_refund_tickets_business ON public.refund_tickets(business_id);
CREATE INDEX idx_refund_tickets_status ON public.refund_tickets(status);
CREATE INDEX idx_dispatch_triggers_business ON public.dispatch_triggers(business_id);
CREATE INDEX idx_dispatch_triggers_status ON public.dispatch_triggers(status);
CREATE INDEX idx_pending_orders_business ON public.pending_orders(business_id);
CREATE INDEX idx_pending_orders_status ON public.pending_orders(status);

-- Trigger for updated_at
CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_rules_updated_at
  BEFORE UPDATE ON public.sales_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_dispatch_triggers_updated_at
  BEFORE UPDATE ON public.dispatch_triggers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();