ALTER TABLE public.ut_partner_onboarding
  DROP CONSTRAINT ut_partner_onboarding_partner_profile_id_fkey;

ALTER TABLE public.ut_partner_onboarding
  ADD CONSTRAINT ut_partner_onboarding_partner_profile_id_fkey
  FOREIGN KEY (partner_profile_id) REFERENCES public.ut_partner_profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ut_partner_onboarding_partner_profile_id ON public.ut_partner_onboarding(partner_profile_id);
CREATE INDEX IF NOT EXISTS idx_ut_partner_venue_media_space_id ON public.ut_partner_venue_media(space_id);
CREATE INDEX IF NOT EXISTS idx_ut_partner_venue_availability_space_id ON public.ut_partner_venue_availability(space_id);
CREATE INDEX IF NOT EXISTS idx_ut_partner_venue_packages_space_id ON public.ut_partner_venue_packages(space_id);