CREATE TABLE IF NOT EXISTS public.surplus_funds_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'new',
  source TEXT DEFAULT 'dynasty_recovery_website',
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  user_agent TEXT,
  ip_address TEXT,
  email_notification_sent BOOLEAN DEFAULT FALSE,
  email_notification_sent_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  replied_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sf_inquiries_status ON public.surplus_funds_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_sf_inquiries_created ON public.surplus_funds_inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sf_inquiries_source ON public.surplus_funds_inquiries(source);

ALTER TABLE public.surplus_funds_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on inquiries" ON public.surplus_funds_inquiries;
CREATE POLICY "Service role full access on inquiries"
  ON public.surplus_funds_inquiries FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.surplus_funds_leads
  ADD COLUMN IF NOT EXISTS website_consent_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS website_consent_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS website_contact_preference TEXT,
  ADD COLUMN IF NOT EXISTS website_best_time TEXT,
  ADD COLUMN IF NOT EXISTS website_sale_type TEXT,
  ADD COLUMN IF NOT EXISTS website_ownership_type TEXT,
  ADD COLUMN IF NOT EXISTS website_notes TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS referrer TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS email_notification_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_notification_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sms_notification_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bland_call_triggered BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bland_call_triggered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bland_call_id TEXT;

ALTER TABLE public.surplus_funds_attorneys
  ADD COLUMN IF NOT EXISTS application_status TEXT DEFAULT 'application_received',
  ADD COLUMN IF NOT EXISTS bar_number TEXT,
  ADD COLUMN IF NOT EXISTS years_practice INTEGER,
  ADD COLUMN IF NOT EXISTS practice_areas TEXT,
  ADD COLUMN IF NOT EXISTS interest_reason TEXT,
  ADD COLUMN IF NOT EXISTS malpractice_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS iolta_confirmed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bar_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS application_source TEXT DEFAULT 'dynasty_recovery_website',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;