-- Communication Drafts System (Draft-First, Human-in-the-Loop)

-- Draft status enum
CREATE TYPE public.draft_status AS ENUM ('draft', 'pending_approval', 'approved', 'sent', 'cancelled');

-- Main drafts table
CREATE TABLE public.communication_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Status and approval
  status draft_status NOT NULL DEFAULT 'draft',
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  
  -- Channel and content
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'whatsapp', 'call')),
  subject TEXT,
  body TEXT NOT NULL,
  rendered_preview TEXT,
  
  -- Recipient
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  entity_type TEXT CHECK (entity_type IN ('store', 'customer', 'wholesaler', 'driver', 'ambassador', 'company', 'other')),
  entity_id UUID,
  
  -- Source context
  business_id UUID REFERENCES public.businesses(id),
  store_id UUID,
  template_id UUID,
  template_key TEXT,
  collection_account_id UUID,
  invoice_ids UUID[] DEFAULT '{}',
  
  -- Sender info
  from_number TEXT,
  from_email TEXT,
  
  -- AI and automation context
  ai_generated BOOLEAN DEFAULT false,
  automation_source TEXT,
  automation_step JSONB,
  
  -- Context for review
  context_data JSONB DEFAULT '{}',
  warnings TEXT[] DEFAULT '{}',
  
  -- User trail
  created_by UUID REFERENCES auth.users(id),
  edited_by UUID REFERENCES auth.users(id),
  edited_before_send BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  sent_by UUID,
  sent_at TIMESTAMPTZ,
  cancelled_by UUID,
  cancelled_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  
  -- Post-send tracking
  external_message_id TEXT,
  delivery_status TEXT,
  sent_message_id UUID
);

-- Indexes
CREATE INDEX idx_drafts_status ON public.communication_drafts(status);
CREATE INDEX idx_drafts_created_by ON public.communication_drafts(created_by);
CREATE INDEX idx_drafts_business ON public.communication_drafts(business_id);
CREATE INDEX idx_drafts_entity ON public.communication_drafts(entity_type, entity_id);
CREATE INDEX idx_drafts_pending ON public.communication_drafts(status) WHERE status IN ('draft', 'pending_approval');

-- Enable RLS
ALTER TABLE public.communication_drafts ENABLE ROW LEVEL SECURITY;

-- Function to check send permissions (Owner, Admin, Accountant)
CREATE OR REPLACE FUNCTION public.can_send_messages(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = $1
      AND role IN ('owner', 'admin', 'accountant')
  )
$$;

-- RLS Policies
CREATE POLICY "Users can view drafts"
ON public.communication_drafts FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'accountant') OR
  created_by = auth.uid()
);

CREATE POLICY "Users can create drafts"
ON public.communication_drafts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update drafts"
ON public.communication_drafts FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'accountant') OR
  (created_by = auth.uid() AND status = 'draft')
);

CREATE POLICY "Admins can delete drafts"
ON public.communication_drafts FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin')
);

-- Trigger for updated_at
CREATE TRIGGER update_communication_drafts_updated_at
  BEFORE UPDATE ON public.communication_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Immutable sent log
CREATE TABLE public.communication_sent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES public.communication_drafts(id),
  channel TEXT NOT NULL,
  subject TEXT,
  final_body TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  entity_type TEXT,
  entity_id UUID,
  context_snapshot JSONB,
  invoice_ids UUID[],
  created_by UUID NOT NULL,
  approved_by UUID NOT NULL,
  sent_by UUID NOT NULL,
  edited_before_send BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  external_message_id TEXT,
  delivery_status TEXT
);

ALTER TABLE public.communication_sent_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view sent log"
ON public.communication_sent_log FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'owner') OR
  public.has_role(auth.uid(), 'admin') OR
  public.has_role(auth.uid(), 'accountant')
);