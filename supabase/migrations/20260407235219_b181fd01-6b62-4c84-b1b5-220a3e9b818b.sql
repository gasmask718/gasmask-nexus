
CREATE TABLE public.cb_auto_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_request_id UUID NOT NULL,
  quote_id UUID NOT NULL,
  partner_id UUID NOT NULL,
  price_score NUMERIC DEFAULT 0,
  speed_score NUMERIC DEFAULT 0,
  rating_score NUMERIC DEFAULT 0,
  capacity_score NUMERIC DEFAULT 0,
  availability_score NUMERIC DEFAULT 0,
  weighted_total NUMERIC DEFAULT 0,
  is_winner BOOLEAN DEFAULT false,
  selection_reason TEXT,
  trigger_type TEXT DEFAULT 'threshold',
  partner_price NUMERIC,
  margin_applied NUMERIC,
  markup_amount NUMERIC,
  final_customer_price NUMERIC,
  scoring_weights JSONB DEFAULT '{"price":0.4,"speed":0.2,"rating":0.2,"capacity":0.1,"availability":0.1}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cb_auto_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view evaluations"
  ON public.cb_auto_evaluations FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_cb_auto_eval_request ON public.cb_auto_evaluations(booking_request_id);
CREATE INDEX idx_cb_auto_eval_winner ON public.cb_auto_evaluations(booking_request_id, is_winner) WHERE is_winner = true;
