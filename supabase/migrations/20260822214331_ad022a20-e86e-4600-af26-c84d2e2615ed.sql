CREATE TABLE public.ambassador_box_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id uuid NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  ambassador_user_id uuid NOT NULL,
  product_id uuid REFERENCES public.products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'pending',
  decline_reason text,
  created_purchase_id uuid REFERENCES public.ambassador_purchases(id),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ambassador_box_requests_quantity_positive CHECK (quantity > 0),
  CONSTRAINT ambassador_box_requests_status_check CHECK (status IN ('pending','approved','declined'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambassador_box_requests TO authenticated;
GRANT ALL ON public.ambassador_box_requests TO service_role;

ALTER TABLE public.ambassador_box_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ambassadors can view own box requests"
ON public.ambassador_box_requests FOR SELECT
USING (
  ambassador_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
);

CREATE POLICY "Ambassadors can create own box requests"
ON public.ambassador_box_requests FOR INSERT
WITH CHECK (ambassador_user_id = auth.uid());

CREATE POLICY "Staff can review box requests"
ON public.ambassador_box_requests FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'owner'::app_role)
);

CREATE TRIGGER ambassador_box_requests_updated_at
BEFORE UPDATE ON public.ambassador_box_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ambassador_box_requests_status ON public.ambassador_box_requests (status, created_at DESC);
CREATE INDEX idx_ambassador_box_requests_ambassador ON public.ambassador_box_requests (ambassador_user_id, created_at DESC);