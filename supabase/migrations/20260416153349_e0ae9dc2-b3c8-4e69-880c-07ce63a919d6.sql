
-- Developer Portal Config (kill switch + settings)
CREATE TABLE public.developer_portal_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by TEXT,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_portal_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dev config"
  ON public.developer_portal_config FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can upsert dev config"
  ON public.developer_portal_config FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- Seed kill switch default
INSERT INTO public.developer_portal_config (config_key, config_value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "System under maintenance. Please check back soon.", "activated_by": null, "activated_at": null}'::jsonb);

-- Developer QA Tags (cross-funnel QA tracking)
CREATE TABLE public.developer_qa_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL,
  funnel_source TEXT NOT NULL,
  qa_status TEXT NOT NULL DEFAULT 'pending',
  tester_email TEXT,
  testing_notes TEXT,
  tested_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_qa_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage QA tags"
  ON public.developer_qa_tags FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_qa_tags_lead ON public.developer_qa_tags(lead_id);
CREATE INDEX idx_qa_tags_funnel ON public.developer_qa_tags(funnel_source);

-- Developer Audit Log
CREATE TABLE public.developer_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  target_table TEXT,
  target_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.developer_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage audit log"
  ON public.developer_audit_log FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.developer_portal_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.developer_audit_log;
