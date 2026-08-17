ALTER TABLE public.rental_partners DROP CONSTRAINT IF EXISTS rental_partners_user_id_fkey;

COMMENT ON COLUMN public.rental_partners.user_id IS 'UT-side auth user id of the owner. Reference only — deliberately NOT a foreign key into auth.users on this project, since the id belongs to UT''s auth, not ours (dropped 2026-08-18).';