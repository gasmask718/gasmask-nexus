-- 1. Backfill slug from the first host label of demo_url
--    e.g. https://test-david-suth-1785357882915.cleaning.demo.brandarodigital.com
--         -> test-david-suth-1785357882915
UPDATE public.brandaro_demo_sites
SET slug = split_part(regexp_replace(demo_url, '^https?://', ''), '.', 1)
WHERE slug IS NULL
  AND demo_url IS NOT NULL
  AND split_part(regexp_replace(demo_url, '^https?://', ''), '.', 1) <> '';

-- 2. Any remaining NULLs (no demo_url) get a deterministic synthetic slug
UPDATE public.brandaro_demo_sites
SET slug = 'demo-' || replace(id::text, '-', '')
WHERE slug IS NULL;

-- 3. De-duplicate any collisions introduced by the backfill, keeping the oldest row intact
WITH dupes AS (
  SELECT id,
         row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS rn
  FROM public.brandaro_demo_sites
)
UPDATE public.brandaro_demo_sites s
SET slug = s.slug || '-' || substr(replace(s.id::text, '-', ''), 1, 8)
FROM dupes d
WHERE d.id = s.id AND d.rn > 1;

-- 4. Safety default so inserts that omit slug (e.g. the durable engine path)
--    cannot violate NOT NULL before that code is updated
ALTER TABLE public.brandaro_demo_sites
  ALTER COLUMN slug SET DEFAULT ('demo-' || replace(gen_random_uuid()::text, '-', ''));

ALTER TABLE public.brandaro_demo_sites
  ALTER COLUMN slug SET NOT NULL;

-- 5. Unique index — this is the public lookup key for the dynamic demo app
CREATE UNIQUE INDEX IF NOT EXISTS brandaro_demo_sites_slug_key
  ON public.brandaro_demo_sites (slug);