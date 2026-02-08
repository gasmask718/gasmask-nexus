
-- ============================================================
-- Phase 3: Worker Submission Flow
-- ============================================================

-- Worker submissions table: pending_review records that require manager approval
CREATE TABLE public.production_worker_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID REFERENCES public.production_batches(id),
  office_id UUID NOT NULL,
  worker_id UUID REFERENCES public.production_workers(id),
  submitted_by UUID REFERENCES auth.users(id),
  
  -- Production data submitted
  lbs_processed NUMERIC(10,2) DEFAULT 0,
  tubes_produced INTEGER DEFAULT 0,
  boxes_packed INTEGER DEFAULT 0,
  defects_count INTEGER DEFAULT 0,
  defect_reason TEXT,
  waste_lbs NUMERIC(10,2) DEFAULT 0,
  downtime_minutes INTEGER DEFAULT 0,
  downtime_reason TEXT,
  quality_check_passed BOOLEAN,
  notes TEXT,
  
  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('pending_review', 'approved', 'rejected', 'auto_approved')),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  
  -- Auto-approval rule reference (if auto-approved)
  auto_rule_applied TEXT,
  
  -- Resulting batch output (created on approval)
  resulting_output_id UUID,
  
  -- Timestamps
  shift_label TEXT DEFAULT 'day',
  submission_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.production_worker_submissions ENABLE ROW LEVEL SECURITY;

-- RLS: Authenticated users can read submissions for their office
CREATE POLICY "Authenticated users can read submissions"
  ON public.production_worker_submissions FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- RLS: Workers can insert their own submissions
CREATE POLICY "Workers can create submissions"
  ON public.production_worker_submissions FOR INSERT
  WITH CHECK (auth.uid() = submitted_by);

-- RLS: Managers can update submissions (approve/reject)
CREATE POLICY "Managers can update submissions"
  ON public.production_worker_submissions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Index for common queries
CREATE INDEX idx_worker_submissions_office_date 
  ON public.production_worker_submissions(office_id, submission_date);
CREATE INDEX idx_worker_submissions_status 
  ON public.production_worker_submissions(status);
CREATE INDEX idx_worker_submissions_batch 
  ON public.production_worker_submissions(batch_id);
CREATE INDEX idx_worker_submissions_worker 
  ON public.production_worker_submissions(worker_id);

-- Trigger for updated_at
CREATE TRIGGER update_worker_submissions_updated_at
  BEFORE UPDATE ON public.production_worker_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live approval queue
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_worker_submissions;
