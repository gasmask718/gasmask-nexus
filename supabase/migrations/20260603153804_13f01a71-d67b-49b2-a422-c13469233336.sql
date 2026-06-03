CREATE TABLE public.field_day_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL,
  rep_role text,
  note_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  completed_count integer NOT NULL DEFAULT 0,
  wrong_addresses jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs text,
  helpful text,
  observations text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rep_id, note_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_day_notes TO authenticated;
GRANT ALL ON public.field_day_notes TO service_role;

ALTER TABLE public.field_day_notes ENABLE ROW LEVEL SECURITY;

-- Reps manage their own notes
CREATE POLICY "Reps manage own day notes"
  ON public.field_day_notes
  FOR ALL
  TO authenticated
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- Admins/owners can view all
CREATE POLICY "Admins view all day notes"
  ON public.field_day_notes
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

-- Admins/owners can update (for resolving wrong-address flags)
CREATE POLICY "Admins update day notes"
  ON public.field_day_notes
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'owner'));

CREATE INDEX idx_field_day_notes_date ON public.field_day_notes (note_date DESC);
CREATE INDEX idx_field_day_notes_rep ON public.field_day_notes (rep_id, note_date DESC);

CREATE TRIGGER field_day_notes_updated_at
  BEFORE UPDATE ON public.field_day_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();