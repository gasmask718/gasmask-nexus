-- Add comprehensive product fields for the Create Product sheet

-- Pricing & Sales
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS bulk_discount_rules jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS taxable boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_order_qty integer DEFAULT 1;

-- Inventory & Counting
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS units_per_pack integer DEFAULT 1;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS track_inventory boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer DEFAULT 10;

-- Sales Channels
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_to_stores boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_to_wholesalers boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_to_ambassadors boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_direct boolean DEFAULT false;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS available_for_promotions boolean DEFAULT true;

-- Descriptions & Media
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS strength_level text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS flavor_notes text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS documents text[] DEFAULT '{}'::text[];

-- AI Intelligence
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS suggested_upsell_product_id uuid REFERENCES public.products(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS suggested_crosssell_product_id uuid REFERENCES public.products(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS target_store_type text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ai_notes text;

-- Compliance
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS age_restricted boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS requires_license boolean DEFAULT true;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS internal_notes text;

-- Status field (more granular than is_active)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'discontinued'));