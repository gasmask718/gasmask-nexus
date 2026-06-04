-- de-dup any existing rows with the same place_id before adding the constraint
WITH dups AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY place_id ORDER BY updated_at DESC NULLS LAST, created_at DESC) AS rn
  FROM public.territory_addresses
  WHERE place_id IS NOT NULL
)
DELETE FROM public.territory_addresses
WHERE id IN (SELECT id FROM dups WHERE rn > 1);

CREATE UNIQUE INDEX IF NOT EXISTS uq_territory_addresses_place_id
  ON public.territory_addresses(place_id)
  WHERE place_id IS NOT NULL;