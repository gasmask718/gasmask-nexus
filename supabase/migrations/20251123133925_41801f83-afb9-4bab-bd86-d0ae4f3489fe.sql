-- Create table for tracking data exports
CREATE TABLE IF NOT EXISTS public.crm_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  export_type TEXT NOT NULL, -- 'contacts', 'logs', 'invoices', 'full'
  format TEXT NOT NULL, -- 'csv', 'excel', 'json', 'xml', 'pdf'
  file_url TEXT,
  record_count INTEGER,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  error_message TEXT,
  filters JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create table for tracking data imports
CREATE TABLE IF NOT EXISTS public.crm_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  import_type TEXT NOT NULL, -- 'contacts', 'logs', 'invoices'
  file_name TEXT NOT NULL,
  file_url TEXT,
  total_rows INTEGER,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  duplicate_rows INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'mapping', 'processing', 'completed', 'failed'
  error_message TEXT,
  mapping JSONB, -- column mapping configuration
  validation_errors JSONB,
  can_rollback BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Create table for CRM snapshots (backup/recovery)
CREATE TABLE IF NOT EXISTS public.crm_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id),
  snapshot_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto', 'scheduled'
  snapshot_data JSONB NOT NULL,
  metadata JSONB,
  file_url TEXT,
  size_bytes BIGINT,
  record_counts JSONB, -- counts of each table
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Create table for backup automation settings
CREATE TABLE IF NOT EXISTS public.crm_backup_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
  auto_export_enabled BOOLEAN DEFAULT false,
  export_frequency TEXT DEFAULT 'daily', -- 'daily', 'weekly', 'monthly'
  export_time TEXT DEFAULT '01:00', -- HH:MM format
  storage_provider TEXT, -- 'google_drive', 'dropbox', 'onedrive', 'email', 'local'
  storage_config JSONB, -- provider-specific settings
  last_export_at TIMESTAMPTZ,
  next_export_at TIMESTAMPTZ,
  export_failures INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_backup_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for crm_exports
CREATE POLICY "Users can view exports for their business"
  ON public.crm_exports FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create exports for their business"
  ON public.crm_exports FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for crm_imports
CREATE POLICY "Users can view imports for their business"
  ON public.crm_imports FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create imports for their business"
  ON public.crm_imports FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for crm_snapshots
CREATE POLICY "Users can view snapshots for their business"
  ON public.crm_snapshots FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create snapshots for their business"
  ON public.crm_snapshots FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for crm_backup_settings
CREATE POLICY "Users can view backup settings for their business"
  ON public.crm_backup_settings FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage backup settings for their business"
  ON public.crm_backup_settings FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM public.business_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create indexes
CREATE INDEX idx_crm_exports_business ON public.crm_exports(business_id);
CREATE INDEX idx_crm_exports_created_at ON public.crm_exports(created_at DESC);
CREATE INDEX idx_crm_imports_business ON public.crm_imports(business_id);
CREATE INDEX idx_crm_imports_created_at ON public.crm_imports(created_at DESC);
CREATE INDEX idx_crm_snapshots_business ON public.crm_snapshots(business_id);
CREATE INDEX idx_crm_snapshots_created_at ON public.crm_snapshots(created_at DESC);
CREATE INDEX idx_crm_backup_settings_business ON public.crm_backup_settings(business_id);

-- Trigger to update backup settings timestamp
CREATE TRIGGER update_crm_backup_settings_updated_at
  BEFORE UPDATE ON public.crm_backup_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();