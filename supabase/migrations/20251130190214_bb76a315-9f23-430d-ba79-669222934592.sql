-- Dynasty OS Checkpoints Cloud Backup Table
CREATE TABLE public.dynasty_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

-- Index for efficient querying by owner
CREATE INDEX dynasty_checkpoints_owner_created_idx 
  ON public.dynasty_checkpoints (owner_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.dynasty_checkpoints ENABLE ROW LEVEL SECURITY;

-- Users can only see their own checkpoints
CREATE POLICY "Users can view their own checkpoints"
  ON public.dynasty_checkpoints FOR SELECT
  USING (auth.uid() = owner_id);

-- Users can create their own checkpoints
CREATE POLICY "Users can create their own checkpoints"
  ON public.dynasty_checkpoints FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Users can delete their own checkpoints
CREATE POLICY "Users can delete their own checkpoints"
  ON public.dynasty_checkpoints FOR DELETE
  USING (auth.uid() = owner_id);