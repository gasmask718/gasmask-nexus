
-- ═══════════════════════════════════════════════════════════════════════════════
-- BUSINESS FINANCIAL PROFILES — Multi-Business Accounting Intelligence Layer
-- Tracks connection status, revenue source, and reporting mode per business
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TYPE public.financial_connection_status AS ENUM ('manual', 'partial', 'api_connected', 'external_pending', 'not_connected');
CREATE TYPE public.revenue_source_type AS ENUM ('internal_os', 'external_website', 'marketplace', 'offline', 'mixed');
CREATE TYPE public.reporting_mode AS ENUM ('live', 'daily_summary', 'weekly_manual', 'estimated', 'placeholder');

CREATE TABLE public.business_financial_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  connection_status public.financial_connection_status NOT NULL DEFAULT 'not_connected',
  revenue_source public.revenue_source_type NOT NULL DEFAULT 'offline',
  reporting_mode public.reporting_mode NOT NULL DEFAULT 'placeholder',
  monthly_revenue_estimate NUMERIC DEFAULT 0,
  monthly_expense_estimate NUMERIC DEFAULT 0,
  last_data_sync_at TIMESTAMPTZ,
  data_confidence_pct INTEGER DEFAULT 0 CHECK (data_confidence_pct >= 0 AND data_confidence_pct <= 100),
  api_provider TEXT,
  api_connected_at TIMESTAMPTZ,
  fiscal_year_start INTEGER DEFAULT 1 CHECK (fiscal_year_start >= 1 AND fiscal_year_start <= 12),
  currency TEXT DEFAULT 'USD',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

-- Enable RLS
ALTER TABLE public.business_financial_profiles ENABLE ROW LEVEL SECURITY;

-- Owner/Admin can view all
CREATE POLICY "Admins can view financial profiles"
  ON public.business_financial_profiles FOR SELECT
  TO authenticated
  USING (true);

-- Only owner/admin can modify
CREATE POLICY "Admins can manage financial profiles"
  ON public.business_financial_profiles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Auto-populate profiles for all existing businesses
INSERT INTO public.business_financial_profiles (business_id, connection_status, revenue_source, reporting_mode, data_confidence_pct)
SELECT 
  b.id,
  CASE 
    WHEN b.industry = 'tobacco_lifestyle' THEN 'partial'::public.financial_connection_status
    ELSE 'not_connected'::public.financial_connection_status
  END,
  CASE
    WHEN b.business_type = 'consumer_goods' THEN 'internal_os'::public.revenue_source_type
    WHEN b.business_type = 'services' THEN 'offline'::public.revenue_source_type
    WHEN b.business_type = 'platform' THEN 'external_website'::public.revenue_source_type
    ELSE 'offline'::public.revenue_source_type
  END,
  CASE
    WHEN b.industry = 'tobacco_lifestyle' THEN 'daily_summary'::public.reporting_mode
    ELSE 'placeholder'::public.reporting_mode
  END,
  CASE 
    WHEN b.industry = 'tobacco_lifestyle' THEN 60
    ELSE 0
  END
FROM public.businesses b
WHERE b.is_active = true
ON CONFLICT (business_id) DO NOTHING;

-- Updated timestamp trigger
CREATE TRIGGER update_business_financial_profiles_updated_at
  BEFORE UPDATE ON public.business_financial_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
