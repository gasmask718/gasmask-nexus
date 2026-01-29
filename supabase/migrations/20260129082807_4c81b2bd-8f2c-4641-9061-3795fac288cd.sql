-- Create ambassador_applications table for pending recruit applications
CREATE TABLE IF NOT EXISTS public.ambassador_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referred_by_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  referral_code TEXT NOT NULL,
  
  -- Applicant information
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  city TEXT,
  state TEXT,
  experience TEXT,
  motivation TEXT,
  
  -- Application status
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Resulting ambassador record (set on approval)
  created_ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

-- Admins can see and manage all applications
CREATE POLICY "Admins can manage applications"
  ON public.ambassador_applications
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Ambassadors can see applications they referred (read-only)
CREATE POLICY "Ambassadors can view their referrals"
  ON public.ambassador_applications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambassadors
      WHERE ambassadors.id = ambassador_applications.referred_by_ambassador_id
      AND ambassadors.user_id = auth.uid()
    )
  );

-- Public can insert applications (no auth required for application submission)
CREATE POLICY "Anyone can submit applications"
  ON public.ambassador_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Index for faster lookups
CREATE INDEX idx_ambassador_applications_status ON public.ambassador_applications(status);
CREATE INDEX idx_ambassador_applications_referrer ON public.ambassador_applications(referred_by_ambassador_id);
CREATE INDEX idx_ambassador_applications_referral_code ON public.ambassador_applications(referral_code);

-- Admin impersonation log table
CREATE TABLE IF NOT EXISTS public.admin_impersonation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  impersonated_ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  actions_taken JSONB DEFAULT '[]'::jsonb,
  ip_address TEXT,
  user_agent TEXT
);

-- Enable RLS
ALTER TABLE public.admin_impersonation_log ENABLE ROW LEVEL SECURITY;

-- Only admins can access impersonation logs
CREATE POLICY "Admins can manage impersonation logs"
  ON public.admin_impersonation_log
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Index for lookups
CREATE INDEX idx_admin_impersonation_log_admin ON public.admin_impersonation_log(admin_user_id);
CREATE INDEX idx_admin_impersonation_log_ambassador ON public.admin_impersonation_log(impersonated_ambassador_id);

-- Add referral_code to ambassadors table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ambassadors' 
    AND column_name = 'referral_code'
  ) THEN
    ALTER TABLE public.ambassadors ADD COLUMN referral_code TEXT UNIQUE;
  END IF;
END $$;

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := 'AMB' || UPPER(SUBSTRING(gen_random_uuid()::text, 1, 6));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate referral code
DROP TRIGGER IF EXISTS trg_ambassador_referral_code ON public.ambassadors;
CREATE TRIGGER trg_ambassador_referral_code
  BEFORE INSERT ON public.ambassadors
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_referral_code();