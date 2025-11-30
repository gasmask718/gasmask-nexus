-- Order status (universal)
CREATE TYPE order_status AS ENUM (
  'draft',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'canceled',
  'refunded'
);

-- Payment status
CREATE TYPE payment_status AS ENUM (
  'unpaid',
  'partial',
  'paid',
  'refunded',
  'chargeback'
);

-- High-level order type
CREATE TYPE order_type AS ENUM (
  'product',
  'service',
  'booking',
  'subscription',
  'application',
  'other'
);

-- How it is fulfilled
CREATE TYPE fulfillment_type AS ENUM (
  'delivery',
  'pickup',
  'shipping',
  'on_site_service',
  'virtual',
  'digital'
);

-- Where the order came from
CREATE TYPE order_channel AS ENUM (
  'web',
  'mobile',
  'admin',
  'call_center',
  'text',
  'api',
  'affiliate',
  'store_portal',
  'wholesaler_portal',
  'other'
);