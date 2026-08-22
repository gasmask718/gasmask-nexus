ALTER TABLE public.ambassador_invites
  ADD COLUMN IF NOT EXISTS invite_request_id uuid REFERENCES public.ambassador_invite_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ambassador_invites_request
  ON public.ambassador_invites(invite_request_id) WHERE invite_request_id IS NOT NULL;