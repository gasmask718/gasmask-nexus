-- Partner response tokens for frictionless quote submissions
CREATE TABLE public.cb_partner_response_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID NOT NULL REFERENCES public.cb_booking_requests(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL,
  secure_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  response_type TEXT, -- quoted, unavailable, alternate
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '48 hours'),
  used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT cb_prt_unique_token UNIQUE (secure_token)
);

CREATE INDEX idx_cb_prt_token ON public.cb_partner_response_tokens(secure_token);
CREATE INDEX idx_cb_prt_request ON public.cb_partner_response_tokens(booking_request_id);

ALTER TABLE public.cb_partner_response_tokens ENABLE ROW LEVEL SECURITY;

-- Public read access (needed for the response page to validate tokens)
CREATE POLICY "Anyone can read response tokens"
  ON public.cb_partner_response_tokens FOR SELECT
  USING (true);

-- Service role handles all writes (via edge functions)
CREATE POLICY "Service role can manage tokens"
  ON public.cb_partner_response_tokens FOR ALL
  USING (true)
  WITH CHECK (true);