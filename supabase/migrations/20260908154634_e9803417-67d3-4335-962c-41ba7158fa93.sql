-- The pre-existing placeholder rows stored the two-letter code in `state`, so the
-- 51-state research load inserted new full-name rows instead of updating them.
-- Remove the superseded code-keyed duplicates; the full-name rows are canonical.
DELETE FROM public.icw_state_config
WHERE char_length(trim(state)) = 2
  AND upper(trim(state)) = upper(trim(coalesce(abbreviation, '')));