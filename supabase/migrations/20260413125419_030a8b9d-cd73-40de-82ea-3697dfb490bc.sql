ALTER TABLE tt_partner_assets
  ADD COLUMN IF NOT EXISTS partner_phone text,
  ADD COLUMN IF NOT EXISTS service_types text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS capabilities jsonb DEFAULT '{}';