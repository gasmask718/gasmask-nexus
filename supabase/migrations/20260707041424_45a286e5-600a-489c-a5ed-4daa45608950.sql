CREATE TABLE IF NOT EXISTS public.bureau_response_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.funding_clients(id) ON DELETE CASCADE,
  dispute_round_id uuid REFERENCES public.funding_dispute_rounds(id) ON DELETE SET NULL,
  bureau text NOT NULL CHECK (bureau IN ('TransUnion','Equifax','Experian')),
  letter_sent_date date NOT NULL,
  certified_mail_number text,
  response_deadline_30 date GENERATED ALWAYS AS (letter_sent_date + 30) STORED,
  response_deadline_45 date GENERATED ALWAYS AS (letter_sent_date + 45) STORED,
  response_deadline_60 date GENERATED ALWAYS AS (letter_sent_date + 60) STORED,
  response_received_date date,
  response_type text CHECK (response_type IN ('deleted','verified','updated','no_response','pending')),
  response_notes text,
  escalation_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.bureau_response_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY brt_service ON public.bureau_response_tracking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY brt_auth ON public.bureau_response_tracking
  FOR ALL TO authenticated USING (true) WITH CHECK (true);