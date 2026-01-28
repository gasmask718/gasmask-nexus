
-- MASTER GENIUS ARCHITECT: Lane separation and safe deletion infrastructure

-- 1. Create dedicated wholesaler_assignments table for lane separation
CREATE TABLE IF NOT EXISTS public.wholesaler_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE CASCADE NOT NULL,
  wholesaler_id UUID REFERENCES public.wholesalers(id) ON DELETE CASCADE NOT NULL,
  assignment_type TEXT DEFAULT 'assigned' CHECK (assignment_type IN ('assigned', 'sourced', 'referred')),
  active BOOLEAN DEFAULT true NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  -- Safe unassignment tracking (never delete, only deactivate)
  unassigned_at TIMESTAMPTZ,
  unassigned_by UUID REFERENCES public.ambassadors(id),
  notes TEXT,
  UNIQUE (ambassador_id, wholesaler_id)
);

-- 2. Add note_date column to store_notes (fix the missing column error)
ALTER TABLE public.store_notes 
ADD COLUMN IF NOT EXISTS note_date TIMESTAMPTZ DEFAULT now();

-- Update existing records to use created_at as note_date
UPDATE public.store_notes 
SET note_date = created_at 
WHERE note_date IS NULL;

-- 3. Enable RLS on wholesaler_assignments
ALTER TABLE public.wholesaler_assignments ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies for wholesaler_assignments
CREATE POLICY "Ambassadors can view their own wholesaler assignments"
  ON public.wholesaler_assignments FOR SELECT
  USING (
    ambassador_id IN (
      SELECT id FROM public.ambassadors 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Ambassadors can update their own wholesaler assignments"
  ON public.wholesaler_assignments FOR UPDATE
  USING (
    ambassador_id IN (
      SELECT id FROM public.ambassadors 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert wholesaler assignments"
  ON public.wholesaler_assignments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_wholesaler_assignments_ambassador 
  ON public.wholesaler_assignments(ambassador_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_assignments_wholesaler 
  ON public.wholesaler_assignments(wholesaler_id);
CREATE INDEX IF NOT EXISTS idx_wholesaler_assignments_active 
  ON public.wholesaler_assignments(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_store_notes_note_date 
  ON public.store_notes(note_date DESC);
