
-- ============================================================
-- PHASE 4: Vendor Data Visibility & Privacy Controls
-- ============================================================

-- 1. Add customer PII columns (admin-only access)
ALTER TABLE public.marketplace_orders
  ADD COLUMN IF NOT EXISTS customer_email text,
  ADD COLUMN IF NOT EXISTS customer_phone text;

-- 2. Add RLS policy: vendors can see their own order items
CREATE POLICY "Vendors view own order items"
  ON public.marketplace_order_items
  FOR SELECT
  USING (
    wholesaler_id IN (
      SELECT id FROM wholesaler_profiles WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- 3. Create a privacy-safe vendor fulfillment view
-- Vendors see shipping address ONLY after payment is confirmed
-- Customer email/phone are NEVER exposed to vendors
CREATE OR REPLACE VIEW public.vendor_fulfillment_view
WITH (security_invoker = on) AS
SELECT
  f.id AS fulfillment_id,
  f.order_id,
  f.wholesaler_id,
  f.status AS fulfillment_status,
  f.shipping_label_url,
  f.tracking_number,
  f.carrier,
  f.items_snapshot,
  f.created_at AS fulfillment_created_at,
  f.updated_at AS fulfillment_updated_at,
  -- Order metadata (safe)
  o.payment_status,
  o.fulfillment_status AS order_fulfillment_status,
  o.subtotal,
  o.total,
  o.created_at AS order_created_at,
  -- Shipping address: ONLY visible after payment confirmed
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'name' ELSE NULL END AS ship_to_name,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'address1' ELSE NULL END AS ship_to_address1,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'address2' ELSE NULL END AS ship_to_address2,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'city' ELSE NULL END AS ship_to_city,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'state' ELSE NULL END AS ship_to_state,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'zip' ELSE NULL END AS ship_to_zip,
  CASE WHEN o.payment_status = 'paid' THEN o.shipping_address->>'country' ELSE NULL END AS ship_to_country,
  -- Dispute info (safe: category + dates only, no PII)
  o.dispute_status,
  o.dispute_reason,
  o.dispute_opened_at,
  o.dispute_resolved_at
  -- INTENTIONALLY EXCLUDED: customer_email, customer_phone, billing_address, stripe_payment_intent_id, notes
FROM public.marketplace_fulfillments f
JOIN public.marketplace_orders o ON o.id = f.order_id;

-- 4. Create a vendor-safe order items view (vendor sees only their slice)
CREATE OR REPLACE VIEW public.vendor_order_items_view
WITH (security_invoker = on) AS
SELECT
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.wholesaler_id,
  oi.qty,
  oi.price_each,
  p.product_name,
  p.images
FROM public.marketplace_order_items oi
LEFT JOIN public.products_all p ON p.id = oi.product_id
WHERE oi.wholesaler_id IN (
  SELECT id FROM wholesaler_profiles WHERE user_id = auth.uid()
)
OR has_role(auth.uid(), 'admin'::app_role);
