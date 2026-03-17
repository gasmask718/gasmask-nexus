
ALTER TABLE public.brandaro_personalities
  ADD COLUMN IF NOT EXISTS nickname text,
  ADD COLUMN IF NOT EXISTS archetype text,
  ADD COLUMN IF NOT EXISTS inspiration_tags text[] DEFAULT '{}';
