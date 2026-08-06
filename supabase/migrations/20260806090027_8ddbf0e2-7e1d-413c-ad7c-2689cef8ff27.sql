CREATE OR REPLACE FUNCTION public.search_products_public(p_q text, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, wholesaler_id uuid, brand_id uuid, product_name text, description text, category text, images jsonb, retail_price numeric, inventory_qty integer, shipping_from_city text, shipping_from_state text, created_at timestamp with time zone, similarity real)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.wholesaler_id, p.brand_id,
         p.product_name, p.description, p.category, p.images,
         p.retail_price, p.inventory_qty,
         p.shipping_from_city, p.shipping_from_state, p.created_at,
         GREATEST(
           word_similarity(p_q, coalesce(p.product_name,'')),
           word_similarity(p_q, coalesce(p.category,'')),
           word_similarity(p_q, coalesce(p.description,'')) * 0.6
         )::real AS similarity
    FROM public.products_all p
   WHERE p.status = 'active'
     AND (
       p.product_name ILIKE '%'||p_q||'%'
       OR p.category    ILIKE '%'||p_q||'%'
       OR word_similarity(p_q, coalesce(p.product_name,'')) > 0.35
       OR word_similarity(p_q, coalesce(p.category,''))     > 0.35
       OR word_similarity(p_q, coalesce(p.description,''))  > 0.45
     )
   ORDER BY similarity DESC, p.created_at DESC
   LIMIT GREATEST(1, LEAST(p_limit, 100));
$function$;

REVOKE ALL ON FUNCTION public.search_products_public(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_products_public(text, integer) TO anon, authenticated, service_role;