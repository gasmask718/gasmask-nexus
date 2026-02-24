
-- Add missing columns to live_call_sessions for simulation bridge
ALTER TABLE public.live_call_sessions
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS queue_item_id uuid REFERENCES public.outbound_call_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES public.dialer_campaigns(id) ON DELETE SET NULL;
