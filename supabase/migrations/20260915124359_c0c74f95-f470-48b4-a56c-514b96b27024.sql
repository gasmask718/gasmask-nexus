CREATE OR REPLACE FUNCTION public.dd_sync_product_images()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_from_images text[];
BEGIN
  IF NEW.images IS NOT NULL AND jsonb_typeof(NEW.images) = 'array' THEN
    SELECT array_agg(x) INTO v_from_images
    FROM (
      SELECT CASE
               WHEN jsonb_typeof(e) = 'string' THEN e #>> '{}'
               ELSE COALESCE(e->>'url', e->>'src')
             END AS x
      FROM jsonb_array_elements(NEW.images) e
    ) s
    WHERE x IS NOT NULL AND x <> '';
  END IF;

  IF COALESCE(array_length(NEW.image_urls, 1), 0) = 0
     AND COALESCE(array_length(v_from_images, 1), 0) > 0 THEN
    NEW.image_urls := v_from_images;
  END IF;

  IF COALESCE(array_length(v_from_images, 1), 0) = 0
     AND COALESCE(array_length(NEW.image_urls, 1), 0) > 0 THEN
    NEW.images := to_jsonb(NEW.image_urls);
  END IF;

  IF NEW.primary_image_url IS NULL AND COALESCE(array_length(NEW.image_urls, 1), 0) > 0 THEN
    NEW.primary_image_url := NEW.image_urls[1];
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS dd_sync_product_images_trg ON public.products_all;
CREATE TRIGGER dd_sync_product_images_trg
BEFORE INSERT OR UPDATE ON public.products_all
FOR EACH ROW EXECUTE FUNCTION public.dd_sync_product_images();

-- Fill-only backfill. Skips live products that would trip the shipping-data
-- gate on update (those are reported to the operator instead of silently touched).
UPDATE public.products_all
SET images = to_jsonb(image_urls)
WHERE COALESCE(array_length(image_urls, 1), 0) > 0
  AND (images IS NULL OR jsonb_typeof(images) <> 'array' OR jsonb_array_length(images) = 0)
  AND (
    COALESCE(status, '') <> 'active'
    OR (COALESCE(weight_oz, 0) > 0 AND COALESCE(length_in, 0) > 0 AND COALESCE(width_in, 0) > 0 AND COALESCE(height_in, 0) > 0)
  );