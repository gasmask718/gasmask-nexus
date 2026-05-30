-- 1. Add 'new_store' to field_entity_type enum
ALTER TYPE public.field_entity_type ADD VALUE IF NOT EXISTS 'new_store';

-- 2. Allow store_id to be NULL for new_store submissions
ALTER TABLE public.field_submissions ALTER COLUMN store_id DROP NOT NULL;