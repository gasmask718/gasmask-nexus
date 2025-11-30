-- Cloud Checkpoints Table for backup system
CREATE TABLE IF NOT EXISTS public.cloud_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  checkpoint_type TEXT NOT NULL DEFAULT 'manual',
  label TEXT,
  notes TEXT,
  snapshot_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cloud_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users can only access their own checkpoints
CREATE POLICY "Users can view own checkpoints"
ON public.cloud_checkpoints FOR SELECT
TO authenticated
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create own checkpoints"
ON public.cloud_checkpoints FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can delete own checkpoints"
ON public.cloud_checkpoints FOR DELETE
TO authenticated
USING (auth.uid() = owner_id);

-- Admins can view all checkpoints
CREATE POLICY "Admins can view all checkpoints"
ON public.cloud_checkpoints FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Index for fast lookups
CREATE INDEX idx_cloud_checkpoints_owner ON public.cloud_checkpoints(owner_id);
CREATE INDEX idx_cloud_checkpoints_created ON public.cloud_checkpoints(created_at DESC);