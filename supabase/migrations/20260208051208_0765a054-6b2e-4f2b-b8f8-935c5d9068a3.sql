
-- Phase 1: Add brand_scope column to store_notes
ALTER TABLE public.store_notes
ADD COLUMN brand_scope TEXT NULL;

-- Add index for efficient brand-scoped queries
CREATE INDEX idx_store_notes_brand_scope
ON public.store_notes (store_id, brand_scope);

-- Phase 2: Intelligent note migration - classify notes by brand keyword
-- Only classify notes that mention exactly one brand

-- Step 1: Create a temp classification view
-- GasMask keywords
UPDATE public.store_notes
SET brand_scope = 'gasmask'
WHERE brand_scope IS NULL
  AND (
    lower(note_text) LIKE '%gasmask%'
    OR lower(note_text) LIKE '%gas mask%'
    OR lower(note_text) LIKE '%gas-mask%'
  )
  AND NOT (
    lower(note_text) LIKE '%hot mama%'
    OR lower(note_text) LIKE '%hotmama%'
    OR lower(note_text) LIKE '%scalati%'
    OR lower(note_text) LIKE '%scolatti%'
    OR lower(note_text) LIKE '%hot scolatti%'
    OR lower(note_text) LIKE '%grabba%'
  );

-- Hot Mama keywords (only if no other brand mentioned)
UPDATE public.store_notes
SET brand_scope = 'hotmama'
WHERE brand_scope IS NULL
  AND (
    lower(note_text) LIKE '%hot mama%'
    OR lower(note_text) LIKE '%hotmama%'
    OR lower(note_text) LIKE '%hot-mama%'
  )
  AND NOT (
    lower(note_text) LIKE '%gasmask%'
    OR lower(note_text) LIKE '%gas mask%'
    OR lower(note_text) LIKE '%scalati%'
    OR lower(note_text) LIKE '%scolatti%'
    OR lower(note_text) LIKE '%grabba%'
  );

-- Scalati / Scolatti keywords
UPDATE public.store_notes
SET brand_scope = 'scalati'
WHERE brand_scope IS NULL
  AND (
    lower(note_text) LIKE '%scalati%'
    OR lower(note_text) LIKE '%scolatti%'
    OR lower(note_text) LIKE '%hot scolatti%'
    OR lower(note_text) LIKE '%hot scalati%'
  )
  AND NOT (
    lower(note_text) LIKE '%gasmask%'
    OR lower(note_text) LIKE '%gas mask%'
    OR lower(note_text) LIKE '%hot mama%'
    OR lower(note_text) LIKE '%hotmama%'
    OR lower(note_text) LIKE '%grabba%'
  );

-- Grabba keywords
UPDATE public.store_notes
SET brand_scope = 'grabba'
WHERE brand_scope IS NULL
  AND (
    lower(note_text) LIKE '%grabba%'
    OR lower(note_text) LIKE '%grabba r us%'
  )
  AND NOT (
    lower(note_text) LIKE '%gasmask%'
    OR lower(note_text) LIKE '%gas mask%'
    OR lower(note_text) LIKE '%hot mama%'
    OR lower(note_text) LIKE '%hotmama%'
    OR lower(note_text) LIKE '%scalati%'
    OR lower(note_text) LIKE '%scolatti%'
  );

-- Notes with NULL brand_scope after this = General (multi-brand or no brand mentioned)
