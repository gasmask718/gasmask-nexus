-- Create uploaded_files table
CREATE TABLE IF NOT EXISTS public.uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'xlsx')),
  uploaded_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  row_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  processed_count INTEGER DEFAULT 0,
  errors JSONB,
  preview_data JSONB,
  target_table TEXT NOT NULL
);

-- Create data_import_jobs table
CREATE TABLE IF NOT EXISTS public.data_import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  rows_total INTEGER DEFAULT 0,
  rows_inserted INTEGER DEFAULT 0,
  rows_failed INTEGER DEFAULT 0,
  ai_cleaning_summary JSONB,
  conflict_rules_applied JSONB
);

-- Create data_import_mapping table
CREATE TABLE IF NOT EXISTS public.data_import_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID REFERENCES public.uploaded_files(id) ON DELETE CASCADE,
  source_column TEXT NOT NULL,
  destination_field TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('string', 'number', 'phone', 'email', 'address', 'bool', 'enum')),
  required BOOLEAN DEFAULT false,
  validation_rules JSONB
);

-- Create dedupe_suggestions table
CREATE TABLE IF NOT EXISTS public.dedupe_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  duplicate_id UUID NOT NULL,
  similarity_score INTEGER NOT NULL,
  merge_recommendation TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX idx_uploaded_files_created_at ON public.uploaded_files(created_at DESC);
CREATE INDEX idx_uploaded_files_uploaded_by ON public.uploaded_files(uploaded_by);
CREATE INDEX idx_uploaded_files_target_table ON public.uploaded_files(target_table);
CREATE INDEX idx_data_import_jobs_file_id ON public.data_import_jobs(file_id);
CREATE INDEX idx_data_import_jobs_status ON public.data_import_jobs(status);
CREATE INDEX idx_data_import_mapping_file_id ON public.data_import_mapping(file_id);
CREATE INDEX idx_dedupe_suggestions_entity_type ON public.dedupe_suggestions(entity_type);
CREATE INDEX idx_dedupe_suggestions_status ON public.dedupe_suggestions(status);

-- Enable RLS
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_import_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dedupe_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for uploaded_files
CREATE POLICY "Admins can manage uploaded files"
  ON public.uploaded_files
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own uploads"
  ON public.uploaded_files
  FOR SELECT
  USING (uploaded_by = auth.uid());

-- RLS Policies for data_import_jobs
CREATE POLICY "Admins can manage import jobs"
  ON public.data_import_jobs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for data_import_mapping
CREATE POLICY "Admins can manage import mapping"
  ON public.data_import_mapping
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for dedupe_suggestions
CREATE POLICY "Admins can manage dedupe suggestions"
  ON public.dedupe_suggestions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );