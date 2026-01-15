-- Create ambassador_online_sales table to track sales from promo/tracking codes
CREATE TABLE public.ambassador_online_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
  tracking_code TEXT NOT NULL,
  order_reference TEXT,
  order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_email TEXT,
  customer_name TEXT,
  product_details JSONB,
  sale_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'refunded', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ambassador_online_sales ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all online sales"
ON public.ambassador_online_sales
FOR ALL
USING (public.is_admin(auth.uid()) OR public.is_owner(auth.uid()));

CREATE POLICY "Ambassadors can view their own sales"
ON public.ambassador_online_sales
FOR SELECT
USING (
  ambassador_id IN (
    SELECT id FROM public.ambassadors WHERE user_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_ambassador_online_sales_ambassador_id ON public.ambassador_online_sales(ambassador_id);
CREATE INDEX idx_ambassador_online_sales_tracking_code ON public.ambassador_online_sales(tracking_code);
CREATE INDEX idx_ambassador_online_sales_sale_date ON public.ambassador_online_sales(sale_date);

-- Add updated_at trigger
CREATE TRIGGER update_ambassador_online_sales_updated_at
BEFORE UPDATE ON public.ambassador_online_sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();