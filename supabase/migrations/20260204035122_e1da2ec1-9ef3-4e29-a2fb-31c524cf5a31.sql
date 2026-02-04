-- Add multi-channel pricing support with hidden profit calculations
-- Invoice line items should support sale_channel + profit snapshots (internal only)

-- Add sale channel and profit snapshot fields to invoice_line_items
ALTER TABLE public.invoice_line_items
ADD COLUMN IF NOT EXISTS sale_channel TEXT DEFAULT 'retail' CHECK (sale_channel IN ('retail', 'wholesale', 'street')),
ADD COLUMN IF NOT EXISTS sale_unit TEXT DEFAULT 'box' CHECK (sale_unit IN ('box', 'unit')),
ADD COLUMN IF NOT EXISTS cost_per_unit_at_sale NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS profit_at_sale NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS units_per_box_snapshot INTEGER DEFAULT 1;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.invoice_line_items.sale_channel IS 'Pricing channel used: retail, wholesale, or street';
COMMENT ON COLUMN public.invoice_line_items.sale_unit IS 'Whether sold by box or individual unit';
COMMENT ON COLUMN public.invoice_line_items.cost_per_unit_at_sale IS 'INTERNAL ONLY: Cost snapshot at time of sale for profit calculation';
COMMENT ON COLUMN public.invoice_line_items.profit_at_sale IS 'INTERNAL ONLY: Calculated profit for this line item (never exposed to invoices)';
COMMENT ON COLUMN public.invoice_line_items.units_per_box_snapshot IS 'Units per box at time of sale for accurate profit tracking';

-- Create index for channel-based profit reporting
CREATE INDEX IF NOT EXISTS idx_invoice_line_items_sale_channel ON public.invoice_line_items(sale_channel);

-- Create a view for internal profit reporting by channel (Finance only)
CREATE OR REPLACE VIEW public.v_invoice_profit_by_channel AS
SELECT 
  ili.sale_channel,
  COUNT(DISTINCT ili.invoice_id) as invoice_count,
  SUM(ili.quantity) as total_units_sold,
  SUM(ili.total) as total_revenue,
  SUM(ili.profit_at_sale) as total_profit,
  ROUND(
    CASE WHEN SUM(ili.total) > 0 
    THEN (SUM(ili.profit_at_sale) / SUM(ili.total)) * 100 
    ELSE 0 END, 2
  ) as avg_margin_pct,
  DATE_TRUNC('month', ili.created_at) as month
FROM public.invoice_line_items ili
GROUP BY ili.sale_channel, DATE_TRUNC('month', ili.created_at)
ORDER BY month DESC, sale_channel;