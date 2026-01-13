-- Partner notes (durable, first-class records)
CREATE TABLE IF NOT EXISTS public.crm_partner_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.crm_partners(id) ON DELETE CASCADE,
  business_slug text NOT NULL,
  is_simulation boolean NOT NULL DEFAULT false,
  note_text text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_partner_notes_partner_id_created_at
  ON public.crm_partner_notes (partner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_partner_notes_partner_id_pinned
  ON public.crm_partner_notes (partner_id, is_pinned);

ALTER TABLE public.crm_partner_notes ENABLE ROW LEVEL SECURITY;

-- Anyone logged in can read partner notes
CREATE POLICY "Partner notes readable by authenticated"
  ON public.crm_partner_notes
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only the author can create notes (created_by defaults to auth.uid())
CREATE POLICY "Partner notes insert by author"
  ON public.crm_partner_notes
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Only the author can edit their notes
CREATE POLICY "Partner notes update by author"
  ON public.crm_partner_notes
  FOR UPDATE
  USING (auth.role() = 'authenticated' AND created_by = auth.uid())
  WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Only the author can delete their notes
CREATE POLICY "Partner notes delete by author"
  ON public.crm_partner_notes
  FOR DELETE
  USING (auth.role() = 'authenticated' AND created_by = auth.uid());

-- Keep updated_at current
DROP TRIGGER IF EXISTS update_crm_partner_notes_updated_at ON public.crm_partner_notes;
CREATE TRIGGER update_crm_partner_notes_updated_at
  BEFORE UPDATE ON public.crm_partner_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();