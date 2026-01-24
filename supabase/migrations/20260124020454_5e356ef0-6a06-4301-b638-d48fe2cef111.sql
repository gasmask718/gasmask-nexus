-- Add business hours and after-hours routing to businesses table
-- These fields enable time-aware call routing

-- Add timezone field (IANA format, e.g., 'America/New_York')
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/New_York';

-- Add business hours JSON field (structured schedule per day)
-- Example: {"monday": {"open": "09:00", "close": "18:00", "enabled": true}, ...}
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{
  "monday": {"open": "09:00", "close": "18:00", "enabled": true},
  "tuesday": {"open": "09:00", "close": "18:00", "enabled": true},
  "wednesday": {"open": "09:00", "close": "18:00", "enabled": true},
  "thursday": {"open": "09:00", "close": "18:00", "enabled": true},
  "friday": {"open": "09:00", "close": "18:00", "enabled": true},
  "saturday": {"open": "10:00", "close": "16:00", "enabled": false},
  "sunday": {"enabled": false}
}'::jsonb;

-- Add after-hours routing configuration
-- route_type: 'role' | 'user' | 'voicemail' | 'kiosk' | 'message'
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS after_hours_route_type TEXT DEFAULT 'voicemail';

-- Target user ID for after-hours (when route_type = 'user')
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS after_hours_route_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Target role for after-hours (when route_type = 'role')
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS after_hours_route_role TEXT;

-- Custom after-hours message (when route_type = 'message')
ALTER TABLE public.businesses 
ADD COLUMN IF NOT EXISTS after_hours_message TEXT DEFAULT 'We are currently closed. Please leave a message and we will return your call during business hours.';

-- Add index on timezone for performance
CREATE INDEX IF NOT EXISTS idx_businesses_timezone ON public.businesses(timezone);

-- Comment on columns for documentation
COMMENT ON COLUMN public.businesses.timezone IS 'IANA timezone identifier (e.g., America/New_York)';
COMMENT ON COLUMN public.businesses.business_hours IS 'Weekly schedule in JSON format with open/close times per day';
COMMENT ON COLUMN public.businesses.after_hours_route_type IS 'How to handle calls outside business hours: role, user, voicemail, kiosk, or message';
COMMENT ON COLUMN public.businesses.after_hours_route_user_id IS 'Target user for after-hours calls when route_type is user';
COMMENT ON COLUMN public.businesses.after_hours_route_role IS 'Target role for after-hours calls when route_type is role';
COMMENT ON COLUMN public.businesses.after_hours_message IS 'Custom message to play during after-hours calls';