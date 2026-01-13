-- ═══════════════════════════════════════════════════════════════════════════════
-- STORE PEOPLE LINKING TABLE — Links people to stores by role
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.store_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  role text NOT NULL,
  assigned_at timestamptz DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- One person can have one role per store (but can have different roles at different stores)
  UNIQUE(store_id, person_id, role)
);

-- Enable RLS
ALTER TABLE public.store_people ENABLE ROW LEVEL SECURITY;

-- RLS Policies for store_people
CREATE POLICY "Users can view store people"
  ON public.store_people
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert store people"
  ON public.store_people
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update store people"
  ON public.store_people
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete store people"
  ON public.store_people
  FOR DELETE
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX idx_store_people_store_id ON public.store_people(store_id);
CREATE INDEX idx_store_people_person_id ON public.store_people(person_id);
CREATE INDEX idx_store_people_role ON public.store_people(role);
CREATE INDEX idx_store_people_active ON public.store_people(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE TRIGGER update_store_people_updated_at
  BEFORE UPDATE ON public.store_people
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.store_people IS 'Links people to stores by role (ambassador, driver, biker, etc.)';
COMMENT ON COLUMN public.store_people.role IS 'Role at this store: ambassador, driver, biker, manager, worker, etc.';