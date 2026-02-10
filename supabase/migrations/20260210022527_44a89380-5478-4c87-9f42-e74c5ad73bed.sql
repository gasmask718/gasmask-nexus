
-- Create pinned_notes table for Layer 2: Governed Memory System
CREATE TABLE public.pinned_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  contact_id UUID NULL REFERENCES public.store_contacts(id) ON DELETE SET NULL,
  note_text TEXT NOT NULL,
  pinned_by UUID NOT NULL,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  unpinned_at TIMESTAMPTZ NULL,
  unpinned_by UUID NULL
);

-- Index for fast lookup on delivery views
CREATE INDEX idx_pinned_notes_store_active ON public.pinned_notes (store_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.pinned_notes ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can read pinned notes
CREATE POLICY "Authenticated users can read pinned notes"
  ON public.pinned_notes FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only owner/admin/staff roles can create pinned notes
CREATE POLICY "Authorized roles can create pinned notes"
  ON public.pinned_notes FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'staff')
    )
  );

-- Only owner/admin/staff can update (unpin)
CREATE POLICY "Authorized roles can update pinned notes"
  ON public.pinned_notes FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin', 'staff')
    )
  );
