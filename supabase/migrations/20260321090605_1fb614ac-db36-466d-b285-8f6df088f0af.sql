CREATE TABLE IF NOT EXISTS public.checklist_sticker_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id),
  person_type text NOT NULL,
  brand text NOT NULL,
  sticker_type text NOT NULL,
  installed boolean DEFAULT false,
  requested boolean DEFAULT false,
  mark_seen boolean DEFAULT false,
  seen_at timestamptz,
  notes text,
  brand_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(store_id, person_type, brand, sticker_type)
);

ALTER TABLE public.checklist_sticker_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated read checklist_sticker_visibility"
  ON public.checklist_sticker_visibility FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated insert checklist_sticker_visibility"
  ON public.checklist_sticker_visibility FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated update checklist_sticker_visibility"
  ON public.checklist_sticker_visibility FOR UPDATE TO authenticated USING (true) WITH CHECK (true);