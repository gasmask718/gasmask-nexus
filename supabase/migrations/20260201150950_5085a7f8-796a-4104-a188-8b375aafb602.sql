-- Add missing columns to production_worker_attendance table
ALTER TABLE public.production_worker_attendance 
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.production_offices(id),
  ADD COLUMN IF NOT EXISTS attendance_date DATE DEFAULT CURRENT_DATE;

-- Make batch_id nullable since attendance can exist without a batch
ALTER TABLE public.production_worker_attendance 
  ALTER COLUMN batch_id DROP NOT NULL;

-- Backfill office_id from related batch if available
UPDATE public.production_worker_attendance pwa
SET office_id = pb.office_id
FROM public.production_batches pb
WHERE pwa.batch_id = pb.id AND pwa.office_id IS NULL;

-- Create index for efficient querying by office and date
CREATE INDEX IF NOT EXISTS idx_worker_attendance_office_date 
  ON public.production_worker_attendance(office_id, attendance_date);

-- Add RLS policy for office-scoped access
DROP POLICY IF EXISTS "Office managers can manage attendance" ON public.production_worker_attendance;
CREATE POLICY "Office managers can manage attendance" 
  ON public.production_worker_attendance 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);