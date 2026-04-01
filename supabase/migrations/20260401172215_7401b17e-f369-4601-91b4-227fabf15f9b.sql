
-- Extend ut_suppliers with procurement intelligence fields
ALTER TABLE public.ut_suppliers
ADD COLUMN IF NOT EXISTS risk_score numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS avg_response_time numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS avg_shipping_delay numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS dispute_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS successful_orders integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_orders integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS communication_score numeric DEFAULT 50,
ADD COLUMN IF NOT EXISTS branding_score numeric DEFAULT 50;

-- Create ut_supplier_risk_profiles
CREATE TABLE IF NOT EXISTS public.ut_supplier_risk_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.ut_suppliers(id) ON DELETE CASCADE NOT NULL,
  risk_score numeric DEFAULT 50,
  risk_level text DEFAULT 'medium',
  flagged_issues_count integer DEFAULT 0,
  delay_probability numeric DEFAULT 0,
  quality_risk numeric DEFAULT 0,
  communication_risk numeric DEFAULT 0,
  pricing_anomaly_detected boolean DEFAULT false,
  last_incident text,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ut_supplier_risk_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage risk profiles"
ON public.ut_supplier_risk_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create ut_sample_reviews
CREATE TABLE IF NOT EXISTS public.ut_sample_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.ut_suppliers(id) ON DELETE CASCADE NOT NULL,
  rfq_id uuid REFERENCES public.ut_rfq_requests(id) ON DELETE SET NULL,
  quality_score numeric DEFAULT 0,
  branding_accuracy numeric DEFAULT 0,
  packaging_score numeric DEFAULT 0,
  notes text,
  photo_urls text[],
  approved boolean DEFAULT false,
  reviewed_by text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ut_sample_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage sample reviews"
ON public.ut_sample_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Create ut_procurement_approvals
CREATE TABLE IF NOT EXISTS public.ut_procurement_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid REFERENCES public.ut_rfq_requests(id) ON DELETE CASCADE NOT NULL,
  supplier_id uuid REFERENCES public.ut_suppliers(id) ON DELETE CASCADE NOT NULL,
  approved_by text,
  approval_status text DEFAULT 'pending',
  risk_checked boolean DEFAULT false,
  shipping_reviewed boolean DEFAULT false,
  branding_reviewed boolean DEFAULT false,
  sample_approved boolean DEFAULT false,
  notes text,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.ut_procurement_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage procurement approvals"
ON public.ut_procurement_approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_risk_profiles_supplier ON public.ut_supplier_risk_profiles(supplier_id);
CREATE INDEX IF NOT EXISTS idx_sample_reviews_supplier ON public.ut_sample_reviews(supplier_id);
CREATE INDEX IF NOT EXISTS idx_procurement_approvals_rfq ON public.ut_procurement_approvals(rfq_id);
CREATE INDEX IF NOT EXISTS idx_procurement_approvals_supplier ON public.ut_procurement_approvals(supplier_id);
