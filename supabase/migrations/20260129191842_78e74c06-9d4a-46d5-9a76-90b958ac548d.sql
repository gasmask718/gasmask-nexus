-- Create unified communications table for all entity types
CREATE TABLE public.communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('influencer', 'ambassador', 'store', 'wholesaler')),
  entity_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'instagram_dm', 'tiktok_dm', 'sms', 'whatsapp', 'call', 'facebook_dm', 'twitter_dm', 'other')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  subject TEXT,
  message_body TEXT NOT NULL,
  external_message_id TEXT,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'delivered', 'read', 'failed')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_communications_entity ON public.communications(entity_type, entity_id);
CREATE INDEX idx_communications_channel ON public.communications(channel);
CREATE INDEX idx_communications_occurred_at ON public.communications(occurred_at DESC);
CREATE INDEX idx_communications_created_by ON public.communications(created_by);

-- Enable RLS
ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view communications"
  ON public.communications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert communications"
  ON public.communications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own communications"
  ON public.communications FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid());

-- Enable realtime for communications
ALTER PUBLICATION supabase_realtime ADD TABLE public.communications;

-- Add social handles to influencers table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'influencers' AND column_name = 'instagram_handle'
  ) THEN
    ALTER TABLE public.influencers ADD COLUMN instagram_handle TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'influencers' AND column_name = 'tiktok_handle'
  ) THEN
    ALTER TABLE public.influencers ADD COLUMN tiktok_handle TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'influencers' AND column_name = 'youtube_handle'
  ) THEN
    ALTER TABLE public.influencers ADD COLUMN youtube_handle TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'influencers' AND column_name = 'twitter_handle'
  ) THEN
    ALTER TABLE public.influencers ADD COLUMN twitter_handle TEXT;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'influencers' AND column_name = 'facebook_handle'
  ) THEN
    ALTER TABLE public.influencers ADD COLUMN facebook_handle TEXT;
  END IF;
END $$;