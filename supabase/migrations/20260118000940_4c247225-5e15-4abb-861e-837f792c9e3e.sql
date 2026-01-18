-- Drop the incorrectly referenced table and recreate with correct FK
DROP TABLE IF EXISTS public.wholesaler_store_map CASCADE;

-- Create wholesaler_store_map table referencing wholesale_hubs
CREATE TABLE public.wholesaler_store_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wholesaler_id UUID NOT NULL REFERENCES public.wholesale_hubs(id) ON DELETE CASCADE,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  assigned_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(wholesaler_id, store_id)
);

-- Create indexes for efficient queries
CREATE INDEX idx_wholesaler_store_map_wholesaler ON public.wholesaler_store_map(wholesaler_id, is_active);
CREATE INDEX idx_wholesaler_store_map_store ON public.wholesaler_store_map(store_id);

-- Enable RLS
ALTER TABLE public.wholesaler_store_map ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all users to view wholesaler store mappings"
  ON public.wholesaler_store_map FOR SELECT
  USING (true);

CREATE POLICY "Allow authenticated users to insert wholesaler store mappings"
  ON public.wholesaler_store_map FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to update wholesaler store mappings"
  ON public.wholesaler_store_map FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated users to delete wholesaler store mappings"
  ON public.wholesaler_store_map FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_wholesaler_store_map_timestamp
  BEFORE UPDATE ON public.wholesaler_store_map
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-populate from existing wholesale_orders (derive initial mappings)
INSERT INTO public.wholesaler_store_map (wholesaler_id, store_id, is_active, assigned_at)
SELECT DISTINCT 
  wo.wholesaler_id,
  wo.store_id,
  true,
  MIN(wo.created_at)
FROM public.wholesale_orders wo
WHERE wo.wholesaler_id IS NOT NULL 
  AND wo.store_id IS NOT NULL
GROUP BY wo.wholesaler_id, wo.store_id
ON CONFLICT (wholesaler_id, store_id) DO NOTHING;

-- Create a function to auto-add store mappings when orders are created
CREATE OR REPLACE FUNCTION public.auto_map_wholesaler_store()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wholesaler_store_map (wholesaler_id, store_id, is_active)
  VALUES (NEW.wholesaler_id, NEW.store_id, true)
  ON CONFLICT (wholesaler_id, store_id) DO UPDATE SET
    is_active = true,
    updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS auto_map_wholesaler_store_on_order ON public.wholesale_orders;

-- Trigger to auto-map on new orders
CREATE TRIGGER auto_map_wholesaler_store_on_order
  AFTER INSERT ON public.wholesale_orders
  FOR EACH ROW
  WHEN (NEW.wholesaler_id IS NOT NULL AND NEW.store_id IS NOT NULL)
  EXECUTE FUNCTION public.auto_map_wholesaler_store();