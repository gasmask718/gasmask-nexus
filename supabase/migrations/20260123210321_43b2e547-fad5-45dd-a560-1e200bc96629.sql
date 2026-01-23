-- Add default inbound route user to businesses table
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS default_inbound_route_user_id UUID REFERENCES auth.users(id);

-- Add index for phone number lookups on business_phone_numbers
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_phone ON public.business_phone_numbers(phone_number);
CREATE INDEX IF NOT EXISTS idx_business_phone_numbers_business ON public.business_phone_numbers(business_id, is_default);

-- Add from_number and to_number columns to manual_call_logs for complete call tracking
ALTER TABLE public.manual_call_logs 
ADD COLUMN IF NOT EXISTS from_number TEXT,
ADD COLUMN IF NOT EXISTS to_number TEXT,
ADD COLUMN IF NOT EXISTS related_entity_type TEXT,
ADD COLUMN IF NOT EXISTS related_entity_id UUID,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS receiving_user_id UUID REFERENCES auth.users(id);

-- Add unique index on call_recordings provider_call_sid for faster lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_recordings_provider_sid ON public.call_recordings(provider_call_sid) WHERE provider_call_sid IS NOT NULL;

-- Add indexes for call log queries
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_business_created ON public.manual_call_logs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_caller_created ON public.manual_call_logs(caller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_manual_call_logs_receiver_created ON public.manual_call_logs(receiving_user_id, created_at DESC);

-- RLS policies for manual_call_logs
ALTER TABLE public.manual_call_logs ENABLE ROW LEVEL SECURITY;

-- Owners and Admins can view all calls
CREATE POLICY "Owners and Admins can view all calls" ON public.manual_call_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('owner', 'admin')
  )
);

-- Users can view their own calls (initiated or received)
CREATE POLICY "Users can view their own calls" ON public.manual_call_logs
FOR SELECT USING (
  auth.uid() = caller_id OR auth.uid() = receiving_user_id
);

-- Authenticated users can insert calls
CREATE POLICY "Authenticated users can insert calls" ON public.manual_call_logs
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- System can update calls (for status updates via service role)
CREATE POLICY "System can update calls" ON public.manual_call_logs
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('owner', 'admin')
  )
  OR auth.uid() = caller_id
);

-- RLS for call_recordings
ALTER TABLE public.call_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view related call recordings" ON public.call_recordings
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM manual_call_logs mcl
    WHERE mcl.id = call_recordings.manual_call_id
    AND (mcl.caller_id = auth.uid() OR mcl.receiving_user_id = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('owner', 'admin')
  )
);

CREATE POLICY "Authenticated users can insert recordings" ON public.call_recordings
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update recordings" ON public.call_recordings
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('owner', 'admin')
  )
);