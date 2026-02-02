-- Add POD and execution fields to deliveries
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES public.stores(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES public.routes(id);
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'GasMask';
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- POD fields
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pod_photo_url TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pod_signature_url TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pod_recipient_name TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pod_notes TEXT;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS pod_captured_at TIMESTAMPTZ;

-- Completion tracking
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- Add route state column
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS route_state TEXT DEFAULT 'draft';
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS locked_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.routes ADD COLUMN IF NOT EXISTS vehicle_type TEXT;

-- Create delivery exceptions table if not exists
CREATE TABLE IF NOT EXISTS public.delivery_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES public.deliveries(id) ON DELETE CASCADE NOT NULL,
  exception_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  description TEXT NOT NULL,
  photo_urls TEXT[] DEFAULT '{}',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reported_by UUID REFERENCES public.profiles(id)
);

-- Enable RLS on exceptions
ALTER TABLE public.delivery_exceptions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view delivery exceptions" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "Users can report delivery exceptions" ON public.delivery_exceptions;
DROP POLICY IF EXISTS "Users can update delivery exceptions" ON public.delivery_exceptions;

CREATE POLICY "Users can view delivery exceptions" ON public.delivery_exceptions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can report delivery exceptions" ON public.delivery_exceptions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update delivery exceptions" ON public.delivery_exceptions
  FOR UPDATE TO authenticated USING (true);

-- Create function to enforce route state locks
CREATE OR REPLACE FUNCTION public.check_route_state_lock()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.route_state IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot modify a % route', OLD.route_state;
  END IF;
  
  IF OLD.route_state = 'active' THEN
    IF (
      OLD.assigned_to IS DISTINCT FROM NEW.assigned_to OR
      OLD.territory IS DISTINCT FROM NEW.territory OR
      OLD.vehicle_type IS DISTINCT FROM NEW.vehicle_type
    ) THEN
      RAISE EXCEPTION 'Cannot modify core route properties while active';
    END IF;
  END IF;
  
  IF OLD.route_state = 'planned' AND NEW.route_state = 'active' THEN
    NEW.locked_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_deliveries_store ON public.deliveries(store_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_route ON public.deliveries(route_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_delivery_exceptions_delivery ON public.delivery_exceptions(delivery_id);