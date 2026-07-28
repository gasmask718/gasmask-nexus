ALTER TABLE public.communication_logs DROP CONSTRAINT IF EXISTS communication_logs_channel_check;
ALTER TABLE public.communication_logs ADD CONSTRAINT communication_logs_channel_check
  CHECK (channel = ANY (ARRAY['call','sms','email','whatsapp','in-person','note','visit','mission','ai_call','voice']));

ALTER TABLE public.communication_logs DROP CONSTRAINT IF EXISTS communication_logs_direction_check;
ALTER TABLE public.communication_logs ADD CONSTRAINT communication_logs_direction_check
  CHECK (direction = ANY (ARRAY['inbound','outbound','system']));