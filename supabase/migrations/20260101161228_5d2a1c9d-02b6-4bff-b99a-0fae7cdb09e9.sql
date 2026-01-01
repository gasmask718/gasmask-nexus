-- Add soft-delete column to ut_staff_categories
ALTER TABLE public.ut_staff_categories 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient filtering of non-deleted categories
CREATE INDEX IF NOT EXISTS idx_ut_staff_categories_deleted_at 
ON public.ut_staff_categories(deleted_at) 
WHERE deleted_at IS NULL;

-- Add system_default column to prevent deletion of core categories
ALTER TABLE public.ut_staff_categories 
ADD COLUMN IF NOT EXISTS system_default BOOLEAN NOT NULL DEFAULT false;

-- Update KPI status CHECK constraint to include 'archived'
-- (Already exists from previous migration, but ensure it's correct)

-- Create function to handle soft-delete cascade
CREATE OR REPLACE FUNCTION public.soft_delete_staff_category(
  p_category_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if category is system_default
  IF EXISTS (
    SELECT 1 FROM public.ut_staff_categories 
    WHERE id = p_category_id AND system_default = true
  ) THEN
    RAISE EXCEPTION 'Cannot delete system default category';
  END IF;

  -- Soft-delete the category
  UPDATE public.ut_staff_categories 
  SET 
    is_active = false,
    deleted_at = now(),
    updated_at = now()
  WHERE id = p_category_id;

  -- Archive the associated KPI card
  UPDATE public.ut_staff_category_kpis 
  SET 
    status = 'archived',
    updated_at = now()
  WHERE staff_category_id = p_category_id;

  -- Unassign staff from deleted category (set category_id to NULL)
  UPDATE public.ut_staff 
  SET 
    category_id = NULL,
    updated_at = now()
  WHERE category_id = p_category_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.soft_delete_staff_category(UUID) TO authenticated;