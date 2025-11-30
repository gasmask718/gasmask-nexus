-- Composite index on status fields
CREATE INDEX orders_status_idx ON public.orders (order_status, payment_status);

-- Composite index on date fields
CREATE INDEX orders_dates_idx ON public.orders (placed_at, scheduled_at);

-- Composite index for business + brand + date queries
CREATE INDEX orders_business_brand_date_idx ON public.orders (business_id, brand_key, placed_at DESC);