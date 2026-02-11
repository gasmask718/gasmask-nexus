
-- Ambassador Invite Requests: governed pipeline where ambassadors REQUEST, admins APPROVE
CREATE TABLE public.ambassador_invite_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  territory text,
  justification text NOT NULL,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_by_ambassador_id uuid,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  review_notes text,
  generated_invite_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ambassador_invite_requests ENABLE ROW LEVEL SECURITY;

-- Ambassadors can insert their own requests
CREATE POLICY "Ambassadors can create their own requests"
ON public.ambassador_invite_requests
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = requested_by);

-- Ambassadors can view their own requests
CREATE POLICY "Ambassadors can view their own requests"
ON public.ambassador_invite_requests
FOR SELECT TO authenticated
USING (
  auth.uid() = requested_by
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
);

-- Admin/Owner can update any request (approve/reject)
CREATE POLICY "Admins can update requests"
ON public.ambassador_invite_requests
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'owner')
);

-- Timestamp trigger
CREATE TRIGGER update_ambassador_invite_requests_updated_at
BEFORE UPDATE ON public.ambassador_invite_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
