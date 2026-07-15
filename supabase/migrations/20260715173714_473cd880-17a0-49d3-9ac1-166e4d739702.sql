
-- brandaro_demo_sites: extend
ALTER TABLE public.brandaro_demo_sites
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS google_data jsonb,
  ADD COLUMN IF NOT EXISTS reviews jsonb,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS zip text,
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS generated_colors jsonb,
  ADD COLUMN IF NOT EXISTS vercel_deployment_id text,
  ADD COLUMN IF NOT EXISTS vercel_project_id text,
  ADD COLUMN IF NOT EXISTS industry_confidence numeric,
  ADD COLUMN IF NOT EXISTS hero_variant text,
  ADD COLUMN IF NOT EXISTS services_variant text,
  ADD COLUMN IF NOT EXISTS about_variant text,
  ADD COLUMN IF NOT EXISTS reviews_variant text,
  ADD COLUMN IF NOT EXISTS cta_variant text,
  ADD COLUMN IF NOT EXISTS audit_score integer,
  ADD COLUMN IF NOT EXISTS audit_passed boolean,
  ADD COLUMN IF NOT EXISTS audit_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS auto_fix_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS sms_sent_at timestamptz;

-- Expand generation_status check
ALTER TABLE public.brandaro_demo_sites
  DROP CONSTRAINT IF EXISTS brandaro_demo_sites_generation_status_check;
ALTER TABLE public.brandaro_demo_sites
  ADD CONSTRAINT brandaro_demo_sites_generation_status_check
  CHECK (generation_status = ANY (ARRAY[
    'pending','queued','fetching_places','generating_copy','generating_logo',
    'generating','deploying','auditing','fixing','ready','sms_sent','sent',
    'failed','expired'
  ]));

CREATE INDEX IF NOT EXISTS idx_brandaro_demo_sites_status
  ON public.brandaro_demo_sites (generation_status);
CREATE INDEX IF NOT EXISTS idx_brandaro_demo_sites_place
  ON public.brandaro_demo_sites (google_place_id);

-- brandaro_demo_templates: extend
ALTER TABLE public.brandaro_demo_templates
  ADD COLUMN IF NOT EXISTS design_md_path text,
  ADD COLUMN IF NOT EXISTS industry_keywords text[],
  ADD COLUMN IF NOT EXISTS brand_colors jsonb,
  ADD COLUMN IF NOT EXISTS vercel_deploy_hook_url text,
  ADD COLUMN IF NOT EXISTS vercel_template_repo text;

-- brandaro_demo_quality_scores: extend
ALTER TABLE public.brandaro_demo_quality_scores
  ADD COLUMN IF NOT EXISTS pass_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS dimension_scores jsonb,
  ADD COLUMN IF NOT EXISTS issues jsonb,
  ADD COLUMN IF NOT EXISTS fixes_applied jsonb;

CREATE INDEX IF NOT EXISTS idx_brandaro_demo_quality_scores_demo
  ON public.brandaro_demo_quality_scores (demo_id, pass_number);

-- Storage RLS: authenticated users can read/write brandaro-design-templates
CREATE POLICY "Authenticated read brandaro-design-templates"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'brandaro-design-templates');

CREATE POLICY "Authenticated write brandaro-design-templates"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'brandaro-design-templates');

CREATE POLICY "Authenticated update brandaro-design-templates"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'brandaro-design-templates');
