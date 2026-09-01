ALTER TABLE public.icw_state_config
  ADD COLUMN IF NOT EXISTS abbreviation text,
  ADD COLUMN IF NOT EXISTS handyman_license_status text,
  ADD COLUMN IF NOT EXISTS handyman_threshold_usd text,
  ADD COLUMN IF NOT EXISTS handyman_city_county_override_notes text,
  ADD COLUMN IF NOT EXISTS pest_control_license_required boolean,
  ADD COLUMN IF NOT EXISTS pest_control_agency text,
  ADD COLUMN IF NOT EXISTS biohazard_license_required_notes text,
  ADD COLUMN IF NOT EXISTS restoration_threshold_usd text,
  ADD COLUMN IF NOT EXISTS mold_remediation_specific_license_notes text,
  ADD COLUMN IF NOT EXISTS last_verified_date date,
  ADD COLUMN IF NOT EXISTS source text;