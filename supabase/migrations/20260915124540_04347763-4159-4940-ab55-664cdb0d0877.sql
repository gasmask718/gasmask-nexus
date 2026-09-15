UPDATE public.products_all p
SET image_urls = sub.urls
FROM (
  SELECT id, array_agg(u) AS urls
  FROM (
    SELECT id, e #>> '{}' AS u
    FROM public.products_all, LATERAL jsonb_array_elements(images) e
    WHERE jsonb_typeof(images) = 'array'
      AND jsonb_array_length(images) > 0
      AND COALESCE(array_length(image_urls, 1), 0) = 0
      AND jsonb_typeof(e) = 'string'
  ) x
  WHERE u IS NOT NULL AND u <> ''
  GROUP BY id
) sub
WHERE p.id = sub.id
  AND (
    COALESCE(p.status, '') <> 'active'
    OR (COALESCE(p.weight_oz,0) > 0 AND COALESCE(p.length_in,0) > 0 AND COALESCE(p.width_in,0) > 0 AND COALESCE(p.height_in,0) > 0)
  );

UPDATE public.products_all
SET primary_image_url = image_urls[1]
WHERE primary_image_url IS NULL
  AND COALESCE(array_length(image_urls, 1), 0) > 0
  AND (
    COALESCE(status, '') <> 'active'
    OR (COALESCE(weight_oz,0) > 0 AND COALESCE(length_in,0) > 0 AND COALESCE(width_in,0) > 0 AND COALESCE(height_in,0) > 0)
  );