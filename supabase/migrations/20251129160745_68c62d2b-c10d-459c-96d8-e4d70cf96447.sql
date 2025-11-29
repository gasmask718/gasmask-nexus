-- Add ai_summary column to ai_daily_briefings if it doesn't exist
ALTER TABLE public.ai_daily_briefings 
ADD COLUMN IF NOT EXISTS ai_summary text;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_daily_briefings_date_type 
ON public.ai_daily_briefings(briefing_date, briefing_type);