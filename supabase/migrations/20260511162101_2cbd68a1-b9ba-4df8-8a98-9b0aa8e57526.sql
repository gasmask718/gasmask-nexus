ALTER TABLE public.store_tube_inventory
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

CREATE INDEX IF NOT EXISTS idx_sti_product_id 
ON public.store_tube_inventory(product_id);

CREATE INDEX IF NOT EXISTS idx_sti_store_product 
ON public.store_tube_inventory(store_id, product_id) 
WHERE product_id IS NOT NULL;

ALTER TABLE public.store_tube_inventory
DROP CONSTRAINT IF EXISTS store_tube_inventory_store_brand_unique;

ALTER TABLE public.store_tube_inventory
DROP CONSTRAINT IF EXISTS store_tube_inventory_unique;

ALTER TABLE public.store_tube_inventory
ADD CONSTRAINT store_tube_inventory_store_product_sim_unique
UNIQUE (store_id, product_id, is_simulation);