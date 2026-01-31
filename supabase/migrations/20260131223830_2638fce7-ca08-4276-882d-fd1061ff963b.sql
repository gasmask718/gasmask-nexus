-- ============================================
-- GLOBAL WHOLESALER CONTACTS ARCHITECTURE
-- Wholesalers are network-level entities, not store-owned
-- ============================================

-- 1. Create global wholesalers table (network-level contacts)
CREATE TABLE IF NOT EXISTS public.wholesalers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  city text,
  state text,
  phone text,
  email text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create store-wholesaler association (many-to-many junction)
CREATE TABLE IF NOT EXISTS public.store_wholesaler_associations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.store_master(id) ON DELETE CASCADE,
  wholesaler_id uuid NOT NULL REFERENCES public.wholesalers(id) ON DELETE CASCADE,
  notes text,
  is_primary boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, wholesaler_id)
);

-- 3. Migrate existing store_wholesaler_contacts to global wholesalers
-- Insert unique wholesalers (by name) into global table
INSERT INTO public.wholesalers (name, address, phone, created_by, created_at)
SELECT DISTINCT ON (name) 
  name, 
  address, 
  phone, 
  created_by, 
  created_at
FROM public.store_wholesaler_contacts
WHERE name IS NOT NULL AND name != ''
ON CONFLICT DO NOTHING;

-- 4. Create associations from old store-owned records
INSERT INTO public.store_wholesaler_associations (store_id, wholesaler_id, created_by)
SELECT 
  swc.store_id,
  w.id,
  swc.created_by
FROM public.store_wholesaler_contacts swc
JOIN public.wholesalers w ON w.name = swc.name
ON CONFLICT (store_id, wholesaler_id) DO NOTHING;

-- 5. Enable RLS on new tables
ALTER TABLE public.wholesalers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_wholesaler_associations ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for wholesalers (global read, authenticated write)
CREATE POLICY "Wholesalers are viewable by authenticated users"
  ON public.wholesalers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert wholesalers"
  ON public.wholesalers FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update wholesalers"
  ON public.wholesalers FOR UPDATE
  TO authenticated
  USING (true);

-- 7. RLS Policies for store-wholesaler associations
CREATE POLICY "Associations are viewable by authenticated users"
  ON public.store_wholesaler_associations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create associations"
  ON public.store_wholesaler_associations FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete associations"
  ON public.store_wholesaler_associations FOR DELETE
  TO authenticated
  USING (true);

-- 8. Indexes for performance
CREATE INDEX idx_wholesalers_name ON public.wholesalers(name);
CREATE INDEX idx_store_wholesaler_assoc_store ON public.store_wholesaler_associations(store_id);
CREATE INDEX idx_store_wholesaler_assoc_wholesaler ON public.store_wholesaler_associations(wholesaler_id);

-- 9. Updated_at trigger for wholesalers
CREATE TRIGGER update_wholesalers_updated_at
  BEFORE UPDATE ON public.wholesalers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();