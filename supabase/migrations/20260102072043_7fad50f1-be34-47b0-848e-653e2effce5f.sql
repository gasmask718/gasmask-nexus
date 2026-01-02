-- Create store_opportunities table for tracking business opportunities
CREATE TABLE public.store_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  opportunity_text TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL CHECK (source IN ('manual', 'ai_extracted')),
  detected_from_note_id UUID REFERENCES public.store_notes(id) ON DELETE SET NULL,
  detected_from_interaction_id UUID REFERENCES public.contact_interactions(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_store_opportunities_store_id ON public.store_opportunities(store_id);
CREATE INDEX idx_store_opportunities_is_completed ON public.store_opportunities(is_completed);
CREATE INDEX idx_store_opportunities_created_at ON public.store_opportunities(created_at);
CREATE INDEX idx_store_opportunities_source ON public.store_opportunities(source);

-- Enable Row Level Security
ALTER TABLE public.store_opportunities ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view opportunities
CREATE POLICY "Anyone can view store opportunities"
ON public.store_opportunities
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only admins can insert opportunities
CREATE POLICY "Admins can insert store opportunities"
ON public.store_opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Only admins can update opportunities
CREATE POLICY "Admins can update store opportunities"
ON public.store_opportunities
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy: Only admins can delete opportunities
CREATE POLICY "Admins can delete store opportunities"
ON public.store_opportunities
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Create trigger for auto-updating updated_at timestamp
CREATE TRIGGER update_store_opportunities_updated_at
BEFORE UPDATE ON public.store_opportunities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();