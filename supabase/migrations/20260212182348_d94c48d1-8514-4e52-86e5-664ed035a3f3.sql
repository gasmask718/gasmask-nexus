
-- Delivery tasks: assigns an invoice/order to a biker with a delivery location
CREATE TABLE public.delivery_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID REFERENCES public.invoices(id),
  store_order_id UUID REFERENCES public.store_orders(id),
  biker_id UUID REFERENCES public.bikers(id),
  assigned_by UUID,
  delivery_address TEXT NOT NULL,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  delivery_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.delivery_tasks ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage delivery tasks
CREATE POLICY "Authenticated users can view delivery tasks"
  ON public.delivery_tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create delivery tasks"
  ON public.delivery_tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update delivery tasks"
  ON public.delivery_tasks FOR UPDATE
  TO authenticated
  USING (true);

-- Timestamp trigger
CREATE TRIGGER update_delivery_tasks_updated_at
  BEFORE UPDATE ON public.delivery_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for biker portal
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tasks;
