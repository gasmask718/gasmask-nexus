ALTER TABLE dc_business_pipelines
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS billing_start_date DATE,
  ADD COLUMN IF NOT EXISTS plan_tier TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;