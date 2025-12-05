-- Create contact_interactions table for logging all interactions
CREATE TABLE public.contact_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.store_contacts(id) ON DELETE CASCADE,
  store_id UUID REFERENCES public.store_master(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('CALL', 'SMS', 'WHATSAPP', 'IN_PERSON', 'EMAIL', 'OTHER')),
  direction TEXT NOT NULL CHECK (direction IN ('OUTBOUND', 'INBOUND')),
  subject TEXT NOT NULL,
  summary TEXT,
  outcome TEXT CHECK (outcome IN ('SUCCESS', 'PENDING', 'NO_ANSWER', 'FOLLOW_UP_NEEDED', 'ESCALATED')),
  sentiment TEXT CHECK (sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE')),
  next_action TEXT,
  follow_up_at TIMESTAMPTZ,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_contact_interactions_contact_id ON public.contact_interactions(contact_id);
CREATE INDEX idx_contact_interactions_store_id ON public.contact_interactions(store_id);
CREATE INDEX idx_contact_interactions_follow_up_at ON public.contact_interactions(follow_up_at) WHERE follow_up_at IS NOT NULL;
CREATE INDEX idx_contact_interactions_created_at ON public.contact_interactions(created_at DESC);

-- Enable RLS
ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for contact_interactions
CREATE POLICY "Allow authenticated users to view interactions"
ON public.contact_interactions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow authenticated users to create interactions"
ON public.contact_interactions FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update interactions"
ON public.contact_interactions FOR UPDATE
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_contact_interactions_updated_at
BEFORE UPDATE ON public.contact_interactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();